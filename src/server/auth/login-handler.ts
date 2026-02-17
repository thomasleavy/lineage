/**
 * Shared login logic for API route (server-set cookie) and tRPC.
 * Returns user + session token/expiry so caller can set cookie or return token.
 */
import { prisma } from '~/server/db';
import { createSession } from '~/server/auth/session';
import { verifyPassword } from '~/server/auth/password';
import { writeAuditLog } from '~/server/audit/service';
import { checkLoginRateLimit } from '~/server/lib/rate-limit';

export type LoginInput = { email: string; password: string };
export type LoginResult =
  | { ok: true; user: { id: string; email: string; name: string | null; roles: string[] }; token: string; expiresAt: Date; rateLimitRemaining: number }
  | { ok: false; code: 'TOO_MANY_REQUESTS' | 'UNAUTHORIZED'; message: string };

export async function performLogin(
  input: LoginInput,
  opts: { ip?: string; userAgent?: string }
): Promise<LoginResult> {
  const { allowed, remaining } = checkLoginRateLimit(opts.ip ?? 'unknown');
  if (!allowed) {
    return { ok: false, code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again later.' };
  }
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user?.passwordHash) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid email or password' };
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid email or password' };
  }
  const { token, expiresAt } = await createSession(user.id, {
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
  await writeAuditLog({
    actorId: user.id,
    actionType: 'LOGIN',
    entityType: 'USER',
    entityId: user.id,
    afterJson: { email: user.email },
    ip: opts.ip ?? null,
    userAgent: opts.userAgent ?? null,
  });
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.userRoles.map((ur) => ur.role.name),
    },
    token,
    expiresAt,
    rateLimitRemaining: remaining,
  };
}
