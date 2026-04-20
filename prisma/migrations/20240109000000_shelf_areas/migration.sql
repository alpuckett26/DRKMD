-- Named shelf areas per store (e.g. "Candy", "Beer cooler").
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "shelfAreas" JSONB DEFAULT '[]';
ALTER TABLE "ShelfPhoto" ADD COLUMN IF NOT EXISTS "areaName" TEXT;

CREATE INDEX IF NOT EXISTS "ShelfPhoto_storeId_areaName_idx"
  ON "ShelfPhoto" ("storeId", "areaName");
