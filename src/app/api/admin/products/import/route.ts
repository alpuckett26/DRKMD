import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const RowSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullish().transform(v => v ?? undefined),
  price: z.string().transform(v => Math.round(parseFloat(v) * 100)),
  nighttimeAvailable: z.string().optional().transform(v => v?.toLowerCase() !== 'false'),
  restrictedFlag: z.string().optional().transform(v => v?.toLowerCase() === 'true' || v === '1'),
  imageUrl: z.string().nullish().transform(v => v ?? undefined),
})

export async function POST(req: Request) {
  const body = await req.json()
  const { storeId, rows } = body
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
    try {
      const product = await db.product.create({
        data: { storeId, active: true, ...parsed.data },
      })
      created.push(product)
    } catch (e) {
      errors.push({ row, error: e instanceof Error ? e.message : String(e) })
    }
  }

  if (created.length === 0 && errors.length > 0) {
    const firstError = typeof errors[0].error === 'string' ? errors[0].error : JSON.stringify(errors[0].error)
    return NextResponse.json({ error: firstError, errors }, { status: 500 })
  }

  return NextResponse.json({ created: created.length, errors })
}
