import { z } from 'zod';

const fileName = z.string().trim().min(1).max(255).refine((value) => !/[\\/\0]/.test(value), 'File name cannot contain path separators.');
const mimeType = z.string().trim().min(1).max(120);
const dateTime = z.string().datetime({ offset: true });

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  total_marks: z.coerce.number().positive().max(9999.99),
  due_at: dateTime,
  allow_late: z.boolean().default(false),
});

export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  total_marks: z.coerce.number().positive().max(9999.99).optional(),
  due_at: dateTime.optional(),
  allow_late: z.boolean().optional(),
  attachment_path: z.string().trim().min(1).max(512).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const assignmentIdSchema = z.object({ id: z.string().uuid() });
export const courseIdSchema = z.object({ id: z.string().uuid() });

export const assignmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const deleteAssignmentQuerySchema = z.object({ confirm: z.enum(['true', 'false']).default('false') });

export const assignmentFileSchema = z.object({
  file_name: fileName,
  mime_type: mimeType,
  size_bytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
});

export const submissionSchema = z.object({
  file_path: z.string().trim().min(1).max(512),
  text_answer: z.string().trim().max(10000).nullable().optional(),
});

export const submissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
