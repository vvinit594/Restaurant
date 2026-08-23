/**
 * Rewrite QR targetUrl rows that still point at localhost to PUBLIC_WEB_URL.
 * Usage (from backend/): node scripts/rewrite-qr-urls.js
 * Requires PUBLIC_WEB_URL in .env (production frontend origin).
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function isLocal(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ''));
}

function publicBase() {
  const raw =
    process.env.PUBLIC_WEB_URL ||
    String(process.env.FRONTEND_ORIGIN || '')
      .split(',')
      .map((s) => s.trim())
      .find((o) => o && !isLocal(o)) ||
    '';
  return String(raw).replace(/\/+$/, '');
}

async function main() {
  const base = publicBase();
  if (!base || isLocal(base)) {
    throw new Error(
      'Set PUBLIC_WEB_URL to your production frontend (e.g. https://restaurant-8815.vercel.app) before rewriting.',
    );
  }

  const restaurants = await prisma.restaurant.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      qrCodes: { select: { id: true, token: true, targetUrl: true } },
    },
  });

  let updated = 0;
  for (const r of restaurants) {
    for (const qr of r.qrCodes) {
      const next = `${base}/r/${r.slug}/t/${qr.token}#menu`;
      if (qr.targetUrl === next) continue;
      await prisma.qrCode.update({
        where: { id: qr.id },
        data: { targetUrl: next },
      });
      updated += 1;
      console.log(`updated ${r.slug} ${qr.id}`);
    }
  }

  console.log(`Done. Rewrote ${updated} QR targetUrl(s) → ${base}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
