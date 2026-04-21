'use client'

import { useEffect, useRef, useState } from 'react'

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
  /** When this value changes, the board collapses its zoom state — used
   *  by the parent to exit zoom after an item was added to cart. */
  resetZoomSignal?: number
  /** Fires true when the customer enters zoom, false when they exit.
   *  The store page uses this to hide the sticky header for a cleaner
   *  full-height shelf view. */
  onZoomChange?: (zoomed: boolean) => void
}

// Pick a zoom factor that makes individual items tappable without hiding
// too much context. Zoom scales with COLUMNS only — shelf rows stack
// vertically and don't change how many items sit side-by-side in a row.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pickZoom(cols: number, _rows: number): number {
  if (cols >= 5) return 3
  if (cols === 4) return 2.5
  if (cols === 3) return 2
  if (cols === 2) return 1.5
  return 1.1 // cols === 1: whole shelf spans the width, just a nudge for tap precision
}

/**
 * Renders all of an area's cells as one seamless board — no grid lines,
 * no per-shelf swipers. Looks like a single photo of the whole aisle.
 * Tap anywhere → zooms 3x to that point and dots appear over every
 * matched product. Tap a dot → opens the product sheet.
 */
export default function AreaBoard({ rows, cols, photos, onOpenProduct, resetZoomSignal, onZoomChange }: Props) {
  const ZOOM_LEVEL = pickZoom(cols, rows)
  const [zoomed, setZoomed] = useState<{ cx: number; cy: number } | null>(null)

  // Parent bumps this counter when an item is added — collapse the zoom so
  // the customer lands back on the clean cooler view without dots.
  useEffect(() => {
    if (resetZoomSignal !== undefined) setZoomed(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetZoomSignal])

  // Tell the parent whenever zoom state changes so the app chrome can
  // hide for a full-height shelf view.
  useEffect(() => {
    onZoomChange?.(zoomed !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed !== null])
  const [tapped, setTapped] = useState<{ id: string; t: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Grid lookup by r:c
  const byRc = new Map<string, ShelfPhoto>()
  for (const p of photos) {
    if (p.shelfIndex == null || p.sectionIndex == null) continue
    byRc.set(`${p.shelfIndex}:${p.sectionIndex}`, p)
  }

  function onBoardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (zoomed) {
      setZoomed(null)
      return
    }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    setZoomed({ cx: clamp01(cx), cy: clamp01(cy) })
  }

  function handleDotTap(e: React.MouseEvent, dotId: string, productId: string) {
    e.stopPropagation()
    setTapped({ id: dotId, t: Date.now() })
    setTimeout(() => setTapped(t => (t?.id === dotId ? null : t)), 400)
    onOpenProduct(productId)
  }

  return (
    <div
      ref={containerRef}
      onClick={onBoardClick}
      className={`relative overflow-hidden rounded-2xl bg-gray-50 border border-gray-100 select-none ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
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
            // Rows auto-size to their images so same-source strips tile
            // seamlessly — don't assume 1/rows per row. Dots below are
            // rendered inside the cell so they track whatever real
            // height each row ends up with.
            gridAutoRows: 'auto',
            gap: 0,
            lineHeight: 0,
          }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const photo = byRc.get(`${r}:${c}`)
              return (
                <div key={`${r}:${c}`} className="relative">
                  {photo ? (
                    <img
                      src={photo.imageUrl}
                      alt=""
                      className="block w-full h-auto"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}

                  {/* Dots render inside their originating cell so their
                   *  % coords line up with the actual rendered image —
                   *  unlike a global overlay which assumes equal row
                   *  heights across the whole board. */}
                  {zoomed && photo && photo.detections.map(d => {
                    if (!d.productId) return null
                    const dotId = `${photo.id}:${d.productId}:${d.bbox.x}:${d.bbox.y}`
                    const cx = d.bbox.x + d.bbox.w / 2
                    const cy = d.bbox.y + d.bbox.h / 2
                    const isTapped = tapped?.id === dotId
                    const productId = d.productId
                    return (
                      <button
                        key={dotId}
                        onClick={e => handleDotTap(e, dotId, productId)}
                        className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${cx * 100}%`,
                          top: `${cy * 100}%`,
                          width: `${Math.max(2, d.bbox.w * 100) / ZOOM_LEVEL}%`,
                          height: `${Math.max(2, d.bbox.h * 100) / ZOOM_LEVEL}%`,
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
              )
            }),
          )}
        </div>
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
