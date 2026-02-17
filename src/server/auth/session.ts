import { createHash, randomBytes } from 'crypto';
import { prisma } from '~/server/db';
import { authConfig } from '~/server/auth/config';

export function generateToken() {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  opts?: { ip?: string; userAgent?: string }
) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + authConfig.sessionMaxAgeSeconds * 1000);
  await prisma.session.create({
    data: {
      userId,
      token: hashToken(token),
      expiresAt,
      ip: opts?.ip,
      userAgent: opts?.userAgent,
    },
  });
  return { token, expiresAt };
}

export async function getSessionByToken(token: string) {
  const hashed = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { token: hashed },
    include: { user: { include: { userRoles: { include: { role: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function revokeSessionById(sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

export async function revokeSession(token: string) {
  const hashed = hashToken(token);
  await prisma.session.deleteMany({ where: { token: hashed } });
}

export async function revokeAllSessionsForUser(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}
