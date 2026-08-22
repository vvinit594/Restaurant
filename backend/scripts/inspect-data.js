require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const rest = await p.restaurant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, status: true },
  });
  console.log('restaurants', rest);

  for (const r of rest) {
    const dishes = await p.dish.findMany({
      where: { restaurantId: r.id },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        isAvailable: true,
        isPublished: true,
      },
    });
    const qrs = await p.qrCode.findMany({
      where: { restaurantId: r.id },
      select: { id: true, token: true, status: true },
    });
    const cats = await p.category.count({
      where: { restaurantId: r.id, deletedAt: null },
    });
    const mems = await p.restaurantMembership.findMany({
      where: { restaurantId: r.id },
      include: {
        user: { select: { email: true, role: true, isActive: true } },
      },
    });
    console.log(
      JSON.stringify(
        {
          slug: r.slug,
          dishes,
          qrs,
          cats,
          mems: mems.map((m) => ({
            email: m.user.email,
            role: m.role,
            isActive: m.isActive,
            userActive: m.user.isActive,
          })),
        },
        null,
        2,
      ),
    );
  }

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
