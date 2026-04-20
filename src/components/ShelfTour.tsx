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
}

const ZOOM_LEVEL = 3.5
const SWIPE_THRESHOLD = 50

export default function ShelfTour({ storeId, onOpenProduct }: Props) {
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
    return (
      <section className="space-y-6">
        {areas.map(area => {
          const areaPhotos = photos.filter(p => {
            if (p.areaName === area.name) return true
            if (!p.areaName && area.name === 'Main shelf') return true
            return false
          })
          if (areaPhotos.length === 0 || area.rows < 1 || area.cols < 1) return null
          return (
            <div key={area.name} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{area.name}</p>
              <GridView
                store={{ shelfRows: area.rows, shelfCols: area.cols, shelfAreas: null }}
                photos={areaPhotos}
                onOpenProduct={onOpenProduct}
              />
            </div>
          )
        })}
      </section>
    )
  }

  if (hasGrid) {
    return <GridView store={store!} photos={photos} onOpenProduct={onOpenProduct} />
  }
  return <LegacyView photos={photos} onOpenProduct={onOpenProduct} />
}

// ─── Grid (panorama) View ────────────────────────────────────────────

function GridView({ store, photos, onOpenProduct }: { store: StoreMeta; photos: ShelfPhoto[]; onOpenProduct: (id: string) => void }) {
  const rows = store.shelfRows ?? 0
  const cols = store.shelfCols ?? 0
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)

  // Lookup by "r:c"
  const cellMap = new Map<string, ShelfPhoto>()
  for (const p of photos) {
    if (p.shelfIndex == null || p.sectionIndex == null) continue
    cellMap.set(`${p.shelfIndex}:${p.sectionIndex}`, p)
  }

  const expanded = activeCell ? cellMap.get(`${activeCell.r}:${activeCell.c}`) : null

  if (activeCell && expanded) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🛒 Shelf {activeCell.r + 1} · Section {activeCell.c + 1}</h2>
            <p className="text-xs text-gray-500">Tap anywhere to zoom · tap the dot to add.</p>
          </div>
          <button onClick={() => setActiveCell(null)} className="text-xs font-semibold text-brand">← All sections</button>
        </div>
        <ExpandedCell photo={expanded} onOpenProduct={onOpenProduct} />
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-gray-900">🛒 Browse the shelf</h2>
        <p className="text-xs text-gray-500">Tap any section to zoom in and shop.</p>
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => {
              const photo = cellMap.get(`${r}:${c}`)
              const itemCount = photo?.detections.filter(d => d.productId).length ?? 0
              return (
                <button
                  key={c}
                  onClick={() => photo && setActiveCell({ r, c })}
                  disabled={!photo}
                  className={`relative rounded-lg overflow-hidden border ${photo ? 'border-gray-200 active:scale-[0.98]' : 'border-dashed border-gray-300 bg-gray-50'} transition-transform`}
                  style={{ aspectRatio: '3 / 4' }}
                >
                  {photo ? (
                    <>
                      <img src={photo.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      {/* Subtle dot markers so the customer sees tap targets exist */}
                      {photo.detections.filter(d => d.productId).slice(0, 30).map((d, i) => (
                        <span
                          key={i}
                          className="absolute w-1.5 h-1.5 rounded-full bg-white ring-1 ring-brand/80 -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${(d.bbox.x + d.bbox.w / 2) * 100}%`,
                            top: `${(d.bbox.y + d.bbox.h / 2) * 100}%`,
                          }}
                        />
                      ))}
                      {itemCount > 0 && (
                        <span className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded text-center">
                          {itemCount} items
                        </span>
                      )}
                    </>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

function ExpandedCell({ photo, onOpenProduct }: { photo: ShelfPhoto; onOpenProduct: (id: string) => void }) {
  // Reuse ShelfRow with a single-photo array. Disables swipe cleanly.
  return <ShelfRow shelfIndex={photo.shelfIndex ?? 0} sections={[photo]} onOpenProduct={onOpenProduct} />
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
          {photo.detections.map((d, i) => {
            if (!d.productId) return null
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
                  minWidth: 28, minHeight: 28,
                }}
                aria-label={d.label}
              >
                <span
                  className={`rounded-full transition-all ${
                    isTapped ? 'bg-brand scale-150 shadow-lg'
                    : zoomed ? 'bg-brand ring-2 ring-white/90 shadow'
                    : 'bg-white/90 ring-2 ring-brand shadow-sm'
                  }`}
                  style={{ width: zoomed ? 14 : 10, height: zoomed ? 14 : 10 }}
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
