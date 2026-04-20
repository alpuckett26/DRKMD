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
  confidence: number
  estimatedPrice: number | null
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
  try {
    const { imageBase64, label } = await req.json() as { imageBase64: string; label?: string }
    const storeId = params.storeId
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured on the server' }, { status: 500 })
    }

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

COORDINATE SYSTEM (read carefully — common source of errors):
- (0, 0) is the TOP-LEFT pixel of the image.
- (1, 1) is the BOTTOM-RIGHT pixel of the image.
- "y" is the TOP edge of the product's packaging, measured from the top of the image.
- "y + h" is the BOTTOM edge of the product's packaging, measured from the top of the image.
- "x" is the LEFT edge of the product, measured from the left of the image.
- "x + w" is the RIGHT edge of the product, measured from the left of the image.

CRITICAL — bottom edge:
The bottom of the bbox (y + h) MUST land where the product's base touches the shelf surface. DO NOT extend the bbox down past the bottom of the product into the shelf, table, floor, or next shelf row. If a bottle is sitting on a shelf, y + h is the base of the bottle, not the lip of the shelf.

What the bbox MUST contain:
- Only the product's visible body/packaging.

What the bbox MUST NOT contain:
- The shelf, table, or counter surface BELOW the product.
- Shelf lips, price tags, promo tags, or shelf-talkers hanging in front.
- The product above or the product below on an adjacent shelf row.
- Reflections (TV screens, windows) behind the product.
- Empty space beside, above, or below the product.

For each product return:
- label: specific product name including brand and size if readable (e.g. "Coca-Cola 20oz", "Lay's Classic").
- bbox: {"x": leftEdge, "y": topEdge, "w": width, "h": height} — all normalized 0.0–1.0. h should equal the pixel-measured height of the product divided by image height — nothing more.
- confidence: decimal 0.0–1.0 reflecting how sure you are of the label. Use 0.9+ for unambiguous branded items, 0.6–0.8 for partial guesses, below 0.5 for genuine uncertainty.
- estimatedPrice: realistic US convenience-store retail price in dollars as a number (e.g. 2.49, 12.99). If there's a visible price tag in the photo, read it and use that value. Otherwise estimate based on typical convenience-store pricing. Use null only if you have absolutely no idea.

Rules:
- One entry per visible unit. If four identical bottles are lined up side by side, return four entries with distinct bboxes.
- A tight box (inside the product) is always better than a loose box (includes surroundings). Err tight.
- Skip shelves, price tags, signage, and non-product clutter.
- Return ONLY a JSON array, no prose:
[{"label":"Coca-Cola 20oz","bbox":{"x":0.12,"y":0.08,"w":0.06,"h":0.22},"confidence":0.94,"estimatedPrice":2.79}]`,
          },
        ],
      }],
    })

    const text = message.content.find(b => b.type === 'text')?.text ?? '[]'
    const match = text.match(/\[[\s\S]*\]/)
    let raw: { label: string; bbox: BBox; confidence?: number; estimatedPrice?: number | null }[] = []
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
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.75,
        estimatedPrice: typeof r.estimatedPrice === 'number' && r.estimatedPrice > 0 ? r.estimatedPrice : null,
        matched: !!hit,
      }
    })

    // Guard: require at least one detection
    if (detections.length === 0) {
      return NextResponse.json({ error: 'No products detected. Try a clearer, better-lit photo.' }, { status: 422 })
    }

    const photo = await db.shelfPhoto.create({
      data: {
        storeId,
        imageUrl: imageBase64,
        label: label ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detections: detections as any,
      },
    })

    return NextResponse.json(photo)
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
