import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, garmentViewProcedure, uploadAssetProcedure } from '../trpc';
import { uploadToS3, S3_BUCKET_NAME, getPresignedGetUrl } from '~/server/storage/client';

const assetTypeSchema = z.enum(['photo', 'scan', 'pattern', 'other']);

async function assetDisplayUrl(
  sourceUrl: string | null,
  storageKey: string
): Promise<string | null> {
  if (sourceUrl) return sourceUrl;
  try {
    return await getPresignedGetUrl(storageKey, 3600);
  } catch {
    return null;
  }
}

export const assetsRouter = router({
  listByGarment: garmentViewProcedure
    .input(z.object({ garmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const list = await ctx.prisma.asset.findMany({
        where: { garmentId: input.garmentId },
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true } }, fabricScan: true },
      });
      const withUrls = await Promise.all(
        list.map(async (a) => ({
          ...a,
          displayUrl: await assetDisplayUrl(a.sourceUrl, a.storageKey),
        }))
      );
      return withUrls;
    }),

  listByVersion: garmentViewProcedure
    .input(z.object({ garmentVersionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const list = await ctx.prisma.asset.findMany({
        where: { garmentVersionId: input.garmentVersionId },
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true } }, fabricScan: true },
      });
      const withUrls = await Promise.all(
        list.map(async (a) => ({
          ...a,
          displayUrl: await assetDisplayUrl(a.sourceUrl, a.storageKey),
        }))
      );
      return withUrls;
    }),

  listRecent: garmentViewProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      const list = await ctx.prisma.asset.findMany({
        where: { garmentId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: { garment: { select: { id: true, houseCode: true } } },
      });
      const withUrls = await Promise.all(
        list
          .filter((a): a is typeof a & { garment: { id: string; houseCode: string } } => a.garment != null && a.garmentId != null)
          .map(async (a) => ({
            id: a.id,
            garmentId: a.garmentId,
            houseCode: a.garment.houseCode,
            originalFilename: a.originalFilename,
            type: a.type,
            displayUrl: await assetDisplayUrl(a.sourceUrl, a.storageKey),
          }))
      );
      return withUrls;
    }),

  /** Full image library: all images with a garment, ordered by creation (newest first), paginated. */
  listLibrary: garmentViewProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(24),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.prisma.asset.findMany({
          where: { garmentId: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
          include: { garment: { select: { id: true, houseCode: true } } },
        }),
        ctx.prisma.asset.count({ where: { garmentId: { not: null } } }),
      ]);
      const withUrls = await Promise.all(
        items
          .filter((a): a is typeof a & { garment: { id: string; houseCode: string }; garmentId: string } => a.garment != null && a.garmentId != null)
          .map(async (a) => ({
            id: a.id,
            garmentId: a.garmentId,
            houseCode: a.garment.houseCode,
            originalFilename: a.originalFilename,
            type: a.type,
            createdAt: a.createdAt,
            displayUrl: await assetDisplayUrl(a.sourceUrl, a.storageKey),
          }))
      );
      return { items: withUrls, total };
    }),

  listWithCredits: garmentViewProcedure.query(async ({ ctx }) => {
    return ctx.prisma.asset.findMany({
      where: { sourceCredit: { not: null } },
      select: {
        id: true,
        sourceUrl: true,
        sourceCredit: true,
        originalFilename: true,
        garmentId: true,
        type: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  createUploadUrl: uploadAssetProcedure
    .input(
      z.object({
        garmentId: z.string().uuid().optional(),
        garmentVersionId: z.string().uuid().optional(),
        type: assetTypeSchema,
        filename: z.string().min(1).max(255),
        contentType: z.string().max(128),
        sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024), // 50MB
      })
    )
    .mutation(async ({ ctx, input }) => {
      const key = `uploads/${ctx.user.id}/${crypto.randomUUID()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const asset = await ctx.prisma.asset.create({
        data: {
          garmentId: input.garmentId ?? null,
          garmentVersionId: input.garmentVersionId ?? null,
          type: input.type,
          storageKey: key,
          originalFilename: input.filename,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          createdById: ctx.user.id,
        },
      });
      await ctx.audit({
        actionType: 'UPLOAD_ASSET',
        entityType: 'ASSET',
        entityId: asset.id,
        afterJson: { storageKey: key, garmentId: input.garmentId, garmentVersionId: input.garmentVersionId },
      });
      return {
        assetId: asset.id,
        storageKey: key,
        bucket: S3_BUCKET_NAME,
      };
    }),

  confirmUpload: uploadAssetProcedure
    .input(
      z.object({
        assetId: z.string().uuid(),
        weaveType: z.string().max(64).optional(),
        tone: z.string().max(64).optional(),
        notes: z.string().max(2000).optional(),
        imageStatsJson: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.prisma.asset.findFirst({
        where: { id: input.assetId, createdById: ctx.user.id },
      });
      if (!asset) throw new TRPCError({ code: 'NOT_FOUND' });
      if (input.weaveType != null || input.tone != null || input.notes != null || input.imageStatsJson != null) {
        await ctx.prisma.fabricScan.upsert({
          where: { assetId: asset.id },
          create: {
            assetId: asset.id,
            weaveType: input.weaveType ?? null,
            tone: input.tone ?? null,
            notes: input.notes ?? null,
            imageStatsJson: (input.imageStatsJson ?? undefined) as Prisma.InputJsonValue | undefined,
          },
          update: {
            weaveType: input.weaveType ?? undefined,
            tone: input.tone ?? undefined,
            notes: input.notes ?? undefined,
            imageStatsJson: (input.imageStatsJson ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      }
      return ctx.prisma.asset.findUniqueOrThrow({
        where: { id: input.assetId },
        include: { fabricScan: true },
      });
    }),
});
