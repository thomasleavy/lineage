import { z } from 'zod';

export const searchGarmentsSchema = z.object({
  q: z.string().max(200).optional(),
  houseCode: z.string().max(64).optional(),
  collection: z.string().max(64).optional(),
  category: z.string().max(64).optional(),
  status: z.enum(['concept', 'toile', 'sample', 'final', 'archived']).optional(),
  revisedMoreThan: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
