import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const ProductSchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  category: z.string().optional(),
  price: z.number().int().positive(),
  nighttimeAvailable: z.boolean().default(true),
  restrictedFlag: z.boolean().default(false),
  imageUrl: z.string().url().optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = ProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const product = await db.product.create({ data: parsed.data })
  return NextResponse.json(product, { status: 201 })
}
