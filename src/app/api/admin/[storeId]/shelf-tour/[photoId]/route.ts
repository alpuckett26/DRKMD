import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface BBox { x: number; y: number; w: number; h: number }
interface Detection {
  productId: string | null
  label: string
  bbox: BBox
  confidence: number
  estimatedPrice: number | null
  matched: boolean
}

export async function GET(_req: Request, { params }: { params: { storeId: string; photoId: string } }) {
  const photo = await db.shelfPhoto.findFirst({
    where: { id: params.photoId, storeId: params.storeId },
  })
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(photo)
}

export async function PATCH(req: Request, { params }: { params: { storeId: string; photoId: string } }) {
  const body = (await req.json()) as { detections?: Detection[]; label?: string | null }
  const data: Record<string, unknown> = {}
  if (body.detections) {
    // Re-derive `matched` from the presence of productId, trust the rest.
    const normalized: Detection[] = body.detections.map(d => ({
      productId: d.productId ?? null,
      label: d.label,
      bbox: d.bbox,
      confidence: typeof d.confidence === 'number' ? d.confidence : 0.75,
      estimatedPrice: typeof d.estimatedPrice === 'number' && d.estimatedPrice > 0 ? d.estimatedPrice : null,
      matched: !!d.productId,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.detections = normalized as any
  }
  if (body.label !== undefined) data.label = body.label

  const updated = await db.shelfPhoto.update({
    where: { id: params.photoId },
    data,
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { storeId: string; photoId: string } }) {
  await db.shelfPhoto.update({
    where: { id: params.photoId },
    data: { active: false },
  })
  return NextResponse.json({ ok: true })
}
