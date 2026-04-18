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
  pickupCode: string
  createdAt: string
  items: { id: string; status: string }[]
}

const ACTIVE_STATUSES = ['authorized', 'picking', 'ready', 'partially_ready', 'captured']

export default function StaffOrdersPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchOrders() {
    const res = await fetch(`/api/admin/stores/${storeId}/orders`)
    if (res.ok) setOrders(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
    const id = setInterval(fetchOrders, 10000)
    return () => clearInterval(id)
  }, [storeId])

  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const completed = orders.filter(o => !ACTIVE_STATUSES.includes(o.status)).slice(0, 10)

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/${storeId}`} className="text-gray-400 text-2xl leading-none">‹</Link>
            <div>
              <h1 className="font-bold text-lg">Incoming Orders</h1>
              <p className="text-xs text-gray-500 animate-pulse">Live • refreshes every 10s</p>
            </div>
          </div>
          <Link href={`/staff/${storeId}/handoff`} className="text-sm text-brand underline">
            Verify Handoff
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {loading && (
          <p className="text-center text-gray-500 animate-pulse pt-10">Loading orders…</p>
        )}

        {!loading && active.length === 0 && (
          <div className="card text-center text-gray-500 py-10">
            <p className="text-4xl mb-3">🪟</p>
            <p>No active orders</p>
          </div>
        )}

        {active.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Active ({active.length})
            </h2>
            {active.map(order => (
              <Link
                key={order.id}
                href={`/staff/${storeId}/orders/${order.id}`}
                className="card flex items-center justify-between hover:bg-gray-800 transition-colors gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xl tracking-widest text-brand">
                      {order.pickupCode}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-gray-300 mt-0.5">{order.customerName}</p>
                  <p className="text-xs text-gray-500">
                    {order.items.length} items • {formatCents(order.estimatedTotal)}
                  </p>
                </div>
                <span className="text-gray-500 text-xl flex-shrink-0">›</span>
              </Link>
            ))}
          </div>
        )}

        {completed.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
              Recent Completed
            </h2>
            {completed.map(order => (
              <Link
                key={order.id}
                href={`/staff/${storeId}/orders/${order.id}`}
                className="card flex items-center justify-between opacity-50 hover:opacity-70 transition-opacity gap-3"
              >
                <div>
                  <span className="font-bold tracking-widest">{order.pickupCode}</span>
                  <span className="ml-2 text-xs text-gray-500">{orderStatusLabel(order.status)}</span>
                </div>
                <span className="text-gray-600 text-lg flex-shrink-0">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    authorized: 'bg-yellow-900 text-yellow-300',
    picking: 'bg-blue-900 text-blue-300',
    ready: 'bg-green-900 text-green-300',
    partially_ready: 'bg-green-900 text-green-300',
    captured: 'bg-green-800 text-green-200',
    completed: 'bg-gray-700 text-gray-400',
    voided: 'bg-gray-800 text-gray-500',
    canceled: 'bg-red-900 text-red-400',
  }
  const cls = configs[status] ?? 'bg-gray-800 text-gray-400'
  return <span className={`badge ${cls}`}>{orderStatusLabel(status)}</span>
}
