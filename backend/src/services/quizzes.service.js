import { AppError } from '../errors/AppError.js';
import { quizzesRepository } from '../repositories/quizzes.repository.js';

function dbError(error) {
  if (error?.code === '23505') return new AppError(409, 'ATTEMPT_EXISTS', 'You have already started this quiz.');
  if (error?.code === '23514') return new AppError(409, 'QUIZ_LOCKED', 'This quiz can no longer be edited because an attempt exists or a quiz rule was violated.');
  if (error?.code === '42501') return new AppError(403, 'QUIZ_UNAVAILABLE', 'This quiz is closed or unavailable for your account.');
  if (error?.code === '22023') return new AppError(403, 'QUIZ_CLOSED', 'This quiz is outside its availability window.');
  if (error?.code === 'P0002') return new AppError(404, 'ATTEMPT_NOT_FOUND', 'No quiz attempt was found.');
  return new AppError(500, 'DATABASE_ERROR', 'The quiz request could not be completed.');
}

class QuizzesService {
  async course(courseId) {
    const { data, error } = await quizzesRepository.findCourse(courseId);
    if (error) throw dbError(error);
    if (!data) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
    return data;
  }
  async quiz(id) {
    const { data, error } = await quizzesRepository.findQuiz(id);
    if (error) throw dbError(error);
    if (!data) throw new AppError(404, 'QUIZ_NOT_FOUND', 'The quiz was not found.');
    return data;
  }
  async assertTeacher(courseId, profile) {
    const course = await this.course(courseId);
    if (profile.role !== 'teacher' || course.teacher_id !== profile.id) throw new AppError(403, 'FORBIDDEN', 'Only the course teacher can manage this quiz.');
    return course;
  }
  async access(courseId, profile) {
    const course = await this.course(courseId);
    if (profile.role === 'teacher' && course.teacher_id === profile.id) return course;
    if (profile.role === 'student') {
      const { data, error } = await quizzesRepository.isEnrolled(courseId, profile.id);
      if (error) throw dbError(error);
      if (data) return course;
    }
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to quizzes for this course.');
  }
  async create(courseId, input, profile) {
    await this.assertTeacher(courseId, profile);
    if (Date.parse(input.closes_at) <= Date.now()) throw new AppError(422, 'INVALID_QUIZ_WINDOW', 'The close time must be in the future.');
    const { data, error } = await quizzesRepository.insert({ ...input, course_id: courseId, created_by: profile.id, instructions: input.instructions || null });
    if (error) throw dbError(error);
    return data;
  }
  async list(courseId, filters, profile) {
    await this.access(courseId, profile);
    const { data, count, error } = await quizzesRepository.list(courseId, filters, profile.role === 'student');
    if (error) throw dbError(error);
    const quizzes = data ?? [];
    if (profile.role === 'teacher') return { data: quizzes, meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 } };
    const enriched = await Promise.all(quizzes.map(async (quiz) => {
      const { data: attempt, error: attemptError } = await quizzesRepository.findAttempt(quiz.id, profile.id);
      if (attemptError) throw dbError(attemptError);
      return { ...quiz, my_attempt: attempt ? { started_at: attempt.started_at, submitted_at: attempt.submitted_at, score: attempt.submitted_at ? attempt.score : null } : null };
    }));
    return { data: enriched, meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 } };
  }
  async saveQuestions(id, questions, profile, accessToken) {
    const quiz = await this.quiz(id);
    await this.assertTeacher(quiz.course_id, profile);
    if (quiz.is_published) throw new AppError(409, 'QUIZ_PUBLISHED', 'Unpublish the quiz before editing its questions.');
    const { count, error: countError } = await quizzesRepository.countAttempts(id);
    if (countError) throw dbError(countError);
    if (count) throw new AppError(409, 'QUIZ_HAS_ATTEMPTS', 'Questions cannot be changed after a student has started the quiz.');
    const { data, error } = await quizzesRepository.saveQuestions(id, questions, accessToken);
    if (error) throw dbError(error);
    return { data, total_marks: (data ?? []).reduce((sum, item) => sum + Number(item.marks), 0) };
  }
  async getQuestions(id, profile) {
    const quiz = await this.quiz(id);
    await this.assertTeacher(quiz.course_id, profile);
    const { data, error } = await quizzesRepository.teacherQuestions(id);
    if (error) throw dbError(error);
    return data ?? [];
  }
  async publish(id, isPublished, profile) {
    const quiz = await this.quiz(id);
    await this.assertTeacher(quiz.course_id, profile);
    if (isPublished) {
      const { count, error } = await quizzesRepository.countQuestions(id);
      if (error) throw dbError(error);
      if (!count) throw new AppError(422, 'QUIZ_NEEDS_QUESTIONS', 'Add at least one question before publishing.');
    }
    const { data, error } = await quizzesRepository.update(id, { is_published: isPublished });
    if (error) throw dbError(error);
    return data;
  }
  async start(id, profile, token) {
    const quiz = await this.quiz(id);
    if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'Only students can attempt quizzes.');
    const { data: attempt, error } = await quizzesRepository.start(id, token);
    if (error) throw dbError(error);
    const { data: questions, error: questionsError } = await quizzesRepository.studentQuestions(id);
    if (questionsError) throw dbError(questionsError);
    const deadline = new Date(Math.min(Date.parse(attempt.started_at) + quiz.duration_minutes * 60_000, Date.parse(quiz.closes_at))).toISOString();
    return { attempt: { id: attempt.id, started_at: attempt.started_at, deadline, answers: attempt.answers }, questions };
  }
  async attempt(id, answers, profile, token) {
    const quiz = await this.quiz(id);
    if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'Only students can save quiz answers.');
    const { data: attempt, error: attemptError } = await quizzesRepository.findAttempt(id, profile.id);
    if (attemptError) throw dbError(attemptError);
    if (!attempt || attempt.submitted_at) throw new AppError(409, 'ATTEMPT_CLOSED', 'This quiz attempt is already closed.');
    const { data: questions, error: questionError } = await quizzesRepository.studentQuestions(id);
    if (questionError) throw dbError(questionError);
    const allowed = new Map((questions ?? []).map((question) => [question.id, question.options.length]));
    for (const [questionId, optionIndex] of Object.entries(answers)) {
      if (!allowed.has(questionId) || optionIndex >= allowed.get(questionId)) throw new AppError(422, 'INVALID_ANSWER', 'One or more answers do not match this quiz.');
    }
    const { data, error } = await quizzesRepository.save(id, answers, token);
    if (error) throw dbError(error);
    const deadline = new Date(Math.min(Date.parse(attempt.started_at) + quiz.duration_minutes * 60_000, Date.parse(quiz.closes_at))).toISOString();
    return { saved_at: new Date().toISOString(), deadline, answer_count: Object.keys(data.answers ?? {}).length };
  }
  async submit(id, profile, token) {
    if (profile.role !== 'student') throw new AppError(403, 'FORBIDDEN', 'Only students can submit quizzes.');
    const { data, error } = await quizzesRepository.submit(id, token);
    if (error) throw dbError(error);
    const { data: marks, error: marksError } = await quizzesRepository.totalMarks(id);
    if (marksError) throw dbError(marksError);
    return { submitted_at: data.submitted_at, score: data.score, total_marks: (marks ?? []).reduce((sum, item) => sum + Number(item.marks), 0) };
  }
  async results(id, filters, profile) {
    const quiz = await this.quiz(id);
    await this.assertTeacher(quiz.course_id, profile);
    const [{ data, count, error }, { data: marks, error: marksError }] = await Promise.all([
      quizzesRepository.listAttempts(id, filters), quizzesRepository.totalMarks(id),
    ]);
    if (error || marksError) throw dbError(error || marksError);
    const totalMarks = (marks ?? []).reduce((sum, item) => sum + Number(item.marks), 0);
    return { data: (data ?? []).map(({ answers, ...attempt }) => ({ ...attempt, total_marks: totalMarks })), meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 } };
  }
}
export const quizzesService = new QuizzesService();
