import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isRestrictedProduct } from '@/lib/restrictedKeywords'
import { seedSimilarProductIds } from '@/lib/similarProducts'
import { z } from 'zod'

const ProductSchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  category: z.string().optional(),
  price: z.number().int().min(0).default(0),
  nighttimeAvailable: z.boolean().default(true),
  restrictedFlag: z.boolean().default(false),
  imageUrl: z.string().url().optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = ProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { storeId, name, ...rest } = parsed.data
  // Auto-flag if name matches any restricted keyword, regardless of what was passed
  const restrictedFlag = rest.restrictedFlag || isRestrictedProduct(name)
  const data = { ...rest, restrictedFlag }

  const product = await db.product.upsert({
    where: { storeId_name: { storeId, name } },
    update: { ...data, active: true },
    create: { storeId, name, ...data, active: true },
  })

  // Seed similar-item suggestions from same-category siblings. Only for
  // fresh creates that don't have any yet — preserves admin overrides.
  if (!product.similarProductIds || product.similarProductIds.length === 0) {
    const similar = await seedSimilarProductIds(storeId, product)
    if (similar.length > 0) {
      await db.product.update({
        where: { id: product.id },
        data: { similarProductIds: similar },
      })
    }
  }

  return NextResponse.json(product, { status: 201 })
}
