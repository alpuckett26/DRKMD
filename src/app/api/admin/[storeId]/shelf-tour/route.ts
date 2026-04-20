import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { detectShelfProducts } from '@/lib/shelfDetect'

export const maxDuration = 60

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const photos = await db.shelfPhoto.findMany({
    where: { storeId: params.storeId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(photos)
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { imageBase64, label, shelfIndex, sectionIndex } = await req.json() as {
      imageBase64: string
      label?: string
      shelfIndex?: number
      sectionIndex?: number
    }
    const storeId = params.storeId
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured on the server' }, { status: 500 })
    }

    const { detections, samMode, samTotal, samUsable, normalizedDataUrl } = await detectShelfProducts(imageBase64, storeId)

    if (detections.length === 0) {
      return NextResponse.json({
        error: 'No products detected. Try a clearer, better-lit, straight-on photo.',
        meta: { sam: { mode: samMode, totalMasks: samTotal, usableMasks: samUsable } },
      }, { status: 422 })
    }

    console.info('[shelf-tour]', {
      mode: samMode,
      samTotal,
      samUsable,
      detected: detections.length,
      matched: detections.filter(d => d.matched).length,
    })

    if (typeof shelfIndex === 'number' && typeof sectionIndex === 'number') {
      await db.shelfPhoto.updateMany({
        where: { storeId, shelfIndex, sectionIndex, active: true },
        data: { active: false },
      })
    }

    const photo = await db.shelfPhoto.create({
      data: {
        storeId,
        imageUrl: normalizedDataUrl,
        label: label ?? null,
        shelfIndex: typeof shelfIndex === 'number' ? shelfIndex : null,
        sectionIndex: typeof sectionIndex === 'number' ? sectionIndex : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detections: detections as any,
      },
    })

    return NextResponse.json({
      ...photo,
      meta: { sam: { mode: samMode, totalMasks: samTotal, usableMasks: samUsable } },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('shelf-tour POST failed:', msg)
    const hint = /does not exist|relation|shelfphoto/i.test(msg)
      ? '. Run /api/migrate to create the ShelfPhoto table.'
      : /anthropic|api key/i.test(msg)
        ? '. Check ANTHROPIC_API_KEY on Vercel.'
        : ''
    return NextResponse.json({ error: `${msg}${hint}` }, { status: 500 })
  }
}
