/**
 * Soft-delete known agent/API test restaurants from the local DB.
 * Does NOT wipe the restaurants table. Keep intentional UI restaurants.
 *
 * Safe to remove (test/agent artifacts):
 * - Isolation A / Isolation B (agent E2E tenant-isolation check)
 * - Test Delete Kitchen (agent delete flow check)
 * - Test Restaurant (testowner@example.com)
 * - Big Img 2 (bigowner2@example.com — cover upload testing)
 * - Duplicate Vinit Kitchen (vinit-kitchen-2, created ~27s after first)
 *
 * Keep:
 * - Gateway Restaurant
 * - Vinit Kitchen (slug: vinit-kitchen)
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const REMOVE_SLUGS = new Set([
  'isolation-28317',
  'isolation-b-80431',
  'test-delete-dish-12800',
  'test-restaurant',
  'big-img',
  'vinit-kitchen-2',
]);

const REMOVE_OWNER_EMAIL_SUFFIXES = ['@example.com'];

(async () => {
  const all = await prisma.restaurant.findMany({
    where: { deletedAt: null },
    include: {
      memberships: {
        where: { role: 'RESTAURANT_OWNER' },
        include: { user: { select: { email: true } } },
        take: 1,
      },
    },
  });

  const targets = all.filter((r) => {
    if (REMOVE_SLUGS.has(r.slug)) return true;
    // Catch other agent random isolation-* leftovers without touching gateway/vinit-kitchen
    if (/^isolation(-b)?-\d+$/.test(r.slug)) return true;
    if (/^test-delete-dish-\d+$/.test(r.slug)) return true;
    const ownerEmail = r.memberships[0]?.user?.email || '';
    if (
      ownerEmail &&
      REMOVE_OWNER_EMAIL_SUFFIXES.some((s) => ownerEmail.endsWith(s)) &&
      r.slug !== 'gateway-restaurant' &&
      r.slug !== 'vinit-kitchen'
    ) {
      return true;
    }
    return false;
  });

  console.log('Will soft-delete:');
  for (const r of targets) {
    console.log(` - ${r.name} /${r.slug}`);
  }
  console.log(`Count: ${targets.length}`);

  for (const r of targets) {
    await prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id: r.id },
        data: { deletedAt: new Date(), status: 'ARCHIVED' },
      });
      await tx.restaurantMembership.updateMany({
        where: { restaurantId: r.id, isActive: true },
        data: { isActive: false },
      });
      await tx.subscription.updateMany({
        where: { restaurantId: r.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });
      await tx.dish.updateMany({
        where: { restaurantId: r.id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          isPublished: false,
          isAvailable: false,
        },
      });
    });
  }

  const remaining = await prisma.restaurant.findMany({
    where: { deletedAt: null, NOT: { status: 'ARCHIVED' } },
    orderBy: { createdAt: 'asc' },
    select: { name: true, slug: true, createdAt: true },
  });
  console.log('Remaining active restaurants:');
  for (const r of remaining) {
    console.log(` - ${r.name} /${r.slug} (${r.createdAt.toISOString()})`);
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
