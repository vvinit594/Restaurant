-- Loyalty CRM + program configuration

DO $$ BEGIN
  CREATE TYPE "LoyaltyCustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoyaltyOfferType" AS ENUM ('COUPON', 'DISCOUNT', 'SPECIAL_OFFER', 'CUSTOM_MESSAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoyaltyOfferStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoyaltyProgramType" AS ENUM (
    'POINTS',
    'STAMP_CARD',
    'MEMBERSHIP_TIERS',
    'BIRTHDAY_REWARD',
    'REFER_EARN',
    'CASHBACK',
    'EXCLUSIVE_OFFERS',
    'ORDER_STREAK'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "loyalty_customers" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "whatsappPhone" TEXT NOT NULL,
  "email" TEXT,
  "notes" TEXT,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "status" "LoyaltyCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
  "totalOffersSent" INTEGER NOT NULL DEFAULT 0,
  "lastOfferSentAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "loyalty_offer_messages" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "offerType" "LoyaltyOfferType" NOT NULL,
  "title" TEXT,
  "message" TEXT NOT NULL,
  "couponCode" TEXT,
  "discountPercent" DECIMAL(5,2),
  "minimumOrderValue" DECIMAL(10,2),
  "expiresAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "status" "LoyaltyOfferStatus" NOT NULL DEFAULT 'PENDING',
  "sentByUserId" TEXT,
  "sentAt" TIMESTAMP(3),
  "providerPayload" JSONB,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_offer_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "restaurant_loyalty_programs" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "programType" "LoyaltyProgramType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "configuration" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "restaurant_loyalty_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_customers_restaurantId_phone_key"
  ON "loyalty_customers"("restaurantId", "phone");
CREATE INDEX IF NOT EXISTS "loyalty_customers_restaurantId_idx"
  ON "loyalty_customers"("restaurantId");
CREATE INDEX IF NOT EXISTS "loyalty_customers_restaurantId_status_idx"
  ON "loyalty_customers"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "loyalty_customers_restaurantId_createdAt_idx"
  ON "loyalty_customers"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "loyalty_customers_restaurantId_lastOfferSentAt_idx"
  ON "loyalty_customers"("restaurantId", "lastOfferSentAt");

CREATE INDEX IF NOT EXISTS "loyalty_offer_messages_restaurantId_customerId_createdAt_idx"
  ON "loyalty_offer_messages"("restaurantId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "loyalty_offer_messages_restaurantId_status_createdAt_idx"
  ON "loyalty_offer_messages"("restaurantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "loyalty_offer_messages_customerId_createdAt_idx"
  ON "loyalty_offer_messages"("customerId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_loyalty_programs_restaurantId_programType_key"
  ON "restaurant_loyalty_programs"("restaurantId", "programType");
CREATE INDEX IF NOT EXISTS "restaurant_loyalty_programs_restaurantId_enabled_idx"
  ON "restaurant_loyalty_programs"("restaurantId", "enabled");

DO $$ BEGIN
  ALTER TABLE "loyalty_customers"
    ADD CONSTRAINT "loyalty_customers_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_customers"
    ADD CONSTRAINT "loyalty_customers_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_offer_messages"
    ADD CONSTRAINT "loyalty_offer_messages_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_offer_messages"
    ADD CONSTRAINT "loyalty_offer_messages_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "loyalty_customers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_offer_messages"
    ADD CONSTRAINT "loyalty_offer_messages_sentByUserId_fkey"
    FOREIGN KEY ("sentByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "restaurant_loyalty_programs"
    ADD CONSTRAINT "restaurant_loyalty_programs_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
