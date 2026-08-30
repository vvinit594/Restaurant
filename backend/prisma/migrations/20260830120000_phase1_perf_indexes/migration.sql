-- Phase 1: composite indexes for public menu / QR / membership query patterns.
-- Safe additive indexes only — no data changes.

CREATE INDEX IF NOT EXISTS "restaurants_status_deletedAt_idx" ON "restaurants"("status", "deletedAt");

CREATE INDEX IF NOT EXISTS "restaurant_memberships_userId_isActive_idx" ON "restaurant_memberships"("userId", "isActive");

CREATE INDEX IF NOT EXISTS "categories_restaurantId_isActive_sortOrder_idx" ON "categories"("restaurantId", "isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "dishes_restaurantId_deletedAt_isPublished_isAvailable_idx" ON "dishes"("restaurantId", "deletedAt", "isPublished", "isAvailable");
