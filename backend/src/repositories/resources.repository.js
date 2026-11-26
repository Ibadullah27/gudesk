import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const resourceFields = 'id,course_id,uploaded_by,title,description,file_path,file_name,mime_type,size_bytes,created_at';

export const resourcesRepository = {
  async findCourse(id) {
    return supabaseAdmin.from('courses').select('id,teacher_id,title,code').eq('id', id).maybeSingle();
  },

  async isEnrolled(courseId, studentId) {
    return supabaseAdmin.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle();
  },

  async list(courseId, { page, pageSize }) {
    const offset = (page - 1) * pageSize;
    return supabaseAdmin.from('resources').select(resourceFields, { count: 'exact' })
      .eq('course_id', courseId).order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
  },

  async findById(id) {
    return supabaseAdmin.from('resources').select(resourceFields).eq('id', id).maybeSingle();
  },

  async findByPath(path) {
    return supabaseAdmin.from('resources').select('id').eq('file_path', path).maybeSingle();
  },

  async insert(resource) {
    return supabaseAdmin.from('resources').insert(resource).select(resourceFields).single();
  },

  async delete(id) {
    return supabaseAdmin.from('resources').delete().eq('id', id).select('id').maybeSingle();
  },

  async findStorageObject(courseId, filename) {
    return supabaseAdmin.storage.from('resources').list(courseId, { search: filename, limit: 100 });
  },

  async createUploadUrl(path, accessToken) {
    return createUserClient(accessToken).storage.from('resources').createSignedUploadUrl(path, { upsert: false });
  },

  async createDownloadUrl(path, filename, accessToken) {
    return createUserClient(accessToken).storage.from('resources').createSignedUrl(path, 60, { download: filename });
  },

  async removeStorageObject(path) {
    return supabaseAdmin.storage.from('resources').remove([path]);
  },
};
