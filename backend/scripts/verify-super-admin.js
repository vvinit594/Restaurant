const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD required');
  }

  const users = await prisma.user.findMany({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      name: true,
      passwordHash: true,
    },
  });

  const u = users[0];
  const hash = u?.passwordHash || '';
  const passwordMatchesEnv = u ? await bcrypt.compare(password, hash) : false;

  console.log(
    JSON.stringify(
      {
        count: users.length,
        email: u?.email,
        role: u?.role,
        isActive: u?.isActive,
        name: u?.name,
        hashPrefix: hash.slice(0, 7),
        hashLooksBcrypt: /^\$2[aby]\$/.test(hash),
        plainTextLeak: hash === password,
        passwordMatchesEnv,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
