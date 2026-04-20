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

export default function ShelfTour({ storeId, onOpenProduct }: Props) {
  const [photos, setPhotos] = useState<ShelfPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState<{ cx: number; cy: number } | null>(null)
  const [tapped, setTapped] = useState<{ i: number; t: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/stores/${storeId}/shelf-tour`)
      .then(r => r.json())
      .then((data: ShelfPhoto[]) => { setPhotos(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [storeId])

  // Reset zoom when switching photos
  useEffect(() => { setZoomed(null) }, [active])

  if (loading) return null
  if (photos.length === 0) return null

  const photo = photos[active]

  function handleOverviewTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current!.getBoundingClientRect()
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
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">🛒 Browse the shelf</h2>
          <p className="text-xs text-gray-500">
            {zoomed ? 'Tap the exact item to confirm quantity.' : 'Tap an area of the shelf to zoom in.'}
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
          {photos.length > 1 && (
            <div className="flex gap-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-2 h-2 rounded-full ${i === active ? 'bg-gray-900' : 'bg-gray-300'}`}
                  aria-label={`Shelf ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={zoomed ? undefined : handleOverviewTap}
        className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 select-none ${zoomed ? '' : 'cursor-zoom-in'}`}
        style={{ touchAction: 'none' }}
      >
        {/* Transformed wrapper — everything inside scales/translates together so
            hotspot positions stay aligned with the image pixels. */}
        <div
          className="relative"
          style={{
            transform: zoomed ? zoomTransform(zoomed.cx, zoomed.cy, ZOOM_LEVEL) : 'none',
            transformOrigin: '0 0',
            transition: 'transform 0.2s ease-out',
          }}
        >
          <img
            src={photo.imageUrl}
            alt={photo.label ?? 'Shelf'}
            className="block w-full h-auto"
            draggable={false}
          />
          {photo.detections.map((d, i) => {
            const interactive = zoomed && d.productId
            return (
              <button
                key={i}
                onClick={e => handleHotspotTap(e, d, i)}
                disabled={!interactive}
                className={`absolute rounded transition-colors ${
                  !zoomed
                    ? d.matched
                      ? 'border-2 border-brand/40 pointer-events-none'
                      : 'border-2 border-dashed border-gray-300/50 pointer-events-none'
                    : d.productId
                      ? 'border-2 border-transparent active:border-brand active:bg-brand/20'
                      : 'border-2 border-dashed border-gray-300/60 cursor-not-allowed'
                } ${tapped?.i === i ? 'bg-brand/30 border-brand' : ''}`}
                style={{
                  left: `${d.bbox.x * 100}%`,
                  top: `${d.bbox.y * 100}%`,
                  width: `${d.bbox.w * 100}%`,
                  height: `${d.bbox.h * 100}%`,
                }}
                aria-label={d.label}
                title={d.label}
              />
            )
          })}
        </div>

        {/* Cue overlay when not zoomed */}
        {!zoomed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/55 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span>🔍</span> Tap to zoom in
            </div>
          </div>
        )}
      </div>

      {photo.label && (
        <p className="text-xs text-gray-600 text-center">{photo.label}</p>
      )}
    </section>
  )
}

/** Compute a CSS transform that zooms the content so that (cx,cy) — given as
 *  a normalized point in the *unscaled* image — ends up at the center of the
 *  container after scaling by `scale`. Clamped so we never show empty edges. */
function zoomTransform(cx: number, cy: number, scale: number): string {
  // target translate so the point (cx,cy) lands at (0.5, 0.5) in the container
  // after scaling. In %: tx = (0.5 - cx*scale) * 100 / scale (since origin is
  // 0,0 and transform scale is applied first). Simpler: work in pre-scale
  // coords for translate.
  const txPct = (0.5 / scale - cx) * 100
  const tyPct = (0.5 / scale - cy) * 100
  // Clamp so the scaled image covers the container.
  const maxTxPct = 0
  const minTxPct = -((scale - 1) / scale) * 100
  const maxTyPct = 0
  const minTyPct = -((scale - 1) / scale) * 100
  const clampedTx = Math.max(minTxPct, Math.min(maxTxPct, txPct))
  const clampedTy = Math.max(minTyPct, Math.min(maxTyPct, tyPct))
  return `scale(${scale}) translate(${clampedTx}%, ${clampedTy}%)`
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }
