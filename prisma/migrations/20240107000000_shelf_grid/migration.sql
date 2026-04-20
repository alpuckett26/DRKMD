-- Store: uniform grid dimensions for the shelf tour.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "shelfRows" INTEGER;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "shelfCols" INTEGER;

-- ShelfPhoto: optional grid cell coordinates. Null = free-form photo.
ALTER TABLE "ShelfPhoto" ADD COLUMN IF NOT EXISTS "shelfIndex" INTEGER;
ALTER TABLE "ShelfPhoto" ADD COLUMN IF NOT EXISTS "sectionIndex" INTEGER;

CREATE INDEX IF NOT EXISTS "ShelfPhoto_storeId_shelfIndex_sectionIndex_idx"
  ON "ShelfPhoto" ("storeId", "shelfIndex", "sectionIndex");
