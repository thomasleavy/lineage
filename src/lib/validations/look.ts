import { z } from 'zod';

export const createLookSchema = z.object({
  name: z.string().min(1).max(128),
  collection: z.string().min(1).max(64),
  type: z.enum(['run_of_show', 'press']),
});

export const updateLookSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  collection: z.string().min(1).max(64).optional(),
  type: z.enum(['run_of_show', 'press']).optional(),
});

export const reorderLookItemsSchema = z.object({
  lookId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()),
});

export const addLookItemSchema = z
  .object({
    lookId: z.string().uuid(),
    garmentId: z.string().uuid().optional(),
    houseCode: z.string().min(1).max(64).optional(),
    orderIndex: z.number().int().min(0),
    modelName: z.string().max(128).optional().nullable(),
    stylingNotes: z.string().max(2000).optional().nullable(),
  })
  .refine((data) => !!data.garmentId || !!data.houseCode?.trim(), {
    message: 'Provide either garmentId or houseCode',
    path: ['garmentId'],
  });
