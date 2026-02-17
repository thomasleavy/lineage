import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ROLES = [
  'CREATIVE_DIRECTOR',
  'LEAD_DESIGNER',
  'ATELIER',
  'ASSISTANT',
  'ARCHIVE_READONLY',
  'LEGAL_AUDIT',
] as const;

// Autumn/Winter (AW) not Fall/Winter (FW)
const COLLECTIONS = ['AW26', 'SS27'];
const CATEGORIES = ['coat', 'dress', 'trouser', 'jacket', 'skirt'];

// Rich, varied notes as if items have been worked on
const GARMENT_NOTES: Record<string, string> = {
  coat: 'Wool blend, single-breasted. First toile approved; shoulder line adjusted after fitting. Lining: cupro. Buttons: horn.',
  dress: 'Silk crepe, bias cut. Second fitting done; hem length confirmed. Internal waist stay added. Press sample due next week.',
  trouser: 'Mid-grey flannel, high waist. Pattern revised for fuller leg. Fabric passed; cutting ticket raised. Topstitch detail on waistband.',
  jacket: 'Structured blazer, patch pockets. Fitting notes: take in at centre back. Canvas and shoulder construction signed off.',
  skirt: 'Pleated, wool mix. Length approved at knee. Zip placement confirmed. Lining to match.',
};

// Version history entries (change summary + detail) for a worked-on feel
const VERSION_HISTORY: { summary: string; detail: string }[] = [
  { summary: 'Initial version', detail: 'Sketch approved. Tech pack issued.' },
  { summary: 'Fabric swap', detail: 'Supplier sample approved. New fabric ref: TEX-442. Colour match confirmed.' },
  { summary: 'Fitting amendments', detail: 'Back neck drop reduced 0.5cm. Sleeve pitch adjusted. Second toile requested.' },
  { summary: 'Construction update', detail: 'Lining attachment method revised. Internal finishes updated on spec.' },
  { summary: 'Sample sign-off', detail: 'Press sample approved with minor thread trim. Ready for lookbook.' },
];

// Stock images (Pexels) – one per garment; category-appropriate filenames/notes
const STOCK_IMAGES: { photoId: string; credit: string; type: string; filename: string; fabricNote?: string }[] = [
  { photoId: '235525', credit: 'Photo by Pixabay (Pexels)', type: 'scan', filename: 'coat-wool-texture.jpg', fabricNote: 'Coat-weight wool blend.' },
  { photoId: '3735439', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'scan', filename: 'dress-fabric.jpg', fabricNote: 'Dress fabric, drape test.' },
  { photoId: '2682612', credit: 'Photo by Trần Long (Pexels)', type: 'photo', filename: 'trouser-detail.jpg', fabricNote: 'Trouser cloth, mid grey.' },
  { photoId: '4946602', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'scan', filename: 'jacket-wool.jpg', fabricNote: 'Jacket-weight wool.' },
  { photoId: '6053755', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'pattern', filename: 'skirt-weave.jpg', fabricNote: 'Skirt fabric weave.' },
  { photoId: '102129', credit: 'Photo by Keira Burton (Pexels)', type: 'photo', filename: 'garment-detail-01.jpg', fabricNote: 'Detail shot for archive.' },
  { photoId: '2911543', credit: 'Photo by Melvin Wahlin (Pexels)', type: 'scan', filename: 'fabric-swatch-01.jpg', fabricNote: 'Swatch for colour ref.' },
  { photoId: '3735438', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'scan', filename: 'texture-02.jpg', fabricNote: 'Texture ref.' },
  { photoId: '4946603', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'pattern', filename: 'weave-detail.jpg', fabricNote: 'Weave detail.' },
  { photoId: '5632402', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'photo', filename: 'garment-02.jpg', fabricNote: 'Studio ref.' },
  { photoId: '7049712', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'scan', filename: 'fabric-03.jpg', fabricNote: 'Fabric scan.' },
  { photoId: '6053754', credit: 'Photo by Karolina Grabowska (Pexels)', type: 'pattern', filename: 'pattern-04.jpg', fabricNote: 'Pattern ref.' },
];

