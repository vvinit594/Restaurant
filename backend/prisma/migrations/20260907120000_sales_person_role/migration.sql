-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SALES_PERSON';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SalesPersonStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SalesLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'DEMO', 'CONVERTED', 'LOST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionRuleType" AS ENUM ('FIXED', 'PERCENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_persons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salesCode" TEXT NOT NULL,
    "phone" TEXT,
    "status" "SalesPersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_persons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sales_leads" (
    "id" TEXT NOT NULL,
    "salesPersonId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "SalesLeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "convertedRestaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "commission_rules" (
    "id" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "type" "CommissionRuleType" NOT NULL DEFAULT 'FIXED',
    "value" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "commissions" (
    "id" TEXT NOT NULL,
    "salesPersonId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "salesPersonId" TEXT;

-- Indexes / uniques
CREATE UNIQUE INDEX IF NOT EXISTS "sales_persons_userId_key" ON "sales_persons"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_persons_salesCode_key" ON "sales_persons"("salesCode");
CREATE INDEX IF NOT EXISTS "sales_persons_status_idx" ON "sales_persons"("status");

CREATE INDEX IF NOT EXISTS "sales_leads_salesPersonId_status_createdAt_idx" ON "sales_leads"("salesPersonId", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "commission_rules_planCode_key" ON "commission_rules"("planCode");

CREATE UNIQUE INDEX IF NOT EXISTS "commissions_subscriptionId_key" ON "commissions"("subscriptionId");
CREATE INDEX IF NOT EXISTS "commissions_salesPersonId_status_createdAt_idx" ON "commissions"("salesPersonId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "commissions_restaurantId_idx" ON "commissions"("restaurantId");

CREATE INDEX IF NOT EXISTS "restaurants_salesPersonId_idx" ON "restaurants"("salesPersonId");

-- FKs (ignore if already present)
DO $$ BEGIN
  ALTER TABLE "sales_persons" ADD CONSTRAINT "sales_persons_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_salesPersonId_fkey"
    FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "commissions" ADD CONSTRAINT "commissions_salesPersonId_fkey"
    FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "commissions" ADD CONSTRAINT "commissions_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_salesPersonId_fkey"
    FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
