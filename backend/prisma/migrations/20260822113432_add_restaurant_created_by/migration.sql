-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "restaurants_createdByUserId_idx" ON "restaurants"("createdByUserId");

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