async function main() {
  // Migrate existing FW26 → AW26 (Autumn/Winter)
  const fwGarments = await prisma.garment.findMany({ where: { collection: 'FW26' } });
  for (const g of fwGarments) {
    await prisma.garment.update({
      where: { id: g.id },
      data: {
        collection: 'AW26',
        houseCode: g.houseCode.replace('FW26', 'AW26'),
      },
    });
  }

  // Create roles
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      create: { id: crypto.randomUUID(), name },
      update: {},
    });
  }

  const roles = await prisma.role.findMany();
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  const directorPassword = await argon2.hash('director-secure');
  const designerPassword = await argon2.hash('designer-secure');
  const atelierPassword = await argon2.hash('atelier-secure');

  const director = await prisma.user.upsert({
    where: { email: 'director@lineage.demo' },
    create: {
      id: crypto.randomUUID(),
      email: 'director@lineage.demo',
      name: 'Alex Director',
      passwordHash: directorPassword,
      userRoles: { create: { roleId: roleByName.CREATIVE_DIRECTOR! } },
    },
    update: { passwordHash: directorPassword, name: 'Alex Director' },
    include: { userRoles: true },
  });

  const designer = await prisma.user.upsert({
    where: { email: 'designer@lineage.demo' },
    create: {
      id: crypto.randomUUID(),
      email: 'designer@lineage.demo',
      name: 'Sam Designer',
      passwordHash: designerPassword,
      userRoles: { create: { roleId: roleByName.LEAD_DESIGNER! } },
    },
    update: { passwordHash: designerPassword, name: 'Sam Designer' },
    include: { userRoles: true },
  });

  const atelier = await prisma.user.upsert({
    where: { email: 'atelier@lineage.demo' },
    create: {
      id: crypto.randomUUID(),
      email: 'atelier@lineage.demo',
      name: 'Jordan Atelier',
      passwordHash: atelierPassword,
      userRoles: { create: { roleId: roleByName.ATELIER! } },
    },
    update: { passwordHash: atelierPassword, name: 'Jordan Atelier' },
    include: { userRoles: true },
  });

  // Garments with rich notes and multiple versions
  for (let i = 1; i <= 12; i++) {
    const collection = COLLECTIONS[i % 2]!;
    const category = CATEGORIES[i % CATEGORIES.length]!;
    const houseCode = `ARC-${collection}-LOOK${String(i).padStart(2, '0')}-${String.fromCharCode(64 + i)}`;
    const notes = GARMENT_NOTES[category] ?? `In development. Category: ${category}. Fittings in progress.`;
    const garment = await prisma.garment.upsert({
      where: { houseCode },
      create: {
        id: crypto.randomUUID(),
        houseCode,
        collection,
        category,
        designerOwnerId: designer.id,
        status: i <= 8 ? 'sample' : 'concept',
        silhouetteTags: ['tailored', 'minimal'],
        notes,
      },
      update: { notes },
    });

    const baseSnapshot = {
      houseCode: garment.houseCode,
      collection: garment.collection,
      category: garment.category,
      status: garment.status,
      notes: garment.notes,
    };
    const v1 = await prisma.garmentVersion.upsert({
      where: { garmentId_versionNumber: { garmentId: garment.id, versionNumber: 1 } },
      create: {
        garmentId: garment.id,
        versionNumber: 1,
        createdById: designer.id,
        changeSummary: VERSION_HISTORY[0]!.summary,
        changeDetail: VERSION_HISTORY[0]!.detail,
        snapshotJson: baseSnapshot,
      },
      update: {},
    });

    // Add extra versions (2–4) so it looks worked on
    const numExtraVersions = 2 + (i % 3);
    let latestVersion = v1;
    for (let v = 2; v <= numExtraVersions; v++) {
      const hist = VERSION_HISTORY[v % VERSION_HISTORY.length]!;
      const ver = await prisma.garmentVersion.upsert({
        where: { garmentId_versionNumber: { garmentId: garment.id, versionNumber: v } },
        create: {
          garmentId: garment.id,
          versionNumber: v,
          createdById: v % 2 === 0 ? atelier.id : designer.id,
          changeSummary: hist.summary,
          changeDetail: hist.detail,
          snapshotJson: { ...baseSnapshot },
          parentVersionId: latestVersion.id,
        },
        update: {},
      });
      latestVersion = ver;
    }
    await prisma.garment.update({
      where: { id: garment.id },
      data: { currentVersionId: latestVersion.id },
    });
  }

  // One stock image per garment (all 12), with category-appropriate notes
  const allGarments = await prisma.garment.findMany({
    orderBy: { houseCode: 'asc' },
    include: { currentVersion: true },
  });
  for (let i = 0; i < allGarments.length; i++) {
    const garment = allGarments[i]!;
    const stock = STOCK_IMAGES[i % STOCK_IMAGES.length]!;
    const hasAsset = await prisma.asset.findFirst({
      where: { garmentId: garment.id, sourceUrl: { not: null } },
    });
    if (hasAsset) continue;
    const sourceUrl = `https://images.pexels.com/photos/${stock.photoId}/pexels-photo-${stock.photoId}.jpeg?auto=compress&cs=tinysrgb&w=600`;
    const asset = await prisma.asset.create({
      data: {
        garmentId: garment.id,
        garmentVersionId: garment.currentVersionId,
        type: stock.type,
        storageKey: `demo/external/${garment.id}-${stock.photoId}`,
        originalFilename: stock.filename,
        contentType: 'image/jpeg',
        sizeBytes: 0,
        createdById: designer.id,
        sourceUrl,
        sourceCredit: stock.credit + ' — https://www.pexels.com',
      },
    });
    if (stock.fabricNote) {
      await prisma.fabricScan.upsert({
        where: { assetId: asset.id },
        create: {
          assetId: asset.id,
          notes: stock.fabricNote,
          weaveType: 'various',
          tone: 'neutral',
        },
        update: { notes: stock.fabricNote },
      });
    }
  }

  console.log('Seed complete. AW26 (Autumn/Winter). Demo users: director@lineage.demo / director-secure, etc. Stock images: Pexels.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
