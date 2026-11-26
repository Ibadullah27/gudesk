import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().refine((value) => !value.includes('your-project'), 'Replace the example project URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).refine((value) => !value.startsWith('replace-') && !value.startsWith('your-'), 'Replace the example anon key'),
  VITE_API_URL: z.string().url(),
});

const result = envSchema.safeParse(import.meta.env);
if (!result.success) {
  const fields = result.error.issues.map(({ path }) => path.join('.')).join(', ');
  throw new Error(`Invalid frontend environment. Check: ${fields}`);
}

export const env = Object.freeze(result.data);
