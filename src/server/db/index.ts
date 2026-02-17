import { PrismaClient } from '@prisma/client';
import { logger } from '~/server/lib/logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }]
        : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

if (process.env.NODE_ENV === 'development') {
  (prisma as unknown as { $on?: (e: string, cb: (q: { query: string }) => void) => void }).$on?.(
    'query',
    (e: { query: string }) => logger.debug({ query: e.query }, 'prisma query')
  );
}
