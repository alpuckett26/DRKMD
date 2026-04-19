'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'

interface StoreRow {
  id: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
  onboardingComplete: boolean
  windowModeEnabled: boolean
  createdAt: string
  productCount: number
  staffCount: number
  orderCount: number
  revenue: number
  todayOrders: number
  todayRevenue: number
  weekOrders: number
  weekRevenue: number
  activeOrders: number
}

interface OrderRow {
  id: string
  storeId: string
  storeName: string
  customerName: string
  status: string
  pickupCode: string
  estimatedTotal: number
  finalTotal: number | null
  itemCount: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  authorized: 'bg-yellow-900 text-yellow-300',
  picking: 'bg-blue-900 text-blue-300',
  ready: 'bg-green-900 text-green-300',
  partially_ready: 'bg-green-900 text-green-400',
  captured: 'bg-green-800 text-green-200',
  completed: 'bg-gray-700 text-gray-300',
  voided: 'bg-red-900 text-red-400',
  canceled: 'bg-red-900 text-red-400',
  submitted: 'bg-gray-800 text-gray-400',
}

export default function PlatformAdmin() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<'overview' | 'stores' | 'orders'>('overview')
  const [stores, setStores] = useState<StoreRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [orderFilter, setOrderFilter] = useState<string>('')
  const [storeFilter, setStoreFilter] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadStores = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/platform/stores')
    if (res.ok) setStores(await res.json())
    setLoading(false)
  }, [])

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' })
    if (storeFilter) params.set('storeId', storeFilter)
    if (orderFilter) params.set('status', orderFilter)
    const res = await fetch(`/api/platform/orders?${params}`)
    if (res.ok) setOrders(await res.json())
  }, [storeFilter, orderFilter])

  useEffect(() => {
    fetch('/api/platform/stores').then(r => {
      if (r.ok) { r.json().then(setStores); setAuthed(true) }
    })
  }, [])

  useEffect(() => {
    if (authed && tab === 'orders') loadOrders()
  }, [authed, tab, loadOrders])

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

  async function logout() {
    await fetch('/api/platform/auth', { method: 'DELETE' })
    setAuthed(false)
    setStores([])
    setOrders([])
  }

  async function toggleWindow(storeId: string, enabled: boolean) {
    await fetch(`/api/platform/stores/${storeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowModeEnabled: enabled }),
    })
    setStores(prev => prev.map(s => s.id === storeId ? { ...s, windowModeEnabled: enabled } : s))
  }

  async function deleteStore(storeId: string) {
    setDeletingId(storeId)
    await fetch(`/api/platform/stores/${storeId}`, { method: 'DELETE' })
    setStores(prev => prev.filter(s => s.id !== storeId))
    setDeletingId(null)
    setConfirmDelete(null)
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="font-black text-4xl text-brand glow-text">WendOS</h1>
            <p className="text-gray-500 text-sm mt-2">Platform Admin</p>
          </div>
          <form onSubmit={login} className="card space-y-4">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Platform password" className="input" autoFocus />
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button type="submit" className="btn-primary">Enter →</button>
          </form>
        </div>
      </div>
    )
  }

  const totalRevenue = stores.reduce((s, r) => s + r.revenue, 0)
  const totalOrders = stores.reduce((s, r) => s + r.orderCount, 0)
  const todayRevenue = stores.reduce((s, r) => s + r.todayRevenue, 0)
  const todayOrders = stores.reduce((s, r) => s + r.todayOrders, 0)
  const weekRevenue = stores.reduce((s, r) => s + r.weekRevenue, 0)
  const weekOrders = stores.reduce((s, r) => s + r.weekOrders, 0)
  const activeStores = stores.filter(r => r.onboardingComplete).length
  const liveOrders = stores.reduce((s, r) => s + r.activeOrders, 0)

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="panel sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <span className="font-black text-brand glow-text">WendOS</span>
              <span className="text-gray-600 text-sm ml-2">Platform</span>
            </div>
            <nav className="flex gap-1">
              {(['overview', 'stores', 'orders'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                    tab === t ? 'bg-brand/20 text-brand border border-brand/30' : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {t}
                  {t === 'orders' && liveOrders > 0 && (
                    <span className="ml-1.5 bg-yellow-500 text-black text-xs rounded-full px-1.5 py-0.5 font-black">{liveOrders}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <button onClick={logout} className="text-gray-600 text-xs underline hover:text-gray-400 transition-colors">Sign out</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Time-based stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card space-y-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Today</p>
                <div>
                  <p className="text-2xl font-black text-brand">{formatCents(todayRevenue)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{todayOrders} orders</p>
                </div>
              </div>
              <div className="card space-y-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">This Week</p>
                <div>
                  <p className="text-2xl font-black text-brand">{formatCents(weekRevenue)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{weekOrders} orders</p>
                </div>
              </div>
              <div className="card space-y-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">All Time</p>
                <div>
                  <p className="text-2xl font-black text-brand">{formatCents(totalRevenue)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{totalOrders} orders</p>
                </div>
              </div>
            </div>

            {/* Platform health */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Stores', value: stores.length },
                { label: 'Active Stores', value: activeStores },
                { label: 'Setup Pending', value: stores.length - activeStores },
                { label: 'Live Orders Now', value: liveOrders, highlight: liveOrders > 0 },
              ].map(stat => (
                <div key={stat.label} className="card text-center py-5">
                  <p className={`text-3xl font-black ${stat.highlight ? 'text-yellow-400' : 'text-white'}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Per-store performance table */}
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand/10">
                    <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">Store</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">Today</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">This Week</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">All Time</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">Live</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.filter(s => s.id !== 'store_demo').map(s => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/${s.id}`} className="font-semibold text-white hover:text-brand transition-colors">{s.name}</Link>
                        <p className="text-xs text-gray-600">{s.ownerName ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-brand font-semibold">{formatCents(s.todayRevenue)}</p>
                        <p className="text-xs text-gray-600">{s.todayOrders} orders</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold">{formatCents(s.weekRevenue)}</p>
                        <p className="text-xs text-gray-600">{s.weekOrders} orders</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold">{formatCents(s.revenue)}</p>
                        <p className="text-xs text-gray-600">{s.orderCount} orders</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.activeOrders > 0
                          ? <span className="badge bg-yellow-900 text-yellow-300">{s.activeOrders} active</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STORES ── */}
        {tab === 'stores' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-widest">{stores.length} Stores</h2>
              <button onClick={loadStores} className="text-xs text-gray-500 underline hover:text-gray-300">Refresh</button>
            </div>
            {loading && <p className="text-gray-500 animate-pulse text-sm">Loading…</p>}
            {stores.map(store => (
              <div key={store.id} className="card space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-base">{store.name}</h3>
                      <span className={`badge text-xs ${store.onboardingComplete ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                        {store.onboardingComplete ? '✓ Active' : '⚠ Setup pending'}
                      </span>
                      {store.id === 'store_demo' && <span className="badge bg-purple-900 text-purple-400 text-xs">Demo</span>}
                      {store.activeOrders > 0 && (
                        <span className="badge bg-yellow-800 text-yellow-300 text-xs">{store.activeOrders} live orders</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{store.ownerName ?? '—'} · {store.ownerEmail ?? '—'}</p>
                    <p className="text-xs text-gray-600 mt-0.5 font-mono">{store.id}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Joined {new Date(store.createdAt).toLocaleDateString()} · {store.productCount} products · {store.staffCount} staff
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-black text-brand text-lg">{formatCents(store.revenue)}</p>
                    <p className="text-xs text-gray-500">{store.orderCount} total orders</p>
                    <p className="text-xs text-green-400">{formatCents(store.todayRevenue)} today</p>
                  </div>
                </div>

                {/* Window mode toggle */}
                <div className="flex items-center justify-between py-2 border-t border-white/5">
                  <div>
                    <p className="text-sm font-semibold">Window Ordering</p>
                    <p className="text-xs text-gray-500">{store.windowModeEnabled ? 'Customers can order now' : 'Orders paused'}</p>
                  </div>
                  <button
                    onClick={() => toggleWindow(store.id, !store.windowModeEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${store.windowModeEnabled ? 'bg-brand' : 'bg-gray-700'}`}
                    style={{}}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${store.windowModeEnabled ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap items-center border-t border-white/5 pt-3">
                  <Link href={`/admin/${store.id}`} className="text-xs bg-brand/20 text-brand border border-brand/30 px-3 py-1.5 rounded-lg hover:bg-brand/30 transition-colors font-semibold">
                    Admin Panel →
                  </Link>
                  <Link href={`/admin/${store.id}/orders`} className="text-xs glass px-3 py-1.5 rounded-lg hover:border-brand/40 transition-colors">Orders</Link>
                  <Link href={`/admin/${store.id}/products`} className="text-xs glass px-3 py-1.5 rounded-lg hover:border-brand/40 transition-colors">Products</Link>
                  <Link href={`/admin/${store.id}/staff`} className="text-xs glass px-3 py-1.5 rounded-lg hover:border-brand/40 transition-colors">Staff</Link>
                  <Link href={`/fulfillment/${store.id}`} className="text-xs glass px-3 py-1.5 rounded-lg hover:border-brand/40 transition-colors">Fulfillment</Link>
                  <div className="ml-auto">
                    {store.id !== 'store_demo' && (
                      confirmDelete === store.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-red-400">Delete store?</span>
                          <button onClick={() => deleteStore(store.id)} disabled={deletingId === store.id}
                            className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded-lg">
                            {deletingId === store.id ? '…' : 'Confirm'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(store.id)} className="text-xs text-gray-700 hover:text-red-500 transition-colors">
                          Delete store
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab === 'orders' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
                className="input text-sm py-2 w-auto flex-1 min-w-[160px]">
                <option value="">All Stores</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)}
                className="input text-sm py-2 w-auto flex-1 min-w-[140px]">
                <option value="">All Statuses</option>
                {['authorized', 'picking', 'ready', 'partially_ready', 'captured', 'completed', 'voided', 'canceled'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button onClick={loadOrders} className="btn-secondary text-sm py-2 px-4 w-auto">Search</button>
            </div>

            <p className="text-xs text-gray-600">{orders.length} orders</p>

            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand/10">
                    {['Code', 'Store', 'Customer', 'Status', 'Total', 'Items', 'Time'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-black text-brand tracking-widest">{o.pickupCode}</td>
                      <td className="px-4 py-3 text-gray-300">{o.storeName}</td>
                      <td className="px-4 py-3 text-gray-300">{o.customerName}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${STATUS_COLORS[o.status] ?? 'bg-gray-700 text-gray-400'}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCents(o.finalTotal ?? o.estimatedTotal)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{o.itemCount}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(o.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">No orders found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
