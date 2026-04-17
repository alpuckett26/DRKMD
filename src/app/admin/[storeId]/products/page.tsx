'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'
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
  const [form, setForm] = useState({
    name: '', category: '', price: '', imageUrl: '',
    nighttimeAvailable: true, restrictedFlag: false,
  })
  const [saving, setSaving] = useState(false)

  async function fetchProducts() {
    const res = await fetch(`/api/stores/${storeId}/menu`)
    if (res.ok) setProducts(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [storeId])

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const priceCents = Math.round(parseFloat(form.price) * 100)
    await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        name: form.name,
        category: form.category || undefined,
        price: priceCents,
        nighttimeAvailable: form.nighttimeAvailable,
        restrictedFlag: form.restrictedFlag,
        imageUrl: form.imageUrl || undefined,
      }),
    })
    setForm({ name: '', category: '', price: '', imageUrl: '', nighttimeAvailable: true, restrictedFlag: false })
    setShowAdd(false)
    setSaving(false)
    fetchProducts()
  }

  async function toggleProduct(productId: string, active: boolean) {
    await fetch(`/api/admin/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    fetchProducts()
  }

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/${storeId}`} className="text-gray-400 text-2xl">‹</Link>
            <h1 className="font-bold text-lg">Night Menu</h1>
          </div>
          <div className="flex gap-3 items-center">
            <Link href={`/admin/${storeId}/import`} className="text-gray-400 text-sm font-semibold underline">Import</Link>
            <button onClick={() => setShowAdd(v => !v)} className="text-brand text-sm font-semibold">
              {showAdd ? 'Cancel' : '+ Add Item'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Add form */}
        {showAdd && (
          <form onSubmit={addProduct} className="card space-y-3">
            <h2 className="font-semibold">New Product</h2>
            <input placeholder="Name *" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" />
            <input placeholder="Category (e.g. Drinks, Snacks)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input" />
            <input placeholder="Price (e.g. 2.99) *" required type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input" />
            <input placeholder="Image URL (optional)" type="url" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="input" />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.nighttimeAvailable} onChange={e => setForm(f => ({ ...f, nighttimeAvailable: e.target.checked }))} className="accent-brand" />
                Night menu
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.restrictedFlag} onChange={e => setForm(f => ({ ...f, restrictedFlag: e.target.checked }))} className="accent-brand" />
                Age restricted (21+)
              </label>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Adding…' : 'Add Product'}
            </button>
          </form>
        )}

        {/* Products list */}
        {loading ? (
          <p className="text-center text-gray-500 animate-pulse pt-10">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-500 pt-10">No products yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {products.map(product => (
              <div key={product.id} className="card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{product.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-brand text-sm font-bold">{formatCents(product.price)}</span>
                    {product.category && <span className="text-xs text-gray-500">{product.category}</span>}
                    {product.restrictedFlag && <span className="badge bg-red-900 text-red-400">21+</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleProduct(product.id, false)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
