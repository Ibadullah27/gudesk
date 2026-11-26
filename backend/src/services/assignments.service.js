import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';
import { assignmentsRepository } from '../repositories/assignments.repository.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIME_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip',
});

function databaseError(error) {
  if (error?.code === '23505') return new AppError(409, 'CONFLICT', 'This record already exists.');
  if (error?.code === '23503') return new AppError(422, 'INVALID_REFERENCE', 'The related account or course is invalid.');
  return new AppError(500, 'DATABASE_ERROR', 'The assignment request could not be completed.');
}

function storageError() {
  return new AppError(502, 'STORAGE_UNAVAILABLE', 'File storage is temporarily unavailable. Please try again.');
}

function validateFile(file) {
  const extension = file.file_name.toLowerCase().split('.').pop();
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType || mimeType !== file.mime_type.toLowerCase()) {
    throw new AppError(422, 'UNSUPPORTED_FILE_TYPE', 'Allowed file types are PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, and ZIP.');
  }
  if (file.size_bytes < 1 || file.size_bytes > MAX_FILE_SIZE) {
    throw new AppError(422, 'FILE_SIZE_LIMIT', 'Files must be between 1 byte and 20 MB.');
  }
  return mimeType;
}

function safeName(filename) {
  const name = filename.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^[._-]+/, '').slice(0, 150);
  if (!name) throw new AppError(422, 'INVALID_FILE_NAME', 'Choose a file name with letters or numbers.');
  return name;
}

function verifyStoredFile(files, name, expectedSize, expectedMime) {
  const file = (files ?? []).find((entry) => entry.name === name);
  if (!file) throw new AppError(422, 'FILE_NOT_UPLOADED', 'Upload the file before saving it.');
  const size = Number(file.metadata?.size ?? file.metadata?.contentLength);
  const mimeType = file.metadata?.mimetype ?? file.metadata?.contentType;
  if (size !== expectedSize || (mimeType && mimeType.toLowerCase() !== expectedMime)) {
    throw new AppError(422, 'FILE_METADATA_MISMATCH', 'The uploaded file details do not match. Upload it again and retry.');
  }
}

class AssignmentsService {
  async course(courseId) {
    const { data, error } = await assignmentsRepository.findCourse(courseId);
    if (error) throw databaseError(error);
    if (!data) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
    return data;
  }

