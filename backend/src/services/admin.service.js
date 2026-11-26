import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { adminRepository } from '../repositories/admin.repository.js';
import { createUserSchema } from '../schemas/admin.schemas.js';

function temporaryPassword() {
  return `Class${randomBytes(15).toString('base64url')}7`;
}

function mapDatabaseError(error, fallback) {
  if (error?.code === '23505') return new AppError(409, 'CONFLICT', 'That email, roll number, or course code is already in use.');
  if (error?.code === '23503') return new AppError(422, 'INVALID_REFERENCE', 'The selected teacher or related record is not valid.');
  return new AppError(500, 'DATABASE_ERROR', fallback);
}

function parseCsvLine(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { fields.push(value.trim()); value = ''; }
    else value += char;
  }
  if (quoted) throw new AppError(422, 'INVALID_CSV', 'A CSV row contains an unclosed quoted field.');
  fields.push(value.trim());
  return fields;
}

class AdminService {
  async listUsers(filters) {
    const { data, count, error } = await adminRepository.listUsers(filters);
    if (error) throw mapDatabaseError(error, 'Unable to load user accounts.');
    return { data, meta: { page: filters.page, pageSize: filters.pageSize, total: count } };
  }

  async createUser(input) {
    if (input.role === 'student' && !input.roll_no?.trim()) {
      throw new AppError(422, 'VALIDATION_ERROR', 'A roll number is required for students.', [{ field: 'roll_no', message: 'Required for students.' }]);
    }
    const email = input.email.toLowerCase();
    const { data: existingProfile, error: profileLookupError } = await adminRepository.findProfileByEmail(email);
    if (profileLookupError) throw mapDatabaseError(profileLookupError, 'Unable to check for an existing account.');
    if (existingProfile) throw new AppError(409, 'CONFLICT', 'An account with that email already exists.');

    const password = temporaryPassword();
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (authError || !created.user) {
      if (/already|registered|exists/i.test(authError?.message ?? '')) throw new AppError(409, 'CONFLICT', 'An account with that email already exists.');
      throw new AppError(422, 'AUTH_USER_CREATE_FAILED', 'The account could not be created. Check the submitted details and try again.');
    }

    const { data: profile, error: insertError } = await adminRepository.insertProfile({
      id: created.user.id,
      full_name: input.full_name,
      email,
      role: input.role,
      roll_no: input.role === 'student' ? input.roll_no.trim() : null,
      is_active: true,
      must_change_password: true,
    });
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw mapDatabaseError(insertError, 'The profile could not be saved, so the new Auth account was rolled back.');
    }
    return { user: profile, temporary_password: password };
  }

  async updateUser(id, changes, currentUserId) {
    if (id === currentUserId && changes.is_active === false) {
      throw new AppError(422, 'SELF_DEACTIVATION_BLOCKED', 'You cannot deactivate your own admin account.');
    }
    const patch = { ...changes };
    const { data: current, error: lookupError } = await adminRepository.findProfileById(id);
    if (lookupError) throw mapDatabaseError(lookupError, 'Unable to load the account.');
    if (!current) throw new AppError(404, 'USER_NOT_FOUND', 'The account was not found.');
    if (patch.role === 'student' && current.role !== 'student' && !patch.roll_no) {
      throw new AppError(422, 'VALIDATION_ERROR', 'A roll number is required when changing an account to student.', [{ field: 'roll_no', message: 'Required for students.' }]);
    }
    if (patch.role && patch.role !== 'student') patch.roll_no = null;
    const { data, error } = await adminRepository.updateProfile(id, patch);
    if (error) throw mapDatabaseError(error, 'Unable to update the account.');
    if (!data) throw new AppError(404, 'USER_NOT_FOUND', 'The account was not found.');
    return data;
  }

  async resetUserPassword(id) {
    const { data: profile, error: lookupError } = await supabaseAdmin.from('profiles').select('id').eq('id', id).maybeSingle();
    if (lookupError) throw mapDatabaseError(lookupError, 'Unable to load the account.');
    if (!profile) throw new AppError(404, 'USER_NOT_FOUND', 'The account was not found.');
    const password = temporaryPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
    if (error) throw new AppError(422, 'PASSWORD_RESET_FAILED', 'The temporary password could not be set.');
    const { error: updateError } = await supabaseAdmin.from('profiles').update({ must_change_password: true }).eq('id', id);
    if (updateError) throw mapDatabaseError(updateError, 'Password reset, but the profile flag could not be updated.');
    return { temporary_password: password };
  }

  async bulkCreate(csv) {
    const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new AppError(422, 'INVALID_CSV', 'Include a header and at least one account row.');
    if (lines.length > 101) throw new AppError(422, 'CSV_TOO_LARGE', 'Import up to 100 accounts at a time.');
    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    const required = ['email', 'full_name', 'role'];
    if (required.some((header) => !headers.includes(header))) {
      throw new AppError(422, 'INVALID_CSV', 'CSV headers must include email, full_name, and role. roll_no is required for student rows.');
    }
    const results = [];
    for (const [index, line] of lines.slice(1).entries()) {
      try {
        const values = parseCsvLine(line);
        const record = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
        const parsed = createUserSchema.safeParse(record);
        if (!parsed.success) {
          results.push({ row: index + 2, status: 'failed', message: parsed.error.issues[0].message });
          continue;
        }
        const created = await this.createUser(parsed.data);
        results.push({ row: index + 2, status: 'created', user: created.user, temporary_password: created.temporary_password });
      } catch (error) {
        results.push({ row: index + 2, status: 'failed', message: error.status ? error.message : 'This account could not be created.' });
      }
    }
    return { created: results.filter(({ status }) => status === 'created').length, failed: results.filter(({ status }) => status === 'failed').length, results };
  }

  async listCourses(filters, profile) {
    const { data, count, error } = await adminRepository.listCourses({ ...filters, role: profile.role, userId: profile.id });
    if (error) throw mapDatabaseError(error, 'Unable to load courses.');
    const teacherIds = [...new Set((data ?? []).map(({ teacher_id }) => teacher_id))];
    let teachers = [];
    if (teacherIds.length) {
      const result = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', teacherIds);
      if (result.error) throw mapDatabaseError(result.error, 'Unable to load course teachers.');
      teachers = result.data ?? [];
    }
    const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    return { data: (data ?? []).map((course) => ({ ...course, teacher: teacherById.get(course.teacher_id) ?? null })), meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 } };
  }

  async saveCourse(input, id) {
    let courseInput = input;
    let currentCourse;
    if (id) {
      const { data, error } = await adminRepository.findCourseById(id);
      if (error) throw mapDatabaseError(error, 'Unable to load the course.');
      if (!data) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
      currentCourse = data;
      courseInput = { ...data, ...input };
    }
    const { data: teacher, error: teacherError } = await adminRepository.findTeacher(courseInput.teacher_id);
    if (teacherError) throw mapDatabaseError(teacherError, 'Unable to verify the selected teacher.');
    const changingTeacher = !id || courseInput.teacher_id !== currentCourse.teacher_id;
    if (!teacher || (changingTeacher && !teacher.is_active)) throw new AppError(422, 'INVALID_TEACHER', 'Select an active teacher account.');
    const course = { ...courseInput, code: courseInput.code.toUpperCase(), description: courseInput.description || null };
    const result = id ? await adminRepository.updateCourse(id, course) : await adminRepository.createCourse(course);
    if (result.error) throw mapDatabaseError(result.error, 'Unable to save the course.');
    if (!result.data) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
    return { ...result.data, teacher };
  }

  async listTeachers() {
    const { data, error } = await adminRepository.listTeachers();
    if (error) throw mapDatabaseError(error, 'Unable to load teacher accounts.');
    return data ?? [];
  }
}

export const adminService = new AdminService();
