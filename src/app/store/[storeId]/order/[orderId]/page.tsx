'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatCents, orderStatusLabel } from '@/lib/utils'
import type { OrderSummary } from '@/types'

const POLL_INTERVAL = 5000

const statusColor: Record<string, string> = {
  submitted: 'text-yellow-400',
  authorized: 'text-yellow-400',
  picking: 'text-blue-400',
  ready: 'text-green-400',
  partially_ready: 'text-green-400',
  captured: 'text-green-400',
  completed: 'text-green-500',
  voided: 'text-gray-400',
  canceled: 'text-red-400',
}

export default function OrderStatusPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchOrder() {
    const res = await fetch(`/api/orders/${orderId}`)
    if (res.ok) setOrder(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchOrder()
    const interval = setInterval(fetchOrder, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading order…</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">Order not found.</p>
      </div>
    )
  }

  const isReady = ['ready', 'partially_ready', 'captured', 'completed'].includes(order.status)
  const isDone = order.status === 'completed'

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="font-black text-lg text-brand">WINDOW MODE</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {/* Status */}
        <div className="card text-center space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Order Status</p>
          <p className={`text-2xl font-black ${statusColor[order.status] ?? 'text-white'}`}>
            {orderStatusLabel(order.status)}
          </p>
          {!isDone && (
            <p className="text-xs text-gray-600 animate-pulse">Auto-refreshing every 5 seconds</p>
          )}
        </div>

        {/* Pickup code */}
        {isReady && (
          <div className="card text-center space-y-3 border border-green-700/50">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Show this at the window</p>
            <p className="text-5xl font-black tracking-widest text-white">{order.pickupCode}</p>
            {order.pickupCodeQr && (
              <img
                src={order.pickupCodeQr}
                alt="QR pickup code"
                className="w-40 h-40 mx-auto rounded-xl"
              />
            )}
          </div>
        )}

        {!isReady && order.status !== 'voided' && (
          <div className="card text-center space-y-2">
            <p className="text-xs text-gray-500">Your pickup code (save it)</p>
            <p className="text-3xl font-black tracking-widest text-gray-500">{order.pickupCode}</p>
          </div>
        )}

        {/* Voided notice */}
        {order.status === 'voided' && (
          <div className="card bg-gray-800 text-center text-gray-400 space-y-1">
            <p className="font-bold">No items available</p>
            <p className="text-sm">Your payment hold has been released. No charge.</p>
          </div>
        )}

        {/* Items */}
        <div className="card space-y-2">
          <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">Items</h2>
          {order.items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex-1">
                <span className="text-gray-200">{item.requestedName}</span>
                <span className="text-gray-500 ml-1">× {item.qtyRequested}</span>
              </div>
              <ItemStatusBadge status={item.status} />
              <span className="text-gray-300 text-right">
                {formatCents(item.requestedPrice * item.qtyRequested)}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="card flex justify-between items-center">
          <span className="text-gray-400 text-sm">
            {order.finalTotal != null ? 'Final Total' : 'Estimated Total'}
          </span>
          <span className="text-xl font-black text-brand">
            {formatCents(order.finalTotal ?? order.estimatedTotal)}
          </span>
        </div>

        {isDone && (
          <div className="card bg-green-900/30 border border-green-700/50 text-center text-green-300 text-sm">
            ✓ Order complete. Thank you!
          </div>
        )}
      </div>
    </div>
  )
}

function ItemStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    requested: { label: 'Pending', className: 'bg-gray-800 text-gray-400' },
    found: { label: '✓ Found', className: 'bg-green-900 text-green-400' },
    unavailable: { label: '✗ Out of stock', className: 'bg-red-900 text-red-400' },
    substituted: { label: '↔ Substituted', className: 'bg-blue-900 text-blue-400' },
    refused_restricted: { label: '⛔ ID Required', className: 'bg-red-900 text-red-500' },
  }
  const cfg = configs[status] ?? { label: status, className: 'bg-gray-800 text-gray-400' }
  return <span className={`badge ${cfg.className} text-nowrap`}>{cfg.label}</span>
}
