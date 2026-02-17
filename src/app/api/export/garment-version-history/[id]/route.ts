import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken } from '~/server/auth/session';
import { authConfig } from '~/server/auth/config';
import { getCookieFromHeader } from '~/server/lib/csrf';
import { generateGarmentVersionHistoryPdf } from '~/server/pdf/generate';
import { writeAuditLog } from '~/server/audit/service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const cookieHeader = req.headers.get('cookie');
  const token = getCookieFromHeader(cookieHeader, authConfig.cookieName);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'Invalid garment id' }, { status: 400 });
  }

  try {
    const buffer = await generateGarmentVersionHistoryPdf(id);
    await writeAuditLog({
      actorId: session.user.id,
      actionType: 'EXPORT_GARMENT_VERSION_HISTORY_PDF',
      entityType: 'GARMENT',
      entityId: id,
      afterJson: { format: 'pdf' },
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    });
    const filename = `lineage-version-history-${id.slice(0, 8)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Export failed';
    if (message === 'Garment not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Garment version history PDF export error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
