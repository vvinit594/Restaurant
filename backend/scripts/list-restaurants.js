const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const rows = await p.restaurant.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      memberships: {
        where: { role: 'RESTAURANT_OWNER' },
        include: {
          user: { select: { id: true, email: true, name: true, createdAt: true } },
        },
      },
    },
  });

  for (const r of rows) {
    const owner = r.memberships[0]?.user;
    console.log(
      JSON.stringify({
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        deletedAt: r.deletedAt,
        createdAt: r.createdAt,
        ownerEmail: owner?.email || null,
        ownerCreatedAt: owner?.createdAt || null,
      }),
    );
  }
  console.log('TOTAL', rows.length);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
