import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken } from '~/server/auth/session';
import { authConfig } from '~/server/auth/config';
import { validateCsrf, getCookieFromHeader } from '~/server/lib/csrf';
import { prisma } from '~/server/db';
import { uploadToS3 } from '~/server/storage/client';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie');
  if (!validateCsrf(cookieHeader, req.headers.get('x-csrf-token'))) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const token = getCookieFromHeader(cookieHeader, authConfig.cookieName);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSessionByToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const assetId = formData.get('assetId') as string | null;
  if (!file || !assetId) {
    return NextResponse.json({ error: 'Missing file or assetId' }, { status: 400 });
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, createdById: session.user.id },
  });
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await uploadToS3(asset.storageKey, buffer, file.type || 'application/octet-stream');
    return NextResponse.json({ assetId: asset.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    const isDev = process.env.NODE_ENV === 'development';
    console.error('[upload]', err);
    return NextResponse.json(
      {
        error: 'Upload failed',
        ...(isDev && { details: message }),
      },
      { status: 500 }
    );
  }
}
