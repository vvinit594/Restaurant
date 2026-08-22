/**
 * Idempotent QR backfill for existing restaurants.
 * Does NOT create restaurants.
 */
const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

function publicWebUrl() {
  const raw =
    process.env.PUBLIC_WEB_URL ||
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:3000';
  return String(raw).replace(/\/+$/, '');
}

function buildTargetUrl(slug, token) {
  return `${publicWebUrl()}/r/${slug}/t/${token}#menu`;
}

(async () => {
  require('dotenv').config();
  const restaurants = await prisma.restaurant.findMany({
    where: { deletedAt: null, NOT: { status: 'ARCHIVED' } },
    select: { id: true, name: true, slug: true },
  });

  let created = 0;
  for (const r of restaurants) {
    const existing = await prisma.qrCode.findFirst({
      where: { restaurantId: r.id, status: 'ACTIVE' },
    });
    if (existing) {
      console.log(`OK  ${r.name} already has QR ${existing.token}`);
      continue;
    }
    const token = randomBytes(16).toString('hex');
    await prisma.qrCode.create({
      data: {
        restaurantId: r.id,
        token,
        targetUrl: buildTargetUrl(r.slug, token),
        status: 'ACTIVE',
      },
    });
    created += 1;
    console.log(`NEW ${r.name} → ${token}`);
  }
  console.log(`Done. created=${created} scanned=${restaurants.length}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
