import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { segmentShelf, filterProductLikely, findBestMask, type SamMaskBBox } from '@/lib/sam'

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

interface LabeledBBox {
  label: string
  bbox: BBox
  confidence: number
  estimatedPrice: number | null
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

    // Step 1: SAM finds shapes.
    const samMasks = await segmentShelf(imageBase64)
    const usable = samMasks ? filterProductLikely(samMasks) : []

    let rawDetections: LabeledBBox[] = []
    let samMode: 'primary' | 'refine' | 'off' = 'off'

    if (usable.length >= 3) {
      // SAM-primary: crop each mask, let Claude label the crop set in one call.
      samMode = 'primary'
      rawDetections = await labelMasksWithClaude(cleanBase64, usable)
    } else {
      // Fallback to Claude detecting bboxes from the full image.
      samMode = samMasks ? 'refine' : 'off'
      rawDetections = await detectWithClaudeFullImage(cleanBase64)
      if (samMode === 'refine') {
        rawDetections = rawDetections.map(r => {
          const mask = findBestMask(r.bbox, usable)
          return mask ? { ...r, bbox: mask.bbox } : r
        })
      }
    }

    // Fuzzy-match each detection to an existing product.
    const products = await db.product.findMany({
      where: { storeId, active: true },
      select: { id: true, name: true },
    })

    const detections: Detection[] = rawDetections.map(r => {
      const hit = products.find(p => tooSimilar(p.name, r.label))
      return {
        productId: hit?.id ?? null,
        label: r.label,
        bbox: r.bbox,
        confidence: r.confidence,
        estimatedPrice: r.estimatedPrice,
        matched: !!hit,
      }
    })

    if (detections.length === 0) {
      return NextResponse.json({
        error: 'No products detected. Try a clearer, better-lit, straight-on photo.',
        meta: { sam: { mode: samMode, totalMasks: samMasks?.length ?? 0, usableMasks: usable.length } },
      }, { status: 422 })
    }

    console.info('[shelf-tour]', {
      mode: samMode,
      samTotal: samMasks?.length ?? 0,
      samUsable: usable.length,
      detected: detections.length,
      matched: detections.filter(d => d.matched).length,
    })

    const photo = await db.shelfPhoto.create({
      data: {
        storeId,
        imageUrl: imageBase64,
        label: label ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detections: detections as any,
      },
    })

    return NextResponse.json({
      ...photo,
      meta: { sam: { mode: samMode, totalMasks: samMasks?.length ?? 0, usableMasks: usable.length } },
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

/** Full-image Claude detection — used when SAM didn't give us enough shapes
 *  (or isn't configured). Returns labels + rough bboxes + price estimates. */
async function detectWithClaudeFullImage(cleanBase64: string): Promise<LabeledBBox[]> {
  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cleanBase64 } },
        { type: 'text', text: `Identify every distinct consumable product on this shelf and return a tight bounding box for each.

Coordinate system: (0,0) is top-left, (1,1) is bottom-right. y is the top of the product, y+h is the base. Do not include shelves, price tags, or space below the product.

Return JSON only:
[{"label":"Coca-Cola 20oz","bbox":{"x":0.12,"y":0.08,"w":0.06,"h":0.22},"confidence":0.94,"estimatedPrice":2.79}]` },
      ],
    }],
  })

  const text = message.content.find(b => b.type === 'text')?.text ?? '[]'
  const match = text.match(/\[[\s\S]*\]/)
  const raw: Array<{ label: string; bbox: BBox; confidence?: number; estimatedPrice?: number | null }> = match ? safeParse(match[0]) : []
  return raw.map(r => ({
    label: r.label,
    bbox: r.bbox,
    confidence: typeof r.confidence === 'number' ? r.confidence : 0.7,
    estimatedPrice: typeof r.estimatedPrice === 'number' && r.estimatedPrice > 0 ? r.estimatedPrice : null,
  }))
}

