import { z } from 'zod';

const safeFileName = z.string().trim().min(1).max(255).refine((value) => !/[\\/\0]/.test(value), 'File name cannot contain path separators.');
export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  contact_email: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one profile field is required.');
export const avatarUploadSchema = z.object({
  file_name: safeFileName,
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.coerce.number().int().min(1).max(5 * 1024 * 1024),
});
export const avatarPathSchema = z.object({ file_path: z.string().trim().min(1).max(255) });
export const profilePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/),
}).refine((value) => value.currentPassword !== value.newPassword, { path: ['newPassword'], message: 'Choose a different password.' });
