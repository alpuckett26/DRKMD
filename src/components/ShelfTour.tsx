'use client'

import { useEffect, useRef, useState } from 'react'
import AreaBoard from './AreaBoard'

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
  shelfIndex: number | null
  sectionIndex: number | null
  areaName: string | null
}

interface ShelfArea {
  name: string
  rows: number
  cols: number
}

interface StoreMeta {
  shelfRows: number | null
  shelfCols: number | null
  shelfAreas: ShelfArea[] | null
}

interface Props {
  storeId: string
  onOpenProduct: (productId: string) => void
  /** Bumped by the parent store page each time an item is added so the
   *  zoomed AreaBoard can collapse back to the clean cooler view. */
  resetZoomSignal?: number
  /** True while any shelf board is zoomed-in — lets the store page hide
   *  its sticky header for a fuller-height shopping view. */
  onZoomChange?: (zoomed: boolean) => void
}

const ZOOM_LEVEL = 3.5
const SWIPE_THRESHOLD = 50

export default function ShelfTour({ storeId, onOpenProduct, resetZoomSignal, onZoomChange }: Props) {
  const [photos, setPhotos] = useState<ShelfPhoto[]>([])
  const [store, setStore] = useState<StoreMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/stores/${storeId}/shelf-tour`).then(r => r.json()),
      fetch(`/api/stores/${storeId}`).then(r => r.json()),
    ])
      .then(([p, s]: [ShelfPhoto[], StoreMeta]) => { setPhotos(p); setStore(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [storeId])

  if (loading) return null
  if (photos.length === 0) return null

  const hasGrid = (store?.shelfRows ?? 0) > 0 && photos.some(p => p.shelfIndex != null)

  // Multi-scan path: one or more named areas with grid photos.
  const areas = Array.isArray(store?.shelfAreas) ? store!.shelfAreas ?? [] : []
  const multiScan = hasGrid && areas.length > 0

  if (multiScan) {
    const visibleAreas = areas
      .map(area => {
        const areaPhotos = photos.filter(p => {
          if (p.areaName === area.name) return true
          if (!p.areaName && area.name === 'Main shelf') return true
          return false
        })
        return { area, areaPhotos }
      })
      .filter(({ area, areaPhotos }) => areaPhotos.length > 0 && area.rows > 0 && area.cols > 0)

    if (visibleAreas.length === 0) return null

    return (
      <AreaSwiper
        areas={visibleAreas}
        onOpenProduct={onOpenProduct}
        resetZoomSignal={resetZoomSignal}
        onZoomChange={onZoomChange}
      />
    )
  }

  if (hasGrid) {
    const itemCount = photos.reduce((sum, p) => sum + p.detections.filter(d => d.productId).length, 0)
    return (
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Shop the shelf</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tap to zoom in, then tap the item you want.</p>
          </div>
          {itemCount > 0 && <span className="text-xs text-gray-500">{itemCount} items</span>}
        </div>
        <AreaBoard
          rows={store!.shelfRows ?? 0}
          cols={store!.shelfCols ?? 0}
          photos={photos}
          onOpenProduct={onOpenProduct}
          resetZoomSignal={resetZoomSignal}
          onZoomChange={onZoomChange}
        />
      </section>
    )
  }
  return <LegacyView photos={photos} onOpenProduct={onOpenProduct} />
}

// ─── Swipe between named areas ──────────────────────────────────────

function AreaSwiper({
  areas, onOpenProduct, resetZoomSignal, onZoomChange,
}: {
  areas: { area: ShelfArea; areaPhotos: ShelfPhoto[] }[]
  onOpenProduct: (id: string) => void
  resetZoomSignal?: number
  onZoomChange?: (zoomed: boolean) => void
}) {
  const [active, setActive] = useState(0)
  const [dragX, setDragX] = useState(0)
  const pointer = useRef<{ id: number; sx: number; sy: number; moved: boolean } | null>(null)
  const SWIPE = 60

  const current = areas[active]
  const prev = active > 0 ? areas[active - 1] : null
  const next = active < areas.length - 1 ? areas[active + 1] : null

  function goPrev() { if (prev) setActive(active - 1) }
  function goNext() { if (next) setActive(active + 1) }

  function onPointerDown(e: React.PointerEvent) {
    pointer.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false }
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = pointer.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.sx
    const dy = e.clientY - p.sy
    if (!p.moved && Math.hypot(dx, dy) > 8) p.moved = true
    if (Math.abs(dx) > Math.abs(dy)) {
      let resisted = dx
      if ((active === 0 && dx > 0) || (active === areas.length - 1 && dx < 0)) resisted = dx * 0.35
      setDragX(resisted)
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const p = pointer.current
    pointer.current = null
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.sx
    const dy = e.clientY - p.sy
    setDragX(0)
    if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
    }
  }

  const itemCount = current.areaPhotos.reduce((sum, p) => sum + p.detections.filter(d => d.productId).length, 0)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{current.area.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Swipe ↔ to change aisle · tap to zoom · tap the item to add.</p>
        </div>
        {itemCount > 0 && <span className="text-xs text-gray-500">{itemCount} items</span>}
      </div>

      {/* Subtle prev/next row above the board — no overlay on the shelf */}
      {(prev || next) && (
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-gray-500 px-0.5">
          {prev ? (
            <button onClick={goPrev} className="flex items-center gap-1 min-w-0 active:text-gray-900">
              <span>‹</span>
              <span className="truncate">{prev.area.name}</span>
            </button>
          ) : <span />}
          {next ? (
            <button onClick={goNext} className="flex items-center gap-1 min-w-0 active:text-gray-900">
              <span className="truncate">{next.area.name}</span>
              <span>›</span>
            </button>
          ) : <span />}
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { pointer.current = null; setDragX(0) }}
        className="relative"
        style={{ touchAction: 'pan-y' }}
      >
        <div
          style={{
            transform: `translateX(${dragX}px)`,
            transition: pointer.current ? 'none' : 'transform 0.22s ease-out',
          }}
        >
          <AreaBoard
            rows={current.area.rows}
            cols={current.area.cols}
            photos={current.areaPhotos}
            onOpenProduct={onOpenProduct}
            resetZoomSignal={resetZoomSignal}
            onZoomChange={onZoomChange}
          />
        </div>
      </div>

      {/* Pagination dots */}
      {areas.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {areas.map((a, i) => (
            <button
              key={a.area.name}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'bg-gray-900 w-6' : 'bg-gray-300 w-1.5'}`}
              aria-label={a.area.name}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Grid (panorama) View ────────────────────────────────────────────

