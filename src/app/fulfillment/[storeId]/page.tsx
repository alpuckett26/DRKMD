'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'

interface OrderItem {
  id: string
  requestedName: string
  requestedPrice: number
  qtyRequested: number
  status: string
}

interface Order {
  id: string
  customerName: string
  customerPhone: string | null
  status: string
  estimatedTotal: number
  finalTotal: number | null
  pickupCode: string
  substitutionPreference: string
  createdAt: string
  items: OrderItem[]
}

const QUEUE_STATUSES = ['authorized', 'picking']
const READY_STATUSES = ['ready', 'partially_ready', 'captured']
const POLL_MS = 4000

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

export default function FulfillmentTablet() {
  const { storeId } = useParams<{ storeId: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [storeName, setStoreName] = useState('')
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const knownIds = useRef<Set<string>>(new Set())
  const [lastPoll, setLastPoll] = useState<Date | null>(null)

  useEffect(() => {
    fetch(`/api/stores/${storeId}`)
      .then(r => r.json())
      .then(s => setStoreName(s.name))
  }, [storeId])

  async function poll() {
    const res = await fetch(`/api/admin/stores/${storeId}/orders`)
    if (!res.ok) return
    const all: Order[] = await res.json()
    const active = all.filter(o => [...QUEUE_STATUSES, ...READY_STATUSES].includes(o.status))
    setOrders(active)
    setLastPoll(new Date())

    const incoming = active.filter(
      o => QUEUE_STATUSES.includes(o.status) && !knownIds.current.has(o.id),
    )
    if (incoming.length > 0) {
      playBeep()
      setNewOrderIds(prev => new Set([...prev, ...incoming.map(o => o.id)]))
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev)
          incoming.forEach(o => next.delete(o.id))
          return next
        })
      }, 5000)
    }

    active.forEach(o => knownIds.current.add(o.id))
  }

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [storeId])

  const queue = orders.filter(o => QUEUE_STATUSES.includes(o.status))
  const ready = orders.filter(o => READY_STATUSES.includes(o.status))

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-black text-brand text-xl">WINDOW MODE</span>
          <span className="text-gray-500 text-sm">{storeName}</span>
          <span className="badge bg-green-900 text-green-400 text-xs">● FULFILLMENT</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {lastPoll && <span>Updated {lastPoll.toLocaleTimeString()}</span>}
          <Link href={`/admin/${storeId}`} className="text-gray-600 underline">Admin</Link>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-0 divide-x divide-gray-800 overflow-hidden">
        {/* LEFT PANEL: Order Queue */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-black text-lg">Order Queue</h2>
            <span className="badge bg-yellow-900 text-yellow-300 text-sm">{queue.length} pending</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {queue.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3 py-20">
                <span className="text-5xl">🪟</span>
                <p>No pending orders</p>
              </div>
            )}
            {queue.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                isNew={newOrderIds.has(order.id)}
                storeId={storeId}
              />
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: Ready for Pickup */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-black text-lg">Ready for Pickup</h2>
            <span className="badge bg-green-900 text-green-300 text-sm">{ready.length} ready</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ready.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3 py-20">
                <span className="text-5xl">✅</span>
                <p>No orders awaiting pickup</p>
              </div>
            )}
            {ready.map(order => (
              <ReadyCard key={order.id} order={order} storeId={storeId} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function OrderCard({
  order,
  isNew,
  storeId,
}: {
  order: Order
  isNew: boolean
  storeId: string
}) {
  const age = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)

  return (
    <Link
      href={`/staff/${storeId}/orders/${order.id}`}
      className={`block rounded-2xl p-4 border-2 transition-all ${
        isNew
          ? 'border-brand bg-brand/10 animate-pulse'
          : order.status === 'picking'
            ? 'border-blue-600 bg-blue-900/20'
            : 'border-gray-700 bg-gray-900'
      }`}
    >
      {isNew && (
        <div className="text-brand font-bold text-xs uppercase tracking-widest mb-2 animate-bounce">
          🔔 NEW ORDER
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-black text-3xl tracking-widest text-white">{order.pickupCode}</p>
          <p className="text-gray-300 text-sm mt-0.5">{order.customerName}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <StatusPill status={order.status} />
          <p className="text-xs text-gray-500 mt-1">{age}m ago</p>
        </div>
      </div>

      {/* Item list */}
      <div className="space-y-1 border-t border-gray-700 pt-2">
        {order.items.map(item => (
          <div key={item.id} className="flex items-center justify-between text-sm gap-2">
            <span className="text-gray-200 truncate">
              {item.qtyRequested > 1 && <span className="text-brand font-bold">{item.qtyRequested}× </span>}
              {item.requestedName}
            </span>
            <ItemDot status={item.status} />
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
        <span className="text-xs text-gray-500">
          {order.substitutionPreference === 'allow_similar' ? '↔ Subs OK' : '✗ No subs'}
        </span>
        <span className="font-bold text-brand">{formatCents(order.estimatedTotal)}</span>
      </div>
    </Link>
  )
}

function ReadyCard({ order, storeId }: { order: Order; storeId: string }) {
  return (
    <Link
      href={`/staff/${storeId}/handoff`}
      className="block rounded-2xl p-4 border-2 border-green-600 bg-green-900/20"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-4xl tracking-widest text-white">{order.pickupCode}</p>
          <p className="text-gray-300 text-sm mt-0.5">{order.customerName}</p>
        </div>
        <div className="text-right">
          <p className="text-green-400 font-bold text-sm">READY</p>
          <p className="font-black text-brand text-xl mt-1">
            {formatCents(order.finalTotal ?? order.estimatedTotal)}
          </p>
        </div>
      </div>
      <p className="text-xs text-green-600 mt-2 font-semibold">→ Tap to go to handoff screen</p>
    </Link>
  )
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    authorized: { label: 'New', cls: 'bg-yellow-900 text-yellow-300' },
    picking: { label: 'In Progress', cls: 'bg-blue-900 text-blue-300' },
    ready: { label: 'Ready', cls: 'bg-green-900 text-green-300' },
    partially_ready: { label: 'Partial', cls: 'bg-green-900 text-green-400' },
    captured: { label: 'Paid ✓', cls: 'bg-green-800 text-green-200' },
  }
  const c = cfg[status] ?? { label: status, cls: 'bg-gray-700 text-gray-400' }
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}

function ItemDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    requested: 'bg-gray-600',
    found: 'bg-green-500',
    unavailable: 'bg-red-500',
    substituted: 'bg-blue-400',
    refused_restricted: 'bg-red-700',
  }
  return (
    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-gray-600'}`} />
  )
}
