/**
 * SAM 2 (Segment Anything Model 2) via Replicate.
 *
 * We use SAM to get pixel-tight shapes for products the admin has already
 * identified with Claude Vision. Claude labels; SAM refines geometry.
 *
 * Environment:
 *   REPLICATE_API_TOKEN   required — get one at replicate.com/account
 *   REPLICATE_SAM_MODEL   optional — model version hash. Defaults to
 *                         meta/sam-2 automatic-mask (image) — a widely
 *                         used community build.
 *
 * If REPLICATE_API_TOKEN is missing or anything fails, `segmentShelf()`
 * returns null so callers can gracefully fall back to Claude-only bboxes.
 */

import Replicate from 'replicate'

export interface SamMaskBBox {
  bbox: { x: number; y: number; w: number; h: number } // normalized 0–1
  area: number // normalized 0–1
  polygon?: [number, number][] // normalized 0–1
  score?: number
}

// Default: a SAM 2 auto-mask model that returns JSON with bboxes.
// Swap via REPLICATE_SAM_MODEL without code changes.
const DEFAULT_MODEL =
  'lucataco/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83'

export async function segmentShelf(imageBase64: string): Promise<SamMaskBBox[] | null> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return null

  try {
    const replicate = new Replicate({ auth: token })
    const model = (process.env.REPLICATE_SAM_MODEL || DEFAULT_MODEL) as `${string}/${string}:${string}`
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`

    const raw = await replicate.run(model, {
      input: {
        image: dataUrl,
        points_per_side: 32,
        pred_iou_thresh: 0.8,
        stability_score_thresh: 0.85,
        min_mask_region_area: 400,
      },
    })

    return parseReplicateOutput(raw)
  } catch (err) {
    console.error('[sam] segmentation failed:', err)
    return null
  }
}

/** Filter SAM masks to the ones most likely to be retail products. */
export function filterProductLikely(masks: SamMaskBBox[]): SamMaskBBox[] {
  return masks.filter(m => {
    const { w, h } = m.bbox
    // Drop sliver-thin or giant background masks.
    if (w < 0.02 || h < 0.03) return false
    if (w > 0.8 || h > 0.9) return false
    // Very elongated horizontal bars = likely shelves or price rails.
    const aspect = w / h
    if (aspect > 4 || aspect < 0.1) return false
    return true
  })
}

/** For a given Claude detection, find the best overlapping SAM mask and
 *  return its tighter bbox. If nothing overlaps well, return null. */
export function findBestMask(
  claudeBBox: { x: number; y: number; w: number; h: number },
  masks: SamMaskBBox[],
  minIoU = 0.15,
): SamMaskBBox | null {
  let best: { mask: SamMaskBBox; iou: number } | null = null
  for (const m of masks) {
    const iou = computeIoU(claudeBBox, m.bbox)
    if (iou < minIoU) continue
    if (!best || iou > best.iou) best = { mask: m, iou }
  }
  return best?.mask ?? null
}

function computeIoU(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const ax2 = a.x + a.w
  const ay2 = a.y + a.h
  const bx2 = b.x + b.w
  const by2 = b.y + b.h
  const ix = Math.max(a.x, b.x)
  const iy = Math.max(a.y, b.y)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)
  const iw = Math.max(0, ix2 - ix)
  const ih = Math.max(0, iy2 - iy)
  const inter = iw * ih
  if (inter <= 0) return 0
  const aArea = a.w * a.h
  const bArea = b.w * b.h
  const union = aArea + bArea - inter
  return inter / union
}

/** Best-effort parser that handles the common Replicate SAM output shapes.
 *  Accepts either an array or an object with a segments/masks array, and
 *  normalizes pixel-coord bboxes when image dimensions accompany them. */
function parseReplicateOutput(raw: unknown): SamMaskBBox[] {
  let items: Record<string, unknown>[] = []
  let imageW: number | undefined
  let imageH: number | undefined

  if (Array.isArray(raw)) {
    items = raw as Record<string, unknown>[]
  } else if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    items =
      (r.segments as Record<string, unknown>[] | undefined) ??
      (r.masks as Record<string, unknown>[] | undefined) ??
      (r.instances as Record<string, unknown>[] | undefined) ??
      []
    if (typeof r.image_width === 'number') imageW = r.image_width
    if (typeof r.image_height === 'number') imageH = r.image_height
  }

  const out: SamMaskBBox[] = []
  for (const it of items) {
    const bboxRaw =
      (it.bbox as number[] | { x: number; y: number; w?: number; h?: number; width?: number; height?: number } | undefined) ??
      (it.box as number[] | undefined)
    if (!bboxRaw) continue

    let x: number, y: number, w: number, h: number
    if (Array.isArray(bboxRaw) && bboxRaw.length >= 4) {
      // Either [x, y, w, h] or [x1, y1, x2, y2]. Heuristic: if the third
      // value is larger than the first AND both are > 1, assume xyxy.
      const [a, b, c, d] = bboxRaw as [number, number, number, number]
      if ((c > a && d > b) && (c > 1 || d > 1) && (a <= c && b <= d)) {
        x = a; y = b; w = c - a; h = d - b
      } else {
        x = a; y = b; w = c; h = d
      }
    } else if (typeof bboxRaw === 'object') {
      const r = bboxRaw as { x: number; y: number; w?: number; h?: number; width?: number; height?: number }
      x = r.x
      y = r.y
      w = r.w ?? r.width ?? 0
      h = r.h ?? r.height ?? 0
    } else {
      continue
    }

    // Normalize if clearly in pixel coords.
    if (x > 1 || y > 1 || w > 1 || h > 1) {
      if (!imageW || !imageH) {
        // No dims; skip rather than guess.
        continue
      }
      x /= imageW; w /= imageW
      y /= imageH; h /= imageH
    }

    if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > 1.01 || y + h > 1.01) continue

    out.push({
      bbox: { x, y, w, h },
      area: (typeof it.area === 'number' ? it.area : w * h),
      score: typeof it.score === 'number' ? it.score : undefined,
    })
  }
  return out
}
