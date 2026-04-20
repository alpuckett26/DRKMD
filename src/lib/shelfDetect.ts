import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { db } from './db'
import {
  segmentShelf,
  filterProductLikely,
  findBestMask,
  nonMaxSuppression,
  type SamMaskBBox,
} from './sam'
import { canonicalize } from './canonicalNames'

const client = new Anthropic()

export interface BBox { x: number; y: number; w: number; h: number }

export interface Detection {
  productId: string | null
  label: string
  bbox: BBox
  confidence: number
  estimatedPrice: number | null
  matched: boolean
}

export interface LabeledBBox {
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

export interface DetectionResult {
  detections: Detection[]
  samMode: 'primary' | 'refine' | 'off'
  samTotal: number
  samUsable: number
  normalizedDataUrl: string
}

/** Run the full SAM + Claude detection + canonicalization + product-match
 *  pipeline on a raw image. Returns the detections plus a normalized
 *  (EXIF-applied) data URL suitable for storage and display. */
export async function detectShelfProducts(
  imageBase64: string,
  storeId: string,
  opts: { alreadyNormalized?: boolean } = {},
): Promise<DetectionResult> {
  const incoming = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const cleanBase64 = opts.alreadyNormalized
    ? incoming
    : (await sharp(Buffer.from(incoming, 'base64')).rotate().jpeg({ quality: 85 }).toBuffer()).toString('base64')

  const normalizedDataUrl = `data:image/jpeg;base64,${cleanBase64}`

  const samMasks = await segmentShelf(normalizedDataUrl)
  const filtered = samMasks ? filterProductLikely(samMasks) : []
  const usable = nonMaxSuppression(filtered, 0.5)

  let rawDetections: LabeledBBox[] = []
  let samMode: 'primary' | 'refine' | 'off' = 'off'

  if (usable.length >= 3) {
    samMode = 'primary'
    rawDetections = await labelMasksWithClaude(cleanBase64, usable)
  } else {
    samMode = samMasks ? 'refine' : 'off'
    rawDetections = await detectWithClaudeFullImage(cleanBase64)
    if (samMode === 'refine') {
      rawDetections = rawDetections.map(r => {
        const mask = findBestMask(r.bbox, usable)
        return mask ? { ...r, bbox: mask.bbox } : r
      })
    }
  }

  const products = await db.product.findMany({
    where: { storeId, active: true },
    select: { id: true, name: true },
  })

  const detections: Detection[] = rawDetections.map(r => {
    const canon = canonicalize(r.label)
    const canonicalLabel = canon?.canonicalName ?? r.label
    const hit = products.find(p => tooSimilar(p.name, canonicalLabel))
    return {
      productId: hit?.id ?? null,
      label: canonicalLabel,
      bbox: r.bbox,
      confidence: r.confidence,
      estimatedPrice: r.estimatedPrice,
      matched: !!hit,
    }
  })

  return {
    detections,
    samMode,
    samTotal: samMasks?.length ?? 0,
    samUsable: usable.length,
    normalizedDataUrl,
  }
}

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
  const m = text.match(/\[[\s\S]*\]/)
  const raw: Array<{ label: string; bbox: BBox; confidence?: number; estimatedPrice?: number | null }> = m ? safeParse(m[0]) : []
  return raw.map(r => ({
    label: r.label,
    bbox: r.bbox,
    confidence: typeof r.confidence === 'number' ? r.confidence : 0.7,
    estimatedPrice: typeof r.estimatedPrice === 'number' && r.estimatedPrice > 0 ? r.estimatedPrice : null,
  }))
}

async function labelMasksWithClaude(cleanBase64: string, masks: SamMaskBBox[]): Promise<LabeledBBox[]> {
  const buf = Buffer.from(cleanBase64, 'base64')
  const rotated = await sharp(buf).rotate().toBuffer()
  const meta = await sharp(rotated).metadata()
  const W = meta.width ?? 0
  const H = meta.height ?? 0
  if (!W || !H) return []

  const CAP = 25
  const sorted = masks.slice().sort((a, b) => (b.bbox.w * b.bbox.h) - (a.bbox.w * a.bbox.h)).slice(0, CAP)

  const crops = await Promise.all(sorted.map(async m => {
    const left = Math.max(0, Math.round(m.bbox.x * W))
    const top = Math.max(0, Math.round(m.bbox.y * H))
    const width = Math.min(W - left, Math.max(2, Math.round(m.bbox.w * W)))
    const height = Math.min(H - top, Math.max(2, Math.round(m.bbox.h * H)))
    const cropped = await sharp(rotated).extract({ left, top, width, height }).jpeg({ quality: 82 }).toBuffer()
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
- index (1-based)
- label (brand + size if readable; "Unknown" if you can't tell)
- category
- restricted (true for alcohol/tobacco/vape/nicotine)
- estimatedPrice (USD number)
- confidence 0.0-1.0
- skip=true ONLY if the region is not a consumable product

Return ONLY a JSON array.`,
  })

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content }],
  })

  const text = message.content.find(b => b.type === 'text')?.text ?? '[]'
  const m = text.match(/\[[\s\S]*\]/)
  const parsed: Array<{ index?: number; label?: string; confidence?: number; estimatedPrice?: number | null; skip?: boolean }> = m ? safeParse(m[0]) : []

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
