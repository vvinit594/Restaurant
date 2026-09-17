/* Diagnostic only. Prints no secrets. */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const Razorpay = require('razorpay');

const p = new PrismaClient();

function maskId(value) {
  const s = String(value || '');
  if (!s) return null;
  if (s.length <= 8) return `${s.slice(0, 2)}…`;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

async function describePlan(rzp, envName, planId) {
  if (!planId) {
    console.log(envName, { configured: false });
    return;
  }
  try {
    const plan = await rzp.plans.fetch(planId);
    const item = plan.item || {};
    console.log(envName, {
      configured: true,
      idMasked: maskId(plan.id),
      period: plan.period,
      interval: plan.interval,
      amountPaise: item.amount,
      amountRupees: item.amount != null ? item.amount / 100 : null,
      currency: item.currency,
      name: item.name,
    });
  } catch (err) {
    console.log(envName, {
      configured: true,
      idMasked: maskId(planId),
      fetchError: err?.error?.description || err.message,
    });
  }
}

(async () => {
  const restaurants = await p.restaurant.findMany({
    where: {
      OR: [
        { slug: { contains: 'vinayak', mode: 'insensitive' } },
        { name: { contains: 'Vinayak', mode: 'insensitive' } },
        { name: { contains: 'DilYum', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      email: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('restaurants', restaurants.map((r) => ({
    ...r,
    id: r.id,
  })));

  for (const row of restaurants) {
    const subs = await p.subscription.findMany({
      where: { restaurantId: row.id },
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            priceAmount: true,
            priceLabel: true,
            billingMonths: true,
            billingDays: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log('subscriptions', subs.map((s) => ({
      id: s.id,
      restaurantId: s.restaurantId,
      status: s.status,
      paymentStatus: s.paymentStatus,
      plan: s.plan,
      razorpaySubscriptionId: s.razorpaySubscriptionId,
      razorpayPaymentId: s.razorpayPaymentId,
      razorpayPlanId: s.razorpayPlanId,
      razorpayCustomerId: s.razorpayCustomerId,
      gracePeriodEndsAt: s.gracePeriodEndsAt,
      endsAt: s.endsAt,
      nextPaymentAt: s.nextPaymentAt,
      lastPaymentAt: s.lastPaymentAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })));

    const pays = await p.payment.findMany({
      where: { restaurantId: row.id },
      select: {
        id: true,
        status: true,
        amount: true,
        razorpayPaymentId: true,
        razorpaySubscriptionId: true,
        planCode: true,
        failureReason: true,
        createdAt: true,
      },
    });
    console.log('payments', pays);
  }

  const recentRest = await p.restaurant.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
  console.log('recent_restaurants', recentRest);

  const ev = await p.razorpayWebhookEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { eventId: true, eventType: true, createdAt: true, processedAt: true },
  });
  console.log('recent_webhooks_count', ev.length);
  console.log('recent_webhooks', ev);

  const webhookTotal = await p.razorpayWebhookEvent.count();
  console.log('webhook_total', webhookTotal);

  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  const monthlyId = String(process.env.RAZORPAY_MONTHLY_PLAN_ID || '').trim();
  const launchId = String(process.env.RAZORPAY_LAUNCH_PLAN_ID || '').trim();

  console.log('env_plan_ids', {
    monthlyConfigured: Boolean(monthlyId),
    launchConfigured: Boolean(launchId),
    monthlyMasked: maskId(monthlyId),
    launchMasked: maskId(launchId),
    sameValue: Boolean(monthlyId && launchId && monthlyId === launchId),
  });

  if (keyId && keySecret) {
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    await describePlan(rzp, 'RAZORPAY_MONTHLY_PLAN_ID', monthlyId);
    await describePlan(rzp, 'RAZORPAY_LAUNCH_PLAN_ID', launchId);

    const subIds = [];
    for (const row of restaurants) {
      const subs = await p.subscription.findMany({
        where: { restaurantId: row.id, razorpaySubscriptionId: { not: null } },
        select: { razorpaySubscriptionId: true, razorpayPlanId: true, id: true },
      });
      subIds.push(...subs);
    }
    for (const s of subIds) {
      try {
        const fetched = await rzp.subscriptions.fetch(s.razorpaySubscriptionId);
        console.log('razorpay_subscription', {
          dilYumSubscriptionId: s.id,
          idMasked: maskId(fetched.id),
          status: fetched.status,
          planIdMasked: maskId(fetched.plan_id),
          storedPlanIdMasked: maskId(s.razorpayPlanId),
          planIdMatchesStored: fetched.plan_id === s.razorpayPlanId,
          planIdMatchesMonthlyEnv: fetched.plan_id === monthlyId,
          planIdMatchesLaunchEnv: fetched.plan_id === launchId,
          paidCount: fetched.paid_count,
          totalCount: fetched.total_count,
          quantity: fetched.quantity,
          notes: fetched.notes,
          chargeAt: fetched.charge_at,
          currentStart: fetched.current_start,
          currentEnd: fetched.current_end,
        });
        if (fetched.plan_id) {
          await describePlan(rzp, 'subscription.plan', fetched.plan_id);
        }
      } catch (err) {
        console.log('razorpay_subscription_fetch_error', {
          dilYumSubscriptionId: s.id,
          error: err?.error?.description || err.message,
        });
      }
    }
  } else {
    console.log('razorpay_client', 'not configured in local env');
  }

  await p.$disconnect();
})().catch(async (e) => {
  console.error('DIAG_ERROR', e.message);
  try { await p.$disconnect(); } catch {}
  process.exit(1);
});
