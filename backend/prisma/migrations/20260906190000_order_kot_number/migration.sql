-- AlterTable
ALTER TABLE "orders" ADD COLUMN "kotNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_kotNumber_key" ON "orders"("kotNumber");
