import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const fields = 'id,full_name,email,role,roll_no,is_active,must_change_password,created_at,phone,contact_email,avatar_path';
const baseFields = 'id,full_name,email,role,roll_no,is_active,must_change_password,created_at';

export const profileRepository = {
  async find(id) {
    const res = await supabaseAdmin.from('profiles').select(fields).eq('id', id).maybeSingle();
    if (res.error && (res.error.message?.includes('does not exist') || res.error.code === '42703')) {
      const baseRes = await supabaseAdmin.from('profiles').select(baseFields).eq('id', id).maybeSingle();
      if (baseRes.data) {
        baseRes.data.phone = null;
        baseRes.data.contact_email = null;
        baseRes.data.avatar_path = null;
      }
      return baseRes;
    }
    return res;
  },
  async update(id, changes, token) {
    const res = await createUserClient(token).from('profiles').update(changes).eq('id', id).select(fields).single();
    if (res.error && (res.error.message?.includes('does not exist') || res.error.code === '42703')) {
      const { phone, contact_email, avatar_path, ...baseChanges } = changes;
      const baseRes = await createUserClient(token).from('profiles').update(baseChanges).eq('id', id).select(baseFields).single();
      if (baseRes.data) {
        baseRes.data.phone = null;
        baseRes.data.contact_email = null;
        baseRes.data.avatar_path = null;
      }
      return baseRes;
    }
    return res;
  },
  async courses(profile) {
    if (profile.role === 'admin') return { data: [], error: null };
    if (profile.role === 'teacher') return supabaseAdmin.from('courses').select('id,code,title').eq('teacher_id', profile.id).order('code');
    const { data, error } = await supabaseAdmin.from('enrollments')
      .select('course:courses!enrollments_course_id_fkey(id,code,title)')
      .eq('student_id', profile.id).order('enrolled_at', { ascending: false });
    return { data: (data ?? []).map((row) => row.course).filter(Boolean), error };
  },
  createAvatarUploadUrl(path, token) { return createUserClient(token).storage.from('avatars').createSignedUploadUrl(path, { upsert: false }); },
  signAvatar(path, token) { return createUserClient(token).storage.from('avatars').createSignedUrl(path, 60); },
  listAvatar(folder, filename) { return supabaseAdmin.storage.from('avatars').list(folder, { search: filename, limit: 100 }); },
  removeAvatar(path, token) { return createUserClient(token).storage.from('avatars').remove([path]); },
};
