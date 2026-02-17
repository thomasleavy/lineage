import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { LookbookDocument } from './LookbookDocument';
import { GarmentVersionHistoryDocument, type VersionForPdf } from './GarmentVersionHistoryDocument';
import { prisma } from '~/server/db';
import { getFromS3 } from '~/server/storage/client';

export type PdfOptions = {
  lookId: string;
  type: 'run_of_show' | 'press';
  redactInternal: boolean;
};

export async function generateLookbookPdf(options: PdfOptions): Promise<Buffer> {
  const look = await prisma.look.findUnique({
    where: { id: options.lookId },
    include: {
      lookItems: {
        orderBy: { orderIndex: 'asc' },
        include: {
          garment: {
            include: { currentVersion: true },
          },
        },
      },
    },
  });
  if (!look) throw new Error('Look not found');
  const items = look.lookItems.map((li) => {
    const cv = li.garment.currentVersion;
    return {
      orderIndex: li.orderIndex,
      summary: cv?.changeSummary != null ? String(cv.changeSummary) : null,
      detail: cv?.changeDetail != null ? String(cv.changeDetail) : null,
      garment: {
        houseCode: String(li.garment.houseCode),
        collection: String(li.garment.collection),
        category: String(li.garment.category),
        status: String(li.garment.status ?? ''),
      },
    };
  });
  const docType = look.type === 'press' ? 'press' : 'run_of_show';
  const buffer = await renderToBuffer(
    React.createElement(LookbookDocument, {
      lookName: String(look.name),
      collection: String(look.collection),
      type: docType,
      items,
      redactInternal: options.redactInternal,
    }) as React.ReactElement
  );
  return Buffer.from(buffer);
}

const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

function toDataUrl(contentType: string, buffer: Buffer): string {
  const base64 = buffer.toString('base64');
  const mime = IMAGE_CONTENT_TYPES.has(contentType) ? contentType : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

export async function generateGarmentVersionHistoryPdf(garmentId: string): Promise<Buffer> {
  const garment = await prisma.garment.findUnique({
    where: { id: garmentId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: {
          createdBy: { select: { name: true } },
          assets: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!garment) throw new Error('Garment not found');

  const versions: VersionForPdf[] = await Promise.all(
    garment.versions.map(async (v) => {
      const snap = (v.snapshotJson ?? {}) as Record<string, unknown>;
      const rawStatus = (typeof snap.status === 'string' ? snap.status : 'concept') as string;
      const status = ['concept', 'toile', 'sample', 'final', 'archived'].includes(rawStatus)
        ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)
        : rawStatus;

      const images: { dataUrl: string; originalFilename: string }[] = [];
      for (const asset of v.assets) {
        try {
          const buf = await getFromS3(asset.storageKey);
          const dataUrl = toDataUrl(asset.contentType, buf);
          images.push({ dataUrl, originalFilename: asset.originalFilename });
        } catch {
          // Skip assets that fail to load (missing in S3, etc.)
        }
      }

      return {
        versionNumber: v.versionNumber,
        createdAt: v.createdAt,
        createdByName: v.createdBy?.name ?? '—',
        changeSummary: v.changeSummary,
        changeDetail: v.changeDetail,
        status,
        snapshotJson: snap,
        isCurrent: garment.currentVersionId === v.id,
        images,
      };
    })
  );

  const buffer = await renderToBuffer(
    React.createElement(GarmentVersionHistoryDocument, {
      houseCode: String(garment.houseCode),
      collection: String(garment.collection),
      category: String(garment.category ?? ''),
      status: String(garment.status ?? ''),
      versions,
      generatedAt: new Date().toLocaleString(),
    }) as React.ReactElement
  );
  return Buffer.from(buffer);
}
