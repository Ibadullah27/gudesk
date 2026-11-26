import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

export const gradesRepository = {
  findCourse(id) { return supabaseAdmin.from('courses').select('id,code,title,teacher_id').eq('id', id).maybeSingle(); },
  gradeSubmission(id, marks, feedback, token) {
    return createUserClient(token).rpc('grade_submission', {
      target_submission_id: id, awarded_marks: marks, teacher_feedback: feedback || null,
    });
  },
  listRoster(courseId, { page, pageSize }) {
    return supabaseAdmin.from('enrollments')
      .select('student:profiles!enrollments_student_id_fkey(id,full_name,email,roll_no)', { count: 'exact' })
      .eq('course_id', courseId).order('enrolled_at', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);
  },
  listAssignments(courseId) {
    return supabaseAdmin.from('assignments').select('id,title,total_marks,due_at').eq('course_id', courseId).order('due_at');
  },
  listPublishedQuizzes(courseId) {
    return supabaseAdmin.from('quizzes').select('id,title').eq('course_id', courseId).eq('is_published', true).order('opens_at');
  },
  listQuizQuestionMarks(quizIds) {
    if (!quizIds.length) return Promise.resolve({ data: [], error: null });
    return supabaseAdmin.from('quiz_questions').select('quiz_id,marks').in('quiz_id', quizIds);
  },
  listSubmissions(assignmentIds, studentIds) {
    if (!assignmentIds.length || !studentIds.length) return Promise.resolve({ data: [], error: null });
    return supabaseAdmin.from('submissions')
      .select('id,assignment_id,student_id,marks_obtained,feedback,graded_at,submitted_at,is_late')
      .in('assignment_id', assignmentIds).in('student_id', studentIds);
  },
  listAttempts(quizIds, studentIds) {
    if (!quizIds.length || !studentIds.length) return Promise.resolve({ data: [], error: null });
    return supabaseAdmin.from('quiz_attempts').select('quiz_id,student_id,score,submitted_at')
      .in('quiz_id', quizIds).in('student_id', studentIds);
  },
  async studentMarks(token, studentId) {
    const client = createUserClient(token);
    const enrollmentsResult = await client.from('enrollments').select('course:courses!enrollments_course_id_fkey(id,code,title)')
      .eq('student_id', studentId).order('enrolled_at', { ascending: false });
    if (enrollmentsResult.error) return { error: enrollmentsResult.error };
    const courseIds = (enrollmentsResult.data ?? []).map((row) => row.course?.id).filter(Boolean);
    const [assignmentsResult, submissionsResult, quizzesResult, attemptsResult, overviewResult] = courseIds.length ? await Promise.all([
      client.from('assignments').select('id,course_id,title,total_marks,due_at').in('course_id', courseIds).order('due_at'),
      client.from('submissions').select('assignment_id,marks_obtained,feedback,graded_at,submitted_at,is_late').eq('student_id', studentId),
      client.from('quizzes').select('id,course_id,title,opens_at,closes_at').in('course_id', courseIds).eq('is_published', true).order('opens_at'),
      client.from('quiz_attempts').select('quiz_id,started_at,submitted_at,score').eq('student_id', studentId),
      client.from('marks_overview').select('course_id,kind,item_id,title,obtained,total,graded_at').eq('student_id', studentId),
    ]) : [
      { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null },
    ];
    const error = [assignmentsResult, submissionsResult, quizzesResult, attemptsResult, overviewResult].find((result) => result.error)?.error;
    return {
      enrollments: enrollmentsResult.data,
      assignments: assignmentsResult.data,
      submissions: submissionsResult.data,
      quizzes: quizzesResult.data,
      attempts: attemptsResult.data,
      overview: overviewResult.data,
      error,
    };
  },
  async studentQuizTotals(quizIds) {
    if (!quizIds.length) return { data: [], error: null };
    const { data: quizzes, error: quizError } = await supabaseAdmin.from('quizzes').select('id,course_id').in('id', quizIds);
    if (quizError) return { data: null, error: quizError };
    const { data: questions, error } = await this.listQuizQuestionMarks(quizIds);
    if (error) return { data: null, error };
    const totals = new Map();
    for (const question of questions ?? []) totals.set(question.quiz_id, (totals.get(question.quiz_id) ?? 0) + Number(question.marks));
    return { data: (quizzes ?? []).map((quiz) => ({ ...quiz, total_marks: totals.get(quiz.id) ?? 0 })), error: null };
  },
};
