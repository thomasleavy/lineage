import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken } from '~/server/auth/session';
import { getCookieFromHeader } from '~/server/lib/csrf';
import { authConfig } from '~/server/auth/config';
import { prisma } from '~/server/db';
import { getPresignedGetUrl } from '~/server/storage/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieHeader = req.headers.get('cookie');
  const token = getCookieFromHeader(cookieHeader, authConfig.cookieName);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSessionByToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id;
  const job = await prisma.exportJob.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const payload: { status: string; downloadUrl?: string; errorMessage?: string } = {
    status: job.status,
  };
  if (job.status === 'ready' && job.storageKey) {
    payload.downloadUrl = await getPresignedGetUrl(job.storageKey, 300); // 5 min
  }
  if (job.status === 'failed' && job.errorMessage) {
    payload.errorMessage = job.errorMessage;
  }
  return NextResponse.json(payload);
}
