import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { hasRole } from '~/server/rbac';
import { hashPassword } from '~/server/auth/password';

const CREATIVE_DIRECTOR = 'CREATIVE_DIRECTOR';

export const adminRouter = router({
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (!hasRole(ctx.user.userRoles, CREATIVE_DIRECTOR)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only Creative Director can list users' });
    }
    return ctx.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        userRoles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  listRoles: protectedProcedure.query(async ({ ctx }) => {
    if (!hasRole(ctx.user.userRoles, CREATIVE_DIRECTOR)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return ctx.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }),

  assignRole: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!hasRole(ctx.user.userRoles, CREATIVE_DIRECTOR)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      await ctx.prisma.userRole.create({
        data: { userId: input.userId, roleId: input.roleId },
      });
      return { ok: true };
    }),

  removeRole: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!hasRole(ctx.user.userRoles, CREATIVE_DIRECTOR)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      await ctx.prisma.userRole.delete({
        where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
      });
      return { ok: true };
    }),

  createUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().max(128).optional(),
        password: z.string().min(8).max(128),
        roleIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!hasRole(ctx.user.userRoles, CREATIVE_DIRECTOR)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Email already exists' });
      const passwordHash = await hashPassword(input.password);
      const user = await ctx.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name ?? null,
          passwordHash,
          userRoles: {
            create: input.roleIds.map((roleId) => ({ roleId })),
          },
        },
        include: { userRoles: { include: { role: true } } },
      });
      return user;
    }),
});
