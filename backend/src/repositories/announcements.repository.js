import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const fields = 'id,course_id,author_id,title,body,created_at';
export const announcementsRepository = {
  findCourse(id) { return supabaseAdmin.from('courses').select('id,code,title,teacher_id').eq('id', id).maybeSingle(); },
  findAnnouncement(id) { return supabaseAdmin.from('announcements').select(fields).eq('id', id).maybeSingle(); },
  list(page, pageSize, token) {
    return createUserClient(token).from('announcements').select(fields, { count: 'exact' })
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
  },
  create(input, authorId, token) {
    return createUserClient(token).from('announcements').insert({ ...input, author_id: authorId }).select(fields).single();
  },
  update(id, changes, token) {
    return createUserClient(token).from('announcements').update(changes).eq('id', id).select(fields).maybeSingle();
  },
  delete(id, token) { return createUserClient(token).from('announcements').delete().eq('id', id).select('id').maybeSingle(); },
  enrich(ids, courseIds) {
    const tasks = [];
    if (ids.length) tasks.push(supabaseAdmin.from('profiles').select('id,full_name').in('id', ids));
    else tasks.push(Promise.resolve({ data: [], error: null }));
    if (courseIds.length) tasks.push(supabaseAdmin.from('courses').select('id,code,title').in('id', courseIds));
    else tasks.push(Promise.resolve({ data: [], error: null }));
    return Promise.all(tasks);
  },
};
