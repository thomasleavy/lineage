import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getSessionByToken } from '~/server/auth/session';
import { authConfig } from '~/server/auth/config';
import { prisma } from '~/server/db';
import { childLogger } from '~/server/lib/logger';
import { writeAuditLog } from '~/server/audit/service';
import type { AuditActionType, AuditEntityType } from '~/server/audit/types';

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  userRoles: { role: { name: string } }[];
};

export type SessionWithUser = SessionUser & { sessionId: string };

async function getSessionUser(cookieHeader: string | undefined): Promise<SessionWithUser | null> {
  const cookies = cookieHeader?.split(';').map((c) => c.trim()) ?? [];
  let token: string | undefined;
  for (const c of cookies) {
    if (c.startsWith(`${authConfig.cookieName}=`)) {
      token = c.slice(authConfig.cookieName.length + 1);
      break;
    }
  }
  if (!token) return null;
  const session = await getSessionByToken(token);
  if (!session) return null;
  return {
    sessionId: session.id,
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    userRoles: session.user.userRoles,
  };
}

export type Context = {
  prisma: typeof prisma;
  user: SessionWithUser | null;
  requestId: string;
  log: ReturnType<typeof childLogger>;
  ip: string | null;
  userAgent: string | null;
  audit: (opts: {
    actionType: AuditActionType;
    entityType: AuditEntityType;
    entityId: string | null;
    beforeJson?: unknown;
    afterJson?: unknown;
  }) => Promise<string>;
};

type ReqLike = { headers: { get?: (n: string) => string | null; cookie?: string; [k: string]: unknown } };
function getCookie(req: ReqLike): string | undefined {
  if (typeof req.headers.cookie === 'string') return req.headers.cookie;
  if (typeof req.headers.get === 'function') return req.headers.get('cookie') ?? undefined;
  return undefined;
}

export async function createContext(
  opts: CreateNextContextOptions | FetchCreateContextFnOptions
): Promise<Context> {
  const requestId = crypto.randomUUID();
  const req = opts.req as ReqLike & { socket?: { remoteAddress?: string }; headers: Record<string, unknown> };
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ??
    null;
  const userAgent = (req.headers['user-agent'] as string) ?? (typeof req.headers.get === 'function' ? req.headers.get('user-agent') : null) ?? null;
  const user = await getSessionUser(getCookie(req));

  const log = childLogger({
    requestId,
    userId: user?.id,
  });

  async function audit(opts: {
    actionType: AuditActionType;
    entityType: AuditEntityType;
    entityId: string | null;
    beforeJson?: unknown;
    afterJson?: unknown;
  }) {
    return writeAuditLog({
      actorId: user?.id ?? null,
      actionType: opts.actionType,
      entityType: opts.entityType,
      entityId: opts.entityId,
      beforeJson: opts.beforeJson,
      afterJson: opts.afterJson,
      ip,
      userAgent,
      requestId,
    });
  }

  return {
    prisma,
    user,
    requestId,
    log,
    ip,
    userAgent,
    audit,
  };
}

export type { Context as TrpcContext };
