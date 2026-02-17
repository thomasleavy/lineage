import { z } from 'zod';
import { router, auditLogProcedure } from '../trpc';
import { repairAuditChain, verifyAuditChain } from '~/server/audit/service';

export const auditRouter = router({
  list: auditLogProcedure
    .input(
      z.object({
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
        actionType: z.string().optional(),
        actorId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: {
        entityType?: string;
        entityId?: string;
        actionType?: string;
        actorId?: string;
      } = {};
      if (input.entityType) where.entityType = input.entityType;
      if (input.entityId) where.entityId = input.entityId;
      if (input.actionType) where.actionType = input.actionType;
      if (input.actorId) where.actorId = input.actorId;
      const [items, total] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
          include: { actor: { select: { id: true, email: true, name: true } } },
        }),
        ctx.prisma.auditLog.count({ where }),
      ]);
      return { items, total };
    }),

  verifyChain: auditLogProcedure.query(async () => {
    return verifyAuditChain();
  }),

  repairChain: auditLogProcedure.mutation(async () => {
    return repairAuditChain();
  }),
});
