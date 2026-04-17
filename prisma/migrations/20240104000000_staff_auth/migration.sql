-- Account table for store owner login
CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "sessionToken" TEXT,
  "sessionExpires" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_email_key" ON "Account"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_storeId_key" ON "Account"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_sessionToken_key" ON "Account"("sessionToken");

-- StaffRole enum
DO $$ BEGIN CREATE TYPE "StaffRole" AS ENUM ('admin', 'staff'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Staff table
CREATE TABLE IF NOT EXISTS "Staff" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "StaffRole" NOT NULL DEFAULT 'staff',
  "pin" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "sessionToken" TEXT,
  "sessionExpires" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Staff_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_sessionToken_key" ON "Staff"("sessionToken");

-- StaffShift table
CREATE TABLE IF NOT EXISTS "StaffShift" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  "totalSales" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffShift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
);

-- Add staffId to Order and OrderEvent
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "staffId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
