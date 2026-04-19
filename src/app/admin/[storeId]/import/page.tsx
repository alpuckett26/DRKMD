'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRESET_CATALOG, type CatalogItem as ProductRow } from '@/lib/catalog'


export default function ImportPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [catalog, setCatalog] = useState<ProductRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingImages, setFetchingImages] = useState(false)
  const [result, setResult] = useState('')
  const [tab, setTab] = useState<'preset' | 'csv'>('preset')

  useEffect(() => {
    fetch(`/api/stores/${storeId}/menu`)
      .then(r => r.json())
      .then((products: { name: string }[]) => {
        const names = new Set(products.map(p => p.name.toLowerCase()))
        const available = PRESET_CATALOG.filter(p => !names.has(p.name.toLowerCase()))
        setCatalog(available)
        setSelected(new Set(available.map((_, i) => i)))
      })
      .catch(() => {
        setCatalog(PRESET_CATALOG)
        setSelected(new Set(PRESET_CATALOG.map((_, i) => i)))
      })
      .finally(() => setLoadingCatalog(false))
  }, [storeId])

  function toggleAll() {
    if (selected.size === catalog.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(catalog.map((_, i) => i)))
    }
  }

  function toggleItem(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function fetchImages() {
    setFetchingImages(true)
    const updated = [...catalog]
    for (const i of Array.from(selected)) {
      if (updated[i].imageUrl) continue
      const res = await fetch(`/api/admin/products/image-lookup?name=${encodeURIComponent(updated[i].name)}`)
      const data = await res.json() as { imageUrl: string | null }
      if (data.imageUrl) updated[i] = { ...updated[i], imageUrl: data.imageUrl }
    }
    setCatalog(updated)
    setFetchingImages(false)
  }

  async function importPreset() {
    setLoading(true)
    const rows = Array.from(selected).map(i => catalog[i])
    const res = await fetch('/api/admin/products/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, rows }),
    })
    const data = await res.json()
    setLoading(false)
    router.push(`/admin/${storeId}/products?imported=${data.created}`)
  }

  async function importCSV() {
    setLoading(true)
    const lines = csvText.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',')
      return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']))
    })
    const res = await fetch('/api/admin/products/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, rows }),
    })
    const data = await res.json()
    setResult(`✅ Imported ${data.created} products${data.errors?.length ? ` (${data.errors.length} skipped)` : ''}`)
    setLoading(false)
  }

  const categories = Array.from(new Set(catalog.map(p => p.category)))

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${storeId}/products`} className="text-gray-500 text-2xl">‹</Link>
          <h1 className="font-bold text-lg">Import Products</h1>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-3">
          <button onClick={() => setTab('preset')} className={`text-sm font-semibold px-4 py-1.5 rounded-full ${tab === 'preset' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>Preset Catalog</button>
          <button onClick={() => setTab('csv')} className={`text-sm font-semibold px-4 py-1.5 rounded-full ${tab === 'csv' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>CSV Upload</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {result && (
          <div className="card bg-green-100/30 border border-green-700/50 text-green-700 text-sm text-center">
            {result}
          </div>
        )}

        {tab === 'preset' && loadingCatalog && (
          <p className="text-center text-gray-500 animate-pulse pt-8">Checking your existing products…</p>
        )}

        {tab === 'preset' && !loadingCatalog && catalog.length === 0 && (
          <div className="text-center pt-12 space-y-2">
            <p className="text-4xl">✅</p>
            <p className="font-bold text-gray-700">All preset products already imported</p>
            <p className="text-sm text-gray-500">Add custom items via CSV or the products page.</p>
          </div>
        )}

        {tab === 'preset' && !loadingCatalog && catalog.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{selected.size} of {catalog.length} selected</p>
              <div className="flex gap-3">
                <button onClick={fetchImages} disabled={fetchingImages || loading} className="text-sm text-brand underline">
                  {fetchingImages ? 'Fetching…' : '🖼 Fetch Images'}
                </button>
                <button onClick={toggleAll} className="text-sm text-gray-500 underline">
                  {selected.size === catalog.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            </div>

            {fetchingImages && (
              <p className="text-xs text-gray-500 animate-pulse text-center">Fetching product images from Open Food Facts…</p>
            )}

            {categories.map(cat => (
              <div key={cat} className="space-y-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{cat}</h3>
                {catalog.map((p, i) => p.category !== cat ? null : (
                  <label key={i} className={`card flex items-center gap-3 cursor-pointer ${selected.has(i) ? 'border border-brand/40' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleItem(i)}
                      className="accent-brand w-4 h-4 flex-shrink-0"
                    />
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-contain bg-white flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-lg">🛒</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.restrictedFlag === 'true' && <span className="badge bg-red-100 text-red-700 text-xs">21+</span>}
                      <span className="text-brand font-bold text-sm">${p.price}</span>
                    </div>
                  </label>
                ))}
              </div>
            ))}
          </>
        )}

        {tab === 'csv' && !loadingCatalog && (
          <div className="space-y-3">
            <div className="card text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">CSV Format (first row = headers):</p>
              <p className="font-mono">name,category,price,nighttimeAvailable,restrictedFlag</p>
              <p className="font-mono text-gray-600">Red Bull 8.4oz,Energy Drinks,4.49,true,false</p>
            </div>
            <textarea
              className="input h-48 font-mono text-xs resize-none"
              placeholder="Paste CSV here..."
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
            />
            <button onClick={importCSV} disabled={loading || !csvText.trim()} className="btn-primary">
              {loading ? 'Importing…' : 'Import CSV'}
            </button>
          </div>
        )}
      </div>

      {tab === 'preset' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="max-w-2xl mx-auto">
            <button onClick={importPreset} disabled={loading || selected.size === 0} className="btn-primary">
              {loading ? 'Importing…' : selected.size === 0 ? 'All products already imported' : `Import ${selected.size} New Products`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
