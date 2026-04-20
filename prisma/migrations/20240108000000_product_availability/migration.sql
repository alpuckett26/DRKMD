-- Similar items + availability (out-of-stock) support.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT NOT NULL DEFAULT 'available';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "similarProductIds" TEXT[] NOT NULL DEFAULT '{}';
