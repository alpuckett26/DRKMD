import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const RowSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  price: z.string().transform(v => Math.round(parseFloat(v) * 100)),
  nighttimeAvailable: z.string().optional().transform(v => v?.toLowerCase() !== 'false'),
  restrictedFlag: z.string().optional().transform(v => v?.toLowerCase() === 'true' || v === '1'),
  imageUrl: z.string().optional(),
})

export async function POST(req: Request) {
  const { storeId, rows } = await req.json()
  if (!storeId || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Missing storeId or rows' }, { status: 400 })
  }

  const created = []
  const errors = []

  for (const row of rows) {
    const parsed = RowSchema.safeParse(row)
    if (!parsed.success) {
      errors.push({ row, error: parsed.error.flatten() })
      continue
    }
    const product = await db.product.create({
      data: { storeId, active: true, ...parsed.data },
    })
    created.push(product)
  }

  return NextResponse.json({ created: created.length, errors })
}
