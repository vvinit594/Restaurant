-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CustomerCouponStatus" AS ENUM ('AVAILABLE', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CustomerNotificationType" AS ENUM ('ORDER_STATUS', 'OFFER', 'COUPON', 'LOYALTY', 'PROMO');

-- CreateEnum
CREATE TYPE "PushCampaignTargeting" AS ENUM ('ALL_ELIGIBLE', 'PREVIOUSLY_ORDERED', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "PushCampaignStatus" AS ENUM ('PENDING', 'SENT', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_devices" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_push_subscriptions" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_customers" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOrderedAt" TIMESTAMP(3),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "code" TEXT NOT NULL,
    "minimumOrderValue" DECIMAL(10,2),
    "maximumDiscount" DECIMAL(10,2),
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_coupons" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "CustomerCouponStatus" NOT NULL DEFAULT 'AVAILABLE',
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "type" "CustomerNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "orderId" TEXT,
    "couponId" TEXT,
    "campaignId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_campaigns" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targeting" "PushCampaignTargeting" NOT NULL,
    "couponId" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'PENDING',
    "sentByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_campaigns_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "customerId" TEXT,
ADD COLUMN "customerDeviceId" TEXT,
ADD COLUMN "couponId" TEXT;

-- CreateIndex
CREATE INDEX "customers_createdAt_idx" ON "customers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_devices_publicId_key" ON "customer_devices"("publicId");

-- CreateIndex
CREATE INDEX "customer_devices_customerId_idx" ON "customer_devices"("customerId");

-- CreateIndex
CREATE INDEX "customer_devices_lastSeenAt_idx" ON "customer_devices"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_push_subscriptions_endpoint_key" ON "customer_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "customer_push_subscriptions_deviceId_idx" ON "customer_push_subscriptions"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_customers_restaurantId_customerId_key" ON "restaurant_customers"("restaurantId", "customerId");

-- CreateIndex
CREATE INDEX "restaurant_customers_restaurantId_lastOrderedAt_idx" ON "restaurant_customers"("restaurantId", "lastOrderedAt");

-- CreateIndex
CREATE INDEX "restaurant_customers_restaurantId_lastSeenAt_idx" ON "restaurant_customers"("restaurantId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "restaurant_customers_customerId_idx" ON "restaurant_customers"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_restaurantId_code_key" ON "coupons"("restaurantId", "code");

-- CreateIndex
CREATE INDEX "coupons_restaurantId_isActive_expiresAt_idx" ON "coupons"("restaurantId", "isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "coupons_restaurantId_createdAt_idx" ON "coupons"("restaurantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_coupons_couponId_customerId_key" ON "customer_coupons"("couponId", "customerId");

-- CreateIndex
CREATE INDEX "customer_coupons_customerId_status_createdAt_idx" ON "customer_coupons"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "customer_coupons_couponId_status_idx" ON "customer_coupons"("couponId", "status");

-- CreateIndex
CREATE INDEX "customer_notifications_customerId_readAt_createdAt_idx" ON "customer_notifications"("customerId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "customer_notifications_customerId_createdAt_idx" ON "customer_notifications"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_notifications_restaurantId_createdAt_idx" ON "customer_notifications"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "push_campaigns_restaurantId_createdAt_idx" ON "push_campaigns"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "push_campaigns_restaurantId_status_createdAt_idx" ON "push_campaigns"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_customerId_createdAt_idx" ON "orders"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_customerId_status_createdAt_idx" ON "orders"("customerId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerDeviceId_fkey" FOREIGN KEY ("customerDeviceId") REFERENCES "customer_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_devices" ADD CONSTRAINT "customer_devices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_push_subscriptions" ADD CONSTRAINT "customer_push_subscriptions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "customer_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_customers" ADD CONSTRAINT "restaurant_customers_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_customers" ADD CONSTRAINT "restaurant_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_coupons" ADD CONSTRAINT "customer_coupons_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_coupons" ADD CONSTRAINT "customer_coupons_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "push_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
