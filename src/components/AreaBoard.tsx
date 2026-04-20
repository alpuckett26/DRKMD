'use client'

import { useRef, useState } from 'react'

interface Detection {
  productId: string | null
  label: string
  bbox: { x: number; y: number; w: number; h: number }
  matched: boolean
}

interface ShelfPhoto {
  id: string
  imageUrl: string
  shelfIndex: number | null
  sectionIndex: number | null
  detections: Detection[]
}

interface Props {
  rows: number
  cols: number
  photos: ShelfPhoto[]
  onOpenProduct: (productId: string) => void
}

// Pick a zoom factor that's useful without being claustrophobic. Dense
// grids need more magnification to separate products; skinny grids
// (like 7x1 coolers) look fine at ~1.5x.
function pickZoom(cols: number, rows: number): number {
  const bigger = Math.max(cols, rows)
  if (bigger >= 4) return 3
  if (bigger === 3) return 2.5
  if (bigger === 2) return 2
  return 1.6
}

/**
 * Renders all of an area's cells as one seamless board — no grid lines,
 * no per-shelf swipers. Looks like a single photo of the whole aisle.
 * Tap anywhere → zooms 3x to that point and dots appear over every
 * matched product. Tap a dot → opens the product sheet.
 */
export default function AreaBoard({ rows, cols, photos, onOpenProduct }: Props) {
  const ZOOM_LEVEL = pickZoom(cols, rows)
  const [zoomed, setZoomed] = useState<{ cx: number; cy: number } | null>(null)
  const [tapped, setTapped] = useState<{ id: string; t: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Grid lookup by r:c
  const byRc = new Map<string, ShelfPhoto>()
  for (const p of photos) {
    if (p.shelfIndex == null || p.sectionIndex == null) continue
    byRc.set(`${p.shelfIndex}:${p.sectionIndex}`, p)
  }

  // Flatten every detection into global (area-normalized) coords so we can
  // position a dot regardless of which cell it came from.
  interface Dot {
    id: string
    productId: string
    gx: number
    gy: number
    gw: number
    gh: number
    label: string
  }
  const dots: Dot[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const photo = byRc.get(`${r}:${c}`)
      if (!photo) continue
      for (const d of photo.detections) {
        if (!d.productId) continue
        dots.push({
          id: `${photo.id}:${d.productId}:${d.bbox.x}:${d.bbox.y}`,
          productId: d.productId,
          gx: (c + d.bbox.x + d.bbox.w / 2) / cols,
          gy: (r + d.bbox.y + d.bbox.h / 2) / rows,
          gw: d.bbox.w / cols,
          gh: d.bbox.h / rows,
          label: d.label,
        })
      }
    }
  }

  function onBoardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (zoomed) {
      // Tapping empty space while zoomed = exit zoom. Dots call
      // stopPropagation in handleDotTap so they keep their own behavior.
      setZoomed(null)
      return
    }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    setZoomed({ cx: clamp01(cx), cy: clamp01(cy) })
  }

  function handleDotTap(e: React.MouseEvent, dot: Dot) {
    e.stopPropagation()
    setTapped({ id: dot.id, t: Date.now() })
    setTimeout(() => setTapped(t => (t?.id === dot.id ? null : t)), 400)
    onOpenProduct(dot.productId)
  }

  return (
    <div
      ref={containerRef}
      onClick={onBoardClick}
      className={`relative overflow-hidden rounded-2xl bg-gray-50 border border-gray-100 select-none ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
        {/* The tiled grid — no gap, no border, looks like one photo */}
        <div
          className="relative"
          style={{
            transform: zoomed ? zoomTransform(zoomed.cx, zoomed.cy, ZOOM_LEVEL) : 'none',
            transformOrigin: '0 0',
            transition: 'transform 0.22s ease-out',
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              gap: 0,
            }}
          >
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const photo = byRc.get(`${r}:${c}`)
                return (
                  <div
                    key={`${r}:${c}`}
                    className="relative bg-gray-100"
                  >
                    {photo ? (
                      <img
                        src={photo.imageUrl}
                        alt=""
                        className="block w-full h-auto"
                        draggable={false}
                      />
                    ) : null}
                  </div>
                )
              }),
            )}
          </div>

          {/* Dots only materialize once the customer has zoomed in */}
          {zoomed && dots.map(d => {
            const isTapped = tapped?.id === d.id
            return (
              <button
                key={d.id}
                onClick={e => handleDotTap(e, d)}
                className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${d.gx * 100}%`,
                  top: `${d.gy * 100}%`,
                  width: `${Math.max(2, d.gw * 100) / ZOOM_LEVEL}%`,
                  height: `${Math.max(2, d.gh * 100) / ZOOM_LEVEL}%`,
                  minWidth: 28, minHeight: 28,
                }}
                aria-label={d.label}
              >
                <span
                  className={`rounded-full transition-all shadow ${
                    isTapped ? 'bg-brand scale-150' : 'bg-brand ring-2 ring-white/90'
                  }`}
                  style={{ width: 14, height: 14 }}
                />
              </button>
            )
          })}
        </div>

    </div>
  )
}

function zoomTransform(cx: number, cy: number, scale: number): string {
  const txPct = (0.5 / scale - cx) * 100
  const tyPct = (0.5 / scale - cy) * 100
  const minTxPct = -((scale - 1) / scale) * 100
  const minTyPct = -((scale - 1) / scale) * 100
  const clampedTx = Math.max(minTxPct, Math.min(0, txPct))
  const clampedTy = Math.max(minTyPct, Math.min(0, tyPct))
  return `scale(${scale}) translate(${clampedTx}%, ${clampedTy}%)`
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }
