import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken } from '~/server/auth/session';
import { authConfig } from '~/server/auth/config';
import { validateCsrf, getCookieFromHeader } from '~/server/lib/csrf';
import { canExportPressPdf, canExportRunOfShowPdf } from '~/server/rbac';
import { checkExportRateLimit } from '~/server/lib/rate-limit';
import { writeAuditLog } from '~/server/audit/service';
import { prisma } from '~/server/db';
import { sendPdfExportJob } from '~/server/jobs/client';
import { z } from 'zod';

const bodySchema = z.object({
  lookId: z.string().uuid(),
  type: z.enum(['run_of_show', 'press']),
  async: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie');
  if (!validateCsrf(cookieHeader, req.headers.get('x-csrf-token'))) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const token = getCookieFromHeader(cookieHeader, authConfig.cookieName);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, remaining } = checkExportRateLimit(session.user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many exports. Try again later.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  }

  const canPress = canExportPressPdf(session.user.userRoles);
  const canRunOfShow = canExportRunOfShowPdf(session.user.userRoles);
  if (!canPress && !canRunOfShow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }
  const { lookId, type, async: wantAsync } = parsed.data;
  const isAsync = wantAsync === true;

  if (type === 'press' && !canPress) {
    return NextResponse.json({ error: 'Forbidden: cannot export press PDF' }, { status: 403 });
  }
  if (type === 'run_of_show' && !canRunOfShow) {
    return NextResponse.json({ error: 'Forbidden: cannot export run-of-show PDF' }, { status: 403 });
  }

  const actionType = type === 'press' ? 'EXPORT_PDF_PRESS' : 'EXPORT_PDF_RUN_OF_SHOW';

  if (isAsync) {
    try {
      const exportJob = await prisma.exportJob.create({
        data: {
          lookId,
          type,
          userId: session.user.id,
          status: 'queued',
        },
      });
      await sendPdfExportJob({
        exportJobId: exportJob.id,
        lookId,
        type,
        userId: session.user.id,
      });
      await writeAuditLog({
        actorId: session.user.id,
        actionType,
        entityType: 'LOOK',
        entityId: lookId,
        afterJson: { type, exportJobId: exportJob.id, queued: true },
        ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
        userAgent: req.headers.get('user-agent') ?? null,
      });
      return NextResponse.json(
        { exportJobId: exportJob.id, status: 'queued' },
        { headers: { 'X-RateLimit-Remaining': String(remaining - 1) } }
      );
    } catch (e) {
      console.error('Queue export error', e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Failed to queue export' },
        { status: 500 }
      );
    }
  }

  try {
    const { generateLookbookPdf } = await import('~/server/pdf/generate');
    const buffer = await generateLookbookPdf({
      lookId,
      type,
      redactInternal: type === 'press',
    });
    await writeAuditLog({
      actorId: session.user.id,
      actionType,
      entityType: 'LOOK',
      entityId: lookId,
      afterJson: { type },
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    });
    const filename = `lineage-lookbook-${lookId.slice(0, 8)}-${type}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'X-RateLimit-Remaining': String(remaining - 1),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Export failed';
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('PDF export error', message, stack);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
