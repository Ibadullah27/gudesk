import { AppError } from '../errors/AppError.js';
import { complaintsRepository } from '../repositories/complaints.repository.js';

function dbError(error) {
  if (error?.code === '23503') return new AppError(422, 'INVALID_COURSE', 'The selected course is not available.');
  if (error?.code === '42501') return new AppError(403, 'FORBIDDEN', 'You do not have permission to access this complaint.');
  return new AppError(500, 'DATABASE_ERROR', 'The complaint request could not be completed.');
}

class ComplaintsService {
  async enrich(data) {
    const complaints = data ?? [];
    const [peopleResult, coursesResult] = await complaintsRepository.enrich(
      [...new Set(complaints.flatMap((row) => [row.raised_by, row.resolved_by].filter(Boolean)))],
      [...new Set(complaints.map((row) => row.course_id).filter(Boolean))],
    );
    if (peopleResult.error || coursesResult.error) throw dbError(peopleResult.error || coursesResult.error);
    const people = new Map((peopleResult.data ?? []).map((person) => [person.id, person]));
    const courses = new Map((coursesResult.data ?? []).map((course) => [course.id, course]));
    return complaints.map((complaint) => ({
      ...complaint,
      complainant: people.get(complaint.raised_by) ?? null,
      resolver: complaint.resolved_by ? people.get(complaint.resolved_by) ?? null : null,
      course: complaint.course_id ? courses.get(complaint.course_id) ?? null : null,
    }));
  }

  async create(input, profile, token) {
    if (!['student', 'teacher'].includes(profile.role)) throw new AppError(403, 'FORBIDDEN', 'Administrators cannot submit complaints.');
    const { data, error } = await complaintsRepository.create(input, profile.id, token);
    if (error) throw dbError(error);
    const [complaint] = await this.enrich([data]);
    return complaint;
  }

  async mine(filters, profile, token) {
    if (!['student', 'teacher'].includes(profile.role)) throw new AppError(403, 'FORBIDDEN', 'This view is for student and teacher complaints.');
    const { data, count, error } = await complaintsRepository.listMine(profile.id, filters, token);
    if (error) throw dbError(error);
    return { data: await this.enrich(data), meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 } };
  }

  async adminList(filters, profile, token) {
    if (profile.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'Only administrators can review the complaint queue.');
    const { data, count, error } = await complaintsRepository.listAdmin(filters, token);
    if (error) throw dbError(error);
    return { data: await this.enrich(data), meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 } };
  }

  async update(id, changes, profile, token) {
    if (profile.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'Only administrators can respond to complaints.');
    const { data: current, error } = await complaintsRepository.find(id, token);
    if (error) throw dbError(error);
    if (!current) throw new AppError(404, 'COMPLAINT_NOT_FOUND', 'The complaint was not found.');
    const status = changes.status ?? current.status;
    const response = Object.hasOwn(changes, 'admin_response') ? changes.admin_response : current.admin_response;
    if (['resolved', 'rejected'].includes(status) && !response?.trim()) {
      throw new AppError(422, 'RESPONSE_REQUIRED', 'Write an admin response before resolving or rejecting a complaint.');
    }
    const update = { ...changes, updated_at: new Date().toISOString() };
    if (Object.hasOwn(changes, 'status')) update.resolved_by = ['resolved', 'rejected'].includes(status) ? profile.id : null;
    const { data, error: updateError } = await complaintsRepository.update(id, update, token);
    if (updateError) throw dbError(updateError);
    if (!data) throw new AppError(404, 'COMPLAINT_NOT_FOUND', 'The complaint was not found.');
    const [complaint] = await this.enrich([data]);
    return complaint;
  }
}
export const complaintsService = new ComplaintsService();
