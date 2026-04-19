'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCents, orderStatusLabel } from '@/lib/utils'

interface Order {
  id: string
  customerName: string
  status: string
  estimatedTotal: number
  finalTotal: number | null
  pickupCode: string
  createdAt: string
  items: { id: string }[]
}

export default function AdminOrdersPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const url = filter === 'all'
      ? `/api/admin/stores/${storeId}/orders`
      : `/api/admin/stores/${storeId}/orders?status=${filter}`
    fetch(url)
      .then(r => r.json())
      .then(data => { setOrders(data); setLoading(false) })
  }, [storeId, filter])

  const statuses = ['all', 'authorized', 'picking', 'ready', 'captured', 'completed', 'voided', 'canceled']

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/admin/${storeId}`} className="text-gray-500 text-2xl">‹</Link>
          <h1 className="font-bold text-lg">Orders</h1>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filter === s ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {s === 'all' ? 'All' : orderStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-2">
        {loading && <p className="text-center text-gray-500 animate-pulse pt-10">Loading…</p>}
        {!loading && orders.length === 0 && <p className="text-center text-gray-500 pt-10">No orders found.</p>}
        {orders.map(order => (
          <Link
            key={order.id}
            href={`/staff/${storeId}/orders/${order.id}`}
            className="card flex items-center justify-between gap-3 hover:bg-gray-100 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black tracking-widest text-brand">{order.pickupCode}</span>
                <span className="text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-700">{order.customerName} • {order.items.length} items</p>
              <p className="text-xs text-gray-500">
                {order.finalTotal != null ? `Final: ${formatCents(order.finalTotal)}` : `Est: ${formatCents(order.estimatedTotal)}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-gray-500">{orderStatusLabel(order.status)}</span>
              <span className="text-gray-600 text-lg">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
