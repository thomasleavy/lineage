import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const BASE = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/lineage_test?schema=public';

describe('Garments integration', () => {
  let userId: string;
  let garmentId: string;

  beforeAll(async () => {
    const hash = await argon2.hash('test');
    const user = await prisma.user.upsert({
      where: { email: 'test@lineage.test' },
      create: {
        email: 'test@lineage.test',
        name: 'Test',
        passwordHash: hash,
      },
      update: {},
    });
    userId = user.id;
    const role = await prisma.role.findFirst({ where: { name: 'LEAD_DESIGNER' } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
  });

  afterAll(async () => {
    await prisma.garment.deleteMany({ where: { houseCode: 'TEST-FW26-001' } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: 'test@lineage.test' } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('creates garment with first version', async () => {
    const version = await prisma.garmentVersion.create({
      data: {
        garment: {
          create: {
            houseCode: 'TEST-FW26-001',
            collection: 'FW26',
            category: 'coat',
            status: 'concept',
            designerOwnerId: userId,
          },
        },
        versionNumber: 1,
        createdBy: { connect: { id: userId } },
        changeSummary: 'Initial',
        snapshotJson: { houseCode: 'TEST-FW26-001', collection: 'FW26' },
      },
      include: { garment: true },
    });
    garmentId = version.garmentId;
    await prisma.garment.update({
      where: { id: garmentId },
      data: { currentVersionId: version.id },
    });
    const g = await prisma.garment.findUnique({
      where: { id: garmentId },
      include: { currentVersion: true },
    });
    expect(g?.houseCode).toBe('TEST-FW26-001');
    expect(g?.currentVersion?.versionNumber).toBe(1);
  });

  it('creates second version immutably', async () => {
    const v2 = await prisma.garmentVersion.create({
      data: {
        garmentId,
        versionNumber: 2,
        createdById: userId,
        changeSummary: 'Updated notes',
        snapshotJson: { houseCode: 'TEST-FW26-001', collection: 'FW26', notes: 'Updated' },
      },
    });
    await prisma.garment.update({
      where: { id: garmentId },
      data: { currentVersionId: v2.id },
    });
    const count = await prisma.garmentVersion.count({ where: { garmentId } });
    expect(count).toBe(2);
  });
});
