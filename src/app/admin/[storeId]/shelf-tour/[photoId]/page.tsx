'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface BBox { x: number; y: number; w: number; h: number }
interface Detection {
  productId: string | null
  label: string
  bbox: BBox
  confidence: number
  matched: boolean
}
interface ShelfPhoto {
  id: string
  imageUrl: string
  label: string | null
  detections: Detection[]
}
interface ProductLite { id: string; name: string; category: string | null; price: number }

type DragMode =
  | { kind: 'idle' }
  | { kind: 'move'; i: number; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'resize'; i: number; sx: number; sy: number; ow: number; oh: number }
  | { kind: 'draw'; sx: number; sy: number; i: number }

export default function ShelfTourEditor() {
  const { storeId, photoId } = useParams<{ storeId: string; photoId: string }>()
  const router = useRouter()
  const [photo, setPhoto] = useState<ShelfPhoto | null>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [photoLabel, setPhotoLabel] = useState('')
  const drag = useRef<DragMode>({ kind: 'idle' })
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/${storeId}/shelf-tour/${photoId}`).then(r => r.json()),
      fetch(`/api/stores/${storeId}/menu`).then(r => r.json()),
    ]).then(([p, prods]: [ShelfPhoto, ProductLite[]]) => {
      setPhoto(p)
      setDetections(p.detections)
      setPhotoLabel(p.label ?? '')
      setProducts(prods)
    })
  }, [storeId, photoId])

  const selectedDet = selected !== null ? detections[selected] : null

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/${storeId}/shelf-tour/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detections, label: photoLabel.trim() || null }),
    })
    setSaving(false)
    setDirty(false)
  }

  function updateBox(i: number, patch: Partial<BBox>) {
    setDetections(prev => {
      const next = [...prev]
      next[i] = { ...next[i], bbox: clampBox({ ...next[i].bbox, ...patch }) }
      return next
    })
    setDirty(true)
  }

  function updateDet(i: number, patch: Partial<Detection>) {
    setDetections(prev => {
      const next = [...prev]
      const merged = { ...next[i], ...patch }
      merged.matched = !!merged.productId
      next[i] = merged
      return next
    })
    setDirty(true)
  }

  function removeDet(i: number) {
    setDetections(prev => prev.filter((_, idx) => idx !== i))
    setSelected(null)
    setDirty(true)
  }

  function onPointerDownBox(e: React.PointerEvent, i: number) {
    e.stopPropagation()
    setSelected(i)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const rect = imgRef.current!.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    drag.current = {
      kind: 'move',
      i,
      sx: nx, sy: ny,
      ox: detections[i].bbox.x,
      oy: detections[i].bbox.y,
    }
  }

  function onPointerDownHandle(e: React.PointerEvent, i: number) {
    e.stopPropagation()
    setSelected(i)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const rect = imgRef.current!.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    drag.current = {
      kind: 'resize',
      i,
      sx: nx, sy: ny,
      ow: detections[i].bbox.w,
      oh: detections[i].bbox.h,
    }
  }

  function onPointerDownCanvas(e: React.PointerEvent) {
    if (!drawMode) { setSelected(null); return }
    const rect = imgRef.current!.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const newIdx = detections.length
    const newDet: Detection = {
      productId: null,
      label: 'New item',
      bbox: { x: nx, y: ny, w: 0.001, h: 0.001 },
      confidence: 1,
      matched: false,
    }
    setDetections(prev => [...prev, newDet])
    setSelected(newIdx)
    setDirty(true)
    drag.current = { kind: 'draw', sx: nx, sy: ny, i: newIdx }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (d.kind === 'idle') return
    const rect = imgRef.current!.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    if (d.kind === 'move') {
      updateBox(d.i, { x: d.ox + (nx - d.sx), y: d.oy + (ny - d.sy) })
    } else if (d.kind === 'resize') {
      updateBox(d.i, { w: Math.max(0.01, d.ow + (nx - d.sx)), h: Math.max(0.01, d.oh + (ny - d.sy)) })
    } else if (d.kind === 'draw') {
      const x = Math.min(d.sx, nx)
      const y = Math.min(d.sy, ny)
      const w = Math.abs(nx - d.sx)
      const h = Math.abs(ny - d.sy)
      updateBox(d.i, { x, y, w, h })
    }
  }

  function onPointerUp() {
    if (drag.current.kind === 'draw') setDrawMode(false)
    drag.current = { kind: 'idle' }
  }

  if (!photo) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500 animate-pulse">Loading…</p></div>
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="panel sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/admin/${storeId}/shelf-tour`} className="text-gray-500 text-2xl leading-none">‹</Link>
          <div className="flex-1">
            <h1 className="font-bold text-base leading-tight">Edit hotspots</h1>
            <p className="text-xs text-gray-500">{detections.length} items · {detections.filter(d => d.matched).length} matched</p>
          </div>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="bg-brand text-white font-semibold text-sm px-4 py-2 rounded-full disabled:opacity-40"
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        <input
          type="text"
          value={photoLabel}
          onChange={e => { setPhotoLabel(e.target.value); setDirty(true) }}
          placeholder="Photo label (e.g. Beer cooler)"
          className="input text-sm"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawMode(v => !v)}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${drawMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}
          >
            {drawMode ? '✕ Cancel draw' : '＋ Draw new box'}
          </button>
          <span className="text-xs text-gray-500">{drawMode ? 'Drag on the image to add a hotspot' : 'Tap a hotspot to edit'}</span>
        </div>

        <div
          ref={imgRef}
          className={`relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 ${drawMode ? 'cursor-crosshair' : ''}`}
          onPointerDown={onPointerDownCanvas}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ touchAction: 'none' }}
        >
          <img src={photo.imageUrl} alt={photo.label ?? 'Shelf'} className="block w-full h-auto select-none" draggable={false} />
          {detections.map((d, i) => {
            const isSel = i === selected
            return (
              <div
                key={i}
                onPointerDown={e => onPointerDownBox(e, i)}
                className={`absolute transition-colors ${
                  isSel
                    ? 'border-2 border-brand ring-2 ring-brand/30'
                    : d.matched
                      ? 'border-2 border-brand/70'
                      : 'border-2 border-dashed border-yellow-400'
                }`}
                style={{
                  left: `${d.bbox.x * 100}%`,
                  top: `${d.bbox.y * 100}%`,
                  width: `${d.bbox.w * 100}%`,
                  height: `${d.bbox.h * 100}%`,
                  cursor: 'move',
                }}
              >
                {isSel && (
                  <div
                    onPointerDown={e => onPointerDownHandle(e, i)}
                    className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-brand border-2 border-white shadow cursor-se-resize"
                  />
                )}
              </div>
            )
          })}
        </div>

        {selectedDet && selected !== null ? (
          <EditPanel
            det={selectedDet}
            products={products}
            onChange={patch => updateDet(selected, patch)}
            onDelete={() => removeDet(selected)}
          />
        ) : (
          <p className="text-center text-xs text-gray-500 py-2">
            Tap a hotspot on the photo to edit. {drawMode ? '' : 'Or tap “Draw new box” to add one.'}
          </p>
        )}
      </div>
    </div>
  )
}

