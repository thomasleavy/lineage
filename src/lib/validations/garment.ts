import { z } from 'zod';

export const houseCodeSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9\-_]+$/);
export const collectionSchema = z.string().min(1).max(64);
export const categorySchema = z.string().min(1).max(64);
export const statusSchema = z.enum(['concept', 'toile', 'sample', 'final', 'archived']);

export const createGarmentSchema = z.object({
  houseCode: houseCodeSchema,
  collection: collectionSchema,
  category: categorySchema,
  designerOwnerId: z.string().uuid().optional().nullable(),
  status: statusSchema.default('concept'),
  silhouetteTags: z.array(z.string().max(32)).max(20).default([]),
  /** First version summary (e.g. "New item"). Shown as Current version summary on detail page. */
  changeSummary: z.string().max(256).optional(),
  /** First version detail / notes. Same as Detail (optional) on version modal; stored as notes and version changeDetail. */
  notes: z.string().max(10000).optional().nullable(),
});

export const updateGarmentSchema = z.object({
  collection: collectionSchema.optional(),
  category: categorySchema.optional(),
  designerOwnerId: z.string().uuid().optional().nullable(),
  status: statusSchema.optional(),
  silhouetteTags: z.array(z.string().max(32)).max(20).optional(),
  notes: z.string().max(10000).optional().nullable(),
});

export const createVersionSchema = z.object({
  garmentId: z.string().uuid(),
  changeSummary: z.string().min(1).max(256),
  changeDetail: z.string().max(10000).optional().nullable(),
  diffTags: z.array(z.string().max(32)).max(20).optional().default([]),
  status: statusSchema.optional().default('concept'),
});

export const rollbackSchema = z.object({
  garmentId: z.string().uuid(),
});
