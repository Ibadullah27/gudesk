import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const fields = 'id,course_id,sender_id,body,created_at';
export const chatRepository = {
  findCourse(id) { return supabaseAdmin.from('courses').select('id,teacher_id,title,code').eq('id', id).maybeSingle(); },
  isEnrolled(courseId, studentId) { return supabaseAdmin.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle(); },
  async list(courseId, before, token) {
    let query = createUserClient(token).from('chat_messages').select(fields).eq('course_id', courseId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    if (before) query = query.lt('created_at', before);
    return query;
  },
  create(courseId, senderId, body, token) {
    return createUserClient(token).from('chat_messages').insert({ course_id: courseId, sender_id: senderId, body }).select(fields).single();
  },
  findMessage(id) { return supabaseAdmin.from('chat_messages').select(fields).eq('id', id).maybeSingle(); },
  delete(id, token) { return createUserClient(token).from('chat_messages').delete().eq('id', id).select('id').maybeSingle(); },
  async senderNames(ids) {
    if (!ids.length) return { data: [], error: null };
    return supabaseAdmin.from('profiles').select('id,full_name').in('id', ids);
  },
};
