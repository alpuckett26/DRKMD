'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ShelfCalibration from '@/components/ShelfCalibration'

interface Detection {
  productId: string | null
  label: string
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

interface StoreInfo {
  id: string
  name: string
  shelfRows: number | null
  shelfCols: number | null
  shelfAreas: ShelfArea[] | null
}

/** Each section is ~2.5 feet wide — the sweet spot where a phone held
 *  a couple feet back fills the frame with one clean shelf section. */
const SECTION_WIDTH_FT = 2.5

export default function ShelfGridPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [photos, setPhotos] = useState<ShelfPhoto[]>([])
  const [areas, setAreas] = useState<ShelfArea[]>([])
  const [activeArea, setActiveArea] = useState<string | null>(null)
  const [rows, setRows] = useState(0)
  const [cols, setCols] = useState(0)
  const [shelfLengthFt, setShelfLengthFt] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const [uploadingCell, setUploadingCell] = useState<{ r: number; c: number } | null>(null)
  const [splitting, setSplitting] = useState(false)
  const [splitResult, setSplitResult] = useState<string>('')
  const [calibrating, setCalibrating] = useState<string | null>(null) // holds imageBase64 data URL
  const [error, setError] = useState('')
  const captureRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const splitFileRef = useRef<HTMLInputElement>(null)

  async function load() {
    let s: StoreInfo | null = null
    let ps: ShelfPhoto[] = []
    try {
      const [sr, pr] = await Promise.all([
        fetch(`/api/stores/${storeId}`),
        fetch(`/api/admin/${storeId}/shelf-tour`),
      ])
      if (sr.ok) s = await sr.json()
      if (pr.ok) ps = await pr.json()
    } catch (err) {
      console.error('shelf-grid load failed', err)
    }
    if (!s) return
    setStore(s)
    setPhotos(Array.isArray(ps) ? ps : [])

    // Bootstrap scan list from store.shelfAreas. Legacy stores with only
    // shelfRows/shelfCols set get migrated into a 'Main' scan on first load.
    let nextAreas: ShelfArea[] = Array.isArray(s.shelfAreas) ? s.shelfAreas : []
    if (nextAreas.length === 0 && (s.shelfRows || s.shelfCols)) {
      nextAreas = [{ name: 'Main shelf', rows: s.shelfRows ?? 0, cols: s.shelfCols ?? 0 }]
    }
    setAreas(nextAreas)

    // Preserve current selection if possible, otherwise pick the first.
    setActiveArea(prev => {
      if (prev && nextAreas.some(a => a.name === prev)) return prev
      return nextAreas[0]?.name ?? null
    })
  }

  useEffect(() => { load() }, [storeId])

  // When the active scan changes, load its rows/cols/length into edit state.
  useEffect(() => {
    const a = areas.find(x => x.name === activeArea)
    setRows(a?.rows ?? 0)
    setCols(a?.cols ?? 0)
    setShelfLengthFt(a?.cols ? a.cols * SECTION_WIDTH_FT : 0)
    setDirty(false)
  }, [activeArea, areas])

  // Photos scoped to the active scan. Legacy (null areaName) photos count
  // toward the 'Main shelf' scan, so old data stays visible after migration.
  const activePhotos = photos.filter(p => {
    if (!activeArea) return false
    if (p.areaName === activeArea) return true
    if (activeArea === 'Main shelf' && !p.areaName) return true
    return false
  })

  // Lookup table: { "r:c": ShelfPhoto }
  const cellMap: Record<string, ShelfPhoto> = {}
  for (const p of activePhotos) {
    if (p.shelfIndex != null && p.sectionIndex != null) {
      cellMap[`${p.shelfIndex}:${p.sectionIndex}`] = p
    }
  }

  const filled = Object.keys(cellMap).length
  const total = rows * cols

  async function saveGridConfig() {
    if (!activeArea) return
    setSavingConfig(true)
    // Upsert the active scan in the areas list with the edited dims.
    const nextAreas = areas.some(a => a.name === activeArea)
      ? areas.map(a => a.name === activeArea ? { ...a, rows, cols } : a)
      : [...areas, { name: activeArea, rows, cols }]
    setAreas(nextAreas)
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Keep shelfRows/shelfCols in sync with the *active* scan so legacy
      // callers (auto-split without an override) still default sensibly.
      body: JSON.stringify({ shelfRows: rows, shelfCols: cols, shelfAreas: nextAreas }),
    })
    setSavingConfig(false)
    setDirty(false)
    load()
  }

  function onCellTap(r: number, c: number) {
    setActiveCell({ r, c })
  }

  function triggerCapture(source: 'camera' | 'library') {
    if (source === 'camera') captureRef.current?.click()
    else libraryRef.current?.click()
  }

  async function handleSplitFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSplitResult('')
    try {
      // Keep the source image big — we're slicing it so compression hurts more.
      const base64 = await compressImage(file, 2400, 0.88)
      // Hand off to the calibration overlay. Slice happens after the admin
      // confirms shelf boundaries there.
      setCalibrating(base64)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t load image')
    } finally {
      if (splitFileRef.current) splitFileRef.current.value = ''
    }
  }

  async function runAutoSplit(imageBase64: string, yBoundaries: number[], xBoundaries: [number, number]) {
    setSplitting(true)
    setSplitResult('')
    setError('')
    try {
      const res = await fetch(`/api/admin/${storeId}/shelf-tour/auto-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, yBoundaries, xBoundaries, areaName: activeArea, rows, cols }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Auto-split failed')
      }
      const data = await res.json() as { cells: number; detected: number; matched: number; failedCells: number }
      setSplitResult(`✅ Sliced into ${data.cells} sections · found ${data.detected} items · ${data.matched} matched${data.failedCells ? ` · ${data.failedCells} cells failed` : ''}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-split failed')
    } finally {
      setSplitting(false)
      setCalibrating(null)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeCell) return
    setError('')
    setUploadingCell(activeCell)
    try {
      const base64 = await compressImage(file, 1400, 0.78)
      const res = await fetch(`/api/admin/${storeId}/shelf-tour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          shelfIndex: activeCell.r,
          sectionIndex: activeCell.c,
          label: `Shelf ${activeCell.r + 1} · Section ${activeCell.c + 1}`,
          areaName: activeArea,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Upload failed')
      }
      setActiveCell(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingCell(null)
      if (captureRef.current) captureRef.current.value = ''
      if (libraryRef.current) libraryRef.current.value = ''
    }
  }

  if (!store) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500 animate-pulse">Loading…</p></div>
  }

  const configured = rows > 0 && cols > 0

  return (
    <div className="min-h-screen pb-16">
      <div className="panel sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/admin/${storeId}`} className="text-gray-500 text-2xl leading-none">‹</Link>
          <div className="flex-1">
            <h1 className="font-bold text-base leading-tight">Shelf Grid</h1>
            <p className="text-xs text-gray-500">{configured ? `${filled}/${total} sections captured` : 'Set up your grid first'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <ScanSelector
          areas={areas}
          activeArea={activeArea}
          onSelect={name => setActiveArea(name)}
          onNew={async () => {
            const name = prompt('Name this scan (e.g. "Candy aisle", "Beer cooler")')?.trim()
            if (!name) return
            if (areas.some(a => a.name === name)) { alert('A scan with that name already exists.'); return }
            const nextAreas = [...areas, { name, rows: 0, cols: 0 }]
            setAreas(nextAreas)
            setActiveArea(name)
            await fetch(`/api/stores/${storeId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shelfAreas: nextAreas }),
            })
          }}
          onDelete={async name => {
            if (!confirm(`Delete "${name}" and all of its photos? This cannot be undone.`)) return
            // Soft-deactivate all photos for this area.
            await fetch(`/api/admin/${storeId}/shelf-tour`, { method: 'GET' }) // no-op, just to be safe
            const toRemove = photos.filter(p => (p.areaName ?? 'Main shelf') === name)
            await Promise.all(toRemove.map(p =>
              fetch(`/api/admin/${storeId}/shelf-tour/${p.id}`, { method: 'DELETE' }),
            ))
            const nextAreas = areas.filter(a => a.name !== name)
            setAreas(nextAreas)
            setActiveArea(nextAreas[0]?.name ?? null)
            await fetch(`/api/stores/${storeId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shelfAreas: nextAreas }),
            })
            load()
          }}
        />
        {/* Grid config */}
        <div className="card space-y-3">
          <div>
            <p className="font-bold text-sm">Your shelf layout</p>
            <p className="text-xs text-gray-500">Tell us the shape of the rack — we&apos;ll auto-split it into photo-sized sections ({SECTION_WIDTH_FT.toFixed(1)} ft each).</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-gray-700">Number of shelves</span>
              <input type="number" min={1} max={10} value={rows || ''}
                onChange={e => {
                  const v = parseInt(e.target.value) || 0
                  setRows(v)
                  setCols(shelfLengthFt ? Math.max(1, Math.round(shelfLengthFt / SECTION_WIDTH_FT)) : cols)
                  setDirty(true)
                }}
                className="input" placeholder="e.g. 4" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-gray-700">Shelf length (feet)</span>
              <input type="number" min={1} max={30} step="0.5" value={shelfLengthFt || ''}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  setShelfLengthFt(v)
                  setCols(v ? Math.max(1, Math.round(v / SECTION_WIDTH_FT)) : 0)
                  setDirty(true)
                }}
                className="input" placeholder="e.g. 8" />
            </label>
          </div>
          {rows > 0 && cols > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs text-gray-600">
                <span className="font-bold text-gray-900">{rows} {rows === 1 ? 'shelf' : 'shelves'}</span>
                {' · '}
                <span className="font-bold text-gray-900">{cols} section{cols === 1 ? '' : 's'} each</span>
                {' = '}
                <span className="font-bold text-brand">{rows * cols} photos</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">Each section ≈ {SECTION_WIDTH_FT} ft wide. Stand ~2 ft back, hold level, fill the frame with just that section.</p>
            </div>
          )}
          {dirty && (
            <button onClick={saveGridConfig} disabled={savingConfig || rows < 1 || cols < 1} className="btn-primary">
              {savingConfig ? 'Saving…' : 'Save layout'}
            </button>
          )}
        </div>

        {/* One-photo auto-split */}
        {configured && (
          <div className="card space-y-3 border-brand/30 bg-brand/5">
            <div>
              <p className="font-bold text-sm">✨ One photo, auto-sliced</p>
              <p className="text-xs text-gray-600">Upload a single high-res photo of the whole shelf — we&apos;ll slice it into your {rows}×{cols} grid and run detection on each section. Fastest way to light up the whole tour.</p>
              <p className="text-[11px] text-gray-500 mt-1">Stand back far enough to fit the full unit in the frame. Straight-on, level, good light. 8–12 MP phones work great.</p>
            </div>
            <input ref={splitFileRef} type="file" accept="image/*" onChange={handleSplitFile} className="hidden" />
            <button onClick={() => splitFileRef.current?.click()} disabled={splitting} className="btn-primary">
              {splitting ? `Slicing ${rows * cols} sections…` : '📸 Upload whole-shelf photo'}
            </button>
            <p className="text-[11px] text-gray-500 text-center">After upload, drag lines onto each shelf edge before slicing.</p>
            {splitResult && <p className="text-xs text-gray-700">{splitResult}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <p className="text-[11px] text-gray-500 text-center">or tap a cell below to capture section-by-section</p>
          </div>
        )}

        {/* Grid preview */}
        {configured && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">Tap a section to capture</p>
              <Link href={`/store/${storeId}`} className="text-xs font-semibold text-brand">View in app →</Link>
            </div>
            <div className="space-y-2">
              {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Shelf {r + 1}</p>
                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: cols }).map((_, c) => {
                      const photo = cellMap[`${r}:${c}`]
                      const uploading = uploadingCell?.r === r && uploadingCell?.c === c
                      return (
                        <button
                          key={c}
                          onClick={() => onCellTap(r, c)}
                          disabled={uploading}
                          className={`relative rounded-xl overflow-hidden border-2 active:scale-[0.98] transition-transform ${
                            photo
                              ? 'border-brand/40 bg-gray-50'
                              : 'border-dashed border-gray-300 bg-gray-50 hover:border-brand/60'
                          }`}
                          style={{ aspectRatio: '3 / 4' }}
                        >
                          {photo ? (
                            <>
                              <img src={photo.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              <span className="absolute bottom-1 left-1 right-1 bg-black/65 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded text-center truncate">
                                {(() => {
                                  const det = photo.detections.length
                                  const matched = photo.detections.filter(d => d.matched).length
                                  if (det === 0) return 'no items'
                                  if (matched === det) return `${matched} items`
                                  return `${matched}/${det} matched`
                                })()}
                              </span>
                            </>
                          ) : uploading ? (
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 animate-pulse">Analyzing…</span>
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-2xl text-gray-400">＋</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Cell action sheet */}
      {activeCell && (
        <CellSheet
          cell={activeCell}
          photo={cellMap[`${activeCell.r}:${activeCell.c}`]}
          storeId={storeId}
          onClose={() => setActiveCell(null)}
          onCamera={() => triggerCapture('camera')}
          onLibrary={() => triggerCapture('library')}
          onEdit={photoId => router.push(`/admin/${storeId}/shelf-tour/${photoId}`)}
          onRemove={async photoId => {
            await fetch(`/api/admin/${storeId}/shelf-tour/${photoId}`, { method: 'DELETE' })
            setActiveCell(null)
            await load()
          }}
        />
      )}

      <input ref={captureRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {calibrating && rows > 0 && (
        <ShelfCalibration
          imageDataUrl={calibrating}
          rows={rows}
          submitting={splitting}
          onCancel={() => { if (!splitting) setCalibrating(null) }}
          onConfirm={(yBoundaries, xBoundaries) => runAutoSplit(calibrating, yBoundaries, xBoundaries)}
        />
      )}
    </div>
  )
}

function ScanSelector({
  areas, activeArea, onSelect, onNew, onDelete,
}: {
  areas: ShelfArea[]
  activeArea: string | null
  onSelect: (name: string) => void
  onNew: () => void | Promise<void>
  onDelete: (name: string) => void | Promise<void>
}) {
  if (areas.length === 0) {
    return (
      <div className="card space-y-3 border-brand/30 bg-brand/5 text-center">
        <p className="font-bold text-sm">No scans yet</p>
        <p className="text-xs text-gray-600">A scan is one physical display — e.g. &ldquo;Candy aisle&rdquo; or &ldquo;Beer cooler&rdquo;. Start by creating one.</p>
        <button onClick={onNew} className="btn-primary">＋ New scan</button>
      </div>
    )
  }
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Active scan</p>
        <button onClick={onNew} className="text-xs font-semibold text-brand">＋ New scan</button>
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
        {areas.map(a => {
          const active = a.name === activeArea
          return (
            <button
              key={a.name}
              onClick={() => onSelect(a.name)}
              className={`shrink-0 px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900 border border-gray-200'
              }`}
            >
              {a.name}
              {a.rows > 0 && <span className={active ? 'text-white/70 ml-1' : 'text-gray-500 ml-1'}> · {a.rows}×{a.cols}</span>}
            </button>
          )
        })}
      </div>
      {activeArea && (
        <button
          onClick={() => onDelete(activeArea)}
          className="text-xs text-red-600 font-semibold self-end"
        >
          Delete &ldquo;{activeArea}&rdquo;
        </button>
      )}
    </div>
  )
}

function CellSheet({
  cell, photo, storeId, onClose, onCamera, onLibrary, onEdit, onRemove,
}: {
  cell: { r: number; c: number }
  photo: ShelfPhoto | undefined
  storeId: string
  onClose: () => void
  onCamera: () => void
  onLibrary: () => void
  onEdit: (photoId: string) => void
  onRemove: (photoId: string) => Promise<void>
}) {
  void storeId
  const title = `Shelf ${cell.r + 1} · Section ${cell.c + 1}`
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-white rounded-t-3xl p-5 space-y-3">
        <div className="flex justify-center"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div>
          <p className="font-bold text-lg leading-tight">{title}</p>
          <p className="text-xs text-gray-500">
            {photo
              ? `${photo.detections.filter(d => d.matched).length} items matched · tap 'Edit' to adjust hotspots`
              : 'Hold your phone parallel to the shelf, ~2 ft back. Fill the frame with this section only.'}
          </p>
        </div>
        {photo ? (
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ aspectRatio: '3 / 4' }}>
            <img src={photo.imageUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 space-y-2">
            <p className="text-xs font-bold text-gray-900">For best detection</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Stand <b>~2 ft back</b> so one section fills the frame</li>
              <li>• Hold phone <b>parallel to the shelf</b> — no upward tilt</li>
              <li>• Even light, no glare, <b>one section per photo</b></li>
              <li>• It&apos;s OK if the photo is portrait or landscape</li>
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCamera} className="btn-primary">📷 {photo ? 'Retake' : 'Take photo'}</button>
          <button onClick={onLibrary} className="btn-secondary">🖼 Upload</button>
        </div>
        {photo && (
          <>
            <button onClick={() => onEdit(photo.id)} className="w-full text-brand font-semibold text-sm py-2">
              Edit hotspots →
            </button>
            <button
              onClick={async () => {
                if (!confirm('Remove this section photo? You can re-shoot it any time.')) return
                await onRemove(photo.id)
              }}
              className="w-full text-red-600 font-semibold text-sm py-2"
            >
              Remove photo
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full text-gray-500 text-sm">Cancel</button>
      </div>
    </>
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
