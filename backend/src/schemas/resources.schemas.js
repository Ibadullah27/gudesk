import { z } from 'zod';

const fileName = z.string().trim().min(1).max(255).refine((value) => !/[\\/\0]/.test(value), 'File name cannot contain path separators.');
const mimeType = z.string().trim().min(1).max(120);

export const resourceUploadUrlSchema = z.object({
  file_name: fileName,
  mime_type: mimeType,
  size_bytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
});

export const createResourceSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  file_path: z.string().trim().min(1).max(512),
  file_name: fileName,
  mime_type: mimeType,
  size_bytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
});

export const resourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const resourceIdSchema = z.object({ id: z.string().uuid() });