  async assignment(id) {
    const { data, error } = await assignmentsRepository.findAssignment(id);
    if (error) throw databaseError(error);
    if (!data) throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'The assignment was not found.');
    return data;
  }

  async assertTeacher(courseId, profile) {
    if (profile.role !== 'teacher') throw new AppError(403, 'FORBIDDEN', 'Only teachers can manage assignments.');
    const course = await this.course(courseId);
    if (course.teacher_id !== profile.id) throw new AppError(403, 'FORBIDDEN', 'You can only manage assignments for your own courses.');
    return course;
  }

  async assertCourseAccess(courseId, profile) {
    const course = await this.course(courseId);
    if (profile.role === 'teacher' && course.teacher_id === profile.id) return course;
    if (profile.role === 'student') {
      const { data, error } = await assignmentsRepository.isEnrolled(courseId, profile.id);
      if (error) throw databaseError(error);
      if (data) return course;
    }
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to assignments for this course.');
  }

  async assertAssignmentAccess(assignment, profile) {
    return this.assertCourseAccess(assignment.course_id, profile);
  }

  async create(courseId, input, profile) {
    await this.assertTeacher(courseId, profile);
    if (Date.parse(input.due_at) <= Date.now()) {
      throw new AppError(422, 'INVALID_DUE_DATE', 'The due date must be in the future.');
    }
    const { data, error } = await assignmentsRepository.insertAssignment({
      ...input,
      course_id: courseId,
      created_by: profile.id,
      description: input.description || null,
      attachment_path: null,
    });
    if (error) throw databaseError(error);
    return data;
  }

  async list(courseId, filters, profile) {
    await this.assertCourseAccess(courseId, profile);
    const { data: assignments, count, error } = await assignmentsRepository.listAssignments(courseId, filters);
    if (error) throw databaseError(error);
    const items = assignments ?? [];
    const { data: submissions, error: submissionsError } = items.length && profile.role === 'student'
      ? await assignmentsRepository.listSubmissionsForAssignments(items.map(({ id }) => id), profile.id)
      : { data: [], error: null };
    if (submissionsError) throw databaseError(submissionsError);
    const submissionsByAssignment = new Map((submissions ?? []).map((submission) => [submission.assignment_id, submission]));
    return {
      data: items.map((assignment) => {
        const base = { ...assignment, has_attachment: Boolean(assignment.attachment_path) };
        delete base.attachment_path;
        if (profile.role === 'student') {
          const submission = submissionsByAssignment.get(assignment.id);
          return {
            ...base,
            my_submission: submission ? {
              id: submission.id,
              submitted_at: submission.submitted_at,
              is_late: submission.is_late,
              file_name: submission.file_path?.split('/').pop()?.replace(/^[0-9a-f-]{36}-/i, '') ?? null,
              text_answer: submission.text_answer,
              marks_obtained: submission.marks_obtained,
              feedback: submission.feedback,
            } : null,
          };
        }
        return base;
      }),
      meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 },
    };
  }

  async update(id, input, profile) {
    const assignment = await this.assignment(id);
    await this.assertTeacher(assignment.course_id, profile);
    const changes = { ...input };
    let oldAttachment;
    if (Object.hasOwn(changes, 'attachment_path')) {
      oldAttachment = assignment.attachment_path;
      if (changes.attachment_path && changes.attachment_path !== oldAttachment) {
        const prefix = `${assignment.course_id}/${assignment.id}/`;
        const name = changes.attachment_path.startsWith(prefix) ? changes.attachment_path.slice(prefix.length) : '';
        if (!name || name.includes('/') || name.includes('..') || !/^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(name)) {
          throw new AppError(422, 'INVALID_FILE_PATH', 'The assignment attachment path is invalid.');
        }
        const mimeType = MIME_BY_EXTENSION[name.toLowerCase().split('.').pop()];
        if (!mimeType) throw new AppError(422, 'UNSUPPORTED_FILE_TYPE', 'The assignment attachment type is not allowed.');
        const { data: files, error } = await assignmentsRepository.listStoredFile('assignment-files', `${assignment.course_id}/${assignment.id}`, name);
        if (error) throw storageError();
        const stored = (files ?? []).find((file) => file.name === name);
        const storedSize = Number(stored?.metadata?.size ?? stored?.metadata?.contentLength);
        const storedMime = stored?.metadata?.mimetype ?? stored?.metadata?.contentType;
        if (!stored || !Number.isFinite(storedSize) || storedSize < 1 || storedSize > MAX_FILE_SIZE || (storedMime && storedMime.toLowerCase() !== mimeType)) {
          throw new AppError(422, 'FILE_NOT_UPLOADED', 'Upload a valid assignment attachment before saving it.');
        }
      }
    }
    if (!Object.keys(changes).length) throw new AppError(422, 'VALIDATION_ERROR', 'At least one field is required.');
    const { data, error } = await assignmentsRepository.updateAssignment(id, changes);
    if (error) throw databaseError(error);
    if (!data) throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'The assignment was not found.');
    if (oldAttachment && oldAttachment !== data.attachment_path) {
      const { error: removeError } = await assignmentsRepository.removeStoredFiles('assignment-files', [oldAttachment]);
      if (removeError) logger.warn({ assignmentId: id }, 'Old assignment attachment cleanup failed');
    }
    return data;
  }

  async delete(id, confirmed, profile) {
    const assignment = await this.assignment(id);
    await this.assertTeacher(assignment.course_id, profile);
    const { count, error: countError } = await assignmentsRepository.countSubmissions(id);
    if (countError) throw databaseError(countError);
    if (count && !confirmed) {
      throw new AppError(409, 'CONFIRM_DELETE', `This assignment has ${count} submission(s). Confirm deletion to continue.`, [{ field: 'submission_count', count }]);
    }
    const { data: fileRecords, error: fileError } = await assignmentsRepository.listSubmissionFiles(id);
    if (fileError) throw databaseError(fileError);
    const { data: deleted, error } = await assignmentsRepository.deleteAssignment(id);
    if (error) throw databaseError(error);
    if (!deleted) throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'The assignment was not found.');
    const attachmentPaths = [assignment.attachment_path, ...(fileRecords ?? []).map(({ file_path }) => file_path)].filter(Boolean);
    const [attachmentCleanup, submissionCleanup] = await Promise.all([
      assignmentsRepository.removeStoredFiles('assignment-files', assignment.attachment_path ? [assignment.attachment_path] : []),
      assignmentsRepository.removeStoredFiles('submissions', (fileRecords ?? []).map(({ file_path }) => file_path).filter(Boolean)),
    ]);
    if (attachmentCleanup.error || submissionCleanup.error) logger.warn({ assignmentId: id, fileCount: attachmentPaths.length }, 'Assignment storage cleanup failed');
    return { deleted: true, id, submissions_deleted: count ?? 0 };
  }

  async createAssignmentUploadUrl(id, file, profile, accessToken) {
    const assignment = await this.assignment(id);
    await this.assertTeacher(assignment.course_id, profile);
    const mimeType = validateFile(file);
    const fileName = safeName(file.file_name);
    const path = `${assignment.course_id}/${assignment.id}/${randomUUID()}-${fileName}`;
    const { data, error } = await assignmentsRepository.createUploadUrl('assignment-files', path, accessToken);
    if (error || !data?.signedUrl) throw storageError();
    return { signed_url: data.signedUrl, file_path: path, file_name: file.file_name, mime_type: mimeType, size_bytes: file.size_bytes };
  }

  async createSubmissionUploadUrl(id, file, profile, accessToken) {
    const assignment = await this.assignment(id);
    if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'Only students can submit assignment work.');
    const { data: enrollment, error: enrollmentError } = await assignmentsRepository.isEnrolled(assignment.course_id, profile.id);
    if (enrollmentError) throw databaseError(enrollmentError);
    if (!enrollment) throw new AppError(403, 'FORBIDDEN', 'You must be enrolled in the course to submit work.');
    if (Date.now() > Date.parse(assignment.due_at) && !assignment.allow_late) {
      throw new AppError(403, 'LATE_SUBMISSION_NOT_ALLOWED', 'The deadline has passed and late submissions are disabled.');
    }
    validateFile(file);
    const fileName = safeName(file.file_name);
    const path = `${assignment.id}/${profile.id}/${randomUUID()}-${fileName}`;
    const { data, error } = await assignmentsRepository.createUploadUrl('submissions', path, accessToken);
    if (error || !data?.signedUrl) throw storageError();
    return { signed_url: data.signedUrl, file_path: path, file_name: file.file_name, mime_type: file.mime_type, size_bytes: file.size_bytes };
  }

  async submit(id, input, profile, accessToken) {
    const assignment = await this.assignment(id);
    if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'Only students can submit assignment work.');
    const { data: enrollment, error: enrollmentError } = await assignmentsRepository.isEnrolled(assignment.course_id, profile.id);
    if (enrollmentError) throw databaseError(enrollmentError);
    if (!enrollment) throw new AppError(403, 'FORBIDDEN', 'You must be enrolled in the course to submit work.');
    const prefix = `${assignment.id}/${profile.id}/`;
    const storageName = input.file_path.startsWith(prefix) ? input.file_path.slice(prefix.length) : '';
    if (!storageName || storageName.includes('/') || storageName.includes('..') || !/^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(storageName)) {
      throw new AppError(422, 'INVALID_FILE_PATH', 'The submission file path is invalid. Request a new upload link and try again.');
    }
    const { data: files, error: storageFailure } = await assignmentsRepository.listStoredFile('submissions', `${assignment.id}/${profile.id}`, storageName);
    if (storageFailure) throw storageError();
    const storedFile = (files ?? []).find((file) => file.name === storageName);
    const mimeType = MIME_BY_EXTENSION[storageName.toLowerCase().split('.').pop()];
    const storedSize = Number(storedFile?.metadata?.size ?? storedFile?.metadata?.contentLength);
    const storedMime = storedFile?.metadata?.mimetype ?? storedFile?.metadata?.contentType;
    if (!storedFile || !mimeType || !Number.isFinite(storedSize) || storedSize < 1 || storedSize > MAX_FILE_SIZE || (storedMime && storedMime.toLowerCase() !== mimeType)) {
      if (storedFile) await assignmentsRepository.removeStoredFiles('submissions', [input.file_path]);
      throw new AppError(422, 'FILE_NOT_UPLOADED', 'Upload a valid submission file before submitting.');
    }
    const { data: previous, error: previousError } = await assignmentsRepository.findSubmission(id, profile.id);
    if (previousError) throw databaseError(previousError);
    const { data, error } = await assignmentsRepository.submitAssignment(id, input.file_path, input.text_answer || null, accessToken);
    if (error || !data) {
      const { error: cleanupError } = await assignmentsRepository.removeStoredFiles('submissions', [input.file_path]);
      if (cleanupError) logger.warn({ assignmentId: id, studentId: profile.id }, 'Rejected submission file cleanup failed');
      if (error?.code === '42501') throw new AppError(403, 'LATE_SUBMISSION_NOT_ALLOWED', 'The deadline has passed and late submissions are disabled.');
      if (error?.code === 'P0002') throw new AppError(403, 'FORBIDDEN', 'The submission is not allowed for this account.');
      throw databaseError(error);
    }
    if (previous?.file_path && previous.file_path !== input.file_path) {
      const { error: cleanupError } = await assignmentsRepository.removeStoredFiles('submissions', [previous.file_path]);
      if (cleanupError) logger.warn({ assignmentId: id, studentId: profile.id }, 'Previous submission file cleanup failed');
    }
    return data;
  }

  async mySubmission(id, profile) {
    const assignment = await this.assignment(id);
    await this.assertCourseAccess(assignment.course_id, profile);
    if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'Only students can view their own submission.');
    const { data, error } = await assignmentsRepository.findSubmission(id, profile.id);
    if (error) throw databaseError(error);
    if (!data) return null;
    return { ...data, file_name: data.file_path?.split('/').pop()?.replace(/^[0-9a-f-]{36}-/i, '') ?? null };
  }

  async submissions(id, filters, profile) {
    const assignment = await this.assignment(id);
    await this.assertTeacher(assignment.course_id, profile);
    const { data: submissions, count, error } = await assignmentsRepository.listSubmissionsForAssignment(id, filters);
    if (error) throw databaseError(error);
    return {
      data: (submissions ?? []).map(({ student, ...submission }) => {
        return {
          student,
          submission,
          status: submission.is_late ? 'late' : 'submitted',
        };
      }),
      meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 },
    };
  }

  async downloadAssignmentAttachment(id, profile, accessToken) {
    const assignment = await this.assignment(id);
    await this.assertAssignmentAccess(assignment, profile);
    if (!assignment.attachment_path) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'This assignment has no attachment.');
    const fileName = assignment.attachment_path.split('/').pop().replace(/^[0-9a-f-]{36}-/i, '');
    const { data, error } = await assignmentsRepository.createDownloadUrl('assignment-files', assignment.attachment_path, fileName, accessToken);
    if (error || !data?.signedUrl) throw storageError();
    return { signed_url: data.signedUrl, expires_in: 60 };
  }

  async downloadSubmission(id, profile, accessToken) {
    const { data: submission, error } = await assignmentsRepository.findSubmissionById(id);
    if (error) throw databaseError(error);
    if (!submission) throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'The submission was not found.');
    const assignment = await this.assignment(submission.assignment_id);
    if (profile.role === 'student' && submission.student_id !== profile.id) throw new AppError(403, 'FORBIDDEN', 'You can only download your own submission.');
    if (profile.role === 'teacher') await this.assertTeacher(assignment.course_id, profile);
    else if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'You do not have access to this submission.');
    if (!submission.file_path) throw new AppError(404, 'SUBMISSION_FILE_NOT_FOUND', 'This submission has no file.');
    const fileName = submission.file_path.split('/').pop().replace(/^[0-9a-f-]{36}-/i, '');
    const { data, error: signError } = await assignmentsRepository.createDownloadUrl('submissions', submission.file_path, fileName, accessToken);
    if (signError || !data?.signedUrl) throw storageError();
    return { signed_url: data.signedUrl, expires_in: 60 };
  }
}

export const assignmentsService = new AssignmentsService();
