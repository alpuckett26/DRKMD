import { db } from './db'

/**
 * Suggest similar-item candidates for a product based on category +
 * price proximity. Deterministic (no AI at runtime), fast, and good
 * enough as a default that owners can override later.
 *
 * Returns up to `limit` product IDs from the same store + category,
 * sorted by closeness in price to the target.
 */
export async function seedSimilarProductIds(
  storeId: string,
  product: { id: string; category: string | null; price: number },
  limit = 6,
): Promise<string[]> {
  if (!product.category) return []
  const siblings = await db.product.findMany({
    where: {
      storeId,
      active: true,
      category: product.category,
      id: { not: product.id },
    },
    select: { id: true, price: true },
    take: 50,
  })
  return siblings
    .map(s => ({ id: s.id, delta: Math.abs(s.price - product.price) }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit)
    .map(s => s.id)
}

export interface AvailableProductLite {
  id: string
  name: string
  price: number
  imageUrl: string | null
  category: string | null
  restrictedFlag: boolean
}

/** Given a product + the full store menu, return the similar items that
 *  are currently available. No AI, no API hit — pure array work. */
export function getSimilarAvailableProducts<
  P extends { id: string; similarProductIds?: string[] | null },
  A extends {
    id: string
    active?: boolean
    availabilityStatus?: string | null
    nighttimeAvailable?: boolean
  },
>(
  product: P,
  allProducts: A[],
  opts: { limit?: number; nightMode?: boolean } = {},
): A[] {
  const ids = product.similarProductIds ?? []
  const seen = new Set<string>()
  const out: A[] = []
  const byId = new Map(allProducts.map(p => [p.id, p]))
  for (const id of ids) {
    if (id === product.id) continue
    if (seen.has(id)) continue
    const p = byId.get(id)
    if (!p) continue
    if (p.active === false) continue
    if ((p.availabilityStatus ?? 'available') !== 'available') continue
    if (opts.nightMode && p.nighttimeAvailable === false) continue
    seen.add(id)
    out.push(p)
    if (out.length >= (opts.limit ?? 4)) break
  }
  return out
}

export function isOutOfStock(p: { availabilityStatus?: string | null }): boolean {
  return p.availabilityStatus === 'suppressed'
}
