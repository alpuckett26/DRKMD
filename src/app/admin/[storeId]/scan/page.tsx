'use client'

import { useRef, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<string>('image/jpeg')
  const [stage, setStage] = useState<Stage>('capture')
  const [products, setProducts] = useState<ScannedProduct[]>([])
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<{ created: number } | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setCameraReady(false)
    setCameraError(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('not supported')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCameraError(true)
    }
  }

  // Start camera on mount, stop on unmount
  useEffect(() => {
    startCamera()
    return stopCamera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setPreview(dataUrl)
    setImageBase64(dataUrl.split(',')[1])
    setMediaType('image/jpeg')
    stopCamera()
  }

  function handleFallbackFile(file: File) {
    setMediaType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  function retake() {
    setPreview(null)
    setImageBase64(null)
    if (fileRef.current) fileRef.current.value = ''
    startCamera()
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
    startCamera()
  }

  const selectedCount = products.filter(p => p.selected && p.customPrice).length

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href={`/admin/${storeId}/products`}
            onClick={stopCamera}
            className="text-gray-500 text-2xl leading-none"
          >
            ‹
          </Link>
          <h1 className="font-bold text-lg">Shelf Scanner</h1>
        </div>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-3">
          <div className="bg-red-100/20 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        </div>
      )}

      {/* ── CAPTURE: live camera ── */}
      {stage === 'capture' && !preview && (
        <div className="flex flex-col flex-1">
          {/* Live camera — top 63% of viewport */}
          <div className="relative bg-black w-full" style={{ height: '63vh' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onCanPlay={() => setCameraReady(true)}
              className="w-full h-full object-cover"
            />

            {/* Corner-bracket framing overlay */}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-5 left-5 w-10 h-10 border-t-[3px] border-l-[3px] border-brand rounded-tl-lg" />
                <div className="absolute top-5 right-5 w-10 h-10 border-t-[3px] border-r-[3px] border-brand rounded-tr-lg" />
                <div className="absolute bottom-5 left-5 w-10 h-10 border-b-[3px] border-l-[3px] border-brand rounded-bl-lg" />
                <div className="absolute bottom-5 right-5 w-10 h-10 border-b-[3px] border-r-[3px] border-brand rounded-br-lg" />
                {/* Subtle scan-line pulse */}
                <div className="absolute inset-x-5 top-5 bottom-5 rounded-lg"
                  style={{ border: '1px solid rgba(46,168,255,0.2)', animation: 'scanPulse 2s ease-in-out infinite' }} />
              </div>
            )}

            {/* Camera loading */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Camera unavailable — fallback to file */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white gap-4 px-8">
                <p className="text-4xl">📷</p>
                <p className="text-gray-500 text-sm text-center">Camera access unavailable</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFallbackFile(f) }}
                  className="hidden"
                />
                <button onClick={() => fileRef.current?.click()} className="btn-secondary text-sm" style={{ width: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}>
                  Choose Photo
                </button>
              </div>
            )}
          </div>

          {/* Bottom guidance strip */}
          <div className="flex-1 flex flex-col px-4 pt-4 pb-6 gap-4">
            <div className="flex gap-2 flex-wrap justify-center">
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

            <p className="text-xs text-gray-600 text-center">
              Claude Vision reads every product on the shelf and auto-fills names, categories &amp; prices.
            </p>

            <div className="flex-1" />

            <canvas ref={canvasRef} className="hidden" />
            <button
              onClick={capturePhoto}
              disabled={!cameraReady}
              className="btn-primary flex items-center justify-center gap-2"
            >
              📸 Capture Shelf
            </button>
          </div>

          <style>{`
            @keyframes scanPulse {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* ── CAPTURE: photo preview ── */}
      {stage === 'capture' && preview && (
        <div className="flex flex-col flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-6 gap-3">
          <div className="relative w-full rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Shelf preview" className="w-full h-full object-contain" />
          </div>
          <div className="flex gap-2">
            <button onClick={retake} className="flex-1 btn-secondary text-sm">Retake</button>
            <button onClick={scan} className="flex-1 btn-primary text-sm">Scan Products</button>
          </div>
        </div>
      )}

      {/* ── SCANNING ── */}
      {stage === 'scanning' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm animate-pulse">Analyzing shelf with Claude Vision…</p>
        </div>
      )}

      {/* ── REVIEW ── */}
      {stage === 'review' && products.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{products.length} products identified · {selectedCount} selected</p>
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
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image src={p.imageUrl} alt={p.name} width={56} height={56} className="w-full h-full object-contain" unoptimized />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-2xl">🏪</div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold text-sm leading-tight">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.category}</p>
                  <input
                    type="number" step="0.01" min="0" placeholder="Price *"
                    value={p.customPrice}
                    onChange={e => { e.stopPropagation(); setPrice(i, e.target.value) }}
                    onClick={e => e.stopPropagation()}
                    className="input text-sm py-1 w-28"
                  />
                </div>
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-1 flex items-center justify-center ${p.selected ? 'bg-brand border-brand' : 'border-gray-300'}`}>
                  {p.selected && <span className="text-black text-xs font-bold">✓</span>}
                </div>
              </div>
            ))}
          </div>

          <button onClick={importSelected} disabled={selectedCount === 0} className="btn-primary">
            Import {selectedCount} Product{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* ── IMPORTING ── */}
      {stage === 'importing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm animate-pulse">Importing products…</p>
        </div>
      )}

      {/* ── DONE ── */}
      {stage === 'done' && importResult && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
          <div className="card space-y-4 text-center py-8 w-full max-w-2xl">
            <p className="text-4xl">✅</p>
            <p className="font-bold text-lg">{importResult.created} product{importResult.created !== 1 ? 's' : ''} added!</p>
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 btn-secondary">Scan Another</button>
              <Link href={`/admin/${storeId}/products`} className="flex-1 btn-primary text-center">View Products</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
