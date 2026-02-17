import { router, garmentViewProcedure } from '../trpc';
import { searchGarmentsSchema } from '~/lib/validations/search';
import { Prisma } from '@prisma/client';

export const searchRouter = router({
  garments: garmentViewProcedure.input(searchGarmentsSchema).query(async ({ ctx, input }) => {
    const where: Prisma.GarmentWhereInput = {};

    if (input.houseCode?.trim()) {
      where.houseCode = { contains: input.houseCode.trim(), mode: 'insensitive' };
    }
    if (input.collection?.trim()) {
      where.collection = { contains: input.collection.trim(), mode: 'insensitive' };
    }
    if (input.category?.trim()) {
      where.category = { contains: input.category.trim(), mode: 'insensitive' };
    }
    if (input.status) where.status = input.status;

    if (input.revisedMoreThan != null && input.revisedMoreThan > 0) {
      const garmentIdsWithEnoughVersions = await ctx.prisma.garmentVersion.groupBy({
        by: ['garmentId'],
        _count: { id: true },
        having: { id: { _count: { gt: input.revisedMoreThan } } },
      });
      const ids = garmentIdsWithEnoughVersions.map((g) => g.garmentId);
      where.id = ids.length > 0 ? { in: ids } : { in: ['__none__'] };
    }

    if (input.q && input.q.trim()) {
      const q = input.q.trim();
      where.OR = [
        { houseCode: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { collection: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        {
          versions: {
            some: {
              changeDetail: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];
      // If FTS columns exist (from migration), use them for better relevance
      // Raw query option: await ctx.prisma.$queryRaw with to_tsquery
      try {
        const ftsResults = await ctx.prisma.$queryRaw<{ id: string }[]>`
          SELECT g.id FROM garments g
          LEFT JOIN garment_versions gv ON gv.garment_id = g.id
          WHERE (g.notes_fts IS NOT NULL AND g.notes_fts @@ plainto_tsquery('english', ${q}))
             OR (gv.change_detail_fts IS NOT NULL AND gv.change_detail_fts @@ plainto_tsquery('english', ${q}))
          LIMIT 500
        `;
        if (ftsResults.length > 0) {
          const ftsIds = [...new Set(ftsResults.map((r) => r.id))];
          where.OR = [{ id: { in: ftsIds } }, ...((where.OR as Prisma.GarmentWhereInput[]) ?? [])];
        }
      } catch {
        // FTS columns may not exist; ILIKE above is used
      }
    }

    const [items, total] = await Promise.all([
      ctx.prisma.garment.findMany({
        where,
        include: {
          currentVersion: true,
          designerOwner: { select: { id: true, name: true, email: true } },
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: input.limit,
        skip: input.offset,
      }),
      ctx.prisma.garment.count({ where }),
    ]);

    return { items, total };
  }),
});
