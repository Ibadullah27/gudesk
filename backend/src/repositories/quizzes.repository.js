import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const quizFields = 'id,course_id,created_by,title,instructions,duration_minutes,opens_at,closes_at,is_published,created_at';
export const quizzesRepository = {
  findCourse(id) { return supabaseAdmin.from('courses').select('id,teacher_id').eq('id', id).maybeSingle(); },
  findQuiz(id) { return supabaseAdmin.from('quizzes').select(quizFields).eq('id', id).maybeSingle(); },
  list(courseId, { page, pageSize }, isStudent) {
    let query = supabaseAdmin.from('quizzes').select(quizFields, { count: 'exact' }).eq('course_id', courseId);
    if (isStudent) query = query.eq('is_published', true);
    return query.order('opens_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  },
  insert(data) { return supabaseAdmin.from('quizzes').insert(data).select(quizFields).single(); },
  update(id, changes) { return supabaseAdmin.from('quizzes').update(changes).eq('id', id).select(quizFields).maybeSingle(); },
  saveQuestions(id, questions, token) { return createUserClient(token).rpc('save_quiz_questions', { target_quiz_id: id, new_questions: questions }); },
  teacherQuestions(id) { return supabaseAdmin.from('quiz_questions').select('id,quiz_id,position,question_text,options,correct_index,marks').eq('quiz_id', id).order('position'); },
  studentQuestions(id) { return supabaseAdmin.from('quiz_questions').select('id,position,question_text,options,marks').eq('quiz_id', id).order('position'); },
  countQuestions(id) { return supabaseAdmin.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', id); },
  totalMarks(id) { return supabaseAdmin.from('quiz_questions').select('marks').eq('quiz_id', id); },
  countAttempts(id) { return supabaseAdmin.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', id); },
  findAttempt(id, studentId) { return supabaseAdmin.from('quiz_attempts').select('id,quiz_id,student_id,started_at,submitted_at,answers,score').eq('quiz_id', id).eq('student_id', studentId).maybeSingle(); },
  listAttempts(id, { page, pageSize }) {
    return supabaseAdmin.from('quiz_attempts')
      .select('id,quiz_id,student_id,started_at,submitted_at,score,student:profiles!quiz_attempts_student_id_fkey(id,full_name,roll_no)', { count: 'exact' })
      .eq('quiz_id', id).order('submitted_at', { ascending: false, nullsFirst: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
  },
  isEnrolled(courseId, studentId) { return supabaseAdmin.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle(); },
  start(id, token) { return createUserClient(token).rpc('start_quiz_attempt', { target_quiz_id: id }); },
  save(id, answers, token) { return createUserClient(token).rpc('save_quiz_attempt', { target_quiz_id: id, new_answers: answers }); },
  submit(id, token) { return createUserClient(token).rpc('submit_quiz_attempt', { target_quiz_id: id }); },
};
