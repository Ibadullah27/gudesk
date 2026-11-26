import { z } from 'zod';

export const courseChatParamsSchema = z.object({ id: z.string().uuid() });
export const chatMessageParamsSchema = z.object({ messageId: z.string().uuid() });
export const chatHistoryQuerySchema = z.object({ before: z.string().datetime({ offset: true }).optional() });
export const createChatMessageSchema = z.object({ body: z.string().trim().min(1).max(2000) });
