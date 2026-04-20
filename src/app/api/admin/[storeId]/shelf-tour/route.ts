import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'

export const maxDuration = 60

const client = new Anthropic()

interface BBox { x: number; y: number; w: number; h: number }
interface Detection {
  productId: string | null
  label: string
  bbox: BBox
  matched: boolean
}

function tooSimilar(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  const wa = words(a), wb = words(b)
  if (!wa.length || !wb.length) return false
  const shared = wa.filter(w => wb.includes(w)).length
  return shared / Math.max(wa.length, wb.length) >= 0.5
}

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const photos = await db.shelfPhoto.findMany({
    where: { storeId: params.storeId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(photos)
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  const { imageBase64, label } = await req.json() as { imageBase64: string; label?: string }
  const storeId = params.storeId
  if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: cleanBase64 },
        },
        {
          type: 'text',
          text: `This is a photo of a convenience-store shelf (or a fridge/cabinet acting as one for testing).
Identify every distinct consumable product visible and return a tight bounding box for each.

For each product return:
- label: specific product name including brand and size if readable (e.g. "Coca-Cola 20oz", "Lay's Classic")
- bbox: normalized 0.0–1.0 coordinates describing the item's position in the image, as {"x": left, "y": top, "w": width, "h": height}

Rules:
- One entry per visible unit. If multiple identical bottles are lined up, list each separately (distinct bboxes).
- Boxes must be tight around the single item — not a whole row.
- Skip prices, price tags, shelves, and non-product clutter.
- Return ONLY a JSON array, no other text:
[{"label":"Coca-Cola 20oz","bbox":{"x":0.1,"y":0.2,"w":0.08,"h":0.3}}]`,
        },
      ],
    }],
  })

  const text = message.content.find(b => b.type === 'text')?.text ?? '[]'
  const match = text.match(/\[[\s\S]*\]/)
  let raw: { label: string; bbox: BBox }[] = []
  if (match) {
    try { raw = JSON.parse(match[0]) } catch {}
  }

  // Match each detection to an existing store product by fuzzy name similarity.
  const products = await db.product.findMany({
    where: { storeId, active: true },
    select: { id: true, name: true },
  })

  const detections: Detection[] = raw.map(r => {
    const hit = products.find(p => tooSimilar(p.name, r.label))
    return {
      productId: hit?.id ?? null,
      label: r.label,
      bbox: r.bbox,
      matched: !!hit,
    }
  })

  // Guard: require at least one detection
  if (detections.length === 0) {
    return NextResponse.json({ error: 'No products detected. Try a clearer photo.' }, { status: 422 })
  }

  const photo = await db.shelfPhoto.create({
    data: {
      storeId,
      imageUrl: imageBase64,
      label: label ?? null,
      // Prisma JSON type accepts plain JS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detections: detections as any,
    },
  })

  return NextResponse.json(photo)
}
