'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { StoreInfo } from '@/types'

export default function AdminDashboard() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [windowModeEnabled, setWindowModeEnabled] = useState(false)
  const [windowStart, setWindowStart] = useState('22:00')
  const [windowEnd, setWindowEnd] = useState('06:00')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoSaving, setLogoSaving] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<string | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(true)
  const [demoResetting, setDemoResetting] = useState(false)
  const isDemo = storeId === 'store_demo'

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoSaving(true)
    const base64 = await compressImage(file, 800, 0.75)
    setLogoUrl(base64)
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: base64 }),
    })
    setLogoSaving(false)
  }

  useEffect(() => {
    fetch(`/api/stores/${storeId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(s => {
        setStore(s)
        setWindowModeEnabled(s.windowModeEnabled ?? false)
        setWindowStart(s.windowModeStart ?? '22:00')
        setWindowEnd(s.windowModeEnd ?? '06:00')
        setLogoUrl(s.logoUrl ?? '')
        setOnboardingComplete(s.onboardingComplete ?? true)
      })
      .catch(() => setStore({ id: storeId, name: 'Store' } as StoreInfo))
    fetch(`/api/qr/${storeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setQrUrl(d.qrDataUrl))
      .catch(() => {})
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

  async function resetDemo() {
    setDemoResetting(true)
    await fetch('/api/admin/demo-reset', { method: 'POST' })
    setOnboardingComplete(false)
    setDemoResetting(false)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
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
      <div className="panel">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-black text-xl text-brand glow-text leading-none">WendOS</h1>
            <p className="text-xs text-gray-500 mt-0.5">{store.name}</p>
          </div>
          {!isDemo && (
            <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-3 py-1.5 rounded-lg bg-gray-100">
              Sign out
            </button>
          )}
        </div>
        {/* Nav strip */}
        <div className="max-w-2xl mx-auto">
        <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
          {[
            { href: `/admin/${storeId}/products`, label: '📦 Products' },
            { href: `/admin/${storeId}/orders`, label: '📋 Orders' },
            { href: `/admin/${storeId}/staff`, label: '👥 Staff' },
            { href: `/staff/${storeId}/orders`, label: '🧾 Staff View' },
            { href: `/fulfillment/${storeId}`, label: '🖥️ Fulfillment' },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:text-gray-900 hover:bg-gray-200 transition-colors whitespace-nowrap">
              {label}
            </Link>
          ))}
        </div>
        </div>
      </div>

      {!onboardingComplete && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="card space-y-3 border-brand/40 bg-brand/10">
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <p className="font-bold text-sm text-gray-900">Setup not complete</p>
                <p className="text-xs text-gray-500 mt-0.5">Your starter kit hasn&apos;t been ordered yet. Finish setup to go live.</p>
              </div>
            </div>
            <Link href={`/admin/${storeId}/setup`} className="btn-primary block text-center">Complete Setup →</Link>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Window Ordering */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Window Ordering</h2>
            <button
              onClick={() => setWindowModeEnabled(v => !v)}
              className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${windowModeEnabled ? 'bg-brand' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${windowModeEnabled ? 'translate-x-7' : ''}`} />
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Opens</label>
              <input type="time" value={windowStart} onChange={e => setWindowStart(e.target.value)} className="input text-sm py-2" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Closes</label>
              <input type="time" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} className="input text-sm py-2" />
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
              download={`wendos-qr-${storeId}.png`}
              className="btn-secondary block"
            >
              Download QR Code
            </a>
          )}
        </div>

        {/* Storefront Photo */}
        <div className="card space-y-3">
          <h2 className="font-bold">Storefront Photo</h2>
          <p className="text-xs text-gray-500">Take or choose a photo — shown to customers on the menu.</p>
          {logoUrl && (
            <img src={logoUrl} alt="Storefront" className="w-full max-h-48 object-cover rounded-xl" />
          )}
          <label className={`btn-primary flex items-center justify-center gap-2 cursor-pointer ${logoSaving ? 'opacity-60 pointer-events-none' : ''}`}>
            {logoSaving ? 'Saving…' : logoUrl ? '📷 Retake Photo' : '📷 Take / Choose Photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
            />
          </label>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/admin/${storeId}/products`} className="card text-center space-y-1 hover:bg-gray-100 transition-colors">
            <p className="text-2xl">📦</p>
            <p className="font-semibold text-sm">Products</p>
            <p className="text-xs text-gray-500">Manage night menu</p>
          </Link>
          <Link href={`/admin/${storeId}/orders`} className="card text-center space-y-1 hover:bg-gray-100 transition-colors">
            <p className="text-2xl">📋</p>
            <p className="font-semibold text-sm">Orders</p>
            <p className="text-xs text-gray-500">View all orders</p>
          </Link>
          <Link href={`/admin/${storeId}/staff`} className="card text-center space-y-1 hover:bg-gray-100 transition-colors">
            <p className="text-2xl">👥</p>
            <p className="font-semibold text-sm">Staff</p>
            <p className="text-xs text-gray-500">Manage logins & shifts</p>
          </Link>
          <Link href={`/fulfillment/${storeId}`} className="card text-center space-y-1 hover:bg-gray-100 transition-colors col-span-2">
            <p className="text-2xl">🖥️</p>
            <p className="font-semibold text-sm">Fulfillment Tablet</p>
            <p className="text-xs text-gray-500">Open on dedicated fulfillment tablet – live queue + audio alerts</p>
          </Link>
        </div>
        {/* Demo Controls */}
        {isDemo && (
          <div className="card space-y-2 border border-yellow-800">
            <h2 className="font-bold text-yellow-700">Demo Controls</h2>
            <p className="text-xs text-gray-500">Reset the demo store to run through the setup wizard again.</p>
            <button onClick={resetDemo} disabled={demoResetting} className="btn-secondary w-full">
              {demoResetting ? 'Resetting…' : '🔄 Reset Demo & Rerun Setup'}
            </button>
            <Link href={`/admin/${storeId}/setup`} className="btn-primary block text-center w-full">
              ▶ Run Setup Wizard
            </Link>
          </div>
        )}

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

function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}
