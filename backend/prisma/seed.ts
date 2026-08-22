import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    priceLabel: '₹0/mo',
    sortOrder: 1,
    features: ['1 branch', '50 dishes', '5 QR tables'],
  },
  {
    code: 'STARTER',
    name: 'Starter',
    priceLabel: '₹999/mo',
    sortOrder: 2,
    features: ['2 branches', '200 dishes', '25 QR tables'],
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    priceLabel: '₹2,499/mo',
    sortOrder: 3,
    features: ['5 branches', 'Unlimited dishes', '100 QR tables', 'Analytics'],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    priceLabel: 'Custom',
    sortOrder: 4,
    features: ['Unlimited branches', 'SLA', 'Custom QR domains', 'Priority support'],
  },
];

async function seedPlans() {
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: plan,
      update: {
        name: plan.name,
        priceLabel: plan.priceLabel,
        features: plan.features,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`Subscription plans upserted: ${PLANS.map((p) => p.code).join(', ')}`);
}

async function seedSuperAdmin() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
  const name = String(
    process.env.SUPER_ADMIN_NAME || 'Platform Super Admin',
  ).trim();

  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env for seeding.',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        name: existing.name || name,
      },
    });
    console.log(`Super Admin already exists: ${email} (ensured active SUPER_ADMIN)`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`Super Admin created: ${email}`);
}

async function main() {
  // Seed NEVER creates restaurants. Only Super Admin + subscription plans.
  await seedPlans();
  await seedSuperAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
