import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isRestrictedProduct } from '@/lib/restrictedKeywords'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  price: z.number().int().positive().optional(),
  nighttimeAvailable: z.boolean().optional(),
  restrictedFlag: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  promoted: z.boolean().optional(),
  availabilityStatus: z.enum(['available', 'suppressed', 'watch', 'manual_review']).optional(),
  similarProductIds: z.array(z.string()).optional(),
})

export async function PATCH(req: Request, { params }: { params: { productId: string } }) {
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates = { ...parsed.data }
  if (updates.name) updates.restrictedFlag = updates.restrictedFlag || isRestrictedProduct(updates.name)

  const product = await db.product.update({
    where: { id: params.productId },
    data: updates,
  })
  return NextResponse.json(product)
}

export async function DELETE(_req: Request, { params }: { params: { productId: string } }) {
  await db.product.update({
    where: { id: params.productId },
    data: { active: false },
  })
  return new NextResponse(null, { status: 204 })
}
