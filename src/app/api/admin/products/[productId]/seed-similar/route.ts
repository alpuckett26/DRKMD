import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedSimilarProductIds } from '@/lib/similarProducts'

/** Populate similarProductIds from same-category siblings. Replaces any
 *  existing list. Admin-only; not gated beyond the admin UI today. */
export async function POST(_req: Request, { params }: { params: { productId: string } }) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
    select: { id: true, storeId: true, category: true, price: true },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const similar = await seedSimilarProductIds(product.storeId, product)
  await db.product.update({ where: { id: product.id }, data: { similarProductIds: similar } })
  return NextResponse.json({ similarProductIds: similar })
}
