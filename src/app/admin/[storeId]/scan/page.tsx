'use client'

import { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatCents } from '@/lib/utils'

interface ScannedProduct {
  name: string
  category: string
  estimatedPrice: number | null
  imageUrl: string | null
  selected: boolean
  customPrice: string
}

type Stage = 'capture' | 'scanning' | 'review' | 'importing' | 'done'

export default function ScanShelfPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<string>('image/jpeg')
  const [stage, setStage] = useState<Stage>('capture')
  const [products, setProducts] = useState<ScannedProduct[]>([])
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<{ created: number } | null>(null)

  function handleFile(file: File) {
    setMediaType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function scan() {
    if (!imageBase64) return
    setStage('scanning')
    setError('')
    try {
      const res = await fetch('/api/admin/scan-shelf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      setProducts(
        data.products.map((p: Omit<ScannedProduct, 'selected' | 'customPrice'>) => ({
          ...p,
          selected: true,
          customPrice: p.estimatedPrice != null ? String(p.estimatedPrice) : '',
        })),
      )
      setStage('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setStage('capture')
    }
  }

  function toggle(i: number) {
    setProducts(ps => ps.map((p, idx) => idx === i ? { ...p, selected: !p.selected } : p))
  }

  function setPrice(i: number, v: string) {
    setProducts(ps => ps.map((p, idx) => idx === i ? { ...p, customPrice: v } : p))
  }

  async function importSelected() {
    const rows = products
      .filter(p => p.selected && p.customPrice)
      .map(p => ({
        name: p.name,
        category: p.category,
        price: p.customPrice,
        imageUrl: p.imageUrl ?? undefined,
        nighttimeAvailable: 'true',
        restrictedFlag: 'false',
      }))
    if (!rows.length) { setError('Select at least one product with a price.'); return }
    setStage('importing')
    try {
      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`)
      setImportResult({ created: data.created })
      setStage('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setStage('review')
    }
  }

  function reset() {
    setPreview(null)
    setImageBase64(null)
    setProducts([])
    setError('')
    setImportResult(null)
    setStage('capture')
    if (fileRef.current) fileRef.current.value = ''
  }

  const selectedCount = products.filter(p => p.selected && p.customPrice).length

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${storeId}/products`} className="text-gray-400 text-2xl">‹</Link>
          <h1 className="font-bold text-lg">Shelf Scanner</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-red-900/20 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* Capture stage */}
        {(stage === 'capture') && (
          <div className="card space-y-4">
            <p className="text-sm text-gray-400">
              Take a photo of a shelf or upload one. Claude Vision will identify the products and look up prices and images automatically.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
            />
            {preview ? (
              <div className="space-y-3">
                <div className="relative w-full rounded-xl overflow-hidden bg-gray-800" style={{ aspectRatio: '4/3' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Shelf preview" className="w-full h-full object-contain" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()} className="flex-1 btn-secondary text-sm">
                    Retake
                  </button>
                  <button onClick={scan} className="flex-1 btn-primary text-sm">
                    Scan Products
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-gray-700 py-12 text-gray-500 text-sm flex flex-col items-center gap-2 hover:border-brand hover:text-brand transition-colors"
              >
                <span className="text-4xl">📷</span>
                <span>Tap to take photo or upload</span>
              </button>
            )}
          </div>
        )}

        {/* Scanning stage */}
        {stage === 'scanning' && (
          <div className="card flex flex-col items-center gap-4 py-10">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">Analyzing shelf with Claude Vision…</p>
          </div>
        )}

        {/* Review stage */}
        {stage === 'review' && products.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{products.length} products identified · {selectedCount} selected</p>
              <button onClick={reset} className="text-xs text-gray-500 underline">Start over</button>
            </div>

            <div className="space-y-2">
              {products.map((p, i) => (
                <div
                  key={i}
                  className={`card flex gap-3 cursor-pointer transition-colors ${p.selected ? '' : 'opacity-50'}`}
                  onClick={() => toggle(i)}
                >
                  {p.imageUrl ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-2xl">🏪</div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-sm leading-tight">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category}</p>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Price *"
                      value={p.customPrice}
                      onChange={e => { e.stopPropagation(); setPrice(i, e.target.value) }}
                      onClick={e => e.stopPropagation()}
                      className="input text-sm py-1 w-28"
                    />
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-1 flex items-center justify-center ${p.selected ? 'bg-brand border-brand' : 'border-gray-600'}`}>
                    {p.selected && <span className="text-black text-xs font-bold">✓</span>}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={importSelected}
              disabled={selectedCount === 0}
              className="btn-primary"
            >
              Import {selectedCount} Product{selectedCount !== 1 ? 's' : ''}
            </button>
          </>
        )}

        {/* Importing stage */}
        {stage === 'importing' && (
          <div className="card flex flex-col items-center gap-4 py-10">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">Importing products…</p>
          </div>
        )}

        {/* Done stage */}
        {stage === 'done' && importResult && (
          <div className="card space-y-4 text-center py-8">
            <p className="text-4xl">✅</p>
            <p className="font-bold text-lg">{importResult.created} product{importResult.created !== 1 ? 's' : ''} added!</p>
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 btn-secondary">Scan Another Shelf</button>
              <Link href={`/admin/${storeId}/products`} className="flex-1 btn-primary text-center">
                View Products
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
