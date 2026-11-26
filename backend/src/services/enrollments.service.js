import { AppError } from '../errors/AppError.js';
import { enrollmentsRepository } from '../repositories/enrollments.repository.js';

function databaseError(error) {
  if (error?.code === '23503') return new AppError(422, 'INVALID_STUDENT', 'One or more selected accounts are not valid students.');
  return new AppError(500, 'DATABASE_ERROR', 'The course enrollment request could not be completed.');
}

function parseCsvRow(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && inQuotes && line[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { fields.push(field.trim()); field = ''; }
    else field += char;
  }
  if (inQuotes) throw new AppError(422, 'INVALID_CSV', 'A CSV row contains an unclosed quoted value.');
  fields.push(field.trim());
  return fields;
}

class EnrollmentsService {
  async assertCourseManager(courseId, profile) {
    const { data: course, error } = await enrollmentsRepository.findCourse(courseId);
    if (error) throw databaseError(error);
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
    if (profile.role !== 'admin' && course.teacher_id !== profile.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only manage students in your own courses.');
    }
    return course;
  }

  async listStudents(courseId, filters, profile) {
    await this.assertCourseManager(courseId, profile);
    const { data: students, count, error } = await enrollmentsRepository.listStudents(filters);
    if (error) throw databaseError(error);
    const ids = (students ?? []).map(({ id }) => id);
    const enrollmentResult = ids.length
      ? await enrollmentsRepository.listEnrollmentIds(courseId, ids)
      : { data: [], error: null };
    if (enrollmentResult.error) throw databaseError(enrollmentResult.error);
    const enrolledIds = new Set((enrollmentResult.data ?? []).map(({ student_id }) => student_id));
    return {
      data: (students ?? []).map((student) => ({ ...student, enrolled: enrolledIds.has(student.id) })),
      meta: { page: filters.page, pageSize: filters.pageSize, total: count ?? 0 },
    };
  }

  async enrollStudents(courseId, studentIds, profile) {
    await this.assertCourseManager(courseId, profile);
    const uniqueIds = [...new Set(studentIds)];
    const { data: students, error: studentError } = await enrollmentsRepository.findActiveStudents(uniqueIds);
    if (studentError) throw databaseError(studentError);
    const validIds = new Set((students ?? []).map(({ id }) => id));
    if (validIds.size !== uniqueIds.length) {
      throw new AppError(422, 'INVALID_STUDENT', 'Only active student accounts can be enrolled.', [{ field: 'student_ids', message: 'Remove invalid, inactive, or non-student accounts.' }]);
    }
    const { data: enrolled, error } = await enrollmentsRepository.enroll(courseId, uniqueIds);
    if (error) throw databaseError(error);
    return {
      enrolled: enrolled?.length ?? 0,
      already_enrolled: uniqueIds.length - (enrolled?.length ?? 0),
    };
  }

  async bulkEnroll(courseId, csv, profile) {
    await this.assertCourseManager(courseId, profile);
    const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 101) throw new AppError(422, 'CSV_TOO_LARGE', 'Import up to 100 roll numbers at a time.');
    const rows = lines.map(parseCsvRow);
    const header = rows[0].map((value) => value.toLowerCase());
    const columnIndex = header.findIndex((value) => ['roll_no', 'roll number', 'rollno'].includes(value));
    const hasHeader = columnIndex >= 0;
    if (rows[0].length > 1 && !hasHeader) throw new AppError(422, 'INVALID_CSV', 'For a multi-column CSV, include a roll_no header.');
    const rollNumbers = [...new Set((hasHeader ? rows.slice(1).map((row) => row[columnIndex] ?? '') : rows.map((row) => row[0] ?? ''))
      .map((value) => value.trim()).filter(Boolean))];
    if (!rollNumbers.length) throw new AppError(422, 'INVALID_CSV', 'Provide at least one roll number, optionally under a roll_no header.');
    if (rollNumbers.length > 100) throw new AppError(422, 'CSV_TOO_LARGE', 'Import up to 100 unique roll numbers at a time.');
    const { data: students, error } = await enrollmentsRepository.findStudentsByRollNumbers(rollNumbers);
    if (error) throw databaseError(error);
    const byRollNumber = new Map((students ?? []).map((student) => [student.roll_no, student.id]));
    const unknownRollNumbers = rollNumbers.filter((rollNumber) => !byRollNumber.has(rollNumber));
    const studentIds = rollNumbers.map((rollNumber) => byRollNumber.get(rollNumber)).filter(Boolean);
    const result = studentIds.length ? await this.enrollStudents(courseId, studentIds, profile) : { enrolled: 0, already_enrolled: 0 };
    return { ...result, unknown_roll_numbers: unknownRollNumbers };
  }

  async removeStudent(courseId, studentId, profile) {
    await this.assertCourseManager(courseId, profile);
    const { data, error } = await enrollmentsRepository.remove(courseId, studentId);
    if (error) throw databaseError(error);
    if (!data) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'This student is not enrolled in the course.');
    return { removed: true, student_id: studentId };
  }
}

export const enrollmentsService = new EnrollmentsService();
