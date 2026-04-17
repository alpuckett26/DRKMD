'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { useCart } from '@/context/CartContext'
import { formatCents } from '@/lib/utils'

declare global {
  interface Window {
    Square: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>
    }
  }
}

interface SquarePayments {
  card: (options?: object) => Promise<SquareCard>
}

interface SquareCard {
  attach: (selector: string) => Promise<void>
  tokenize: () => Promise<{ status: string; token?: string; errors?: unknown[] }>
  destroy: () => Promise<void>
}

export default function CheckoutPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const { items, total, substitutionPreference, clearCart } = useCart()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [squareReady, setSquareReady] = useState(false)
  const cardRef = useRef<SquareCard | null>(null)

  const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
  const squareSrc =
    process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js'

  async function initSquare() {
    if (!window.Square) return
    try {
      const payments = await window.Square.payments(appId, locationId)
      const card = await payments.card()
      await card.attach('#card-container')
      cardRef.current = card
      setSquareReady(true)
    } catch (e) {
      console.error('Square init error:', e)
      setError('Payment form failed to load. Please refresh.')
    }
  }

  if (items.length === 0) {
    router.replace(`/store/${storeId}`)
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cardRef.current || !squareReady) return
    if (!name.trim()) { setError('Please enter your name.'); return }

    setSubmitting(true)
    setError('')

    const tokenResult = await cardRef.current.tokenize()
    if (tokenResult.status !== 'OK' || !tokenResult.token) {
      setError('Card could not be processed. Please check your details.')
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        substitutionPreference,
        items: items.map(i => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
        paymentToken: tokenResult.token,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Order failed. Please try again.')
      setSubmitting(false)
      return
    }

    const order = await res.json()
    router.push(`/store/${storeId}/order/${order.id}`)
    clearCart()
  }

  return (
    <>
      <Script src={squareSrc} onLoad={initSquare} />

      <div className="min-h-screen pb-10">
        <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            <Link href={`/store/${storeId}/cart`} className="text-gray-400 text-2xl leading-none">‹</Link>
            <h1 className="font-bold text-lg">Checkout</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          {/* Contact */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">Your Info</h2>
            <input
              type="text"
              placeholder="Name *"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="input"
            />
            <input
              type="tel"
              placeholder="Phone (optional – for order updates)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="input"
            />
          </div>

          {/* Order summary */}
          <div className="card space-y-2">
            <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">Order Summary</h2>
            {items.map(i => (
              <div key={i.productId} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name} × {i.qty}</span>
                <span className="text-gray-300">{formatCents(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
              <span>Estimated Total</span>
              <span className="text-brand">{formatCents(total)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">Payment</h2>
            <p className="text-xs text-gray-500">
              A hold will be placed. You&apos;re only charged for items handed to you.
            </p>
            <div
              id="card-container"
              className="min-h-[80px] rounded-xl bg-gray-800 px-3 py-3"
            />
            {!squareReady && (
              <p className="text-xs text-gray-500 animate-pulse">Loading payment form…</p>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-900/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !squareReady}
            className="btn-primary"
          >
            {submitting ? 'Processing…' : `Place Order & Authorize ${formatCents(total)}`}
          </button>

          <p className="text-xs text-gray-600 text-center pb-6">
            By placing your order you agree to a payment hold. Unused funds are released automatically.
          </p>
        </form>
      </div>
    </>
  )
}
