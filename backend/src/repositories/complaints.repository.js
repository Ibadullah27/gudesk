import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const fields = 'id,raised_by,course_id,category,subject,description,status,admin_response,resolved_by,created_at,updated_at';
export const complaintsRepository = {
  listMine(studentId, { page, pageSize }, token) {
    return createUserClient(token).from('complaints').select(fields, { count: 'exact' }).eq('raised_by', studentId)
      .order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  },
  listAdmin({ page, pageSize, status, category }, token) {
    let query = createUserClient(token).from('complaints').select(fields, { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    return query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  },
  create(input, userId, token) {
    return createUserClient(token).from('complaints').insert({ ...input, course_id: input.course_id ?? null, raised_by: userId })
      .select(fields).single();
  },
  find(id, token) { return createUserClient(token).from('complaints').select(fields).eq('id', id).maybeSingle(); },
  update(id, changes, token) { return createUserClient(token).from('complaints').update(changes).eq('id', id).select(fields).maybeSingle(); },
  enrich(userIds, courseIds) {
    return Promise.all([
      userIds.length ? supabaseAdmin.from('profiles').select('id,full_name,role,roll_no').in('id', userIds) : Promise.resolve({ data: [], error: null }),
      courseIds.length ? supabaseAdmin.from('courses').select('id,code,title').in('id', courseIds) : Promise.resolve({ data: [], error: null }),
    ]);
  },
};
