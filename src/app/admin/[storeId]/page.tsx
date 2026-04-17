'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { StoreInfo } from '@/types'

export default function AdminDashboard() {
  const { storeId } = useParams<{ storeId: string }>()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [windowModeEnabled, setWindowModeEnabled] = useState(false)
  const [windowStart, setWindowStart] = useState('22:00')
  const [windowEnd, setWindowEnd] = useState('06:00')
  const [logoUrl, setLogoUrl] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/stores/${storeId}`)
      .then(r => r.json())
      .then(s => {
        setStore(s)
        setWindowModeEnabled(s.windowModeEnabled)
        setWindowStart(s.windowModeStart ?? '22:00')
        setWindowEnd(s.windowModeEnd ?? '06:00')
        setLogoUrl((s as StoreInfo & { logoUrl?: string }).logoUrl ?? '')
      })
    fetch(`/api/qr/${storeId}`)
      .then(r => r.json())
      .then(d => setQrUrl(d.qrDataUrl))
  }, [storeId])

  async function saveSettings() {
    setSaving(true)
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        windowModeEnabled,
        windowModeStart: windowStart,
        windowModeEnd: windowEnd,
        logoUrl: logoUrl || null,
      }),
    })
    setSaving(false)
  }

  async function runMigrate() {
    setMigrating(true)
    setMigrateResult(null)
    try {
      const r = await fetch('/api/migrate', { method: 'POST' })
      const d = await r.json()
      setMigrateResult(d.ok ? '✅ Migration complete' : `❌ ${d.error}`)
    } catch {
      setMigrateResult('❌ Network error')
    }
    setMigrating(false)
  }

  if (!store) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500 animate-pulse">Loading…</p></div>

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-black text-lg text-brand">Admin</h1>
            <p className="text-sm text-gray-400">{store.name}</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href={`/admin/${storeId}/products`} className="text-brand underline">Products</Link>
            <Link href={`/admin/${storeId}/orders`} className="text-brand underline">Orders</Link>
            <Link href={`/staff/${storeId}/orders`} className="text-gray-400 underline">Staff View</Link>
            <Link href={`/fulfillment/${storeId}`} className="text-gray-400 underline">Fulfillment Tablet</Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Window Mode Toggle */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Window Mode</h2>
              <p className="text-xs text-gray-500">Enable to allow orders through window only</p>
            </div>
            <button
              onClick={() => setWindowModeEnabled(v => !v)}
              className={`relative w-14 h-7 rounded-full transition-colors ${windowModeEnabled ? 'bg-brand' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${windowModeEnabled ? 'translate-x-7' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Window Opens</label>
              <input type="time" value={windowStart} onChange={e => setWindowStart(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Window Closes</label>
              <input type="time" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} className="input" />
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

        {/* QR Code */}
        <div className="card space-y-3 text-center">
          <h2 className="font-bold text-left">Store QR Code</h2>
          <p className="text-xs text-gray-500 text-left">Print and post at window. Customers scan to order.</p>
          {qrUrl && (
            <img src={qrUrl} alt="Store QR" className="w-48 h-48 mx-auto rounded-xl bg-white p-2" />
          )}
          <p className="text-xs text-gray-500 font-mono break-all">
            {process.env.NEXT_PUBLIC_BASE_URL}/store/{storeId}
          </p>
          {qrUrl && (
            <a
              href={qrUrl}
              download={`window-mode-qr-${storeId}.png`}
              className="btn-secondary block"
            >
              Download QR Code
            </a>
          )}
        </div>

        {/* Storefront Photo */}
        <div className="card space-y-3">
          <h2 className="font-bold">Storefront Photo</h2>
          <p className="text-xs text-gray-500">Paste a URL to your store photo or logo. Shown to customers on the menu.</p>
          <input
            type="url"
            placeholder="https://example.com/photo.jpg"
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            className="input"
          />
          {logoUrl && (
            <img src={logoUrl} alt="Storefront preview" className="w-full max-h-40 object-cover rounded-xl" />
          )}
          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Photo'}
          </button>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/admin/${storeId}/products`} className="card text-center space-y-1 hover:bg-gray-800 transition-colors">
            <p className="text-2xl">📦</p>
            <p className="font-semibold text-sm">Products</p>
            <p className="text-xs text-gray-500">Manage night menu</p>
          </Link>
          <Link href={`/admin/${storeId}/orders`} className="card text-center space-y-1 hover:bg-gray-800 transition-colors">
            <p className="text-2xl">📋</p>
            <p className="font-semibold text-sm">Orders</p>
            <p className="text-xs text-gray-500">View all orders</p>
          </Link>
          <Link href={`/fulfillment/${storeId}`} className="card text-center space-y-1 hover:bg-gray-800 transition-colors col-span-2">
            <p className="text-2xl">🖥️</p>
            <p className="font-semibold text-sm">Fulfillment Tablet</p>
            <p className="text-xs text-gray-500">Open on dedicated fulfillment tablet – live queue + audio alerts</p>
          </Link>
        </div>
        {/* DB Migration */}
        <div className="card space-y-2">
          <h2 className="font-bold">Database</h2>
          <p className="text-xs text-gray-500">Run if you see column/table errors after an update.</p>
          <button onClick={runMigrate} disabled={migrating} className="btn-secondary w-full">
            {migrating ? 'Running…' : '🛠 Run Migration'}
          </button>
          {migrateResult && <p className="text-sm text-center">{migrateResult}</p>}
        </div>
      </div>
    </div>
  )
}
