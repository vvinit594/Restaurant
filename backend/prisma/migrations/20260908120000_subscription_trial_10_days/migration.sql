-- Trial plan support: TRIAL status + day-based duration + plan metadata

-- Add TRIAL to SubscriptionStatus (safe if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SubscriptionStatus' AND e.enumlabel = 'TRIAL'
  ) THEN
    ALTER TYPE "SubscriptionStatus" ADD VALUE 'TRIAL';
  END IF;
END $$;

ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "billingDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "planType" TEXT NOT NULL DEFAULT 'PAID';
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "paymentRequired" BOOLEAN NOT NULL DEFAULT true;

-- Upsert 10-day free trial (sortOrder 0 = first card)
INSERT INTO "subscription_plans" (
  "id", "code", "name", "priceLabel", "priceAmount", "billingMonths", "billingDays",
  "branchLimit", "badge", "description", "specialNotice", "isNewRestaurantOnly",
  "planType", "paymentRequired", "features", "sortOrder", "isActive", "createdAt", "updatedAt"
) VALUES (
  'plan_trial_10_days_v1',
  'TRIAL_10_DAYS',
  '10 Days Free Trial',
  '₹0 / 10 Days',
  0,
  0,
  10,
  5,
  'FREE TRIAL',
  'Free Trial for New Restaurants',
  'No payment required during the trial period',
  true,
  'FREE_TRIAL',
  false,
  '["Digital Menu & QR Code","Loyalty Program","Analytics & Insights","Regular Updates & Support"]'::jsonb,
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "priceLabel" = EXCLUDED."priceLabel",
  "priceAmount" = EXCLUDED."priceAmount",
  "billingMonths" = EXCLUDED."billingMonths",
  "billingDays" = EXCLUDED."billingDays",
  "branchLimit" = EXCLUDED."branchLimit",
  "badge" = EXCLUDED."badge",
  "description" = EXCLUDED."description",
  "specialNotice" = EXCLUDED."specialNotice",
  "isNewRestaurantOnly" = EXCLUDED."isNewRestaurantOnly",
  "planType" = EXCLUDED."planType",
  "paymentRequired" = EXCLUDED."paymentRequired",
  "features" = EXCLUDED."features",
  "sortOrder" = 0,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep Monthly / Launch active with correct sort order (do not change pricing)
UPDATE "subscription_plans"
SET
  "sortOrder" = 1,
  "billingDays" = 0,
  "planType" = 'PAID',
  "paymentRequired" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'MONTHLY';

UPDATE "subscription_plans"
SET
  "sortOrder" = 2,
  "billingDays" = 0,
  "planType" = 'PAID',
  "paymentRequired" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'LAUNCH';
