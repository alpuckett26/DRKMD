'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
const POLL_MS = 2000

function playBeep() {
  function tone(offset: number) {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.6, ctx.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.3)
    } catch {}
  }
  tone(0)
  tone(0.4)
}

interface StaffSession {
  id: string
  name: string
  role: string
}

export default function FulfillmentTablet() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [storeName, setStoreName] = useState('')
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null)
  const [endingShift, setEndingShift] = useState(false)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const knownIds = useRef<Set<string>>(new Set())
  // Track when each unacknowledged order was first seen and how many reminders sent
  const reminderState = useRef<Map<string, { seenAt: number; reminders: number }>>(new Map())
  const [lastPoll, setLastPoll] = useState<Date | null>(null)

  useEffect(() => {
    fetch(`/api/stores/${storeId}`)
      .then(r => r.json())
      .then(s => setStoreName(s.name))
    fetch(`/api/staff/${storeId}/session`)
      .then(r => r.json())
      .then(data => setStaffSession(data))
  }, [storeId])

  async function endShift() {
    setEndingShift(true)
    router.push(`/staff/${storeId}/shift-end`)
  }

  // Keep screen awake on tablet
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    async function acquire() {
      try { lock = await navigator.wakeLock.request('screen') } catch {}
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); lock?.release() }
  }, [])

  async function poll() {
    const res = await fetch(`/api/admin/stores/${storeId}/orders`)
    if (!res.ok) return
    const all: Order[] = await res.json()
    const active = all.filter(o => [...QUEUE_STATUSES, ...READY_STATUSES].includes(o.status))
    setOrders(active)
    setLastPoll(new Date())

    const now = Date.now()
    const incoming = active.filter(
      o => QUEUE_STATUSES.includes(o.status) && !knownIds.current.has(o.id),
    )
    if (incoming.length > 0) {
      playBeep()
      setNewOrderIds(prev => new Set(Array.from(prev).concat(incoming.map(o => o.id))))
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev)
          incoming.forEach(o => next.delete(o.id))
          return next
        })
      }, 5000)
      incoming.forEach(o => reminderState.current.set(o.id, { seenAt: now, reminders: 0 }))
    }

    // Reminder beeps: re-alert every 2 minutes, up to 2 reminders, for unacknowledged authorized orders
    const REMINDER_INTERVAL_MS = 2 * 60 * 1000
    const MAX_REMINDERS = 2
    const unacknowledged = active.filter(o => o.status === 'authorized')
    for (const order of unacknowledged) {
      const state = reminderState.current.get(order.id)
      if (state && state.reminders < MAX_REMINDERS) {
        const elapsed = now - state.seenAt
        const due = (state.reminders + 1) * REMINDER_INTERVAL_MS
        if (elapsed >= due) {
          playBeep()
          reminderState.current.set(order.id, { ...state, reminders: state.reminders + 1 })
        }
      }
    }

    // Clean up reminder state for orders no longer in queue
    const activeIds = new Set(active.map(o => o.id))
    for (const id of Array.from(reminderState.current.keys())) {
      if (!activeIds.has(id)) reminderState.current.delete(id)
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
    <div className="min-h-screen flex flex-col" style={{background:'#050a12'}}>
      {/* Header bar */}
      <div className="panel px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-brand text-lg glow-text shrink-0">WendOS</span>
            <span className="text-gray-500 text-sm truncate">{storeName}</span>
            <span className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(46,168,255,0.12)', color: '#2EA8FF', border: '1px solid rgba(46,168,255,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              LIVE
            </span>
          </div>
          <Link href={`/admin/${storeId}`} className="text-xs text-gray-600 underline shrink-0">Admin</Link>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
            {staffSession && <span className="text-gray-300 truncate">{staffSession.name}</span>}
            {lastPoll && <span className="truncate">· {lastPoll.toLocaleTimeString()}</span>}
          </div>
          {staffSession ? (
            <button onClick={endShift} disabled={endingShift}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              {endingShift ? '…' : 'End Shift'}
            </button>
          ) : (
            <Link href={`/staff/${storeId}/login`} className="shrink-0 text-xs text-gray-500 underline">Staff Login</Link>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-0 divide-x divide-gray-800 overflow-hidden">
        {/* LEFT PANEL: Order Queue */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-black text-base">Queue</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: queue.length > 0 ? '#facc15' : '#6b7280' }}>
              {queue.length} pending
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {queue.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-3 py-20">
                <span className="text-4xl">🪟</span>
                <p className="text-sm">No pending orders</p>
              </div>
            )}
            {queue.map(order => (
              <OrderCard key={order.id} order={order} isNew={newOrderIds.has(order.id)} storeId={storeId} />
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: Ready for Pickup */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-black text-base">Ready</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: ready.length > 0 ? '#2EA8FF' : '#6b7280' }}>
              {ready.length} ready
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {ready.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-3 py-20">
                <span className="text-4xl opacity-40">✓</span>
                <p className="text-sm">No orders awaiting pickup</p>
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
      href={`/staff/${storeId}/orders/${order.id}`}
      className="block rounded-2xl p-4"
      style={{ background: 'rgba(46,168,255,0.07)', border: '1px solid rgba(46,168,255,0.25)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-3xl tracking-widest text-white">{order.pickupCode}</p>
          <p className="text-gray-400 text-sm mt-0.5">{order.customerName}</p>
        </div>
        <div className="text-right">
          <p className="text-brand font-bold text-xs uppercase tracking-widest">Ready</p>
          <p className="font-black text-white text-xl mt-1">
            {formatCents(order.finalTotal ?? order.estimatedTotal)}
          </p>
        </div>
      </div>
    </Link>
  )
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    authorized:     { label: 'New',         color: '#facc15' },
    picking:        { label: 'Picking',      color: '#2EA8FF' },
    ready:          { label: 'Ready',        color: '#2EA8FF' },
    partially_ready:{ label: 'Partial',      color: '#2EA8FF' },
    captured:       { label: 'Paid ✓',       color: '#4ade80' },
  }
  const c = cfg[status] ?? { label: status, color: '#6b7280' }
  return (
    <span className="badge text-xs font-bold"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: c.color }}>
      {c.label}
    </span>
  )
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
