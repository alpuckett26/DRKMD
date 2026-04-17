'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'

interface StoreRow {
  id: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
  onboardingComplete: boolean
  createdAt: string
  productCount: number
  staffCount: number
  orderCount: number
  revenue: number
}

export default function PlatformAdmin() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [stores, setStores] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    const res = await fetch('/api/platform/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) { setAuthError('Wrong password'); return }
    setAuthed(true)
    loadStores()
  }

  async function loadStores() {
    setLoading(true)
    const res = await fetch('/api/platform/stores')
    if (res.ok) setStores(await res.json())
    setLoading(false)
  }

  async function logout() {
    await fetch('/api/platform/auth', { method: 'DELETE' })
    setAuthed(false)
    setStores([])
  }

  // Try auto-auth on mount (if cookie still valid)
  useEffect(() => {
    fetch('/api/platform/stores').then(r => {
      if (r.ok) { r.json().then(setStores); setAuthed(true) }
    })
  }, [])

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="font-black text-4xl text-brand glow-text">WendOS</h1>
            <p className="text-gray-500 text-sm mt-2">Platform Admin</p>
          </div>
          <form onSubmit={login} className="card space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Platform password"
              className="input"
              autoFocus
            />
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button type="submit" className="btn-primary">Enter →</button>
          </form>
        </div>
      </div>
    )
  }

  const totalRevenue = stores.reduce((s, r) => s + r.revenue, 0)
  const totalOrders = stores.reduce((s, r) => s + r.orderCount, 0)
  const activeStores = stores.filter(r => r.onboardingComplete).length

  return (
    <div className="min-h-screen pb-10">
      <div className="panel">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-black text-lg text-brand glow-text">WendOS Platform</h1>
            <p className="text-sm text-gray-400">{stores.length} stores</p>
          </div>
          <button onClick={logout} className="text-gray-600 text-xs underline hover:text-gray-400 transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center space-y-1">
            <p className="text-3xl font-black text-brand">{activeStores}</p>
            <p className="text-xs text-gray-500">Active Stores</p>
          </div>
          <div className="card text-center space-y-1">
            <p className="text-3xl font-black text-brand">{totalOrders}</p>
            <p className="text-xs text-gray-500">Total Orders</p>
          </div>
          <div className="card text-center space-y-1">
            <p className="text-3xl font-black text-brand">{formatCents(totalRevenue)}</p>
            <p className="text-xs text-gray-500">Total Revenue</p>
          </div>
        </div>

        {/* Store list */}
        <div className="space-y-3">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-widest">All Stores</h2>
          {loading && <p className="text-gray-500 animate-pulse text-sm">Loading…</p>}
          {stores.map(store => (
            <div key={store.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-white">{store.name}</h3>
                    <span className={`badge text-xs ${store.onboardingComplete ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                      {store.onboardingComplete ? '✓ Active' : '⚠ Setup pending'}
                    </span>
                    {store.id === 'store_demo' && (
                      <span className="badge bg-purple-900 text-purple-400 text-xs">Demo</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {store.ownerName ?? '—'} · {store.ownerEmail ?? '—'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Joined {new Date(store.createdAt).toLocaleDateString()} · {store.productCount} products · {store.staffCount} staff
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-brand">{formatCents(store.revenue)}</p>
                  <p className="text-xs text-gray-500">{store.orderCount} orders</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href={`/admin/${store.id}`} className="text-xs text-brand underline">
                  Admin →
                </Link>
                <Link href={`/admin/${store.id}/orders`} className="text-xs text-gray-400 underline">
                  Orders
                </Link>
                <Link href={`/admin/${store.id}/products`} className="text-xs text-gray-400 underline">
                  Products
                </Link>
                <Link href={`/fulfillment/${store.id}`} className="text-xs text-gray-400 underline">
                  Fulfillment
                </Link>
                <span className="text-xs text-gray-700 font-mono">{store.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
