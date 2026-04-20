'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  createdAt: string
}

export default function ShelfTourAdmin() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const captureRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<ShelfPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')

  async function load() {
    const res = await fetch(`/api/admin/${storeId}/shelf-tour`)
    if (res.ok) setPhotos(await res.json())
  }

  useEffect(() => { load() }, [storeId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const base64 = await compressImage(file, 1200, 0.75)
      const res = await fetch(`/api/admin/${storeId}/shelf-tour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, label: label.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Upload failed')
      }
      const created = await res.json() as ShelfPhoto
      setLabel('')
      // Jump straight into the editor so admin can nudge boxes.
      router.push(`/admin/${storeId}/shelf-tour/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (captureRef.current) captureRef.current.value = ''
      if (libraryRef.current) libraryRef.current.value = ''
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this shelf photo?')) return
    await fetch(`/api/admin/${storeId}/shelf-tour/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${storeId}`} className="text-gray-500 text-2xl leading-none">‹</Link>
          <h1 className="font-bold text-lg">Shelf Tour</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <div className="card space-y-3">
          <p className="font-bold">Snap your shelves</p>
          <p className="text-sm text-gray-600">
            Take a clear, straight-on photo of a shelf (or a fridge/cabinet for testing). Claude will find every
            product and draw tappable hotspots — customers browse like they&apos;re standing in the aisle.
          </p>
          <input
            type="text"
            placeholder="Label (optional) — e.g. Beer cooler, Candy aisle"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="input text-sm"
          />
          <input ref={captureRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
          <input ref={libraryRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => captureRef.current?.click()}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? 'Analyzing…' : '📷 Take photo'}
            </button>
            <button
              onClick={() => libraryRef.current?.click()}
              disabled={uploading}
              className="btn-secondary"
            >
              🖼 Upload from library
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {photos.length === 0 && !uploading && (
          <p className="text-center text-gray-500 py-8 text-sm">No shelves uploaded yet.</p>
        )}

        {photos.map(photo => (
          <PhotoCard key={photo.id} photo={photo} storeId={storeId} onRemove={() => remove(photo.id)} />
        ))}
      </div>
    </div>
  )
}

function PhotoCard({ photo, storeId, onRemove }: { photo: ShelfPhoto; storeId: string; onRemove: () => void }) {
  const matched = photo.detections.filter(d => d.matched).length
  const unmatched = photo.detections.length - matched
  return (
    <div className="card !p-0 overflow-hidden">
      <Link href={`/admin/${storeId}/shelf-tour/${photo.id}`} className="block">
        <div className="relative w-full bg-gray-100">
          <img src={photo.imageUrl} alt={photo.label ?? 'Shelf'} className="block w-full h-auto" />
          {photo.detections.map((d, i) => (
            <div
              key={i}
              className={`absolute border-2 ${d.matched ? 'border-brand' : 'border-yellow-400'} rounded pointer-events-none`}
              style={{
                left: `${d.bbox.x * 100}%`,
                top: `${d.bbox.y * 100}%`,
                width: `${d.bbox.w * 100}%`,
                height: `${d.bbox.h * 100}%`,
              }}
              title={d.label}
            />
          ))}
        </div>
      </Link>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{photo.label ?? 'Shelf'}</p>
          <p className="text-xs text-gray-500">
            {photo.detections.length} items · <span className="text-brand">{matched} matched</span>
            {unmatched > 0 && <> · <span className="text-yellow-700">{unmatched} unmatched</span></>}
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Link
            href={`/admin/${storeId}/shelf-tour/${photo.id}`}
            className="text-xs font-semibold text-white bg-brand px-3 py-2 rounded-full"
          >
            Adjust hotspots →
          </Link>
          <button onClick={onRemove} className="text-xs text-red-600 font-semibold">Remove</button>
        </div>
      </div>
    </div>
  )
}

async function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
