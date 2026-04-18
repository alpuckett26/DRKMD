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
    <div className="min-h-screen flex flex-col">
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${storeId}/products`} className="text-gray-400 text-2xl leading-none">‹</Link>
          <h1 className="font-bold text-lg">Shelf Scanner</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4">
        {error && (
          <div className="mt-4 bg-red-900/20 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* Capture stage — idle (no photo yet) */}
        {stage === 'capture' && !preview && (
          <div className="flex-1 flex flex-col pb-6">
            {/* Diagram fills available space */}
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <ShelfDiagram />

              {/* Tips */}
              <div className="flex gap-2 mt-6 flex-wrap justify-center">
                {[
                  { icon: '📐', label: '3–4 ft back' },
                  { icon: '💡', label: 'Good lighting' },
                  { icon: '👀', label: 'Full shelf visible' },
                ].map(({ icon, label }) => (
                  <span key={label} className="text-xs px-3 py-1.5 rounded-full font-medium"
                    style={{ background: 'rgba(46,168,255,0.08)', border: '1px solid rgba(46,168,255,0.25)', color: '#94a3b8' }}>
                    {icon} {label}
                  </span>
                ))}
              </div>

              <p className="text-xs text-gray-600 text-center mt-4 max-w-xs">
                Claude Vision reads every product on the shelf and auto-fills names, categories &amp; prices.
              </p>
            </div>

            {/* CTA pinned to bottom */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-primary flex items-center justify-center gap-2 text-base"
            >
              <span>📷</span> Open Camera
            </button>
          </div>
        )}

        {/* Capture stage — photo selected */}
        {stage === 'capture' && preview && (
          <div className="pt-4 space-y-3 pb-6">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
            />
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
        )}

        {/* Scanning stage */}
        {stage === 'scanning' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">Analyzing shelf with Claude Vision…</p>
          </div>
        )}

        {/* Review stage */}
        {stage === 'review' && products.length > 0 && (
          <div className="pt-4 space-y-4 pb-6">
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
          </div>
        )}

        {/* Importing stage */}
        {stage === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">Importing products…</p>
          </div>
        )}

        {/* Done stage */}
        {stage === 'done' && importResult && (
          <div className="flex-1 flex flex-col items-center justify-center pb-6">
            <div className="card space-y-4 text-center py-8 w-full">
              <p className="text-4xl">✅</p>
              <p className="font-bold text-lg">{importResult.created} product{importResult.created !== 1 ? 's' : ''} added!</p>
              <div className="flex gap-3">
                <button onClick={reset} className="flex-1 btn-secondary">Scan Another Shelf</button>
                <Link href={`/admin/${storeId}/products`} className="flex-1 btn-primary text-center">
                  View Products
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ShelfDiagram() {
  return (
    <div className="w-full max-w-xs">
      <svg viewBox="0 0 240 230" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Phone — floats with CSS animation */}
        <g style={{ animation: 'shelfFloat 2.4s ease-in-out infinite', transformOrigin: '120px 44px' }}>
          {/* Phone body */}
          <rect x="96" y="4" width="48" height="76" rx="8"
            fill="rgba(46,168,255,0.12)" stroke="rgba(46,168,255,0.55)" strokeWidth="1.5" />
          {/* Camera lens ring */}
          <circle cx="120" cy="24" r="11"
            fill="rgba(5,10,18,1)" stroke="rgba(46,168,255,0.5)" strokeWidth="1.5" />
          {/* Lens inner */}
          <circle cx="120" cy="24" r="6" fill="rgba(46,168,255,0.25)" />
          <circle cx="120" cy="24" r="2.5" fill="rgba(46,168,255,0.6)" />
          {/* Screen */}
          <rect x="102" y="42" width="36" height="28" rx="3"
            fill="rgba(46,168,255,0.06)" stroke="rgba(46,168,255,0.18)" strokeWidth="1" />
          {/* Shutter button hint */}
          <rect x="112" y="74" width="16" height="3" rx="1.5" fill="rgba(46,168,255,0.3)" />
        </g>

        {/* Dashed distance line */}
        <line x1="120" y1="84" x2="120" y2="108"
          stroke="rgba(46,168,255,0.35)" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Distance label */}
        <rect x="126" y="90" width="42" height="16" rx="4" fill="rgba(46,168,255,0.08)" />
        <text x="147" y="101" fill="rgba(148,163,184,0.85)" fontSize="9" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="600">3–4 ft</text>

        {/* Focus frame corners around shelf area */}
        <path d="M28 113 L28 106 L38 106" stroke="rgba(46,168,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M212 106 L202 106 L202 113" stroke="rgba(46,168,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 210 L28 217 L38 217" stroke="rgba(46,168,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M212 217 L202 217 L202 210" stroke="rgba(46,168,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Shelf board 1 */}
        <rect x="24" y="132" width="192" height="5" rx="2" fill="rgba(46,168,255,0.35)" />
        {/* Products shelf 1 */}
        {[28, 50, 72, 96, 118, 142, 164, 186].map((x, i) => (
          <rect key={i} x={x} y={132 - 18 - (i % 3) * 4} width={16} height={18 + (i % 3) * 4} rx="2"
            fill={`rgba(255,255,255,${0.04 + (i % 2) * 0.02})`}
            stroke={`rgba(255,255,255,${0.1 + (i % 2) * 0.05})`} strokeWidth="1" />
        ))}

        {/* Shelf board 2 */}
        <rect x="24" y="192" width="192" height="5" rx="2" fill="rgba(46,168,255,0.22)" />
        {/* Products shelf 2 */}
        {[30, 54, 76, 100, 122, 146, 168, 190].map((x, i) => (
          <rect key={i} x={x} y={192 - 20 - (i % 2) * 3} width={15} height={20 + (i % 2) * 3} rx="2"
            fill={`rgba(255,255,255,0.03)`}
            stroke={`rgba(255,255,255,0.08)`} strokeWidth="1" />
        ))}

        {/* Shelf board 3 bottom edge */}
        <rect x="24" y="226" width="192" height="4" rx="2" fill="rgba(46,168,255,0.12)" />
      </svg>

      {/* Keyframe animation injected inline */}
      <style>{`
        @keyframes shelfFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}
