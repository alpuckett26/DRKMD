'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatCents } from '@/lib/utils'

interface HandoffResult {
  id: string
  customerName: string
  pickupCode: string
  status: string
  finalTotal: number | null
  estimatedTotal: number
  items: { id: string; requestedName: string; status: string; qtyFound: number }[]
}

export default function HandoffPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [orderId, setOrderId] = useState('')
  const [result, setResult] = useState<HandoffResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function lookupOrder() {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    const res = await fetch(`/api/admin/stores/${storeId}/orders`)
    if (!res.ok) { setError('Failed to load orders.'); setLoading(false); return }

    const orders: HandoffResult[] = await res.json()
    const match = orders.find(
      o => o.pickupCode === code.trim() && ['captured', 'ready', 'partially_ready'].includes(o.status),
    )

    if (!match) {
      setError('No ready order found with that code.')
      setLoading(false)
      return
    }

    setResult(match)
    setOrderId(match.id)
    setLoading(false)
  }

  async function confirmHandoff() {
    const res = await fetch(`/api/orders/${orderId}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickupCode: code }),
    })
    if (res.ok) {
      setConfirmed(true)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Handoff failed.')
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <div className="panel sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 text-2xl">‹</button>
          <h1 className="font-bold text-lg">Verify Handoff</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {!confirmed ? (
          <>
            <div className="card space-y-3">
              <p className="text-sm text-gray-400">Enter the customer&apos;s 6-digit pickup code:</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="123456"
                value={code}
                onChange={e => { setCode(e.target.value); setResult(null); setError('') }}
                className="input text-center text-3xl font-black tracking-widest"
              />
              <button
                onClick={lookupOrder}
                disabled={loading || code.length < 6}
                className="btn-primary"
              >
                {loading ? 'Looking up…' : 'Find Order'}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-900/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            {result && (
              <div className="card border border-green-700/50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-green-400">Order Found ✓</p>
                  <span className="font-black text-xl text-brand">{result.pickupCode}</span>
                </div>
                <p className="text-sm text-gray-300">{result.customerName}</p>
                <div className="space-y-1">
                  {result.items.filter(i => i.status === 'found' || i.status === 'substituted').map(i => (
                    <div key={i.id} className="flex justify-between text-sm">
                      <span className="text-gray-300">{i.requestedName} × {i.qtyFound}</span>
                      <span className="text-green-400">✓</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
                  <span>Total Charged</span>
                  <span className="text-brand">{formatCents(result.finalTotal ?? result.estimatedTotal)}</span>
                </div>
                <button onClick={confirmHandoff} className="btn-primary bg-green-700 hover:bg-green-600">
                  ✓ Confirm Handoff – Complete Order
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card text-center space-y-4 py-8">
            <p className="text-5xl">✅</p>
            <p className="text-xl font-bold text-green-400">Handoff Complete</p>
            <p className="text-gray-400">Order {code} marked as completed.</p>
            <button
              onClick={() => { setConfirmed(false); setCode(''); setResult(null); setOrderId('') }}
              className="btn-secondary"
            >
              New Handoff
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
