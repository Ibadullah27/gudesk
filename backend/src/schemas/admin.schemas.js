import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const fullName = z.string().trim().min(2).max(120);

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  active: z.enum(['true', 'false']).optional(),
});

export const createUserSchema = z.object({
  email,
  full_name: fullName,
  role: z.enum(['admin', 'teacher', 'student']),
  roll_no: z.string().trim().min(1).max(40).optional().or(z.literal('')),
});

export const updateUserSchema = z.object({
  full_name: fullName.optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  is_active: z.boolean().optional(),
  roll_no: z.string().trim().min(1).max(40).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const userIdSchema = z.object({ id: z.string().uuid() });

export const bulkUsersSchema = z.object({
  csv: z.string().min(1).max(500_000),
});

export const listCoursesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
});

export const courseSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  teacher_id: z.string().uuid(),
});

export const updateCourseSchema = courseSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const courseIdSchema = z.object({ id: z.string().uuid() });

export const courseStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
});

export const enrollStudentsSchema = z.object({
  student_ids: z.array(z.string().uuid()).min(1).max(100),
});

export const bulkEnrollSchema = z.object({ csv: z.string().min(1).max(100_000) });

export const enrollmentParamsSchema = z.object({ id: z.string().uuid(), studentId: z.string().uuid() });
