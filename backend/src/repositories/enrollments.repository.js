import { supabaseAdmin } from '../lib/supabase.js';

const safeSearch = (value) => value.replace(/[%,().*]/g, '');

export const enrollmentsRepository = {
  async findCourse(id) {
    return supabaseAdmin.from('courses').select('id,teacher_id,title,code').eq('id', id).maybeSingle();
  },

  async listStudents({ page, pageSize, search }) {
    let query = supabaseAdmin.from('profiles')
      .select('id,full_name,roll_no,is_active', { count: 'exact' })
      .eq('role', 'student').order('full_name');
    if (search) {
      const term = safeSearch(search);
      query = query.or(`full_name.ilike.%${term}%,roll_no.ilike.%${term}%`);
    }
    const offset = (page - 1) * pageSize;
    return query.range(offset, offset + pageSize - 1);
  },

  async listEnrollmentIds(courseId, studentIds) {
    return supabaseAdmin.from('enrollments').select('student_id').eq('course_id', courseId).in('student_id', studentIds);
  },

  async findActiveStudents(studentIds) {
    return supabaseAdmin.from('profiles').select('id,role,roll_no,is_active')
      .in('id', studentIds).eq('role', 'student').eq('is_active', true);
  },

  async findStudentsByRollNumbers(rollNumbers) {
    return supabaseAdmin.from('profiles').select('id,roll_no,role,is_active')
      .in('roll_no', rollNumbers).eq('role', 'student').eq('is_active', true);
  },

  async enroll(courseId, studentIds) {
    if (!studentIds.length) return { data: [], error: null };
    return supabaseAdmin.from('enrollments')
      .upsert(studentIds.map((student_id) => ({ course_id: courseId, student_id })), {
        onConflict: 'course_id,student_id', ignoreDuplicates: true,
      }).select('student_id');
  },

  async remove(courseId, studentId) {
    return supabaseAdmin.from('enrollments').delete().eq('course_id', courseId).eq('student_id', studentId)
      .select('id').maybeSingle();
  },
};
