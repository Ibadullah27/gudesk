import { supabaseAdmin } from '../lib/supabase.js';

export const dashboardRepository = {
  async student(profileId) {
    const { data: enrollments, error: enrollmentError } = await supabaseAdmin.from('enrollments')
      .select('course_id,course:courses!enrollments_course_id_fkey(id,code,title)').eq('student_id', profileId);
    if (enrollmentError) return { error: enrollmentError };
    const courseIds = (enrollments ?? []).map((row) => row.course_id);
    if (!courseIds.length) return { courses: [], assignments: [], submissions: [], quizzes: [], attempts: [], error: null };
    const [{ data: assignments, error: assignmentError }, { data: quizzes, error: quizError }] = await Promise.all([
      supabaseAdmin.from('assignments').select('id,course_id,title,due_at').in('course_id', courseIds),
      supabaseAdmin.from('quizzes').select('id,course_id,title,closes_at').in('course_id', courseIds).eq('is_published', true),
    ]);
    if (assignmentError || quizError) return { error: assignmentError || quizError };
    const assignmentIds = (assignments ?? []).map((row) => row.id);
    const quizIds = (quizzes ?? []).map((row) => row.id);
    const [submissionsResult, attemptsResult] = await Promise.all([
      assignmentIds.length ? supabaseAdmin.from('submissions').select('assignment_id').eq('student_id', profileId).in('assignment_id', assignmentIds) : Promise.resolve({ data: [], error: null }),
      quizIds.length ? supabaseAdmin.from('quiz_attempts').select('quiz_id,submitted_at').eq('student_id', profileId).in('quiz_id', quizIds) : Promise.resolve({ data: [], error: null }),
    ]);
    return { courses: enrollments, assignments, submissions: submissionsResult.data, quizzes, attempts: attemptsResult.data, error: submissionsResult.error || attemptsResult.error };
  },
  async teacher(profileId) {
    const { data: courses, error } = await supabaseAdmin.from('courses').select('id,code,title').eq('teacher_id', profileId);
    if (error) return { error };
    const courseIds = (courses ?? []).map((course) => course.id);
    if (!courseIds.length) return { courses: [], assignments: [], ungraded_count: 0, error: null };
    const { data: assignments, error: assignmentError } = await supabaseAdmin.from('assignments')
      .select('id,course_id,title,due_at').in('course_id', courseIds);
    if (assignmentError) return { error: assignmentError };
    const assignmentIds = (assignments ?? []).map((row) => row.id);
    if (!assignmentIds.length) return { courses, assignments, ungraded_count: 0, error: null };
    const { count, error: submissionError } = await supabaseAdmin.from('submissions')
      .select('id', { count: 'exact', head: true }).in('assignment_id', assignmentIds).is('marks_obtained', null);
    return { courses, assignments, ungraded_count: count ?? 0, error: submissionError };
  },
  async admin() {
    const [users, courses, complaints] = await Promise.all([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    return { users: users.count ?? 0, courses: courses.count ?? 0, open_complaints: complaints.count ?? 0, error: users.error || courses.error || complaints.error };
  },
};
