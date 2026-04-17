import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  return POST()
}

export async function POST() {
  try {
    // Enums
    for (const sql of [
      `DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('submitted','authorized','picking','ready','partially_ready','captured','completed','voided','canceled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE "ItemStatus" AS ENUM ('requested','found','unavailable','substituted','refused_restricted'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE "SubstitutionPreference" AS ENUM ('none','allow_similar'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE "EventType" AS ENUM ('submitted','authorized','picking_started','item_marked','ready','captured','completed','voided','canceled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE "StaffRole" AS ENUM ('admin','staff'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    ]) {
      await db.$executeRawUnsafe(sql)
    }

    // Core tables
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Store" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "location" TEXT,
        "windowModeEnabled" BOOLEAN NOT NULL DEFAULT false,
        "windowModeStart" TEXT,
        "windowModeEnd" TEXT,
        "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
      )`)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Product" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "category" TEXT,
        "price" INTEGER NOT NULL,
        "nighttimeAvailable" BOOLEAN NOT NULL DEFAULT true,
        "restrictedFlag" BOOLEAN NOT NULL DEFAULT false,
        "imageUrl" TEXT,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
      )`)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Order" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "customerName" TEXT NOT NULL,
        "customerPhone" TEXT,
        "status" "OrderStatus" NOT NULL DEFAULT 'submitted',
        "estimatedTotal" INTEGER NOT NULL,
        "finalTotal" INTEGER,
        "paymentAuthId" TEXT,
        "paymentCaptureId" TEXT,
        "substitutionPreference" "SubstitutionPreference" NOT NULL DEFAULT 'none',
        "pickupCode" TEXT NOT NULL,
        "pickupCodeQr" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id")
      )`)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrderItem" (
        "id" TEXT NOT NULL,
        "orderId" TEXT NOT NULL,
        "productId" TEXT,
        "requestedName" TEXT NOT NULL,
        "requestedPrice" INTEGER NOT NULL,
        "qtyRequested" INTEGER NOT NULL,
        "qtyFound" INTEGER NOT NULL DEFAULT 0,
        "finalPrice" INTEGER,
        "status" "ItemStatus" NOT NULL DEFAULT 'requested',
        "substitutionReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
        CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id")
      )`)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrderEvent" (
        "id" TEXT NOT NULL,
        "orderId" TEXT NOT NULL,
        "eventType" "EventType" NOT NULL,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE
      )`)

    // Staff tables
    await db.$executeRawUnsafe(`
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
      )`)

    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Staff_sessionToken_key" ON "Staff"("sessionToken")`)

    await db.$executeRawUnsafe(`
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
      )`)

    await db.$executeRawUnsafe(`
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
      )`)

    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Account_email_key" ON "Account"("email")`)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Account_storeId_key" ON "Account"("storeId")`)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Account_sessionToken_key" ON "Account"("sessionToken")`)

    // ADD COLUMNS to existing tables (idempotent)
    for (const sql of [
      // Store columns
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "ownerName" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "businessLegalName" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "businessType" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "ein" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "address" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "city" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "state" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "zip" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "tosAcceptedAt" TIMESTAMP(3)`,
      // Order columns
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staffId" TEXT`,
      // OrderEvent columns
      `ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "staffId" TEXT`,
    ]) {
      await db.$executeRawUnsafe(sql)
    }

    // Indexes and unique constraints
    await db.$executeRawUnsafe(`
      DELETE FROM "Product" WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "storeId", name ORDER BY "updatedAt" DESC) AS rn
          FROM "Product"
        ) t WHERE rn > 1
      )`)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Product_storeId_name_key" ON "Product"("storeId", "name")`)

    return NextResponse.json({ ok: true, message: 'Migration complete' })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
