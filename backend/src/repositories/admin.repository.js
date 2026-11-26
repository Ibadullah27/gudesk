import { supabaseAdmin } from '../lib/supabase.js';

const safeSearchTerm = (value) => value.replace(/[%,().*]/g, '');

export const adminRepository = {
  async listUsers({ page, pageSize, search, role, active }) {
    let query = supabaseAdmin.from('profiles')
      .select('id,full_name,email,role,roll_no,is_active,must_change_password,created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (search) {
      const term = safeSearchTerm(search);
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,roll_no.ilike.%${term}%`);
    }
    if (role) query = query.eq('role', role);
    if (active !== undefined) query = query.eq('is_active', active === 'true');
    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    return { data, count: count ?? 0, error };
  },

  async findProfileByEmail(email) {
    return supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
  },

  async findProfileById(id) {
    return supabaseAdmin.from('profiles').select('id,role,roll_no').eq('id', id).maybeSingle();
  },

  async insertProfile(profile) {
    return supabaseAdmin.from('profiles').insert(profile)
      .select('id,full_name,email,role,roll_no,is_active,must_change_password,created_at').single();
  },

  async updateProfile(id, changes) {
    return supabaseAdmin.from('profiles').update(changes).eq('id', id)
      .select('id,full_name,email,role,roll_no,is_active,must_change_password,created_at').maybeSingle();
  },

  async findTeacher(id) {
    return supabaseAdmin.from('profiles').select('id,full_name,email,is_active')
      .eq('id', id).eq('role', 'teacher').maybeSingle();
  },

  async findCourseById(id) {
    return supabaseAdmin.from('courses').select('id,code,title,description,teacher_id,created_at').eq('id', id).maybeSingle();
  },

  async listCourses({ page, pageSize, search, role, userId }) {
    const select = 'id,code,title,description,teacher_id,created_at';
    const from = (page - 1) * pageSize;
    if (role === 'student') {
      const { data: enrollments, error: enrollmentError } = await supabaseAdmin
        .from('enrollments').select('course_id').eq('student_id', userId);
      if (enrollmentError) return { data: null, count: null, error: enrollmentError };
      const ids = (enrollments ?? []).map(({ course_id }) => course_id);
      if (!ids.length) return { data: [], count: 0, error: null };
      let query = supabaseAdmin.from('courses').select(select, { count: 'exact' }).in('id', ids).order('title');
      if (search) {
        const term = safeSearchTerm(search);
        query = query.or(`code.ilike.%${term}%,title.ilike.%${term}%`);
      }
      const result = await query.range(from, from + pageSize - 1);
      return result;
    }
    let query = supabaseAdmin.from('courses').select(select, { count: 'exact' }).order('created_at', { ascending: false });
    if (role === 'teacher') query = query.eq('teacher_id', userId);
    if (search) {
      const term = safeSearchTerm(search);
      query = query.or(`code.ilike.%${term}%,title.ilike.%${term}%`);
    }
    return query.range(from, from + pageSize - 1);
  },

  async createCourse(course) {
    return supabaseAdmin.from('courses').insert(course).select('id,code,title,description,teacher_id,created_at').single();
  },

  async updateCourse(id, course) {
    return supabaseAdmin.from('courses').update(course).eq('id', id)
      .select('id,code,title,description,teacher_id,created_at').maybeSingle();
  },

  async listTeachers() {
    return supabaseAdmin.from('profiles').select('id,full_name,email')
      .eq('role', 'teacher').eq('is_active', true).order('full_name');
  },
};
