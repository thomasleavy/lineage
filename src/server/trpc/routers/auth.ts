import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { prisma } from '~/server/db';
import { hashPassword, createSession, revokeSession } from '~/server/auth';
import { loginSchema } from '~/lib/validations/auth';
import { checkLoginRateLimit } from '~/server/lib/rate-limit';

export const authRouter = router({
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const { allowed, remaining } = checkLoginRateLimit(ctx.ip ?? 'unknown');
      if (!allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many login attempts. Try again later.',
        });
      }
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        include: { userRoles: { include: { role: true } } },
      });
      if (!user?.passwordHash) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }
      const { verifyPassword } = await import('~/server/auth/password');
      const ok = await verifyPassword(user.passwordHash, input.password);
      if (!ok) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }
      const { token, expiresAt } = await createSession(user.id, {
        ip: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });
      await ctx.audit({
        actionType: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        afterJson: { email: user.email },
      });
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.userRoles.map((ur) => ur.role.name),
        },
        session: { token, expiresAt },
        rateLimitRemaining: remaining,
      };
    }),

  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name,
    roles: ctx.user.userRoles.map((ur) => ur.role.name),
  })),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const { revokeSessionById } = await import('~/server/auth/session');
    if ('sessionId' in ctx.user) await revokeSessionById(ctx.user.sessionId);
    await ctx.audit({
      actionType: 'LOGOUT',
      entityType: 'USER',
      entityId: ctx.user.id,
    });
    return { ok: true };
  }),
});
