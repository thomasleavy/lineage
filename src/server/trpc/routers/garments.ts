import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import {
  router,
  garmentViewProcedure,
  garmentEditProcedure,
  archiveProcedure,
  hardDeleteProcedure,
} from '../trpc';
import {
  createGarmentSchema,
  updateGarmentSchema,
  createVersionSchema,
  rollbackSchema,
} from '~/lib/validations/garment';
import { isReadOnly, canArchiveGarment } from '~/server/rbac';

export const garmentsRouter = router({
  list: garmentViewProcedure
    .input(
      z
        .object({
          houseCode: z.string().max(64).optional(),
          collection: z.string().optional(),
          status: z.string().optional(),
          archived: z.boolean().optional(), // true = only archived, false/undefined = exclude archived
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.archived === true && !canArchiveGarment(ctx.user.userRoles)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only lead designer and director can view the archive' });
      }
      const where: Prisma.GarmentWhereInput = {};
      if (input?.houseCode?.trim()) {
        where.houseCode = { contains: input.houseCode.trim(), mode: 'insensitive' };
      }
      if (input?.collection?.trim()) {
        where.collection = { contains: input.collection.trim(), mode: 'insensitive' };
      }
      if (input?.status) where.status = input.status;
      if (input?.archived === true) {
        where.status = 'archived';
      } else if (input?.status) {
        where.status = input.status;
      } else {
        where.status = { not: 'archived' };
      }
      const [items, total] = await Promise.all([
        ctx.prisma.garment.findMany({
          where,
          include: {
            currentVersion: true,
            designerOwner: { select: { id: true, name: true, email: true } },
            versions: {
              where: { versionNumber: 1 },
              take: 1,
              include: { createdBy: { select: { id: true, name: true, email: true } } },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: input?.limit ?? 20,
          skip: input?.offset ?? 0,
        }),
        ctx.prisma.garment.count({ where }),
      ]);
      const itemsWithCreator = items.map((g) => ({
        ...g,
        createdBy: g.versions[0]?.createdBy ?? null,
      }));
      return { items: itemsWithCreator, total };
    }),

  listCollections: garmentViewProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.garment.groupBy({
      by: ['collection'],
      orderBy: { collection: 'asc' },
    });
    return rows.map((r) => r.collection);
  }),

  getById: garmentViewProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const g = await ctx.prisma.garment.findUnique({
        where: { id: input.id },
        include: {
          currentVersion: { include: { createdBy: { select: { id: true, name: true, email: true } } } },
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: { createdBy: { select: { id: true, name: true, email: true } } },
          },
          designerOwner: { select: { id: true, name: true, email: true } },
          assets: true,
        },
      });
      if (!g) throw new TRPCError({ code: 'NOT_FOUND', message: 'Garment not found' });
      await ctx.audit({
        actionType: 'VIEW_GARMENT',
        entityType: 'GARMENT',
        entityId: g.id,
      });
      return g;
    }),

  update: garmentEditProcedure
    .input(z.object({ id: z.string().uuid() }).merge(updateGarmentSchema))
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
      const { id, ...data } = input;
      const garment = await ctx.prisma.garment.update({
        where: { id },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.collection !== undefined && { collection: data.collection }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.designerOwnerId !== undefined && { designerOwnerId: data.designerOwnerId }),
          ...(data.silhouetteTags !== undefined && { silhouetteTags: data.silhouetteTags }),
        },
      });
      await ctx.audit({
        actionType: 'EDIT_GARMENT',
        entityType: 'GARMENT',
        entityId: garment.id,
        afterJson: data,
      });
      return garment;
    }),

  listRecentTabletNotes: garmentViewProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.$queryRaw<
        Array<{ id: string; garment_id: string; house_code: string; weave_type: string | null; tone: string | null; notes: string | null; created_at: Date; created_by_name: string | null }>
      >(
        Prisma.sql`
          SELECT n.id, n.garment_id, g.house_code, n.weave_type, n.tone, n.notes, n.created_at, u.name AS created_by_name
          FROM garment_notes n
          JOIN users u ON u.id = n.created_by_id
          JOIN garments g ON g.id = n.garment_id
          ORDER BY n.created_at DESC
          LIMIT ${input.limit}
        `
      );
      return rows.map((r) => ({
        id: r.id,
        garmentId: r.garment_id,
        houseCode: r.house_code,
        weaveType: r.weave_type,
        tone: r.tone,
        notes: r.notes,
        createdAt: r.created_at,
        createdBy: { name: r.created_by_name },
      }));
    }),

  listTabletNotes: garmentViewProcedure
    .input(z.object({ garmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const notes = await ctx.prisma.$queryRaw<
        Array<{ id: string; weave_type: string | null; tone: string | null; notes: string | null; garment_version_id: string | null; created_at: Date; created_by_name: string | null }>
      >(
        Prisma.sql`
          SELECT n.id, n.weave_type, n.tone, n.notes, n.garment_version_id, n.created_at, u.name AS created_by_name
          FROM garment_notes n
          JOIN users u ON u.id = n.created_by_id
          WHERE n.garment_id::text = ${input.garmentId}
          ORDER BY n.created_at DESC
        `
      );
      return notes.map((n) => ({
        id: n.id,
        weaveType: n.weave_type,
        tone: n.tone,
        notes: n.notes,
        garmentVersionId: n.garment_version_id,
        createdAt: n.created_at,
        createdBy: { id: '', name: n.created_by_name },
      }));
    }),

  saveTabletNote: garmentEditProcedure
    .input(
      z.object({
        garmentId: z.string().uuid(),
        garmentVersionId: z.string().uuid().optional().nullable(),
        weaveType: z.string().max(128).optional().nullable(),
        tone: z.string().max(128).optional().nullable(),
        notes: z.string().max(5000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Read-only role' });
      }
      const hasContent =
        (input.weaveType?.trim()?.length ?? 0) > 0 ||
        (input.tone?.trim()?.length ?? 0) > 0 ||
        (input.notes?.trim()?.length ?? 0) > 0;
      if (!hasContent) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Provide at least weave type, tone, or notes' });
      }
      const garment = await ctx.prisma.garment.findUnique({
        where: { id: input.garmentId },
      });
      if (!garment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Garment not found' });
      if (input.garmentVersionId) {
        const ver = await ctx.prisma.garmentVersion.findFirst({
          where: { id: input.garmentVersionId, garmentId: input.garmentId },
        });
        if (!ver) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });
      }
      const weaveType = input.weaveType?.trim() || null;
      const tone = input.tone?.trim() || null;
      const notes = input.notes?.trim() || null;
      const versionIdParam = input.garmentVersionId ?? null;
      const [row] = await ctx.prisma.$queryRaw<[{ id: string }]>(
        Prisma.sql`
          INSERT INTO garment_notes (id, garment_id, garment_version_id, weave_type, tone, notes, created_by_id, created_at)
          VALUES (gen_random_uuid(), CAST(${input.garmentId} AS uuid), CAST(${versionIdParam} AS uuid), ${weaveType}, ${tone}, ${notes}, CAST(${ctx.user.id} AS uuid), now())
          RETURNING id
        `
      );
      const noteId = row?.id;
      if (!noteId) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create note' });
      await ctx.audit({
        actionType: 'SAVE_TABLET_NOTE',
        entityType: 'GARMENT_NOTE',
        entityId: noteId,
        afterJson: { garmentId: input.garmentId, garmentVersionId: input.garmentVersionId },
      });
      return { id: noteId, garmentId: input.garmentId, garmentVersionId: versionIdParam, weaveType, tone, notes, createdById: ctx.user.id, createdAt: new Date() };
    }),

  create: garmentEditProcedure.input(createGarmentSchema).mutation(async ({ ctx, input }) => {
    if (isReadOnly(ctx.user.userRoles)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Read-only role' });
    }
    const existing = await ctx.prisma.garment.findUnique({
      where: { houseCode: input.houseCode },
    });
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', message: 'House code already exists' });
    }
    const snapshot = {
      houseCode: input.houseCode,
      collection: input.collection,
      category: input.category,
      status: input.status,
      silhouetteTags: input.silhouetteTags,
      notes: input.notes ?? null,
      designerOwnerId: input.designerOwnerId ?? null,
    };
    const version = await ctx.prisma.garmentVersion.create({
      data: {
        garment: {
          create: {
            houseCode: input.houseCode,
            collection: input.collection,
            category: input.category,
            status: input.status,
            silhouetteTags: input.silhouetteTags,
            notes: input.notes ?? null,
            designerOwnerId: input.designerOwnerId ?? null,
          },
        },
        versionNumber: 1,
        createdBy: { connect: { id: ctx.user.id } },
        changeSummary: input.changeSummary?.trim() || 'New item',
        changeDetail: input.notes?.trim() || null,
        snapshotJson: snapshot as Prisma.InputJsonValue,
      },
      include: { garment: true },
    });
    await ctx.prisma.garment.update({
      where: { id: version.garmentId },
      data: { currentVersion: { connect: { id: version.id } } },
    });
    await ctx.prisma.$executeRaw(Prisma.sql`
      UPDATE garments SET current_version_restored_by_rollback = false WHERE id::text = ${version.garmentId}
    `);
    const garment = await ctx.prisma.garment.findUniqueOrThrow({
      where: { id: version.garmentId },
      include: { currentVersion: true },
    });
    await ctx.audit({
      actionType: 'CREATE_GARMENT',
      entityType: 'GARMENT',
      entityId: garment.id,
      afterJson: { houseCode: garment.houseCode, versionId: version.id },
    });
    return garment;
  }),

  createVersion: garmentEditProcedure.input(createVersionSchema).mutation(async ({ ctx, input }) => {
    if (isReadOnly(ctx.user.userRoles)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Read-only role' });
    }
    const garment = await ctx.prisma.garment.findUnique({
      where: { id: input.garmentId },
      include: { currentVersion: true },
    });
    if (!garment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Garment not found' });
    const versionCount = await ctx.prisma.garmentVersion.count({
      where: { garmentId: input.garmentId },
    });
    const nextNum = versionCount + 1;
    const prevSnapshot =
      garment.currentVersion && 'snapshotJson' in garment.currentVersion
        ? (garment.currentVersion.snapshotJson as Record<string, unknown>)
        : {};
    const snapshot = { ...prevSnapshot, status: input.status ?? garment.status };
    const version = await ctx.prisma.garmentVersion.create({
      data: {
        garmentId: input.garmentId,
        versionNumber: nextNum,
        createdById: ctx.user.id,
        changeSummary: input.changeSummary,
        changeDetail: input.changeDetail ?? null,
        diffTags: input.diffTags ?? [],
        snapshotJson: snapshot as Prisma.InputJsonValue,
        parentVersionId: garment.currentVersionId,
      },
    });
    const newStatus = input.status ?? garment.status;
    await ctx.prisma.garment.update({
      where: { id: input.garmentId },
      data: {
        currentVersion: { connect: { id: version.id } },
        status: newStatus,
        updatedAt: new Date(),
      },
    });
    await ctx.prisma.$executeRaw(Prisma.sql`
      UPDATE garments SET current_version_restored_by_rollback = false WHERE id::text = ${input.garmentId}
    `);
    await ctx.audit({
      actionType: 'CREATE_VERSION',
      entityType: 'VERSION',
      entityId: version.id,
      afterJson: { garmentId: input.garmentId, versionNumber: nextNum },
    });
    return ctx.prisma.garmentVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }),

  updateCurrentFromSnapshot: garmentEditProcedure
    .input(
      z.object({
        garmentId: z.string().uuid(),
        changeSummary: z.string().min(1).max(256),
        changeDetail: z.string().max(10000).optional(),
        snapshot: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
      const garment = await ctx.prisma.garment.findUnique({
        where: { id: input.garmentId },
        include: { currentVersion: true },
      });
      if (!garment) throw new TRPCError({ code: 'NOT_FOUND' });
      const nextNum =
        (await ctx.prisma.garmentVersion.count({ where: { garmentId: input.garmentId } })) + 1;
      const version = await ctx.prisma.garmentVersion.create({
        data: {
          garmentId: input.garmentId,
          versionNumber: nextNum,
          createdById: ctx.user.id,
        changeSummary: input.changeSummary,
        changeDetail: input.changeDetail ?? null,
        snapshotJson: input.snapshot as Prisma.InputJsonValue,
        parentVersionId: garment.currentVersionId,
      },
    });
    const garmentUpdateData: Prisma.GarmentUpdateInput = {
      currentVersion: { connect: { id: version.id } },
      updatedAt: new Date(),
      ...(typeof input.snapshot.collection === 'string' && { collection: input.snapshot.collection }),
      ...(typeof input.snapshot.category === 'string' && { category: input.snapshot.category }),
      ...(typeof input.snapshot.status === 'string' && { status: input.snapshot.status }),
      ...(Array.isArray(input.snapshot.silhouetteTags) && { silhouetteTags: input.snapshot.silhouetteTags as string[] }),
      ...(typeof input.snapshot.notes === 'string' && { notes: input.snapshot.notes }),
      ...(typeof input.snapshot.designerOwnerId === 'string' && { designerOwnerId: input.snapshot.designerOwnerId }),
    };
    await ctx.prisma.garment.update({
      where: { id: input.garmentId },
      data: garmentUpdateData,
    });
    await ctx.prisma.$executeRaw(Prisma.sql`
      UPDATE garments SET current_version_restored_by_rollback = false WHERE id::text = ${input.garmentId}
    `);
    await ctx.audit({
      actionType: 'EDIT_GARMENT',
      entityType: 'VERSION',
      entityId: version.id,
      afterJson: { garmentId: input.garmentId, versionNumber: nextNum },
    });
    return ctx.prisma.garmentVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }),

  rollback: garmentEditProcedure.input(rollbackSchema).mutation(async ({ ctx, input }) => {
    if (isReadOnly(ctx.user.userRoles)) throw new TRPCError({ code: 'FORBIDDEN' });
    const garment = await ctx.prisma.garment.findUnique({
      where: { id: input.garmentId },
      include: { currentVersion: { include: { parentVersion: true } } },
    });
    if (!garment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Garment not found' });
    if (!garment.currentVersionId || !garment.currentVersion) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No current version to roll back from' });
    }
    const current = garment.currentVersion;
    if (!current.parentVersionId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot roll back: this is the first version' });
    }
    if (garment.currentVersionRestoredByRollback) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot roll back again: current version was already restored by a rollback. Create a new version to continue.',
      });
    }
    // Walk back to the first version that was created by a user (not a rollback)
    const isRollbackVersion = (v: { changeSummary: string | null }) =>
      (v.changeSummary?.startsWith('Rollback to v') ?? false);
    let targetVersionId: string | null = current.parentVersionId;
    while (targetVersionId) {
      const candidate: { parentVersionId: string | null; changeSummary: string | null } | null =
        await ctx.prisma.garmentVersion.findUnique({
          where: { id: targetVersionId },
          include: { parentVersion: true },
        });
      if (!candidate) break;
      if (!isRollbackVersion(candidate)) break;
      targetVersionId = candidate.parentVersionId;
    }
    if (!targetVersionId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot roll back: no user-created version found in history' });
    }
    const newCurrentId = targetVersionId;
    await ctx.prisma.garment.update({
      where: { id: input.garmentId },
      data: { currentVersion: { connect: { id: newCurrentId } }, updatedAt: new Date() },
    });
    await ctx.prisma.$executeRaw(Prisma.sql`
      UPDATE garments SET current_version_restored_by_rollback = true WHERE id::text = ${input.garmentId}
    `);
    await ctx.audit({
      actionType: 'ROLLBACK',
      entityType: 'GARMENT',
      entityId: input.garmentId,
      afterJson: {
        previousVersionId: current.id,
        newCurrentVersionId: newCurrentId,
      },
    });
    return ctx.prisma.garmentVersion.findUniqueOrThrow({
      where: { id: newCurrentId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }),

  compareVersions: garmentViewProcedure
    .input(z.object({ versionA: z.string().uuid(), versionB: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [a, b] = await Promise.all([
        ctx.prisma.garmentVersion.findUnique({
          where: { id: input.versionA },
          include: { createdBy: { select: { name: true } } },
        }),
        ctx.prisma.garmentVersion.findUnique({
          where: { id: input.versionB },
          include: { createdBy: { select: { name: true } } },
        }),
      ]);
      if (!a || !b) throw new TRPCError({ code: 'NOT_FOUND' });
      if (a.garmentId !== b.garmentId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Versions must belong to the same garment' });
      }
      return { versionA: a, versionB: b };
    }),

  archive: archiveProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const g = await ctx.prisma.garment.findUnique({ where: { id: input.id } });
      if (!g) throw new TRPCError({ code: 'NOT_FOUND' });
      if (g.status === 'archived') return g;
      const updated = await ctx.prisma.garment.update({
        where: { id: input.id },
        data: { status: 'archived', updatedAt: new Date() },
      });
      await ctx.audit({
        actionType: 'ARCHIVE_GARMENT',
        entityType: 'GARMENT',
        entityId: input.id,
        beforeJson: { status: g.status },
        afterJson: { status: 'archived' },
      });
      return updated;
    }),

  unarchive: archiveProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const g = await ctx.prisma.garment.findUnique({
        where: { id: input.id },
        include: { currentVersion: true },
      });
      if (!g) throw new TRPCError({ code: 'NOT_FOUND' });
      if (g.status !== 'archived') return g;
      const snap = g.currentVersion && 'snapshotJson' in g.currentVersion
        ? (g.currentVersion.snapshotJson as Record<string, unknown>)
        : {};
      const restoredStatus = (typeof snap.status === 'string' && ['concept', 'toile', 'sample', 'final'].includes(snap.status))
        ? snap.status
        : 'sample';
      const updated = await ctx.prisma.garment.update({
        where: { id: input.id },
        data: { status: restoredStatus, updatedAt: new Date() },
      });
      await ctx.audit({
        actionType: 'ARCHIVE_GARMENT',
        entityType: 'GARMENT',
        entityId: input.id,
        beforeJson: { status: 'archived' },
        afterJson: { status: restoredStatus, restored: true },
      });
      return updated;
    }),

  hardDelete: hardDeleteProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const g = await ctx.prisma.garment.findUnique({ where: { id: input.id } });
      if (!g) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.audit({
        actionType: 'HARD_DELETE_GARMENT',
        entityType: 'GARMENT',
        entityId: input.id,
        beforeJson: { houseCode: g.houseCode },
      });
      await ctx.prisma.garment.delete({ where: { id: input.id } });
      return { deleted: true };
    }),
});
