/**
 * Enqueue jobs from API (e.g. async PDF export). Uses same pg-boss DB.
 */
import PgBoss from 'pg-boss';

let bossInstance: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (bossInstance) return bossInstance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL required');
  const boss = new PgBoss(connectionString);
  await boss.start();
  bossInstance = boss;
  return boss;
}

export async function sendPdfExportJob(payload: {
  exportJobId: string;
  lookId: string;
  type: string;
  userId: string;
}): Promise<string> {
  const boss = await getBoss();
  const jobId = await boss.send('pdf-export', payload);
  return jobId ?? payload.exportJobId;
}

export async function sendImageStatsJob(payload: { assetId: string }): Promise<string | null> {
  const boss = await getBoss();
  return boss.send('image-stats', payload);
}
