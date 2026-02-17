import { z } from 'zod';

const envSchema = z.object({
  SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7), // 7 days
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success && process.env.NODE_ENV === 'production') {
  throw new Error('Invalid auth env: ' + parsed.error.message);
}

export const authConfig = {
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret-min-32-chars-required',
  sessionMaxAgeSeconds: Number(process.env.SESSION_MAX_AGE_SECONDS) || 60 * 60 * 24 * 7,
  cookieName: 'lineage_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  },
};
