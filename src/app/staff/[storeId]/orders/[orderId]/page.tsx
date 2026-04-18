'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCents, calcFinalTotal } from '@/lib/utils'

interface OrderItem {
  id: string
  requestedName: string
  requestedPrice: number
  qtyRequested: number
  qtyFound: number
  finalPrice: number | null
  status: string
  substitutionReason: string | null
  product?: { restrictedFlag: boolean } | null
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
  items: OrderItem[]
}

export default function PickingPage() {
  const { storeId, orderId } = useParams<{ storeId: string; orderId: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)

  async function fetchOrder() {
    const res = await fetch(`/api/orders/${orderId}`)
    if (res.ok) setOrder(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchOrder() }, [orderId])

  async function startPicking() {
    await fetch(`/api/orders/${orderId}/pick`, { method: 'POST' })
    fetchOrder()
  }

  async function markItem(itemId: string, status: string, qtyFound?: number) {
    await fetch(`/api/orders/${orderId}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, status, qtyFound: qtyFound ?? 0 }),
    })
    fetchOrder()
  }

  async function captureAndReady() {
    setCapturing(true)
    await fetch(`/api/orders/${orderId}/capture`, { method: 'POST' })
    fetchOrder()
    setCapturing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading…</p>
      </div>
    )
  }

  if (!order) return <p className="p-6 text-red-400">Order not found.</p>

  const allMarked = order.items.every(i => i.status !== 'requested')
  const canCapture = ['ready', 'partially_ready'].includes(order.status)
  const captured = ['captured', 'completed'].includes(order.status)
  const computedTotal = calcFinalTotal(order.items)

  return (
    <div className="min-h-screen pb-32">
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 text-2xl">‹</button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl text-brand tracking-widest">{order.pickupCode}</span>
              <span className="text-sm text-gray-400">— {order.customerName}</span>
            </div>
            <p className="text-xs text-gray-500">
              {order.substitutionPreference === 'allow_similar' ? '✓ Substitutions allowed' : '✗ No substitutions'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Start picking button */}
        {order.status === 'authorized' && (
          <button onClick={startPicking} className="btn-primary">
            Start Picking This Order
          </button>
        )}

        {/* Items list */}
        <div className="space-y-3">
          {order.items.map(item => (
            <div key={item.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.requestedName}</p>
                  <p className="text-sm text-gray-400">
                    Qty: {item.qtyRequested} • {formatCents(item.requestedPrice)} ea
                  </p>
                </div>
                <ItemStatusPill status={item.status} />
              </div>

              {order.status === 'picking' && item.status === 'requested' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => markItem(item.id, 'found', item.qtyRequested)}
                    className="bg-green-800 text-green-100 font-semibold py-2 rounded-xl text-sm active:bg-green-700"
                  >
                    ✓ Found
                  </button>
                  <button
                    onClick={() => markItem(item.id, 'unavailable', 0)}
                    className="bg-red-900 text-red-100 font-semibold py-2 rounded-xl text-sm active:bg-red-800"
                  >
                    ✗ Unavailable
                  </button>
                  {order.substitutionPreference === 'allow_similar' && (
                    <button
                      onClick={() => markItem(item.id, 'substituted', item.qtyRequested)}
                      className="bg-blue-900 text-blue-100 font-semibold py-2 rounded-xl text-sm active:bg-blue-800"
                    >
                      ↔ Substitute
                    </button>
                  )}
                  {item.product?.restrictedFlag && (
                    <button
                      onClick={() => markItem(item.id, 'refused_restricted', 0)}
                      className="bg-gray-700 text-gray-300 font-semibold py-2 rounded-xl text-sm active:bg-gray-600"
                    >
                      ⛔ Refused (ID)
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Final total preview */}
        {order.status === 'picking' && allMarked && (
          <div className="card border border-green-700/50">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Final Total to Capture</span>
              <span className="text-xl font-black text-brand">{formatCents(computedTotal)}</span>
            </div>
            {computedTotal === 0 && (
              <p className="text-xs text-gray-500 mt-2">All items unavailable — authorization will be voided.</p>
            )}
          </div>
        )}

        {/* Capture button */}
        {canCapture && !captured && (
          <button onClick={captureAndReady} disabled={capturing} className="btn-primary">
            {capturing ? 'Capturing payment…' : `Capture ${formatCents(computedTotal)} & Mark Ready`}
          </button>
        )}

        {captured && (
          <div className="card bg-green-900/30 border border-green-700/50 text-center space-y-3">
            <p className="text-green-400 font-bold">Payment Captured ✓</p>
            <p className="text-2xl font-black tracking-widest text-white">{order.pickupCode}</p>
            <p className="text-sm text-gray-400">Customer will show this code</p>
            <Link href={`/staff/${storeId}/handoff`} className="btn-primary block">
              Go to Handoff Screen →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function ItemStatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    requested: { label: 'Pending', cls: 'bg-gray-700 text-gray-300' },
    found: { label: '✓ Found', cls: 'bg-green-900 text-green-300' },
    unavailable: { label: '✗ Unavailable', cls: 'bg-red-900 text-red-300' },
    substituted: { label: '↔ Substituted', cls: 'bg-blue-900 text-blue-300' },
    refused_restricted: { label: '⛔ Refused', cls: 'bg-red-900 text-red-400' },
  }
  const c = cfg[status] ?? { label: status, cls: 'bg-gray-700 text-gray-400' }
  return <span className={`badge ${c.cls} flex-shrink-0`}>{c.label}</span>
}
