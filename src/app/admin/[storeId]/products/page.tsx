'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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
    name: '', category: '',
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
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/${storeId}`} className="text-gray-400 text-2xl">‹</Link>
            <h1 className="font-bold text-lg">Night Menu</h1>
          </div>
          <div className="flex gap-3 items-center">
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
          <div className="space-y-2">
            {products.map(product => (
              <div key={product.id} className="card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{product.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {product.category && <span className="text-xs text-gray-500">{product.category}</span>}
                    {product.restrictedFlag && <span className="badge bg-red-900 text-red-400">21+</span>}
                    {product.price === 0
                      ? <span className="text-xs text-yellow-600">Pricing pending</span>
                      : <span className="text-xs text-gray-600">Active</span>
                    }
                  </div>
                </div>
                <button onClick={() => toggleProduct(product.id, false)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors">
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
