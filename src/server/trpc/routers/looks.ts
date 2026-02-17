import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, garmentViewProcedure, garmentEditProcedure } from '../trpc';
import {
  createLookSchema,
  updateLookSchema,
  addLookItemSchema,
  reorderLookItemsSchema,
} from '~/lib/validations/look';
import { isReadOnly, canCreateLookbooks, canDeleteLookbooks } from '~/server/rbac';

export const looksRouter = router({
  list: garmentViewProcedure.query(async ({ ctx }) => {
    return ctx.prisma.look.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lookItems: {
          orderBy: { orderIndex: 'asc' },
          include: { garment: { include: { currentVersion: true } } },
        },
      },
    });
  }),

  getById: garmentViewProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const look = await ctx.prisma.look.findUnique({
        where: { id: input.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          lookItems: {
            orderBy: { orderIndex: 'asc' },
            include: { garment: { include: { currentVersion: true } } },
          },
        },
      });
      if (!look) throw new TRPCError({ code: 'NOT_FOUND', message: 'Look not found' });
      return look;
    }),

  create: garmentEditProcedure.input(createLookSchema).mutation(async ({ ctx, input }) => {
    if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
    if (!canCreateLookbooks(ctx.user.userRoles)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only atelier, lead designer and director can create lookbooks' });
    }
    const look = await ctx.prisma.look.create({
      data: {
        name: input.name,
        collection: input.collection,
        type: input.type,
        createdById: ctx.user.id,
      },
    });
    await ctx.audit({
      actionType: 'CREATE_LOOK',
      entityType: 'LOOK',
      entityId: look.id,
      afterJson: { name: look.name, type: look.type },
    });
    return look;
  }),

  update: garmentEditProcedure
    .input(z.object({ id: z.string().uuid() }).merge(updateLookSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
      const { id, ...data } = input;
      const look = await ctx.prisma.look.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.collection && { collection: data.collection }),
          ...(data.type && { type: data.type }),
        },
      });
      await ctx.audit({
        actionType: 'UPDATE_LOOK',
        entityType: 'LOOK',
        entityId: look.id,
        afterJson: data,
      });
      return look;
    }),

  addItem: garmentEditProcedure.input(addLookItemSchema).mutation(async ({ ctx, input }) => {
    if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
    const look = await ctx.prisma.look.findUnique({ where: { id: input.lookId } });
    if (!look) throw new TRPCError({ code: 'NOT_FOUND' });
    let garmentId = input.garmentId;
    if (!garmentId && input.houseCode?.trim()) {
      const garment = await ctx.prisma.garment.findFirst({
        where: { houseCode: { equals: input.houseCode.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (!garment) throw new TRPCError({ code: 'NOT_FOUND', message: 'No garment with that house code' });
      garmentId = garment.id;
    }
    if (!garmentId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Provide garmentId or houseCode' });
    const item = await ctx.prisma.lookItem.create({
      data: {
        lookId: input.lookId,
        garmentId,
        orderIndex: input.orderIndex,
        modelName: input.modelName ?? null,
        stylingNotes: input.stylingNotes ?? null,
      },
    });
    return ctx.prisma.lookItem.findUniqueOrThrow({
      where: { id: item.id },
      include: { garment: { include: { currentVersion: true } } },
    });
  }),

  removeItem: garmentEditProcedure
    .input(z.object({ lookItemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
      await ctx.prisma.lookItem.delete({ where: { id: input.lookItemId } });
      return { ok: true };
    }),

  reorderItems: garmentEditProcedure.input(reorderLookItemsSchema).mutation(async ({ ctx, input }) => {
    if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
    const count = await ctx.prisma.lookItem.count({
      where: { lookId: input.lookId, id: { in: input.itemIds } },
    });
    if (count !== input.itemIds.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'All items must belong to this look' });
    }
    await ctx.prisma.$transaction(
      input.itemIds.map((id, i) =>
        ctx.prisma.lookItem.update({
          where: { id },
          data: { orderIndex: i },
        })
      )
    );
    return ctx.prisma.lookItem.findMany({
      where: { lookId: input.lookId },
      orderBy: { orderIndex: 'asc' },
      include: { garment: { include: { currentVersion: true } } },
    });
  }),

  listContainingGarment: garmentViewProcedure
    .input(z.object({ garmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.look.findMany({
        where: { lookItems: { some: { garmentId: input.garmentId } } },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          lookItems: { orderBy: { orderIndex: 'asc' }, select: { id: true, orderIndex: true } },
        },
      });
    }),

  delete: garmentEditProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
      if (!canDeleteLookbooks(ctx.user.userRoles)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only lead designer and director can delete lookbooks' });
      }
      const look = await ctx.prisma.look.findUnique({ where: { id: input.id } });
      if (!look) throw new TRPCError({ code: 'NOT_FOUND', message: 'Look not found' });
      await ctx.prisma.look.delete({ where: { id: input.id } });
      await ctx.audit({
        actionType: 'DELETE_LOOK',
        entityType: 'LOOK',
        entityId: input.id,
        beforeJson: { name: look.name, type: look.type },
      });
      return { ok: true };
    }),

  duplicate: garmentEditProcedure
    .input(z.object({ lookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
      const source = await ctx.prisma.look.findUnique({
        where: { id: input.lookId },
        include: { lookItems: { orderBy: { orderIndex: 'asc' } } },
      });
      if (!source) throw new TRPCError({ code: 'NOT_FOUND' });
      const look = await ctx.prisma.look.create({
        data: {
          name: `${source.name} (copy)`,
          collection: source.collection,
          type: source.type,
          createdById: ctx.user.id,
        },
      });
      await ctx.prisma.lookItem.createMany({
        data: source.lookItems.map((li, i) => ({
          lookId: look.id,
          garmentId: li.garmentId,
          orderIndex: i,
          modelName: li.modelName,
          stylingNotes: li.stylingNotes,
        })),
      });
      await ctx.audit({
        actionType: 'CREATE_LOOK',
        entityType: 'LOOK',
        entityId: look.id,
        afterJson: { name: look.name, type: look.type, duplicatedFrom: input.lookId },
      });
      return ctx.prisma.look.findUniqueOrThrow({
        where: { id: look.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          lookItems: {
            orderBy: { orderIndex: 'asc' },
            include: { garment: { include: { currentVersion: true } } },
          },
        },
      });
    }),

  createFromCollection: garmentEditProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        collection: z.string().min(1).max(64),
        type: z.enum(['run_of_show', 'press']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
      const look = await ctx.prisma.look.create({
        data: {
          name: input.name,
          collection: input.collection,
          type: input.type,
          createdById: ctx.user.id,
        },
      });
      const garments = await ctx.prisma.garment.findMany({
        where: { collection: input.collection },
        orderBy: { houseCode: 'asc' },
        select: { id: true },
      });
      await ctx.prisma.lookItem.createMany({
        data: garments.map((g, i) => ({
          lookId: look.id,
          garmentId: g.id,
          orderIndex: i,
        })),
      });
      await ctx.audit({
        actionType: 'CREATE_LOOK',
        entityType: 'LOOK',
        entityId: look.id,
        afterJson: { name: look.name, type: look.type, fromCollection: input.collection, itemCount: garments.length },
      });
      return ctx.prisma.look.findUniqueOrThrow({
        where: { id: look.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          lookItems: {
            orderBy: { orderIndex: 'asc' },
            include: { garment: { include: { currentVersion: true } } },
          },
        },
      });
    }),
});
