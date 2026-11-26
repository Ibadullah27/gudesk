import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url().refine((value) => !value.includes('your-project'), 'Replace the example project URL'),
  SUPABASE_ANON_KEY: z.string().min(1).refine((value) => !value.startsWith('replace-') && !value.startsWith('your-'), 'Replace the example anon key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).refine((value) => !value.startsWith('replace-') && !value.startsWith('your-'), 'Set the backend service role key locally'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CLIENT_ORIGIN: z.string().url(),
  JWT_AUDIENCE: z.string().min(1).default('authenticated'),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const fields = result.error.issues.map(({ path }) => path.join('.')).join(', ');
  throw new Error(`Invalid backend environment. Check: ${fields}`);
}

export const env = Object.freeze(result.data);
