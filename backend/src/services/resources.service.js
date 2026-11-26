import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { resourcesRepository } from '../repositories/resources.repository.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const EXTENSION_TYPES = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: 'application/zip',
});

function databaseError(error) {
  if (error?.code === '23505') return new AppError(409, 'RESOURCE_EXISTS', 'This file is already registered.');
  if (error?.code === '23503') return new AppError(422, 'INVALID_REFERENCE', 'The selected course or account is invalid.');
  return new AppError(500, 'DATABASE_ERROR', 'The resource request could not be completed.');
}

function storageError() {
  return new AppError(502, 'STORAGE_UNAVAILABLE', 'File storage is temporarily unavailable. Please try again.');
}

function getCanonicalMimeType(name) {
  const extension = name.toLowerCase().split('.').pop();
  return EXTENSION_TYPES[extension];
}

function validateFileMetadata(file) {
  const canonicalMime = getCanonicalMimeType(file.file_name);
  if (!canonicalMime || canonicalMime !== file.mime_type.toLowerCase()) {
    throw new AppError(422, 'UNSUPPORTED_FILE_TYPE', 'Allowed file types are PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, and ZIP.');
  }
  if (file.size_bytes < 1 || file.size_bytes > MAX_FILE_SIZE) {
    throw new AppError(422, 'FILE_SIZE_LIMIT', 'Files must be between 1 byte and 20 MB.');
  }
  return canonicalMime;
}

function safeStorageName(filename) {
  const safe = filename.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^[._-]+/, '').slice(0, 150);
  if (!safe) throw new AppError(422, 'INVALID_FILE_NAME', 'Choose a file name with letters or numbers.');
  return safe;
}

class ResourcesService {
  async getCourse(courseId) {
    const { data: course, error } = await resourcesRepository.findCourse(courseId);
    if (error) throw databaseError(error);
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
    return course;
  }

  async assertCourseAccess(courseId, profile) {
    const course = await this.getCourse(courseId);
    if (profile.role === 'admin') return course;
    if (profile.role === 'teacher' && course.teacher_id === profile.id) return course;
    if (profile.role === 'student') {
      const { data, error } = await resourcesRepository.isEnrolled(courseId, profile.id);
      if (error) throw databaseError(error);
      if (data) return course;
    }
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to resources for this course.');
  }

  async createUploadUrl(courseId, file, profile, accessToken) {
    if (profile.role !== 'teacher') throw new AppError(403, 'FORBIDDEN', 'Only the course teacher can upload resources.');
    const course = await this.getCourse(courseId);
    if (course.teacher_id !== profile.id) throw new AppError(403, 'FORBIDDEN', 'You can only upload to your own courses.');
    const mimeType = validateFileMetadata(file);
    const storageName = safeStorageName(file.file_name);
    const filePath = `${courseId}/${randomUUID()}-${storageName}`;
    const { data, error } = await resourcesRepository.createUploadUrl(filePath, accessToken);
    if (error || !data?.signedUrl || !data?.token) throw storageError();
    return {
      file_path: filePath,
      signed_url: data.signedUrl,
      mime_type: mimeType,
      file_name: file.file_name,
      size_bytes: file.size_bytes,
      max_size_bytes: MAX_FILE_SIZE,
    };
  }

  async createResource(courseId, input, profile) {
    if (profile.role !== 'teacher') throw new AppError(403, 'FORBIDDEN', 'Only the course teacher can register resources.');
    const course = await this.getCourse(courseId);
    if (course.teacher_id !== profile.id) throw new AppError(403, 'FORBIDDEN', 'You can only register resources in your own courses.');
    const mimeType = validateFileMetadata(input);
    const expectedPrefix = `${courseId}/`;
    const storageName = input.file_path.startsWith(expectedPrefix) ? input.file_path.slice(expectedPrefix.length) : '';
    if (!storageName || storageName.includes('/') || storageName.includes('..') || !/^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(storageName)) {
      throw new AppError(422, 'INVALID_FILE_PATH', 'The uploaded file path is invalid. Request a new upload link and try again.');
    }
    const { data: existing, error: duplicateError } = await resourcesRepository.findByPath(input.file_path);
    if (duplicateError) throw databaseError(duplicateError);
    if (existing) throw new AppError(409, 'RESOURCE_EXISTS', 'This file is already registered.');

    const { data: files, error: listError } = await resourcesRepository.findStorageObject(courseId, storageName);
    if (listError) throw storageError();
    const storedFile = (files ?? []).find((file) => file.name === storageName);
    if (!storedFile) throw new AppError(422, 'FILE_NOT_UPLOADED', 'The file upload was not found. Upload the file before saving it.');
    const actualSize = Number(storedFile.metadata?.size ?? storedFile.metadata?.contentLength);
    const actualMime = storedFile.metadata?.mimetype ?? storedFile.metadata?.contentType;
    if (actualSize !== input.size_bytes || (actualMime && actualMime.toLowerCase() !== mimeType)) {
      throw new AppError(422, 'FILE_METADATA_MISMATCH', 'The uploaded file details do not match. Upload it again and retry.');
    }

    const { data, error } = await resourcesRepository.insert({
      course_id: courseId,
      uploaded_by: profile.id,
      title: input.title,
      description: input.description || null,
      file_path: input.file_path,
      file_name: input.file_name,
      mime_type: mimeType,
      size_bytes: actualSize,
    });
    if (error) throw databaseError(error);
    return data;
  }

  async list(courseId, filters, profile) {
    await this.assertCourseAccess(courseId, profile);
    const { data, count, error } = await resourcesRepository.list(courseId, filters);
    if (error) throw databaseError(error);
    return { data: data ?? [], meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 } };
  }

  async createDownloadUrl(resourceId, profile, accessToken) {
    const { data: resource, error } = await resourcesRepository.findById(resourceId);
    if (error) throw databaseError(error);
    if (!resource) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The resource was not found.');
    await this.assertCourseAccess(resource.course_id, profile);
    const { data, error: storageFailure } = await resourcesRepository.createDownloadUrl(resource.file_path, resource.file_name, accessToken);
    if (storageFailure || !data?.signedUrl) throw storageError();
    return { signed_url: data.signedUrl, expires_in: 60 };
  }

  async delete(resourceId, profile) {
    const { data: resource, error } = await resourcesRepository.findById(resourceId);
    if (error) throw databaseError(error);
    if (!resource) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The resource was not found.');
    const course = await this.getCourse(resource.course_id);
    if (profile.role !== 'teacher' || course.teacher_id !== profile.id || resource.uploaded_by !== profile.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only delete resources that you uploaded to your own course.');
    }
    const { error: storageFailure } = await resourcesRepository.removeStorageObject(resource.file_path);
    if (storageFailure) throw storageError();
    const { data: deleted, error: deleteError } = await resourcesRepository.delete(resourceId);
    if (deleteError) throw databaseError(deleteError);
    if (!deleted) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The resource was not found.');
    return { deleted: true, id: resourceId };
  }
}

export const resourcesService = new ResourcesService();
