import { z } from 'zod';

const complaintId = z.string().uuid();
export const complaintIdSchema = z.object({ id: complaintId });
export const createComplaintSchema = z.object({
  category: z.enum(['academic', 'marks', 'teacher', 'technical', 'other']),
  course_id: complaintId.nullable().optional(),
  subject: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(3000),
});
export const complaintListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'in_review', 'resolved', 'rejected']).optional(),
  category: z.enum(['academic', 'marks', 'teacher', 'technical', 'other']).optional(),
});
export const updateComplaintSchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved', 'rejected']).optional(),
  admin_response: z.string().trim().max(5000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');
