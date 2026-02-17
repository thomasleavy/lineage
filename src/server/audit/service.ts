import { createHash } from 'crypto';
import { prisma } from '~/server/db';
import type { AuditEntryInput } from './types';

function computeEntryHash(prevHash: string | null, payload: string): string {
  const input = prevHash ? `${prevHash}:${payload}` : payload;
  return createHash('sha256').update(input).digest('hex');
}

function buildPayload(row: {
  prevHash: string | null;
  actorId: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  traceId: string | null;
  createdAt: Date;
}) {
  return JSON.stringify({
    prevHash: row.prevHash,
    actorId: row.actorId,
    actionType: row.actionType,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeJson: row.beforeJson,
    afterJson: row.afterJson,
    ip: row.ip,
    userAgent: row.userAgent,
    requestId: row.requestId,
    traceId: row.traceId,
    createdAt: row.createdAt.toISOString(),
  });
}

export async function writeAuditLog(entry: AuditEntryInput): Promise<string> {
  const last = await prisma.auditLog.findFirst({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { entryHash: true },
  });
  const prevHash = last?.entryHash ?? null;
  const createdAt = new Date();

  const rowForHash = {
    prevHash,
    actorId: entry.actorId,
    actionType: entry.actionType,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeJson: entry.beforeJson,
    afterJson: entry.afterJson,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
    requestId: entry.requestId ?? null,
    traceId: entry.traceId ?? null,
    createdAt,
  };
  const payload = buildPayload(rowForHash);
  const entryHash = computeEntryHash(prevHash, payload);

  const created = await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      actionType: entry.actionType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeJson: entry.beforeJson ?? undefined,
      afterJson: entry.afterJson ?? undefined,
      ip: entry.ip ?? undefined,
      userAgent: entry.userAgent ?? undefined,
      requestId: entry.requestId ?? undefined,
      traceId: entry.traceId ?? undefined,
      createdAt,
      prevHash,
      entryHash,
    },
  });
  return created.id;
}

/** Verify hash chain integrity (for LEGAL_AUDIT / ops) */
export async function verifyAuditChain(): Promise<{ valid: boolean; firstBrokenId?: string }> {
  const logs = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      prevHash: true,
      entryHash: true,
      actorId: true,
      actionType: true,
      entityType: true,
      entityId: true,
      beforeJson: true,
      afterJson: true,
      ip: true,
      userAgent: true,
      requestId: true,
      traceId: true,
      createdAt: true,
    },
  });
  for (const log of logs) {
    const payload = buildPayload({
      prevHash: log.prevHash,
      actorId: log.actorId,
      actionType: log.actionType,
      entityType: log.entityType,
      entityId: log.entityId,
      beforeJson: log.beforeJson,
      afterJson: log.afterJson,
      ip: log.ip,
      userAgent: log.userAgent,
      requestId: log.requestId,
      traceId: log.traceId,
      createdAt: log.createdAt,
    });
    const expected = computeEntryHash(log.prevHash, payload);
    if (log.entryHash !== expected) {
      return { valid: false, firstBrokenId: log.id };
    }
  }
  return { valid: true };
}

/** Recompute hashes for the entire chain (fixes breaks from ordering or one-off edits). Use after fixing ordering. */
export async function repairAuditChain(): Promise<{ repaired: number }> {
  const logs = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      prevHash: true,
      actorId: true,
      actionType: true,
      entityType: true,
      entityId: true,
      beforeJson: true,
      afterJson: true,
      ip: true,
      userAgent: true,
      requestId: true,
      traceId: true,
      createdAt: true,
    },
  });
  let prevHash: string | null = null;
  let repaired = 0;
  for (const log of logs) {
    const rowForHash = {
      prevHash,
      actorId: log.actorId,
      actionType: log.actionType,
      entityType: log.entityType,
      entityId: log.entityId,
      beforeJson: log.beforeJson,
      afterJson: log.afterJson,
      ip: log.ip,
      userAgent: log.userAgent,
      requestId: log.requestId,
      traceId: log.traceId,
      createdAt: log.createdAt,
    };
    const payload = buildPayload(rowForHash);
    const entryHash = computeEntryHash(prevHash, payload);
    await prisma.auditLog.update({
      where: { id: log.id },
      data: { prevHash, entryHash },
    });
    prevHash = entryHash;
    repaired += 1;
  }
  return { repaired };
}
