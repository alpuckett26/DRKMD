-- CreateTable
CREATE TABLE "ShelfPhoto" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "label" TEXT,
    "detections" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShelfPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShelfPhoto_storeId_active_sortOrder_idx" ON "ShelfPhoto"("storeId", "active", "sortOrder");

-- AddForeignKey
ALTER TABLE "ShelfPhoto" ADD CONSTRAINT "ShelfPhoto_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
