import { NextResponse } from 'next/server';
import { prisma } from '~/server/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      service: 'lineage',
      timestamp: new Date().toISOString(),
      db: 'connected',
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: 'error',
        service: 'lineage',
        timestamp: new Date().toISOString(),
        db: 'disconnected',
        error: e instanceof Error ? e.message : 'unknown',
      },
      { status: 503 }
    );
  }
}
