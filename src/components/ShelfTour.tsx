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

export default function ShelfTour({ storeId, onOpenProduct }: Props) {
  const [photos, setPhotos] = useState<ShelfPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [tapped, setTapped] = useState<{ i: number; t: number } | null>(null)

  useEffect(() => {
    fetch(`/api/stores/${storeId}/shelf-tour`)
      .then(r => r.json())
      .then((data: ShelfPhoto[]) => { setPhotos(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [storeId])

  if (loading) return null
  if (photos.length === 0) return null

  const photo = photos[active]

  function handleTap(det: Detection, i: number) {
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
          <p className="text-xs text-gray-500">Tap any item to add it to your order.</p>
        </div>
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

      <Zoomable>
        <img
          src={photo.imageUrl}
          alt={photo.label ?? 'Shelf'}
          className="block w-full h-auto select-none"
          draggable={false}
        />
        {photo.detections.map((d, i) => (
          <button
            key={i}
            onClick={() => handleTap(d, i)}
            disabled={!d.productId}
            className={`absolute rounded transition-colors ${
              d.productId
                ? 'border-2 border-transparent hover:border-brand active:border-brand'
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
        ))}
      </Zoomable>

      {photo.label && (
        <p className="text-xs text-gray-600 text-center">{photo.label}</p>
      )}
    </section>
  )
}

// Minimal pinch-zoom / pan wrapper so tiny items are tappable.
function Zoomable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const pan = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dx = a.clientX - b.clientX
      const dy = a.clientY - b.clientY
      pinch.current = { dist: Math.hypot(dx, dy), scale }
    } else if (e.touches.length === 1 && scale > 1) {
      pan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pos.x, py: pos.y }
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const next = Math.max(1, Math.min(4, pinch.current.scale * (d / pinch.current.dist)))
      setScale(next)
    } else if (e.touches.length === 1 && pan.current && scale > 1) {
      const dx = e.touches[0].clientX - pan.current.x
      const dy = e.touches[0].clientY - pan.current.y
      setPos({ x: pan.current.px + dx, y: pan.current.py + dy })
    }
  }

  function onTouchEnd() {
    pinch.current = null
    pan.current = null
    if (scale <= 1.05) { setScale(1); setPos({ x: 0, y: 0 }) }
  }

  return (
    <div
      ref={ref}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
      style={{ touchAction: 'none' }}
    >
      <div
        className="relative"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: pinch.current || pan.current ? 'none' : 'transform 0.15s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}
