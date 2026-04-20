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
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewStarted, setReviewStarted] = useState(false)
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
      // Auto-start review if there are unmatched detections on first load
      if (!reviewStarted && p.detections.some(d => !d.matched)) {
        setReviewMode(true)
        setReviewStarted(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Save a specific detections array immediately (used by review mode so
  // progress isn't lost between steps).
  async function saveDetections(next: Detection[]) {
    await fetch(`/api/admin/${storeId}/shelf-tour/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detections: next }),
    })
  }

  async function linkDetectionToExisting(index: number, productId: string) {
    const next = detections.map((d, i) => i === index ? { ...d, productId, matched: true } : d)
    setDetections(next)
    await saveDetections(next)
  }

  async function addDetectionToMenu(index: number, price: number, category: string, restricted: boolean) {
    const det = detections[index]
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        name: det.label,
        category,
        price: Math.round(price * 100),
        nighttimeAvailable: true,
        restrictedFlag: restricted,
      }),
    })
    if (!res.ok) throw new Error('Could not add to menu')
    const product = await res.json() as { id: string; name: string; category: string | null; price: number }
    setProducts(prev => [...prev, product])
    const next = detections.map((d, i) => i === index ? { ...d, productId: product.id, matched: true } : d)
    setDetections(next)
    await saveDetections(next)
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

  const unmatchedIndices = detections.map((d, i) => d.matched ? -1 : i).filter(i => i >= 0)
  const matchedCount = detections.length - unmatchedIndices.length

  if (reviewMode) {
    return (
      <ReviewFlow
        storeId={storeId}
        photo={photo}
        detections={detections}
        products={products}
        unmatchedIndices={unmatchedIndices}
        onLink={linkDetectionToExisting}
        onAddToMenu={addDetectionToMenu}
        onSkip={i => {
          // Just advance; the detection stays unmatched and hidden from customers.
          void i
        }}
        onRemove={async i => {
          const next = detections.filter((_, idx) => idx !== i)
          setDetections(next)
          await saveDetections(next)
        }}
        onDone={() => setReviewMode(false)}
      />
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="panel sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/admin/${storeId}/shelf-tour`} className="text-gray-500 text-2xl leading-none">‹</Link>
          <div className="flex-1">
            <h1 className="font-bold text-base leading-tight">Shelf</h1>
            <p className="text-xs text-gray-500">{matchedCount} live · {unmatchedIndices.length} to tag</p>
          </div>
          <Link
            href={`/store/${storeId}`}
            className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-2 rounded-full"
          >
            View in app →
          </Link>
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

        {unmatchedIndices.length > 0 && selected === null && (
          <button
            onClick={() => setReviewMode(true)}
            className="w-full rounded-2xl p-4 bg-yellow-50 border border-yellow-300 text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <span className="text-2xl">🏷</span>
            <div className="flex-1">
              <p className="font-bold text-sm text-yellow-900">{unmatchedIndices.length} items still need tagging</p>
              <p className="text-xs text-yellow-800">They&apos;re hidden from customers until you link them to a menu item.</p>
            </div>
            <span className="text-yellow-900 font-semibold text-sm">Review →</span>
          </button>
        )}

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

// ─── Review Flow ──────────────────────────────────────────────────────────

function ReviewFlow({
  storeId,
  photo,
  detections,
  products,
  unmatchedIndices,
  onLink,
  onAddToMenu,
  onSkip,
  onRemove,
  onDone,
}: {
  storeId: string
  photo: ShelfPhoto
  detections: Detection[]
  products: ProductLite[]
  unmatchedIndices: number[]
  onLink: (i: number, productId: string) => Promise<void>
  onAddToMenu: (i: number, price: number, category: string, restricted: boolean) => Promise<void>
  onSkip: (i: number) => void
  onRemove: (i: number) => Promise<void>
  onDone: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'choose' | 'add' | 'link'>('choose')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Drinks')
  const [restricted, setRestricted] = useState(false)
  const [labelEdit, setLabelEdit] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const live = unmatchedIndices[cursor]
  const det = live !== undefined ? detections[live] : null
  const total = unmatchedIndices.length

  useEffect(() => {
    if (det) {
      setMode('choose')
      setLabelEdit(det.label)
      setPrice('')
      setCategory(guessCategory(det.label))
      setRestricted(looksRestricted(det.label))
      setError('')
      setSearch('')
    }
  }, [cursor, det?.label])

  if (!det) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-5xl">✅</p>
        <h1 className="text-2xl font-black">All tagged!</h1>
        <p className="text-sm text-gray-600">Your shelf is live for customers.</p>
        <div className="flex gap-2 pt-2">
          <Link href={`/store/${storeId}`} className="btn-secondary inline-flex items-center justify-center px-5" style={{ width: 'auto' }}>
            View in app
          </Link>
          <button onClick={onDone} className="btn-primary inline-flex items-center justify-center px-5" style={{ width: 'auto' }}>
            Open editor
          </button>
        </div>
      </div>
    )
  }

  async function handleLink(productId: string) {
    setSubmitting(true)
    try { await onLink(live!, productId); advance() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleAdd() {
    setError('')
    const p = parseFloat(price)
    if (isNaN(p) || p <= 0) { setError('Enter a price in dollars'); return }
    setSubmitting(true)
    try { await onAddToMenu(live!, p, category, restricted); advance() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  function advance() {
    if (cursor + 1 >= total) {
      // Next render will show the success screen (live becomes undefined).
    }
    setCursor(c => c + 1)
  }

  async function handleDelete() {
    setSubmitting(true)
    try { await onRemove(live!); advance() }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen pb-10 flex flex-col">
      <div className="panel">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onDone} className="text-gray-500 text-2xl leading-none">‹</button>
          <div className="flex-1">
            <h1 className="font-bold text-base leading-tight">Tag your items</h1>
            <p className="text-xs text-gray-500">Item {cursor + 1} of {total}</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${(cursor / total) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4 w-full flex-1">
        {/* Highlighted context preview */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
          <img src={photo.imageUrl} alt="" className="block w-full h-auto" />
          {detections.map((d, i) => {
            const isCurrent = i === live
            return (
              <div
                key={i}
                className={`absolute ${
                  isCurrent
                    ? 'border-2 border-brand ring-4 ring-brand/30 animate-pulse'
                    : d.matched
                      ? 'border border-brand/30'
                      : 'border border-dashed border-yellow-400/50'
                }`}
                style={{
                  left: `${d.bbox.x * 100}%`,
                  top: `${d.bbox.y * 100}%`,
                  width: `${d.bbox.w * 100}%`,
                  height: `${d.bbox.h * 100}%`,
                }}
              />
            )
          })}
        </div>

        {mode === 'choose' && (
          <>
            <div className="card space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Claude saw</p>
              <input
                className="input font-bold text-lg"
                value={labelEdit}
                onChange={e => setLabelEdit(e.target.value)}
              />
              <p className="text-xs text-gray-500">Edit the name if Claude got it wrong.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('add')}
                className="bg-brand text-white rounded-2xl p-4 font-bold text-sm active:scale-[0.98] transition-transform"
              >
                ＋ Add to menu
              </button>
              <button
                onClick={() => setMode('link')}
                className="rounded-2xl p-4 font-bold text-sm bg-gray-100 text-gray-900 border border-gray-200 active:scale-[0.98] transition-transform"
              >
                🔗 Link to existing
              </button>
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={() => advance()} className="text-sm text-gray-600 underline">
                Skip for now
              </button>
              <button onClick={handleDelete} disabled={submitting} className="text-sm text-red-600 underline">
                Not a product — delete
              </button>
            </div>
          </>
        )}

        {mode === 'add' && (
          <div className="card space-y-3">
            <p className="font-bold text-sm">Add &ldquo;{labelEdit}&rdquo; to your menu</p>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-gray-700">Price (USD)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="input"
                placeholder="2.49"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-gray-700">Category</span>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-brand w-4 h-4"
                checked={restricted}
                onChange={e => setRestricted(e.target.checked)}
              />
              21+ (age-restricted)
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setMode('choose')} className="btn-secondary flex-1" style={{ width: 'auto' }}>
                Back
              </button>
              <button onClick={handleAdd} disabled={submitting || !price.trim()} className="btn-primary flex-1" style={{ width: 'auto' }}>
                {submitting ? 'Adding…' : 'Add & continue'}
              </button>
            </div>
          </div>
        )}

        {mode === 'link' && (
          <div className="card space-y-3">
            <p className="font-bold text-sm">Link to an existing menu item</p>
            <input
              className="input"
              placeholder="Search menu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {products
                .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 30)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleLink(p.id)}
                    disabled={submitting}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-gray-500 ml-2">${(p.price / 100).toFixed(2)}</span>
                  </button>
                ))}
            </div>
            <button onClick={() => setMode('choose')} className="btn-secondary">Back</button>
          </div>
        )}
      </div>
    </div>
  )
}

const CATEGORIES = [
  'Drinks', 'Energy Drinks', 'Coffee', 'Water', 'Juice', 'Soft Drinks',
  'Beer', 'Wine', 'Spirits', 'Wine & Spirits',
  'Snacks', 'Chips', 'Candy', 'Bars', 'Nuts', 'Meat Snacks', 'Pastry',
  'Food', 'Hot Food',
  'Health', 'Personal Care', 'Health & Beauty',
  'Cigarettes', 'Cigars', 'Vape', 'Nicotine Pouches', 'Smokeless', 'Accessories',
  'Household', 'Baby', 'Electronics', 'General',
]

function guessCategory(label: string): string {
  const l = label.toLowerCase()
  if (/cola|pepsi|soda|sprite|mountain dew|dr pepper|fanta/.test(l)) return 'Soft Drinks'
  if (/red bull|monster|celsius|rockstar|bang|ghost|reign|c4|energy/.test(l)) return 'Energy Drinks'
  if (/water|aquafina|dasani|fiji|smartwater|evian/.test(l)) return 'Water'
  if (/coffee|frappuccino|latte|espresso|cold brew/.test(l)) return 'Coffee'
  if (/juice|ocean spray|minute maid|tropicana|naked/.test(l)) return 'Juice'
  if (/beer|lager|ale|ipa|stout|pilsner|hard seltzer|white claw|truly|corona|modelo|bud|miller|coors|heineken/.test(l)) return 'Beer'
  if (/wine|pinot|chardonnay|cabernet/.test(l)) return 'Wine'
  if (/whiskey|bourbon|vodka|tequila|rum|gin|cognac|liqueur/.test(l)) return 'Spirits'
  if (/doritos|lays|cheetos|pringles|fritos|takis|ruffles|chips/.test(l)) return 'Chips'
  if (/snickers|twix|kit kat|reeses|m&m|hershey|candy|skittles|starburst|haribo|airheads|twizzlers/.test(l)) return 'Candy'
  if (/clif|kind|rxbar|quest|protein bar|nature valley/.test(l)) return 'Bars'
  if (/peanuts|almonds|cashews|nuts|pistachio/.test(l)) return 'Nuts'
  if (/slim jim|jerky|meat stick/.test(l)) return 'Meat Snacks'
  if (/pop-tart|honey bun|donette|twinkie|ding dong/.test(l)) return 'Pastry'
  if (/marlboro|newport|camel|winston|pall mall|lucky strike|l&m|kool|parliament|virginia slims/.test(l)) return 'Cigarettes'
  if (/swisher|backwoods|black & mild|white owl|dutch master|phillies|cigar/.test(l)) return 'Cigars'
  if (/vuse|juul|njoy|elf bar|geek bar|lost mary|hyde|puff bar|vape|pod|disposable/.test(l)) return 'Vape'
  if (/zyn|on\!|velo|rogue|lucy|nicotine pouch/.test(l)) return 'Nicotine Pouches'
  if (/copenhagen|grizzly|skoal|kodiak|snuff|chew/.test(l)) return 'Smokeless'
  if (/lighter|zippo|clipper|rolling paper|zig-zag|raw/.test(l)) return 'Accessories'
  if (/advil|tylenol|aleve|pepto|tums|nyquil|zzzquil|benadryl|claritin|zyrtec/.test(l)) return 'Health'
  if (/chapstick|lip balm|toothbrush|mouthwash|condom|sanitizer/.test(l)) return 'Personal Care'
  if (/battery|cable|charger|earbud/.test(l)) return 'Electronics'
  if (/trash bag|ziploc|paper towel|tissue|laundry|dish soap/.test(l)) return 'Household'
  if (/diaper|formula|pedialyte/.test(l)) return 'Baby'
  return 'General'
}

function looksRestricted(label: string): boolean {
  return /beer|lager|ale|ipa|stout|pilsner|hard seltzer|white claw|truly|corona|modelo|bud|miller|coors|heineken|wine|pinot|chardonnay|cabernet|whiskey|bourbon|vodka|tequila|rum|gin|cognac|marlboro|newport|camel|winston|pall mall|kool|parliament|swisher|backwoods|black & mild|white owl|dutch master|phillies|vuse|juul|njoy|elf bar|geek bar|lost mary|hyde|puff bar|vape|zyn|on\!|velo|rogue|lucy|copenhagen|grizzly|skoal|kodiak|snuff|chew|lighter|rolling paper/i.test(label)
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
