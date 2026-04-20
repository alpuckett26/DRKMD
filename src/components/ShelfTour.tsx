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
  label: string | null
  detections: Detection[]
}

interface Props {
  storeId: string
  onOpenProduct: (productId: string) => void
}

const ZOOM_LEVEL = 2.5
const SWIPE_THRESHOLD = 50 // pixels of horizontal travel before it counts as a swipe

export default function ShelfTour({ storeId, onOpenProduct }: Props) {
  const [photos, setPhotos] = useState<ShelfPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState<{ cx: number; cy: number } | null>(null)
  const [tapped, setTapped] = useState<{ i: number; t: number } | null>(null)
  const [dragX, setDragX] = useState(0) // live drag offset for swipe feedback
  const containerRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ id: number; sx: number; sy: number; moved: boolean } | null>(null)

  useEffect(() => {
    fetch(`/api/stores/${storeId}/shelf-tour`)
      .then(r => r.json())
      .then((data: ShelfPhoto[]) => { setPhotos(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [storeId])

  // Reset zoom when switching photos
  useEffect(() => { setZoomed(null); setDragX(0) }, [active])

  if (loading) return null
  if (photos.length === 0) return null

  const photo = photos[active]
  const hasMultiple = photos.length > 1

  function goPrev() { if (active > 0) setActive(active - 1) }
  function goNext() { if (active < photos.length - 1) setActive(active + 1) }

  function handleHotspotTap(e: React.MouseEvent, det: Detection, i: number) {
    e.stopPropagation()
    if (!det.productId) return
    setTapped({ i, t: Date.now() })
    setTimeout(() => setTapped(t => (t?.i === i ? null : t)), 400)
    onOpenProduct(det.productId)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoomed || !hasMultiple) return
    pointer.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointer.current
    if (!p || p.id !== e.pointerId || zoomed || !hasMultiple) return
    const dx = e.clientX - p.sx
    const dy = e.clientY - p.sy
    if (!p.moved && Math.hypot(dx, dy) > 8) p.moved = true
    // Only show horizontal drag feedback if horizontal travel dominates
    if (Math.abs(dx) > Math.abs(dy)) {
      // Resist on edges so user feels the boundary
      let resisted = dx
      if ((active === 0 && dx > 0) || (active === photos.length - 1 && dx < 0)) {
        resisted = dx * 0.35
      }
      setDragX(resisted)
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointer.current
    pointer.current = null
    if (!p || p.id !== e.pointerId || zoomed || !hasMultiple) { setDragX(0); return }
    const dx = e.clientX - p.sx
    const dy = e.clientY - p.sy
    const horizontal = Math.abs(dx) > Math.abs(dy)

    setDragX(0)
    if (horizontal && Math.abs(dx) >= SWIPE_THRESHOLD) {
      if (dx < 0) goNext()
      else goPrev()
      return
    }
    // Not a swipe → treat as a tap → zoom to that position.
    // When p.moved is true the user was scrolling/panning; ignore.
    if (!p.moved && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const cx = (e.clientX - rect.left) / rect.width
      const cy = (e.clientY - rect.top) / rect.height
      setZoomed({ cx: clamp01(cx), cy: clamp01(cy) })
    }
  }

  // Simple click handler for the single-photo case — no swipe detection
  // needed so we keep the original, working behavior.
  function onContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (zoomed) return
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    setZoomed({ cx: clamp01(cx), cy: clamp01(cy) })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">🛒 Browse the shelf</h2>
          <p className="text-xs text-gray-500">
            {zoomed
              ? 'Tap the exact item to confirm quantity.'
              : hasMultiple
                ? 'Tap to zoom in · swipe to change shelves.'
                : 'Tap an area of the shelf to zoom in.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {zoomed && (
            <button
              onClick={() => setZoomed(null)}
              className="text-xs font-semibold text-brand flex items-center gap-1"
            >
              ⛶ Zoom out
            </button>
          )}
          {hasMultiple && (
            <div className="flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-1.5 rounded-full transition-all ${i === active ? 'bg-gray-900 w-6' : 'bg-gray-300 w-2'}`}
                  aria-label={`Shelf ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={hasMultiple ? undefined : onContainerClick}
        onPointerDown={hasMultiple ? onPointerDown : undefined}
        onPointerMove={hasMultiple ? onPointerMove : undefined}
        onPointerUp={hasMultiple ? onPointerUp : undefined}
        onPointerCancel={hasMultiple ? () => { pointer.current = null; setDragX(0) } : undefined}
        className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 select-none ${zoomed ? '' : 'cursor-zoom-in'}`}
      >
        {/* Transformed wrapper — everything inside scales/translates together so
            hotspot positions stay aligned with the image pixels. */}
        <div
          className="relative"
          style={{
            transform: zoomed
              ? zoomTransform(zoomed.cx, zoomed.cy, ZOOM_LEVEL)
              : `translateX(${dragX}px)`,
            transformOrigin: '0 0',
            transition: pointer.current ? 'none' : 'transform 0.22s ease-out',
          }}
        >
          <img
            src={photo.imageUrl}
            alt={photo.label ?? 'Shelf'}
            className="block w-full h-auto"
            draggable={false}
          />
          {photo.detections.map((d, i) => {
            if (!d.productId) return null // hide unmatched from customers
            const interactive = !!zoomed
            const cx = d.bbox.x + d.bbox.w / 2
            const cy = d.bbox.y + d.bbox.h / 2
            const isTapped = tapped?.i === i
            return (
              <button
                key={i}
                onClick={e => handleHotspotTap(e, d, i)}
                disabled={!interactive}
                className={`absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2 ${!interactive ? 'pointer-events-none' : ''}`}
                style={{
                  left: `${cx * 100}%`,
                  top: `${cy * 100}%`,
                  width: `${Math.max(14, d.bbox.w * 100) / (zoomed ? ZOOM_LEVEL : 1)}%`,
                  height: `${Math.max(14, d.bbox.h * 100) / (zoomed ? ZOOM_LEVEL : 1)}%`,
                  minWidth: 28,
                  minHeight: 28,
                }}
                aria-label={d.label}
                title={d.label}
              >
                <span
                  className={`rounded-full transition-all ${
                    isTapped
                      ? 'bg-brand scale-150 shadow-lg'
                      : zoomed
                        ? 'bg-brand ring-2 ring-white/90 shadow'
                        : 'bg-white/90 ring-2 ring-brand shadow-sm'
                  }`}
                  style={{
                    width: zoomed ? 14 : 10,
                    height: zoomed ? 14 : 10,
                  }}
                />
              </button>
            )
          })}
        </div>

        {/* Overlay cue when not zoomed */}
        {!zoomed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/55 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span>🔍</span> Tap to zoom in
            </div>
          </div>
        )}

        {/* Prev/Next arrows with the destination shelf label so the customer
            builds a mental map — same way they'd walk aisle to aisle. */}
        {!zoomed && hasMultiple && (
          <>
            {active > 0 && (
              <button
                onClick={e => { e.stopPropagation(); goPrev() }}
                onPointerDown={e => e.stopPropagation()}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 h-10 pl-2 pr-3 rounded-full bg-white/95 border border-gray-200 text-gray-900 font-semibold shadow backdrop-blur-sm active:bg-white max-w-[40%]"
                aria-label={`Previous shelf: ${shelfLabel(photos[active - 1], active - 1)}`}
              >
                <span className="text-lg leading-none">‹</span>
                <span className="text-xs truncate">{shelfLabel(photos[active - 1], active - 1)}</span>
              </button>
            )}
            {active < photos.length - 1 && (
              <button
                onClick={e => { e.stopPropagation(); goNext() }}
                onPointerDown={e => e.stopPropagation()}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 h-10 pl-3 pr-2 rounded-full bg-white/95 border border-gray-200 text-gray-900 font-semibold shadow backdrop-blur-sm active:bg-white max-w-[40%]"
                aria-label={`Next shelf: ${shelfLabel(photos[active + 1], active + 1)}`}
              >
                <span className="text-xs truncate">{shelfLabel(photos[active + 1], active + 1)}</span>
                <span className="text-lg leading-none">›</span>
              </button>
            )}
          </>
        )}
      </div>

      {photo.label && (
        <p className="text-xs text-gray-600 text-center">
          {photo.label}
          {hasMultiple && <span className="text-gray-400"> · {active + 1} of {photos.length}</span>}
        </p>
      )}
    </section>
  )
}

/** Compute a CSS transform that zooms the content so (cx,cy) — given as a
 *  normalized point in the *unscaled* image — ends up at the center of the
 *  container. Clamped so we never show empty edges. */
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

function shelfLabel(photo: ShelfPhoto | undefined, index: number): string {
  if (photo?.label && photo.label.trim()) return photo.label
  return `Shelf ${index + 1}`
}
