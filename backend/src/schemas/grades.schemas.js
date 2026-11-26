import { z } from 'zod';

export const submissionIdSchema = z.object({ id: z.string().uuid() });
export const gradeSubmissionSchema = z.object({
  marks_obtained: z.coerce.number().min(0).max(9999.99),
  feedback: z.string().trim().max(5000).nullable().optional(),
});
export const gradebookQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
