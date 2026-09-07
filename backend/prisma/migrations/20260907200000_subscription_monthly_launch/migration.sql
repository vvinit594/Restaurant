-- Extend subscription_plans with trusted pricing / limits metadata
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "priceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "billingMonths" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "branchLimit" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "badge" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "specialNotice" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "isNewRestaurantOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

-- Upsert new active plans
INSERT INTO "subscription_plans" (
  "id", "code", "name", "priceLabel", "priceAmount", "billingMonths", "branchLimit",
  "badge", "description", "specialNotice", "isNewRestaurantOnly", "features",
  "sortOrder", "isActive", "createdAt", "updatedAt"
) VALUES
(
  'plan_monthly_v1',
  'MONTHLY',
  'Monthly Plan',
  '₹1,499 / Month',
  1499,
  1,
  5,
  'MOST POPULAR',
  'Perfect for Established Restaurants',
  NULL,
  false,
  '["Digital Menu & QR Code","Loyalty Program","Analytics & Insights","Regular Updates & Support"]'::jsonb,
  1,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'plan_launch_v1',
  'LAUNCH',
  'Launch Plan',
  '₹2,999 / 3 Months',
  2999,
  3,
  5,
  'LAUNCH PLAN',
  'Special Launch Plan for New Restaurants',
  'Monthly trial plan only new restaurant',
  true,
  '["Digital Menu & QR Code","Loyalty Program","Analytics & Insights","Regular Updates & Support"]'::jsonb,
  2,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "priceLabel" = EXCLUDED."priceLabel",
  "priceAmount" = EXCLUDED."priceAmount",
  "billingMonths" = EXCLUDED."billingMonths",
  "branchLimit" = EXCLUDED."branchLimit",
  "badge" = EXCLUDED."badge",
  "description" = EXCLUDED."description",
  "specialNotice" = EXCLUDED."specialNotice",
  "isNewRestaurantOnly" = EXCLUDED."isNewRestaurantOnly",
  "features" = EXCLUDED."features",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep legacy plans for historical subscriptions, but hide from new selection
UPDATE "subscription_plans"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
