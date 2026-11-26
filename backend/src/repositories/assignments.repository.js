import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const assignmentFields = 'id,course_id,created_by,title,description,attachment_path,total_marks,due_at,allow_late,created_at';
const submissionFields = 'id,assignment_id,student_id,file_path,text_answer,submitted_at,is_late,marks_obtained,feedback,graded_by,graded_at';

export const assignmentsRepository = {
  async findCourse(id) {
    return supabaseAdmin.from('courses').select('id,teacher_id,title,code').eq('id', id).maybeSingle();
  },
  async findAssignment(id) {
    return supabaseAdmin.from('assignments').select(assignmentFields).eq('id', id).maybeSingle();
  },
  async listAssignments(courseId, { page, pageSize }) {
    const offset = (page - 1) * pageSize;
    return supabaseAdmin.from('assignments').select(assignmentFields, { count: 'exact' })
      .eq('course_id', courseId).order('due_at', { ascending: true }).range(offset, offset + pageSize - 1);
  },
  async listSubmissionsForAssignments(assignmentIds, studentFilter) {
    let query = supabaseAdmin.from('submissions').select(submissionFields).in('assignment_id', assignmentIds);
    if (Array.isArray(studentFilter)) query = query.in('student_id', studentFilter);
    else if (studentFilter) query = query.eq('student_id', studentFilter);
    return query;
  },
  async insertAssignment(assignment) {
    return supabaseAdmin.from('assignments').insert(assignment).select(assignmentFields).single();
  },
  async updateAssignment(id, changes) {
    return supabaseAdmin.from('assignments').update(changes).eq('id', id).select(assignmentFields).maybeSingle();
  },
  async deleteAssignment(id) {
    return supabaseAdmin.from('assignments').delete().eq('id', id).select('id').maybeSingle();
  },
  async countSubmissions(assignmentId) {
    return supabaseAdmin.from('submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', assignmentId);
  },
  async listSubmissionsForAssignment(assignmentId, { page, pageSize }) {
    const offset = (page - 1) * pageSize;
    return supabaseAdmin.from('submissions')
      .select(`${submissionFields},student:profiles!submissions_student_id_fkey(id,full_name,roll_no)`, { count: 'exact' })
      .eq('assignment_id', assignmentId).order('submitted_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
  },
  async listSubmissionFiles(assignmentId) {
    return supabaseAdmin.from('submissions').select('file_path').eq('assignment_id', assignmentId).not('file_path', 'is', null);
  },
  async findSubmission(assignmentId, studentId) {
    return supabaseAdmin.from('submissions').select(submissionFields)
      .eq('assignment_id', assignmentId).eq('student_id', studentId).maybeSingle();
  },
  async findSubmissionById(id) {
    return supabaseAdmin.from('submissions').select(submissionFields).eq('id', id).maybeSingle();
  },
  async findStudent(id) {
    return supabaseAdmin.from('profiles').select('id,role,is_active').eq('id', id).maybeSingle();
  },
  async isEnrolled(courseId, studentId) {
    return supabaseAdmin.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle();
  },
  async submitAssignment(assignmentId, filePath, textAnswer, accessToken) {
    return createUserClient(accessToken).rpc('submit_assignment', {
      target_assignment_id: assignmentId,
      submission_file_path: filePath,
      answer_text: textAnswer || null,
    });
  },
  async createUploadUrl(bucket, path, accessToken) {
    return createUserClient(accessToken).storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
  },
  async createDownloadUrl(bucket, path, filename, accessToken) {
    return createUserClient(accessToken).storage.from(bucket).createSignedUrl(path, 60, { download: filename });
  },
  async listStoredFile(bucket, folder, filename) {
    return supabaseAdmin.storage.from(bucket).list(folder, { search: filename, limit: 100 });
  },
  async removeStoredFiles(bucket, paths) {
    if (!paths.length) return { data: [], error: null };
    return supabaseAdmin.storage.from(bucket).remove(paths);
  },
};
