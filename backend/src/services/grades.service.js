import { AppError } from '../errors/AppError.js';
import { gradesRepository } from '../repositories/grades.repository.js';

function dbError(error) {
  if (error?.code === '22023') return new AppError(422, 'INVALID_GRADE', 'Marks must be between zero and the assignment total.');
  if (error?.code === 'P0002') return new AppError(404, 'SUBMISSION_NOT_FOUND', 'The submission was not found or is outside your course.');
  if (error?.code === '42501') return new AppError(403, 'FORBIDDEN', 'You cannot grade this submission.');
  return new AppError(500, 'DATABASE_ERROR', 'The marks request could not be completed.');
}

function assessmentRow(assessment, value, kind) {
  const status = kind === 'assignment'
    ? value ? value.marks_obtained === null ? 'pending' : 'graded' : 'not_submitted'
    : value ? value.submitted_at ? 'graded' : 'in_progress' : 'not_started';
  const obtained = status === 'graded' ? Number(kind === 'assignment' ? value.marks_obtained : value.score) : null;
  return {
    id: assessment.id,
    kind,
    title: assessment.title,
    total: Number(kind === 'assignment' ? assessment.total_marks : assessment.total_marks),
    obtained,
    status,
    feedback: kind === 'assignment' ? value?.feedback ?? null : null,
    graded_at: kind === 'assignment' ? value?.graded_at ?? null : value?.submitted_at ?? null,
    submitted_at: kind === 'assignment' ? value?.submitted_at ?? null : value?.started_at ?? null,
    is_late: kind === 'assignment' ? value?.is_late ?? false : false,
  };
}

class GradesService {
  async teacherCourse(courseId, profile) {
    const { data, error } = await gradesRepository.findCourse(courseId);
    if (error) throw dbError(error);
    if (!data) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
    if (profile.role !== 'teacher' || data.teacher_id !== profile.id) throw new AppError(403, 'FORBIDDEN', 'Only the course teacher can view its gradebook.');
    return data;
  }

  async grade(submissionId, input, profile, accessToken) {
    if (profile.role !== 'teacher') throw new AppError(403, 'FORBIDDEN', 'Only teachers can grade submissions.');
    const { data, error } = await gradesRepository.gradeSubmission(submissionId, input.marks_obtained, input.feedback, accessToken);
    if (error) throw dbError(error);
    return { id: data.id, marks_obtained: data.marks_obtained, feedback: data.feedback, graded_at: data.graded_at, graded_by: data.graded_by };
  }

  async gradebook(courseId, filters, profile) {
    const course = await this.teacherCourse(courseId, profile);
    const [rosterResult, assignmentsResult, quizzesResult] = await Promise.all([
      gradesRepository.listRoster(courseId, filters), gradesRepository.listAssignments(courseId), gradesRepository.listPublishedQuizzes(courseId),
    ]);
    if (rosterResult.error || assignmentsResult.error || quizzesResult.error) throw dbError(rosterResult.error || assignmentsResult.error || quizzesResult.error);
    const students = (rosterResult.data ?? []).map((row) => row.student).filter(Boolean);
    const assignments = assignmentsResult.data ?? [];
    const quizzes = quizzesResult.data ?? [];
    const [questionResult, submissionsResult, attemptsResult] = await Promise.all([
      gradesRepository.listQuizQuestionMarks(quizzes.map(({ id }) => id)),
      gradesRepository.listSubmissions(assignments.map(({ id }) => id), students.map(({ id }) => id)),
      gradesRepository.listAttempts(quizzes.map(({ id }) => id), students.map(({ id }) => id)),
    ]);
    if (questionResult.error || submissionsResult.error || attemptsResult.error) throw dbError(questionResult.error || submissionsResult.error || attemptsResult.error);
    const quizTotals = new Map();
    for (const question of questionResult.data ?? []) quizTotals.set(question.quiz_id, (quizTotals.get(question.quiz_id) ?? 0) + Number(question.marks));
    const assessments = [
      ...assignments.map((row) => ({ ...row, kind: 'assignment', total: Number(row.total_marks) })),
      ...quizzes.map((row) => ({ ...row, kind: 'quiz', total: quizTotals.get(row.id) ?? 0 })),
    ];
    const submissionMap = new Map((submissionsResult.data ?? []).map((row) => [`${row.student_id}:${row.assignment_id}`, row]));
    const attemptMap = new Map((attemptsResult.data ?? []).map((row) => [`${row.student_id}:${row.quiz_id}`, row]));
    const rows = students.map((student) => {
      const grades = assessments.map((item) => assessmentRow(item,
        item.kind === 'assignment' ? submissionMap.get(`${student.id}:${item.id}`) : attemptMap.get(`${student.id}:${item.id}`), item.kind));
      const graded = grades.filter(({ status }) => status === 'graded');
      const obtained = graded.reduce((sum, row) => sum + row.obtained, 0);
      const possible = graded.reduce((sum, row) => sum + row.total, 0);
      return { student, grades, summary: { obtained, possible, percentage: possible ? Math.round((obtained / possible) * 10000) / 100 : null, graded_count: graded.length } };
    });
    return { course, assessments, data: rows, meta: { ...filters, total: rosterResult.count ?? 0 } };
  }

