/**
 * Background job worker (pg-boss).
 * Run: npm run job:worker
 * Jobs: pdf-export (async PDF generation), audit-batch (optional), image-stats (optional).
 */
import PgBoss from 'pg-boss';
import { prisma } from '~/server/db';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const boss = new PgBoss(connectionString);

boss.work('pdf-export', {}, async (jobOrJobs) => {
  const job = (Array.isArray(jobOrJobs) ? jobOrJobs[0] : jobOrJobs) as {
    data: { exportJobId: string; lookId: string; type: string; userId: string };
  } | undefined;
  if (!job?.data) return;
  const { exportJobId, lookId, type, userId } = job.data;
  try {
    await prisma.exportJob.updateMany({
      where: { id: exportJobId, userId },
      data: { status: 'processing' },
    });
    const { generateLookbookPdf } = await import('~/server/pdf/generate');
    const buffer = await generateLookbookPdf({
      lookId,
      type: type as 'run_of_show' | 'press',
      redactInternal: type === 'press',
    });
    const { uploadToS3 } = await import('~/server/storage/client');
    const storageKey = `exports/${exportJobId}.pdf`;
    await uploadToS3(storageKey, Buffer.from(buffer), 'application/pdf');
    await prisma.exportJob.updateMany({
      where: { id: exportJobId, userId },
      data: { status: 'ready', storageKey, completedAt: new Date() },
    });
    return { size: buffer.length, exportJobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await prisma.exportJob.updateMany({
      where: { id: exportJobId, userId },
      data: { status: 'failed', errorMessage: message, completedAt: new Date() },
    });
    throw err;
  }
});

boss.work('image-stats', {}, async (jobOrJobs) => {
  const job = (Array.isArray(jobOrJobs) ? jobOrJobs[0] : jobOrJobs) as { data: { assetId: string } } | undefined;
  if (!job?.data) return;
  const { assetId } = job.data;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return {};
  const scan = await prisma.fabricScan.findUnique({ where: { assetId } });
  if (!scan) return {};
  const stats = { computedAt: new Date().toISOString(), dominantColor: '#888888', contrast: 0.5 };
  await prisma.fabricScan.update({
    where: { assetId },
    data: { imageStatsJson: stats },
  });
  return stats;
});

async function main() {
  await boss.start();
  console.log('LINEAGE job worker started. Jobs: pdf-export, image-stats');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
