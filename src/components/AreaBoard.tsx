'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

  // Portals need document.body, which only exists on the client. Flip this
  // on after mount so the fullscreen overlay can render into body — escaping
  // any transformed ancestor (the AreaSwiper wraps us in a translateX()
  // drag container, and `position: fixed` inside a transform is scoped to
  // that ancestor instead of the viewport, so the overlay would otherwise
  // collapse into the swiper rather than cover the screen).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

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
      setZoomed(null)
      return
    }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    // Diagnostic so we can tell in the console whether the expected zoom
    // level is actually being applied when bottles get cut off.
    console.info('[AreaBoard] zoom', { cols, rows, zoom: ZOOM_LEVEL, board: { w: rect.width, h: rect.height }, tap: { cx, cy } })
    setZoomed({ cx: clamp01(cx), cy: clamp01(cy) })
  }

  function handleDotTap(e: React.MouseEvent, dot: Dot) {
    e.stopPropagation()
    setTapped({ id: dot.id, t: Date.now() })
    setTimeout(() => setTapped(t => (t?.id === dot.id ? null : t)), 400)
    onOpenProduct(dot.productId)
  }

  // In-flow board — always renders in the swiper. Natural aspect, no zoom.
  const inFlow = (
    <div
      ref={containerRef}
      onClick={onBoardClick}
      className="relative overflow-hidden rounded-2xl bg-gray-50 border border-gray-100 select-none cursor-zoom-in"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
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
              </div>
            )
          }),
        )}
      </div>
    </div>
  )

  // Fullscreen zoomed overlay — rendered via portal into document.body so
  // it escapes the AreaSwiper's translateX transform container. Fills the
  // viewport with equal 1fr rows/cols and letterboxes each cell's image
  // so aspect ratio is preserved.
  const fullscreen = zoomed ? (
    <div
      onClick={() => setZoomed(null)}
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none cursor-zoom-out"
      style={{ touchAction: 'none' }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transform: zoomTransform(zoomed.cx, zoomed.cy, ZOOM_LEVEL),
          transformOrigin: '0 0',
          transition: 'transform 0.22s ease-out',
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            width: '100%',
            height: '100%',
            gap: 0,
            lineHeight: 0,
          }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const photo = byRc.get(`${r}:${c}`)
              return (
                <div
                  key={`${r}:${c}`}
                  className="relative"
                  style={{ minHeight: 0, minWidth: 0 }}
                >
                  {photo ? (
                    <img
                      src={photo.imageUrl}
                      alt=""
                      className="block w-full h-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-900" />
                  )}
                </div>
              )
            }),
          )}
        </div>

        {dots.map(d => {
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
  ) : null

  return (
    <>
      {inFlow}
      {mounted && fullscreen ? createPortal(fullscreen, document.body) : null}
    </>
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
