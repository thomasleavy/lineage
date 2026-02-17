import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '~/server/auth/config';
import { performLogin } from '~/server/auth/login-handler';
import { csrfCookieHeader, generateCsrfToken, CSRF_COOKIE_NAME } from '~/server/lib/csrf';
import { loginSchema } from '~/lib/validations/auth';

function sessionCookieHeader(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${authConfig.cookieName}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null;
  const userAgent = req.headers.get('user-agent') ?? undefined;
  const result = await performLogin(
    { email: parsed.data.email.trim().toLowerCase(), password: parsed.data.password },
    { ip: ip ?? undefined, userAgent }
  );
  if (!result.ok) {
    const status = result.code === 'TOO_MANY_REQUESTS' ? 429 : 401;
    return NextResponse.json({ error: result.message }, { status });
  }
  const maxAgeSeconds = Math.floor((result.expiresAt.getTime() - Date.now()) / 1000);
  const csrfToken = generateCsrfToken();
  const headers = new Headers();
  headers.append('Set-Cookie', sessionCookieHeader(result.token, maxAgeSeconds));
  headers.append('Set-Cookie', csrfCookieHeader(csrfToken, maxAgeSeconds));
  return NextResponse.json(
    {
      user: result.user,
      csrfToken, // client can store in memory for X-CSRF-Token header if needed (cookie is also set for same value)
    },
    { headers }
  );
}
