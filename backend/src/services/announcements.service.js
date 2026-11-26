import { AppError } from '../errors/AppError.js';
import { announcementsRepository } from '../repositories/announcements.repository.js';

function dbError(error) {
  if (error?.code === '23503') return new AppError(422, 'INVALID_COURSE', 'The selected course does not exist.');
  if (error?.code === '42501') return new AppError(403, 'FORBIDDEN', 'You do not have permission to manage this announcement.');
  return new AppError(500, 'DATABASE_ERROR', 'The announcement request could not be completed.');
}

class AnnouncementsService {
  async list({ page, pageSize }, profile, token) {
    const { data, count, error } = await announcementsRepository.list(page, pageSize, token);
    if (error) throw dbError(error);
    const entries = data ?? [];
    const [authorsResult, coursesResult] = await announcementsRepository.enrich(
      [...new Set(entries.map((row) => row.author_id))],
      [...new Set(entries.map((row) => row.course_id).filter(Boolean))],
    );
    if (authorsResult.error || coursesResult.error) throw dbError(authorsResult.error || coursesResult.error);
    const authors = new Map((authorsResult.data ?? []).map((row) => [row.id, row.full_name]));
    const courses = new Map((coursesResult.data ?? []).map((row) => [row.id, row]));
    return {
      data: entries.map((announcement) => ({
        ...announcement,
        author_name: authors.get(announcement.author_id) ?? 'Classroom staff',
        course: announcement.course_id ? courses.get(announcement.course_id) ?? null : null,
        scope: announcement.course_id ? 'course' : 'global',
        can_edit: announcement.author_id === profile.id && ['admin', 'teacher'].includes(profile.role),
      })),
      meta: { page, pageSize, total: count ?? 0 },
    };
  }

  async assertCanPublish(courseId, profile) {
    if (!courseId) {
      if (profile.role !== 'admin') throw new AppError(403, 'GLOBAL_ANNOUNCEMENT_FORBIDDEN', 'Only administrators can post a global announcement.');
      return null;
    }
    if (profile.role === 'admin') throw new AppError(403, 'ADMIN_GLOBAL_ONLY', 'Administrators can post global announcements; course announcements are posted by the course teacher.');
    const { data: course, error } = await announcementsRepository.findCourse(courseId);
    if (error) throw dbError(error);
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'The selected course was not found.');
    if (profile.role === 'teacher' && course.teacher_id !== profile.id) throw new AppError(403, 'FORBIDDEN', 'You can only post announcements to courses you teach.');
    if (profile.role !== 'teacher') throw new AppError(403, 'FORBIDDEN', 'Only the course teacher can post a course announcement.');
    return course;
  }

  async create(input, profile, token) {
    await this.assertCanPublish(input.course_id ?? null, profile);
    const { data, error } = await announcementsRepository.create({ ...input, course_id: input.course_id ?? null }, profile.id, token);
    if (error) throw dbError(error);
    return data;
  }

  async update(id, changes, profile, token) {
    const { data: announcement, error } = await announcementsRepository.findAnnouncement(id);
    if (error) throw dbError(error);
    if (!announcement) throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'The announcement was not found.');
    if (announcement.author_id !== profile.id || !['admin', 'teacher'].includes(profile.role)) throw new AppError(403, 'FORBIDDEN', 'Only the announcement author can edit it.');
    if (profile.role === 'teacher' && announcement.course_id) await this.assertCanPublish(announcement.course_id, profile);
    const { data, error: updateError } = await announcementsRepository.update(id, changes, token);
    if (updateError) throw dbError(updateError);
    if (!data) throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'The announcement was not found.');
    return data;
  }

  async delete(id, profile, token) {
    const { data: announcement, error } = await announcementsRepository.findAnnouncement(id);
    if (error) throw dbError(error);
    if (!announcement) throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'The announcement was not found.');
    if (announcement.author_id !== profile.id || !['admin', 'teacher'].includes(profile.role)) throw new AppError(403, 'FORBIDDEN', 'Only the announcement author can delete it.');
    if (profile.role === 'teacher' && announcement.course_id) await this.assertCanPublish(announcement.course_id, profile);
    const { data, error: deleteError } = await announcementsRepository.delete(id, token);
    if (deleteError) throw dbError(deleteError);
    if (!data) throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'The announcement was not found.');
    return { deleted: true, id };
  }
}

export const announcementsService = new AnnouncementsService();
