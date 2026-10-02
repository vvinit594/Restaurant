-- Public menu reads filter a restaurant's published, available dishes and
-- order them by name. The previous 4-column index is a prefix of this one,
-- so it is replaced rather than kept as a duplicate.

CREATE INDEX IF NOT EXISTS "dishes_restaurantId_deletedAt_isPublished_isAvailable_name_idx"
ON "dishes"("restaurantId", "deletedAt", "isPublished", "isAvailable", "name");

DROP INDEX IF EXISTS "dishes_restaurantId_deletedAt_isPublished_isAvailable_idx";
