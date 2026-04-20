import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedSimilarProductIds } from '@/lib/similarProducts'

export const maxDuration = 60

/** One-shot backfill: populate similarProductIds for every product in the
 *  store that has an empty list. Safe to re-run — skips any product that
 *  already has entries, so owner overrides never get stomped. */
export async function POST(_req: Request, { params }: { params: { storeId: string } }) {
  const missing = await db.product.findMany({
    where: {
      storeId: params.storeId,
      active: true,
      similarProductIds: { equals: [] },
    },
    select: { id: true, storeId: true, category: true, price: true },
  })

  let updated = 0
  for (const p of missing) {
    const similar = await seedSimilarProductIds(p.storeId, p)
    if (similar.length === 0) continue
    await db.product.update({ where: { id: p.id }, data: { similarProductIds: similar } })
    updated++
  }

  return NextResponse.json({ updated, scanned: missing.length })
}
