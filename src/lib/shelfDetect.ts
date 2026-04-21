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
  opts: { alreadyNormalized?: boolean; areaName?: string | null } = {},
): Promise<DetectionResult> {
  const incoming = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const cleanBase64 = opts.alreadyNormalized
    ? incoming
    : (await sharp(Buffer.from(incoming, 'base64')).rotate().jpeg({ quality: 85 }).toBuffer()).toString('base64')

  const normalizedDataUrl = `data:image/jpeg;base64,${cleanBase64}`

  // Pull the store's catalog up front — we use it both for the final
  // name-match step AND as a candidate brand hint in the Claude prompts,
  // which biases recognition toward SKUs the store actually stocks.
  const products = await db.product.findMany({
    where: { storeId, active: true },
    select: { id: true, name: true, category: true },
  })

  const samMasks = await segmentShelf(normalizedDataUrl)
  const filtered = samMasks ? filterProductLikely(samMasks) : []
  const usable = nonMaxSuppression(filtered, 0.5)

  let rawDetections: LabeledBBox[] = []
  let samMode: 'primary' | 'refine' | 'off' = 'off'

  if (usable.length >= 3) {
    samMode = 'primary'
    rawDetections = await labelMasksWithClaude(cleanBase64, usable, {
      areaName: opts.areaName ?? null,
      candidates: pickCandidateBrands(products, opts.areaName ?? null),
    })
  } else {
    samMode = samMasks ? 'refine' : 'off'
    rawDetections = await detectWithClaudeFullImage(cleanBase64, {
      areaName: opts.areaName ?? null,
      candidates: pickCandidateBrands(products, opts.areaName ?? null),
    })
    if (samMode === 'refine') {
      rawDetections = rawDetections.map(r => {
        const mask = findBestMask(r.bbox, usable)
        return mask ? { ...r, bbox: mask.bbox } : r
      })
    }
  }

  const detections: Detection[] = rawDetections.map(r => {
    const canon = canonicalize(r.label)
    const canonicalLabel = canon?.canonicalName ?? r.label
    const hit = products.find((p: { id: string; name: string }) => tooSimilar(p.name, canonicalLabel))
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

/** Build a short candidate-brand list for Claude. When we know the shelf
 *  area (e.g. "Energy drinks"), bias toward catalog items whose category
 *  or name matches; otherwise fall back to the store-wide catalog. Cap at
 *  ~60 names so the prompt stays tight. */
function pickCandidateBrands(
  products: Array<{ name: string; category: string | null }>,
  areaName: string | null,
): string[] {
  const norm = (s: string) => s.toLowerCase()
  const area = areaName ? norm(areaName) : ''
  const areaTokens = area.split(/\s+/).filter(t => t.length > 2)

  const scored = products.map(p => {
    let score = 0
    const cat = norm(p.category ?? '')
    const name = norm(p.name)
    if (area) {
      for (const t of areaTokens) {
        if (cat.includes(t)) score += 3
        if (name.includes(t)) score += 1
      }
    }
    return { name: p.name, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return Array.from(new Set(scored.map(s => s.name))).slice(0, 60)
}

async function detectWithClaudeFullImage(
  cleanBase64: string,
  ctx: { areaName: string | null; candidates: string[] },
): Promise<LabeledBBox[]> {
  const contextLine = ctx.areaName
    ? `\n\nContext: this shelf is the "${ctx.areaName}" section of a convenience store.`
    : ''
  const candidateLine = ctx.candidates.length
    ? `\n\nThe store stocks these SKUs — prefer matching to one of these exact names when a product matches:\n${ctx.candidates.join(', ')}`
    : ''

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cleanBase64 } },
        { type: 'text', text: `Identify every distinct consumable product on this shelf and return a tight bounding box for each.${contextLine}${candidateLine}

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

async function labelMasksWithClaude(
  cleanBase64: string,
  masks: SamMaskBBox[],
  ctx: { areaName: string | null; candidates: string[] },
): Promise<LabeledBBox[]> {
  const buf = Buffer.from(cleanBase64, 'base64')
  const rotated = await sharp(buf).rotate().toBuffer()
  const meta = await sharp(rotated).metadata()
  const W = meta.width ?? 0
  const H = meta.height ?? 0
  if (!W || !H) return []

  const CAP = 25
  const sorted = masks.slice().sort((a, b) => (b.bbox.w * b.bbox.h) - (a.bbox.w * a.bbox.h)).slice(0, CAP)

  // Upscale tiny crops so Claude has enough pixels to read the label,
  // but never past a hard ceiling — combined request size matters, and
  // a single broken crop shouldn't fail the whole pass, so fall back to
  // the raw extract if anything goes sideways.
  const MIN_SHORT_SIDE = 384
  const MAX_LONG_SIDE = 1400
  const crops = await Promise.all(sorted.map(async m => {
    const left = Math.max(0, Math.round(m.bbox.x * W))
    const top = Math.max(0, Math.round(m.bbox.y * H))
    const width = Math.min(W - left, Math.max(2, Math.round(m.bbox.w * W)))
    const height = Math.min(H - top, Math.max(2, Math.round(m.bbox.h * H)))

    const extract = sharp(rotated).extract({ left, top, width, height })
    const shortSide = Math.min(width, height)
    const longSide = Math.max(width, height)

    if (shortSide >= MIN_SHORT_SIDE) {
      const buf = await extract.jpeg({ quality: 88 }).toBuffer()
      return buf.toString('base64')
    }

    const rawScale = MIN_SHORT_SIDE / shortSide
    const scale = Math.min(rawScale, MAX_LONG_SIDE / longSide)
    if (scale <= 1) {
      const buf = await extract.jpeg({ quality: 88 }).toBuffer()
      return buf.toString('base64')
    }

    try {
      const targetW = Math.max(1, Math.round(width * scale))
      const targetH = Math.max(1, Math.round(height * scale))
      const buf = await extract
        .resize({ width: targetW, height: targetH, fit: 'fill', kernel: 'lanczos3' })
        .jpeg({ quality: 88 })
        .toBuffer()
      return buf.toString('base64')
    } catch (err) {
      console.warn('[shelfDetect] upscale failed, using raw crop:', err)
      const buf = await sharp(rotated).extract({ left, top, width, height }).jpeg({ quality: 88 }).toBuffer()
      return buf.toString('base64')
    }
  }))

  const contextLine = ctx.areaName
    ? ` This shelf is the "${ctx.areaName}" section.`
    : ''
  const candidateLine = ctx.candidates.length
    ? `\n\nThe store stocks these SKUs — prefer one of these exact names when a region matches:\n${ctx.candidates.join(', ')}`
    : ''

  const content: Anthropic.Messages.ContentBlockParam[] = []
  crops.forEach((c, i) => {
    content.push({ type: 'text', text: `Region ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c } })
  })
  content.push({
    type: 'text',
    text: `You're cataloging a convenience-store shelf.${contextLine} For each numbered region above, identify the product.${candidateLine}

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
    max_tokens: 5000,
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
