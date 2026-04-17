'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'

interface ProductRow {
  name: string
  category: string
  price: string
  nighttimeAvailable: string
  restrictedFlag: string
  imageUrl?: string
}

const PRESET_CATALOG: ProductRow[] = [
  // Energy & Drinks
  { name: 'Red Bull 8.4oz', category: 'Energy Drinks', price: '4.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Red Bull Sugar Free 8.4oz', category: 'Energy Drinks', price: '4.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Monster Energy Original 16oz', category: 'Energy Drinks', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Monster Zero Ultra 16oz', category: 'Energy Drinks', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Celsius Sparkling Orange 12oz', category: 'Energy Drinks', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: '5-hour ENERGY Extra Strength', category: 'Energy Drinks', price: '4.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Gatorade Fruit Punch 32oz', category: 'Sports Drinks', price: '3.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Gatorade Lemon-Lime 32oz', category: 'Sports Drinks', price: '3.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Powerade Mountain Berry Blast 32oz', category: 'Sports Drinks', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Liquid IV Hydration Multiplier', category: 'Sports Drinks', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Smartwater 1L', category: 'Water', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'FIJI Water 1L', category: 'Water', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Evian Natural Spring Water 1L', category: 'Water', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Essentia 9.5 pH Water 1L', category: 'Water', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Coca-Cola 20oz', category: 'Soft Drinks', price: '2.79', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Diet Coke 20oz', category: 'Soft Drinks', price: '2.79', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Sprite 20oz', category: 'Soft Drinks', price: '2.79', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Dr Pepper 20oz', category: 'Soft Drinks', price: '2.79', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Mountain Dew 20oz', category: 'Soft Drinks', price: '2.79', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Arizona Green Tea 23oz', category: 'Soft Drinks', price: '1.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Lipton Brisk Iced Tea 20oz', category: 'Soft Drinks', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Tropicana Orange Juice 10oz', category: 'Juice', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Minute Maid Lemonade 20oz', category: 'Juice', price: '2.79', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Starbucks Frappuccino Mocha 13.7oz', category: 'Coffee', price: '4.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Starbucks Double Shot Espresso 6.5oz', category: 'Coffee', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Monster Java Mean Bean 15oz', category: 'Coffee', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  // Snacks
  { name: 'Doritos Nacho Cheese 2.75oz', category: 'Chips', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Doritos Cool Ranch 2.75oz', category: 'Chips', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: "Lay's Classic 2.625oz", category: 'Chips', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: "Lay's Sour Cream & Onion 2.625oz", category: 'Chips', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Cheetos Crunchy 2.375oz', category: 'Chips', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Fritos Original 2oz', category: 'Chips', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Pringles Original 2.5oz', category: 'Chips', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Takis Fuego 3.2oz', category: 'Chips', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Kettle Brand Sea Salt 2oz', category: 'Chips', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Snickers 1.86oz', category: 'Candy', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Snickers King Size 3.29oz', category: 'Candy', price: '3.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: "Reese's Peanut Butter Cups 1.5oz", category: 'Candy', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: "Reese's King Size 2.8oz", category: 'Candy', price: '3.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Kit Kat 1.5oz', category: 'Candy', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Twix 1.79oz', category: 'Candy', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'M&Ms Peanut 1.74oz', category: 'Candy', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Skittles Original 2.17oz', category: 'Candy', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Starburst Original 2.07oz', category: 'Candy', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Haribo Gold-Bears 4oz', category: 'Candy', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Airheads Variety 3.3oz', category: 'Candy', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Nature Valley Oats & Honey Bar', category: 'Bars', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Clif Bar Chocolate Chip', category: 'Bars', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Kind Dark Chocolate Nuts & Sea Salt', category: 'Bars', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'RXBar Chocolate Sea Salt', category: 'Bars', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Planters Dry Roasted Peanuts 1.75oz', category: 'Nuts', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Planters Mixed Nuts 1.75oz', category: 'Nuts', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Sunflower Seeds David Original 1.75oz', category: 'Nuts', price: '2.29', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  // Food
  { name: 'Slim Jim Original 0.97oz', category: 'Meat Snacks', price: '1.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Slim Jim Giant 1.94oz', category: 'Meat Snacks', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Jack Links Beef Jerky 1.25oz', category: 'Meat Snacks', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Old Wisconsin Turkey Stick', category: 'Meat Snacks', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Hot Dog – Roller Grill', category: 'Hot Food', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Cheeseburger – Heated', category: 'Hot Food', price: '4.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Taquito – Chicken', category: 'Hot Food', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Taquito – Beef', category: 'Hot Food', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Chester's Fries 1.75oz', category: 'Hot Food', price: '1.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Pop-Tarts Frosted Strawberry 2pk', category: 'Pastry', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Honey Bun', category: 'Pastry', price: '1.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Donettes Powdered Mini Donuts 3oz', category: 'Pastry', price: '2.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  // Health & Personal Care
  { name: 'Advil Ibuprofen 200mg 10ct', category: 'Pain Relief', price: '6.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Tylenol Extra Strength 10ct', category: 'Pain Relief', price: '6.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Aleve 220mg 8ct', category: 'Pain Relief', price: '6.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Pepto-Bismol Chewable 4ct', category: 'Stomach', price: '5.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Tums Ultra Strength 12ct', category: 'Stomach', price: '4.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Tylenol PM 10ct', category: 'Sleep', price: '8.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'ZzzQuil Nighttime Sleep Aid 12ct', category: 'Sleep', price: '9.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Unisom SleepTabs 8ct', category: 'Sleep', price: '8.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Trojan ENZ Condoms 3pk', category: 'Personal Care', price: '8.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Trojan Ultra Thin 3pk', category: 'Personal Care', price: '8.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Durex Extra Sensitive 3pk', category: 'Personal Care', price: '8.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Chapstick Original', category: 'Personal Care', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Burt's Bees Lip Balm', category: 'Personal Care', price: '4.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Visine Original Eye Drops 0.5oz', category: 'Personal Care', price: '7.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Listerine PocketPaks Strips 24ct', category: 'Personal Care', price: '4.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Colgate Wisp Disposable Toothbrush', category: 'Personal Care', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  // Tobacco (Restricted)
  { name: 'Marlboro Red (pack)', category: 'Tobacco', price: '12.99', nighttimeAvailable: 'true', restrictedFlag: 'true' },
  { name: 'Marlboro Light (pack)', category: 'Tobacco', price: '12.99', nighttimeAvailable: 'true', restrictedFlag: 'true' },
  { name: 'Newport Menthol (pack)', category: 'Tobacco', price: '12.99', nighttimeAvailable: 'true', restrictedFlag: 'true' },
  { name: 'Camel Blue (pack)', category: 'Tobacco', price: '12.99', nighttimeAvailable: 'true', restrictedFlag: 'true' },
  { name: 'Swisher Sweets Cigarillo 2pk', category: 'Tobacco', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'true' },
  { name: 'Backwoods Original 5pk', category: 'Tobacco', price: '8.99', nighttimeAvailable: 'true', restrictedFlag: 'true' },
  // General
  { name: 'AA Batteries 4pk Duracell', category: 'Electronics', price: '7.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'AAA Batteries 4pk Duracell', category: 'Electronics', price: '7.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'USB-A to Lightning Cable 3ft', category: 'Electronics', price: '12.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'USB-C Charging Cable 3ft', category: 'Electronics', price: '12.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Earbuds – Wired 3.5mm', category: 'Electronics', price: '9.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Hand Sanitizer 2oz Purell', category: 'General', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Tylenol Travel Pack 2ct', category: 'General', price: '2.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Condom – Lifestyle 1pk', category: 'General', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Lighter – BIC', category: 'General', price: '3.49', nighttimeAvailable: 'true', restrictedFlag: 'true' },
  { name: 'Ziplock Bags Sandwich 10ct', category: 'General', price: '3.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
  { name: 'Condom – Trojan Magnum 1pk', category: 'General', price: '4.99', nighttimeAvailable: 'true', restrictedFlag: 'false' },
]

export default function ImportPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [catalog, setCatalog] = useState<ProductRow[]>(PRESET_CATALOG)
  const [selected, setSelected] = useState<Set<number>>(new Set(PRESET_CATALOG.map((_, i) => i)))
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingImages, setFetchingImages] = useState(false)
  const [result, setResult] = useState('')
  const [tab, setTab] = useState<'preset' | 'csv'>('preset')

  function toggleAll() {
    if (selected.size === PRESET_CATALOG.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(PRESET_CATALOG.map((_, i) => i)))
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
    setResult(`✅ Imported ${data.created} products${data.errors?.length ? ` (${data.errors.length} skipped)` : ''}`)
    setLoading(false)
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

  const categories = Array.from(new Set(PRESET_CATALOG.map(p => p.category)))

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${storeId}/products`} className="text-gray-400 text-2xl">‹</Link>
          <h1 className="font-bold text-lg">Import Products</h1>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-3">
          <button onClick={() => setTab('preset')} className={`text-sm font-semibold px-4 py-1.5 rounded-full ${tab === 'preset' ? 'bg-brand text-white' : 'bg-gray-800 text-gray-400'}`}>Preset Catalog</button>
          <button onClick={() => setTab('csv')} className={`text-sm font-semibold px-4 py-1.5 rounded-full ${tab === 'csv' ? 'bg-brand text-white' : 'bg-gray-800 text-gray-400'}`}>CSV Upload</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {result && (
          <div className="card bg-green-900/30 border border-green-700/50 text-green-300 text-sm text-center">
            {result}
          </div>
        )}

        {tab === 'preset' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{selected.size} of {catalog.length} selected</p>
              <div className="flex gap-3">
                <button onClick={fetchImages} disabled={fetchingImages || loading} className="text-sm text-brand underline">
                  {fetchingImages ? 'Fetching…' : '🖼 Fetch Images'}
                </button>
                <button onClick={toggleAll} className="text-sm text-gray-400 underline">
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
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-lg">🛒</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.restrictedFlag === 'true' && <span className="badge bg-red-900 text-red-400 text-xs">21+</span>}
                      <span className="text-brand font-bold text-sm">${p.price}</span>
                    </div>
                  </label>
                ))}
              </div>
            ))}
          </>
        )}

        {tab === 'csv' && (
          <div className="space-y-3">
            <div className="card text-xs text-gray-400 space-y-1">
              <p className="font-semibold text-gray-300">CSV Format (first row = headers):</p>
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-950 border-t border-gray-800">
          <div className="max-w-2xl mx-auto">
            <button onClick={importPreset} disabled={loading || selected.size === 0} className="btn-primary">
              {loading ? 'Importing…' : `Import ${selected.size} Products`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
