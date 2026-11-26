import { z } from 'zod';

const dateTime = z.string().datetime({ offset: true });
export const quizIdSchema = z.object({ id: z.string().uuid() });
export const createQuizSchema = z.object({
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(5000).nullable().optional(),
  duration_minutes: z.coerce.number().int().min(1).max(600),
  opens_at: dateTime,
  closes_at: dateTime,
}).refine((value) => Date.parse(value.closes_at) > Date.parse(value.opens_at), { path: ['closes_at'], message: 'Close time must be after open time.' });
export const questionsSchema = z.object({
  questions: z.array(z.object({
    question_text: z.string().trim().min(2).max(2000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
    correct_index: z.coerce.number().int().min(0),
    marks: z.coerce.number().positive().max(999.99).default(1),
  }).refine((question) => question.correct_index < question.options.length, { path: ['correct_index'], message: 'Correct answer must match an option.' })).min(1).max(100),
});
export const publishQuizSchema = z.object({ is_published: z.boolean().default(true) });
export const listQuizzesQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
export const quizAnswersSchema = z.object({ answers: z.record(z.string().uuid(), z.coerce.number().int().min(0).max(5)) });
export const quizResultsQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