/** SAM-primary: take the masks SAM found, crop each from the source image,
 *  send the crop set to Claude in one multimodal call, ask for per-crop
 *  labels. Drops masks Claude says aren't products. */
async function labelMasksWithClaude(cleanBase64: string, masks: SamMaskBBox[]): Promise<LabeledBBox[]> {
  const buf = Buffer.from(cleanBase64, 'base64')
  const meta = await sharp(buf).metadata()
  const W = meta.width ?? 0
  const H = meta.height ?? 0
  if (!W || !H) return []

  // Cap how many crops we send per request — keeps Claude payload sane.
  const CAP = 25
  const sorted = masks.slice().sort((a, b) => (b.bbox.w * b.bbox.h) - (a.bbox.w * a.bbox.h)).slice(0, CAP)

  const crops = await Promise.all(sorted.map(async (m) => {
    const left = Math.max(0, Math.round(m.bbox.x * W))
    const top = Math.max(0, Math.round(m.bbox.y * H))
    const width = Math.min(W - left, Math.max(2, Math.round(m.bbox.w * W)))
    const height = Math.min(H - top, Math.max(2, Math.round(m.bbox.h * H)))
    const cropped = await sharp(buf).extract({ left, top, width, height }).jpeg({ quality: 82 }).toBuffer()
    return cropped.toString('base64')
  }))

  const content: Anthropic.Messages.ContentBlockParam[] = []
  crops.forEach((c, i) => {
    content.push({ type: 'text', text: `Region ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c } })
  })
  content.push({
    type: 'text',
    text: `You're cataloging a convenience-store shelf. For each numbered region above, identify the product.

For each region return:
- index: the region number (1-based)
- label: specific product name with brand + size if readable (e.g. "Coca-Cola 20oz"). Use "Unknown" if you genuinely can't tell.
- category: one of Drinks, Energy Drinks, Coffee, Water, Juice, Soft Drinks, Beer, Wine, Spirits, Snacks, Chips, Candy, Bars, Nuts, Meat Snacks, Pastry, Food, Hot Food, Health, Personal Care, Cigarettes, Cigars, Vape, Nicotine Pouches, Smokeless, Accessories, Household, Baby, Electronics, General.
- restricted: true for alcohol/tobacco/vape/nicotine, else false.
- estimatedPrice: realistic US convenience-store retail price in dollars (e.g. 2.49). Null if unsure.
- confidence: 0.0–1.0.
- skip: true ONLY if this region is NOT a consumable product (e.g. shelf, shadow, background). Skipped entries won't be stored.

Return ONLY a JSON array:
[{"index":1,"label":"Coca-Cola 20oz","category":"Soft Drinks","restricted":false,"estimatedPrice":2.79,"confidence":0.95,"skip":false}]`,
  })

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content }],
  })

  const text = message.content.find(b => b.type === 'text')?.text ?? '[]'
  const m = text.match(/\[[\s\S]*\]/)
  const parsed: Array<{ index?: number; label?: string; category?: string; restricted?: boolean; estimatedPrice?: number | null; confidence?: number; skip?: boolean }> = m ? safeParse(m[0]) : []

  const out: LabeledBBox[] = []
  for (const row of parsed) {
    if (row.skip === true) continue
    if (!row.index || row.index < 1 || row.index > sorted.length) continue
    const mask = sorted[row.index - 1]
    const label = row.label && row.label !== 'Unknown' ? row.label : null
    if (!label) continue
    out.push({
      label,
      bbox: mask.bbox,
      confidence: typeof row.confidence === 'number' ? row.confidence : 0.8,
      estimatedPrice: typeof row.estimatedPrice === 'number' && row.estimatedPrice > 0 ? row.estimatedPrice : null,
    })
  }
  return out
}

function safeParse<T = unknown>(s: string): T[] {
  try { return JSON.parse(s) as T[] } catch { return [] }
}
