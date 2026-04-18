'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { ProductInfo } from '@/types'

interface ExtendedProduct extends ProductInfo {
  active: boolean
  storeId: string
}

export default function ProductsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [products, setProducts] = useState<ExtendedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<ExtendedProduct | null>(null)
  const [form, setForm] = useState({
    name: '', category: '',
    nighttimeAvailable: true, restrictedFlag: false,
  })
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchProducts() {
    const res = await fetch(`/api/stores/${storeId}/menu`)
    if (res.ok) {
      const prods: ExtendedProduct[] = await res.json()
      setProducts(prods)
      refreshMissingImages(prods)
    }
    setLoading(false)
  }

  async function refreshMissingImages(prods: ExtendedProduct[]) {
    for (const p of prods.filter(x => !x.imageUrl)) {
      const r = await fetch(`/api/admin/products/image-lookup?name=${encodeURIComponent(p.name)}`)
      if (!r.ok) continue
      const { imageUrl } = await r.json()
      if (!imageUrl) continue
      fetch(`/api/admin/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, imageUrl } : x))
    }
  }

  async function refreshAllImages() {
    setRefreshing(true)
    const current = await fetch(`/api/stores/${storeId}/menu`).then(r => r.json()) as ExtendedProduct[]
    for (const p of current) {
      const r = await fetch(`/api/admin/products/image-lookup?name=${encodeURIComponent(p.name)}`)
      if (!r.ok) continue
      const { imageUrl } = await r.json()
      if (!imageUrl) continue
      fetch(`/api/admin/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, imageUrl } : x))
    }
    setRefreshing(false)
  }

  useEffect(() => { fetchProducts() }, [storeId])

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        name: form.name,
        category: form.category || undefined,
        price: 0,
        nighttimeAvailable: form.nighttimeAvailable,
        restrictedFlag: form.restrictedFlag,
      }),
    })
    setForm({ name: '', category: '', nighttimeAvailable: true, restrictedFlag: false })
    setShowAdd(false)
    setSaving(false)
    fetchProducts()
  }

  function updateSelected(updated: ExtendedProduct) {
    setSelected(updated)
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  const featured = products.filter(p => p.promoted)
  const regular = products.filter(p => !p.promoted)

  return (
    <div className="min-h-screen pb-10">
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/${storeId}`} className="text-gray-400 text-2xl">‹</Link>
            <h1 className="font-bold text-lg">Night Menu</h1>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={refreshAllImages} disabled={refreshing} className="text-gray-400 text-sm font-semibold">
              {refreshing ? '⟳ Refreshing…' : '⟳ Pics'}
            </button>
            <Link href={`/admin/${storeId}/scan`} className="text-gray-400 text-sm font-semibold underline">Scan Shelf</Link>
            <Link href={`/admin/${storeId}/import`} className="text-gray-400 text-sm font-semibold underline">Import</Link>
            <button onClick={() => setShowAdd(v => !v)} className="text-brand text-sm font-semibold">
              {showAdd ? 'Cancel' : '+ Add Item'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {showAdd && (
          <form onSubmit={addProduct} className="card space-y-3">
            <h2 className="font-semibold">New Item</h2>
            <input placeholder="Item name *" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" />
            <input placeholder="Category (e.g. Drinks, Snacks)" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input" />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.nighttimeAvailable}
                  onChange={e => setForm(f => ({ ...f, nighttimeAvailable: e.target.checked }))} className="accent-brand" />
                Night menu
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.restrictedFlag}
                  onChange={e => setForm(f => ({ ...f, restrictedFlag: e.target.checked }))} className="accent-brand" />
                Age restricted (21+)
              </label>
            </div>
            <p className="text-xs text-gray-600">Pricing is managed by WendOS and will be applied to your items.</p>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Adding…' : 'Add Item'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-gray-500 animate-pulse pt-10">Loading…</p>
        ) : products.length === 0 ? (
          <div className="text-center pt-16 space-y-3">
            <p className="text-gray-500">No items yet.</p>
            <p className="text-xs text-gray-600">Add items above or use Scan Shelf to photo your shelves.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {featured.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span>⚡</span>
                  <h2 className="text-xs font-black uppercase tracking-widest text-brand">Featured / Hot Picks</h2>
                </div>
                <div className="space-y-2">
                  {featured.map(product => (
                    <ProductRow key={product.id} product={product} onOpen={() => setSelected(product)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              {featured.length > 0 && (
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">All Items</h2>
              )}
              <div className="space-y-2">
                {regular.map(product => (
                  <ProductRow key={product.id} product={product} onOpen={() => setSelected(product)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ProductDetailSheet
          product={selected}
          onClose={() => { setSelected(null); fetchProducts() }}
          onUpdate={updateSelected}
        />
      )}
    </div>
  )
}

function ProductRow({ product, onOpen }: { product: ExtendedProduct; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="card flex items-center gap-3 w-full text-left active:opacity-70 transition-opacity"
      style={product.promoted ? { borderColor: 'rgba(46,168,255,0.45)', boxShadow: '0 0 12px rgba(46,168,255,0.12)' } : {}}
    >
      <div className="w-12 h-12 rounded-xl bg-gray-800 shrink-0 overflow-hidden flex items-center justify-center">
        {product.imageUrl
          ? <Image src={product.imageUrl} alt={product.name} width={48} height={48} className="object-cover w-full h-full" unoptimized />
          : <span className="text-xl">🛒</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {product.category && <span className="text-xs text-gray-500">{product.category}</span>}
          {product.restrictedFlag && <span className="badge bg-red-900 text-red-400">21+</span>}
          {product.promoted && <span className="badge bg-blue-900 text-brand">⚡ Featured</span>}
          {product.price === 0
            ? <span className="text-xs text-yellow-600">Pricing pending</span>
            : <span className="text-xs text-gray-600">${(product.price / 100).toFixed(2)}</span>
          }
        </div>
      </div>
      <span className="text-gray-600 text-lg">›</span>
    </button>
  )
}

function ProductDetailSheet({
  product,
  onClose,
  onUpdate,
}: {
  product: ExtendedProduct
  onClose: () => void
  onUpdate: (p: ExtendedProduct) => void
}) {
  const [draft, setDraft] = useState(product)
  const [saving, setSaving] = useState(false)
  const [refreshingImage, setRefreshingImage] = useState(false)
  const [imgError, setImgError] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/products/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        category: draft.category,
        price: draft.price,
        nighttimeAvailable: draft.nighttimeAvailable,
        restrictedFlag: draft.restrictedFlag,
        promoted: draft.promoted,
        imageUrl: draft.imageUrl,
      }),
    })
    setSaving(false)
    onUpdate(draft)
    onClose()
  }

  async function remove() {
    await fetch(`/api/admin/products/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    onClose()
  }

  async function refreshImage() {
    setRefreshingImage(true)
    setImgError(false)
    const r = await fetch(`/api/admin/products/image-lookup?name=${encodeURIComponent(draft.name)}`)
    if (r.ok) {
      const { imageUrl } = await r.json()
      if (imageUrl) setDraft(d => ({ ...d, imageUrl }))
    }
    setRefreshingImage(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto bg-gray-900 rounded-t-3xl overflow-hidden"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Image */}
        <div className="relative mx-4 mt-2 rounded-2xl overflow-hidden bg-gray-800 flex items-center justify-center"
          style={{ height: 200 }}
        >
          {draft.imageUrl && !imgError
            ? <Image
                src={draft.imageUrl}
                alt={draft.name}
                fill
                className="object-contain"
                unoptimized
                onError={() => setImgError(true)}
              />
            : <span className="text-6xl">🛒</span>
          }
          <button
            onClick={refreshImage}
            disabled={refreshingImage}
            className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full font-semibold backdrop-blur-sm"
          >
            {refreshingImage ? 'Searching…' : '↺ Refresh Image'}
          </button>
        </div>

        {/* Fields */}
        <div className="px-4 pt-4 pb-8 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">Product Name</label>
              <input
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="input mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Category</label>
                <input
                  value={draft.category ?? ''}
                  onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
                  placeholder="e.g. Drinks"
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.price === 0 ? '' : (draft.price / 100).toFixed(2)}
                  onChange={e => setDraft(d => ({ ...d, price: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                  placeholder="0.00"
                  className="input mt-1"
                />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="card space-y-3">
            {([
              ['nighttimeAvailable', 'Night Menu', 'Show on after-hours menu'],
              ['restrictedFlag', '21+ Age Restricted', 'Requires ID check at pickup'],
              ['promoted', '⚡ Featured / Hot Pick', 'Shown in impulse buy strip'],
            ] as [keyof ExtendedProduct, string, string][]).map(([key, label, desc]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <div
                  onClick={() => setDraft(d => ({ ...d, [key]: !d[key] }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${draft[key] ? 'bg-brand' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${draft[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            ))}
          </div>

          {/* Actions */}
          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={remove} className="w-full text-center text-red-400 text-sm font-semibold py-2">
            Remove from Menu
          </button>
        </div>
      </div>
    </>
  )
}
