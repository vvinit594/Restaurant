require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.subscription
  .findUnique({
    where: { id: 'cmulf7qlf0008l4048vw0ldm1' },
    select: {
      status: true,
      paymentStatus: true,
      razorpayCustomerId: true,
      razorpaySubscriptionId: true,
      razorpayPlanId: true,
      plan: { select: { code: true } },
    },
  })
  .then((row) => {
    console.log(
      JSON.stringify({
        plan: row?.plan.code || null,
        status: row?.status || null,
        payment: row?.paymentStatus || null,
        hasCustomer: Boolean(row?.razorpayCustomerId),
        hasSub: Boolean(row?.razorpaySubscriptionId),
        hasPlan: Boolean(row?.razorpayPlanId),
      }),
    );
  })
  .catch((err) => {
    console.error(err.code || err.name);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
