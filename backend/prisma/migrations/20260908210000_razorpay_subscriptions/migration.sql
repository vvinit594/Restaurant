-- Razorpay subscriptions + payment history + webhook idempotency

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SubscriptionStatus' AND e.enumlabel = 'PENDING'
  ) THEN
    ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SubscriptionStatus' AND e.enumlabel = 'SUSPENDED'
  ) THEN
    ALTER TYPE "SubscriptionStatus" ADD VALUE 'SUSPENDED';
  END IF;
END $$;

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "razorpayCustomerId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "razorpayPlanId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "razorpayTokenId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paymentFailedAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "gracePeriodStartedAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "nextPaymentAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpaySubscriptionId_key"
  ON "subscriptions"("razorpaySubscriptionId");

CREATE INDEX IF NOT EXISTS "subscriptions_status_gracePeriodEndsAt_idx"
  ON "subscriptions"("status", "gracePeriodEndsAt");

CREATE INDEX IF NOT EXISTS "subscriptions_razorpayCustomerId_idx"
  ON "subscriptions"("razorpayCustomerId");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "razorpayPaymentId" TEXT,
  "razorpaySubscriptionId" TEXT,
  "razorpayOrderId" TEXT,
  "planCode" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "method" TEXT,
  "failureReason" TEXT,
  "paidAt" TIMESTAMP(3),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpayPaymentId_key"
  ON "payments"("razorpayPaymentId");

CREATE INDEX IF NOT EXISTS "payments_restaurantId_createdAt_idx"
  ON "payments"("restaurantId", "createdAt");

CREATE INDEX IF NOT EXISTS "payments_subscriptionId_idx"
  ON "payments"("subscriptionId");

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "razorpay_webhook_events" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "razorpay_webhook_events_eventId_key"
  ON "razorpay_webhook_events"("eventId");

CREATE INDEX IF NOT EXISTS "razorpay_webhook_events_eventType_processedAt_idx"
  ON "razorpay_webhook_events"("eventType", "processedAt");
