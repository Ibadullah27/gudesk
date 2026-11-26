import { AppError } from '../errors/AppError.js';
import { dashboardRepository } from '../repositories/dashboard.repository.js';

function dashboardError() { return new AppError(500, 'DASHBOARD_UNAVAILABLE', 'Dashboard information could not be loaded.'); }
class DashboardService {
  async get(profile) {
    if (profile.role === 'admin') {
      const result = await dashboardRepository.admin();
      if (result.error) throw dashboardError();
      return { metrics: [{ label: 'Active accounts', value: result.users }, { label: 'Courses', value: result.courses }, { label: 'Open complaints', value: result.open_complaints }], deadlines: [] };
    }
    if (profile.role === 'teacher') {
      const result = await dashboardRepository.teacher(profile.id);
      if (result.error) throw dashboardError();
      const courseById = new Map((result.courses ?? []).map((course) => [course.id, course]));
      const deadlines = (result.assignments ?? []).filter((item) => Date.parse(item.due_at) > Date.now())
        .sort((a, b) => a.due_at.localeCompare(b.due_at)).slice(0, 5)
        .map((item) => ({ ...item, course: courseById.get(item.course_id) ?? null, kind: 'assignment' }));
      return { metrics: [{ label: 'Teaching courses', value: result.courses?.length ?? 0 }, { label: 'Assignments', value: result.assignments?.length ?? 0 }, { label: 'Work to grade', value: result.ungraded_count }], deadlines };
    }
    const result = await dashboardRepository.student(profile.id);
    if (result.error) throw dashboardError();
    const submissions = new Set((result.submissions ?? []).map((row) => row.assignment_id));
    const attempts = new Set((result.attempts ?? []).filter((row) => row.submitted_at).map((row) => row.quiz_id));
    const pending = (result.assignments ?? []).filter((row) => !submissions.has(row.id));
    const courseById = new Map((result.courses ?? []).map((row) => [row.course_id, row.course]));
    const deadlines = [
      ...(result.assignments ?? []).filter((row) => !submissions.has(row.id) && Date.parse(row.due_at) > Date.now()).map((row) => ({ ...row, course: courseById.get(row.course_id) ?? null, kind: 'assignment' })),
      ...(result.quizzes ?? []).filter((row) => !attempts.has(row.id) && Date.parse(row.closes_at) > Date.now()).map((row) => ({ ...row, due_at: row.closes_at, course: courseById.get(row.course_id) ?? null, kind: 'quiz' })),
    ].sort((a, b) => a.due_at.localeCompare(b.due_at)).slice(0, 5);
    return { metrics: [{ label: 'Enrolled courses', value: result.courses?.length ?? 0 }, { label: 'Assignments not submitted', value: pending.length }, { label: 'Upcoming deadlines', value: deadlines.length }], deadlines };
  }
}
export const dashboardService = new DashboardService();