  async studentMarks(profile, accessToken, filters) {
    if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'Only students can view student marks.');
    const result = await gradesRepository.studentMarks(accessToken, profile.id);
    if (result.error) throw dbError(result.error);
    const allCourses = (result.enrollments ?? []).filter((row) => row.course).map((row) => row.course);
    const enrollmentRows = allCourses.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);
    const courseIds = new Set(enrollmentRows.map(({ id }) => id));
    const assignments = (result.assignments ?? []).filter((row) => courseIds.has(row.course_id));
    const submissions = new Map((result.submissions ?? []).map((row) => [row.assignment_id, row]));
    const publishedQuizzes = (result.quizzes ?? []).filter((row) => courseIds.has(row.course_id));
    const attempts = new Map((result.attempts ?? []).map((row) => [row.quiz_id, row]));
    const totalsResult = await gradesRepository.studentQuizTotals(publishedQuizzes.map(({ id }) => id));
    if (totalsResult.error) throw dbError(totalsResult.error);
    const quizTotalMap = new Map((totalsResult.data ?? []).map((row) => [row.id, row.total_marks]));
    const courses = enrollmentRows.map((course) => {
      const items = [
        ...assignments.filter((row) => row.course_id === course.id).map((item) => assessmentRow(item, submissions.get(item.id), 'assignment')),
        ...publishedQuizzes.filter((row) => row.course_id === course.id).map((item) => assessmentRow({ ...item, total_marks: quizTotalMap.get(item.id) ?? 0 }, attempts.get(item.id), 'quiz')),
      ].sort((a, b) => (b.graded_at ?? b.submitted_at ?? '').localeCompare(a.graded_at ?? a.submitted_at ?? ''));
      const graded = items.filter((item) => item.status === 'graded');
      const obtained = graded.reduce((sum, item) => sum + item.obtained, 0);
      const possible = graded.reduce((sum, item) => sum + item.total, 0);
      return { ...course, items, summary: { obtained, possible, percentage: possible ? Math.round((obtained / possible) * 10000) / 100 : null, graded_count: graded.length } };
    });
    const gradedIds = new Set((result.overview ?? []).map((row) => `${row.course_id}:${row.kind}:${row.item_id}`));
    return {
      data: courses.map((course) => ({ ...course, items: course.items.filter((item) => item.status !== 'graded' || gradedIds.has(`${course.id}:${item.kind}:${item.id}`)) })),
      meta: { ...filters, total: allCourses.length },
    };
  }
}

export const gradesService = new GradesService();
