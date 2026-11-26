import { z } from 'zod';

export const announcementIdSchema = z.object({ id: z.string().uuid() });
export const announcementListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(10000),
  course_id: z.string().uuid().nullable().optional(),
});
export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  body: z.string().trim().min(2).max(10000).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');
