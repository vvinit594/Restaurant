require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const p = new PrismaClient();

(async () => {
  const user = await p.user.findUnique({
    where: { email: 'restaurant@gmail.com' },
  });
  const mem = await p.restaurantMembership.findFirst({
    where: { userId: user.id, isActive: true },
  });
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: mem.restaurantId,
      membershipRole: mem.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  const headers = { Authorization: `Bearer ${token}` };
  const base = 'http://localhost:3001/api/v1';
  const me = await fetch(`${base}/auth/me`, { headers }).then((r) => r.json());
  const dishes = await fetch(`${base}/restaurants/me/dishes`, { headers }).then(
    (r) => r.json(),
  );
  const dash = await fetch(`${base}/restaurants/me/dashboard`, {
    headers,
  }).then((r) => r.json());
  const profile = await fetch(`${base}/restaurants/me`, { headers }).then((r) =>
    r.json(),
  );
  console.log(
    JSON.stringify(
      {
        meRestaurant: me.restaurant,
        dishes: Array.isArray(dishes) ? dishes.length : dishes,
        dishName: dishes[0]?.name,
        dash,
        profileName: profile.name,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
