import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';
import { profileRepository } from '../repositories/profile.repository.js';

const MIME_BY_EXTENSION = Object.freeze({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' });
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
function dbError(error) {
  if (error?.code === '23505') return new AppError(409, 'CONTACT_EMAIL_IN_USE', 'That contact email is already attached to another account.');
  if (error?.code === '42501') return new AppError(403, 'FORBIDDEN', 'You can only edit your own profile.');
  return new AppError(500, 'DATABASE_ERROR', 'The profile request could not be completed.');
}
function storageError() { return new AppError(502, 'STORAGE_UNAVAILABLE', 'Profile photo storage is temporarily unavailable.'); }

class ProfileService {
  async view(profile, token) {
    const [{ data, error }, coursesResult] = await Promise.all([
      profileRepository.find(profile.id), profileRepository.courses(profile),
    ]);
    if (error || coursesResult.error) throw dbError(error || coursesResult.error);
    if (!data) throw new AppError(404, 'PROFILE_NOT_FOUND', 'The profile was not found.');
    let photoUrl = null;
    if (data.avatar_path) {
      const { data: signed, error: signedError } = await profileRepository.signAvatar(data.avatar_path, token);
      if (signedError) throw storageError();
      photoUrl = signed.signedUrl;
    }
    const { avatar_path, ...safeProfile } = data;
    const courseList = coursesResult.data ?? [];
    return {
      profile: { ...safeProfile, photo_url: photoUrl },
      role_info: {
        label: profile.role === 'student' ? 'Enrolled courses' : profile.role === 'teacher' ? 'Taught courses' : 'Account access',
        courses: courseList,
      },
    };
  }

  async update(changes, profile, token) {
    const payload = { ...changes };
    if (Object.hasOwn(payload, 'contact_email')) payload.contact_email = payload.contact_email?.trim() || null;
    if (Object.hasOwn(payload, 'phone')) payload.phone = payload.phone?.trim() || null;
    const { data, error } = await profileRepository.update(profile.id, payload, token);
    if (error) throw dbError(error);
    return data;
  }

  async avatarUpload(file, profile, token) {
    const extension = file.file_name.toLowerCase().split('.').pop();
    if (MIME_BY_EXTENSION[extension] !== file.mime_type) throw new AppError(422, 'UNSUPPORTED_FILE_TYPE', 'Use a JPG, PNG, or WebP image.');
    if (file.size_bytes > MAX_AVATAR_BYTES) throw new AppError(422, 'FILE_SIZE_LIMIT', 'Profile photos must be 5 MB or smaller.');
    const path = `${profile.id}/${randomUUID()}.${extension}`;
    const { data, error } = await profileRepository.createAvatarUploadUrl(path, token);
    if (error || !data?.signedUrl || !data?.token) throw storageError();
    return { signed_url: data.signedUrl, upload_token: data.token, file_path: path, mime_type: file.mime_type, expires_in: 60 };
  }

  async saveAvatar(path, profile, token) {
    const prefix = `${profile.id}/`;
    const filename = path.startsWith(prefix) ? path.slice(prefix.length) : '';
    if (!filename || filename.includes('/') || filename.includes('..') || !/^[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i.test(filename)) {
      throw new AppError(422, 'INVALID_FILE_PATH', 'The profile photo path is invalid. Request a new upload link.');
    }
    const { data: files, error: storageFailure } = await profileRepository.listAvatar(profile.id, filename);
    if (storageFailure) throw storageError();
    const file = (files ?? []).find((item) => item.name === filename);
    const size = Number(file?.metadata?.size ?? file?.metadata?.contentLength);
    const mime = file?.metadata?.mimetype ?? file?.metadata?.contentType;
    const expectedMime = MIME_BY_EXTENSION[filename.split('.').pop().toLowerCase()];
    if (!file || size < 1 || size > MAX_AVATAR_BYTES || (mime && mime.toLowerCase() !== expectedMime)) {
      throw new AppError(422, 'FILE_NOT_UPLOADED', 'Upload a valid JPG, PNG, or WebP image before saving it.');
    }
    const { data: old, error: oldError } = await profileRepository.find(profile.id);
    if (oldError) throw dbError(oldError);
    const { data, error } = await profileRepository.update(profile.id, { avatar_path: path }, token);
    if (error) throw dbError(error);
    if (old?.avatar_path && old.avatar_path !== path) {
      const { error: cleanupError } = await profileRepository.removeAvatar(old.avatar_path, token);
      if (cleanupError) logger.warn({ profileId: profile.id }, 'Old profile avatar cleanup failed');
    }
    return { avatar_path: data.avatar_path };
  }

  async removeAvatar(profile, token) {
    const { data: old, error: findError } = await profileRepository.find(profile.id);
    if (findError) throw dbError(findError);
    if (!old?.avatar_path) return { removed: false };
    const { error } = await profileRepository.update(profile.id, { avatar_path: null }, token);
    if (error) throw dbError(error);
    const { error: cleanupError } = await profileRepository.removeAvatar(old.avatar_path, token);
    if (cleanupError) logger.warn({ profileId: profile.id }, 'Profile avatar cleanup failed');
    return { removed: true };
  }
}
export const profileService = new ProfileService();
