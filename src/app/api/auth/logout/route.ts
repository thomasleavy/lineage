import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '~/server/auth/config';
import { getSessionByToken } from '~/server/auth/session';
import { revokeSessionById } from '~/server/auth/session';
import { getCookieFromHeader } from '~/server/lib/csrf';
import { writeAuditLog } from '~/server/audit/service';

function getSessionToken(cookieHeader: string | null): string | null {
  return getCookieFromHeader(cookieHeader, authConfig.cookieName);
}

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie');
  const token = getSessionToken(cookieHeader);
  if (token) {
    const session = await getSessionByToken(token);
    if (session) {
      await revokeSessionById(session.id);
      await writeAuditLog({
        actorId: session.user.id,
        actionType: 'LOGOUT',
        entityType: 'USER',
        entityId: session.user.id,
        ip: req.headers.get('x-forwarded-for') ?? null,
        userAgent: req.headers.get('user-agent') ?? null,
      });
    }
  }
  const headers = new Headers();
  // Clear session cookie
  headers.append('Set-Cookie', `${authConfig.cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return NextResponse.json({ ok: true }, { headers });
}
