import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import {
  LEGACY_PLAN_CODES,
  SUBSCRIPTION_PLANS,
} from '../src/common/subscription-plans';

dotenv.config();

const prisma = new PrismaClient();

async function seedPlans() {
  for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        priceLabel: plan.priceLabel,
        priceAmount: plan.priceAmount,
        billingMonths: plan.billingMonths,
        billingDays: plan.billingDays,
        branchLimit: plan.branchLimit,
        badge: plan.badge,
        description: plan.description,
        specialNotice: plan.specialNotice,
        isNewRestaurantOnly: plan.isNewRestaurantOnly,
        planType: plan.planType,
        paymentRequired: plan.paymentRequired,
        features: [...plan.features],
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      update: {
        name: plan.name,
        priceLabel: plan.priceLabel,
        priceAmount: plan.priceAmount,
        billingMonths: plan.billingMonths,
        billingDays: plan.billingDays,
        branchLimit: plan.branchLimit,
        badge: plan.badge,
        description: plan.description,
        specialNotice: plan.specialNotice,
        isNewRestaurantOnly: plan.isNewRestaurantOnly,
        planType: plan.planType,
        paymentRequired: plan.paymentRequired,
        features: [...plan.features],
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
  }

  // Preserve historical plans; hide from new subscription selection.
  await prisma.subscriptionPlan.updateMany({
    where: { code: { in: [...LEGACY_PLAN_CODES] } },
    data: { isActive: false },
  });

  console.log(
    `Subscription plans upserted: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')} (legacy deactivated)`,
  );
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

async function seedSalesPerson() {
  const email = String(process.env.SALES_PERSON_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.env.SALES_PERSON_PASSWORD || '');
  const name = String(process.env.SALES_PERSON_NAME || 'Sales Person').trim();

  if (!email || !password) {
    console.log(
      'SALES_PERSON_EMAIL / SALES_PERSON_PASSWORD not set — skipping sales person seed.',
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== UserRole.SALES_PERSON) {
      console.log(
        `User ${email} exists with role ${existing.role} — not converting to SALES_PERSON.`,
      );
      return;
    }
    let profile = await prisma.salesPerson.findUnique({
      where: { userId: existing.id },
    });
    if (!profile) {
      profile = await prisma.salesPerson.create({
        data: {
          userId: existing.id,
          salesCode: 'SP00001',
          status: 'ACTIVE',
        },
      });
    }
    console.log(
      `Sales Person already exists: ${email} (${profile.salesCode})`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: UserRole.SALES_PERSON,
      isActive: true,
    },
  });
  const profile = await prisma.salesPerson.create({
    data: {
      userId: user.id,
      salesCode: 'SP00001',
      status: 'ACTIVE',
    },
  });
  console.log(`Sales Person created: ${email} (${profile.salesCode})`);
}

async function main() {
  // Seed NEVER creates restaurants. Only Super Admin + plans (+ optional Sales Person).
  await seedPlans();
  await seedSuperAdmin();
  await seedSalesPerson();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