function EditPanel({
  det,
  products,
  onChange,
  onDelete,
}: {
  det: Detection
  products: ProductLite[]
  onChange: (patch: Partial<Detection>) => void
  onDelete: () => void
}) {
  const [search, setSearch] = useState('')
  const linked = useMemo(() => products.find(p => p.id === det.productId) ?? null, [products, det.productId])
  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 12)
    const q = search.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 20)
  }, [products, search])

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">Hotspot</p>
        <span className={`badge ${det.matched ? 'bg-brand/10 text-brand' : 'bg-yellow-100 text-yellow-800'}`}>
          {det.matched ? 'Matched' : 'Unmatched'} · {Math.round(det.confidence * 100)}%
        </span>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-gray-700">Label (what Claude saw)</span>
        <input
          className="input text-sm"
          value={det.label}
          onChange={e => onChange({ label: e.target.value })}
        />
      </label>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-700">Linked product</p>
        {linked ? (
          <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{linked.name}</p>
              <p className="text-xs text-gray-500">{linked.category ?? 'General'} · ${(linked.price / 100).toFixed(2)}</p>
            </div>
            <button
              onClick={() => onChange({ productId: null })}
              className="text-xs text-red-600 font-semibold shrink-0 ml-2"
            >
              Unlink
            </button>
          </div>
        ) : (
          <>
            <input
              className="input text-sm"
              placeholder="Search menu to link…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onChange({ productId: p.id }); setSearch('') }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-gray-500 ml-2">${(p.price / 100).toFixed(2)}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-500">No matches.</p>
              )}
            </div>
          </>
        )}
      </div>

      <button onClick={onDelete} className="w-full text-sm font-semibold text-red-600 py-2">
        Delete hotspot
      </button>
    </div>
  )
}

function clampBox(b: BBox): BBox {
  let { x, y, w, h } = b
  w = Math.max(0.01, Math.min(1, w))
  h = Math.max(0.01, Math.min(1, h))
  x = Math.max(0, Math.min(1 - w, x))
  y = Math.max(0, Math.min(1 - h, y))
  return { x, y, w, h }
}