function GridView({ store, photos, onOpenProduct }: { store: StoreMeta; photos: ShelfPhoto[]; onOpenProduct: (id: string) => void }) {
  const rows = store.shelfRows ?? 0

  // Group photos by shelfIndex, sorted by sectionIndex
  const byShelf: Record<number, ShelfPhoto[]> = {}
  for (const p of photos) {
    if (p.shelfIndex == null || p.sectionIndex == null) continue
    const arr = byShelf[p.shelfIndex] ?? []
    arr.push(p)
    byShelf[p.shelfIndex] = arr
  }
  for (const k of Object.keys(byShelf)) {
    byShelf[Number(k)].sort((a, b) => (a.sectionIndex ?? 0) - (b.sectionIndex ?? 0))
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => {
        const sections = byShelf[r] ?? []
        if (sections.length === 0) return null
        return (
          <ShelfRow key={r} shelfIndex={r} sections={sections} onOpenProduct={onOpenProduct} />
        )
      })}
    </div>
  )
}

function ShelfRow({ shelfIndex, sections, onOpenProduct }: {
  shelfIndex: number
  sections: ShelfPhoto[]
  onOpenProduct: (id: string) => void
}) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState<{ cx: number; cy: number } | null>(null)
  const [dragX, setDragX] = useState(0)
  const [tapped, setTapped] = useState<{ i: number; t: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ id: number; sx: number; sy: number; moved: boolean } | null>(null)

  useEffect(() => { setZoomed(null); setDragX(0) }, [active])

  const photo = sections[active]
  const hasMultiple = sections.length > 1

  function goPrev() { if (active > 0) setActive(active - 1) }
  function goNext() { if (active < sections.length - 1) setActive(active + 1) }

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
    if (Math.abs(dx) > Math.abs(dy)) {
      let resisted = dx
      if ((active === 0 && dx > 0) || (active === sections.length - 1 && dx < 0)) resisted = dx * 0.35
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
    if (!p.moved && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const cx = (e.clientX - rect.left) / rect.width
      const cy = (e.clientY - rect.top) / rect.height
      setZoomed({ cx: clamp01(cx), cy: clamp01(cy) })
    }
  }
  function onClickContainer(e: React.MouseEvent<HTMLDivElement>) {
    if (zoomed) return
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    setZoomed({ cx: clamp01(cx), cy: clamp01(cy) })
  }

  function handleHotspotTap(e: React.MouseEvent, det: Detection, i: number) {
    e.stopPropagation()
    if (!det.productId) return
    setTapped({ i, t: Date.now() })
    setTimeout(() => setTapped(t => (t?.i === i ? null : t)), 400)
    onOpenProduct(det.productId)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Shelf {shelfIndex + 1}</p>
        <div className="flex items-center gap-3">
          {zoomed && (
            <button onClick={() => setZoomed(null)} className="text-xs font-semibold text-brand">⛶ Zoom out</button>
          )}
          {hasMultiple && (
            <div className="flex gap-1.5">
              {sections.map((_, i) => (
                <button key={i} onClick={() => setActive(i)}
                  className={`h-1.5 rounded-full transition-all ${i === active ? 'bg-gray-900 w-5' : 'bg-gray-300 w-1.5'}`}
                  aria-label={`Section ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={hasMultiple ? undefined : onClickContainer}
        onPointerDown={hasMultiple ? onPointerDown : undefined}
        onPointerMove={hasMultiple ? onPointerMove : undefined}
        onPointerUp={hasMultiple ? onPointerUp : undefined}
        onPointerCancel={hasMultiple ? () => { pointer.current = null; setDragX(0) } : undefined}
        className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 select-none ${zoomed ? '' : 'cursor-zoom-in'}`}
      >
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
          <img src={photo.imageUrl} alt={photo.label ?? ''} className="block w-full h-auto" draggable={false} />
          {/* Dots only exist once the customer has zoomed into a section —
              before that the shelf should look like a normal photo. */}
          {zoomed && photo.detections.map((d, i) => {
            if (!d.productId) return null
            const cx = d.bbox.x + d.bbox.w / 2
            const cy = d.bbox.y + d.bbox.h / 2
            const isTapped = tapped?.i === i
            return (
              <button
                key={i}
                onClick={e => handleHotspotTap(e, d, i)}
                className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${cx * 100}%`,
                  top: `${cy * 100}%`,
                  width: `${Math.max(14, d.bbox.w * 100) / ZOOM_LEVEL}%`,
                  height: `${Math.max(14, d.bbox.h * 100) / ZOOM_LEVEL}%`,
                  minWidth: 28, minHeight: 28,
                }}
                aria-label={d.label}
              >
                <span
                  className={`rounded-full transition-all ${
                    isTapped ? 'bg-brand scale-150 shadow-lg' : 'bg-brand ring-2 ring-white/90 shadow'
                  }`}
                  style={{ width: 14, height: 14 }}
                />
              </button>
            )
          })}
        </div>

        {!zoomed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">🔍 Tap to zoom</div>
          </div>
        )}

        {!zoomed && hasMultiple && (
          <>
            {active > 0 && (
              <button onClick={e => { e.stopPropagation(); goPrev() }} onPointerDown={e => e.stopPropagation()}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-gray-200 text-gray-900 font-bold shadow"
                aria-label="Previous section">‹</button>
            )}
            {active < sections.length - 1 && (
              <button onClick={e => { e.stopPropagation(); goNext() }} onPointerDown={e => e.stopPropagation()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-gray-200 text-gray-900 font-bold shadow"
                aria-label="Next section">›</button>
            )}
          </>
        )}
      </div>

      {hasMultiple && (
        <p className="text-[10px] text-gray-500 text-right">Section {active + 1} of {sections.length}</p>
      )}
    </div>
  )
}

// ─── Legacy (free-form) View ─────────────────────────────────────────

function LegacyView({ photos, onOpenProduct }: { photos: ShelfPhoto[]; onOpenProduct: (id: string) => void }) {
  // Treat legacy free-form photos as a single shelf with many sections.
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-gray-900">🛒 Browse the shelf</h2>
        <p className="text-xs text-gray-500">Tap to zoom · tap the dot to add.</p>
      </div>
      <ShelfRow shelfIndex={0} sections={photos} onOpenProduct={onOpenProduct} />
    </section>
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
