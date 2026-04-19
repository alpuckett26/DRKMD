'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { useCart } from '@/context/CartContext'
import { formatCents, calcServiceFee } from '@/lib/utils'
import type { ProductInfo } from '@/types'

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

const CAT_ICON: Record<string, string> = {
  'Drinks': '🥤', 'Energy': '⚡', 'Coffee & Tea': '☕',
  'Beer': '🍺', 'Wine & Spirits': '🍷',
  'Snacks': '🍿', 'Candy & Chocolate': '🍬',
  'Food': '🌮', 'Health': '💊', 'Health & Beauty': '🧴',
  'Tobacco': '🚬', 'Electronics': '🔋',
  'Household': '🏠', 'Baby': '👶', 'General': '🛒',
}

function ImpulseBuySection({ storeId }: { storeId: string }) {
  const { items, addItem } = useCart()
  const [promoted, setPromoted] = useState<ProductInfo[]>([])

  useEffect(() => {
    fetch(`/api/stores/${storeId}/menu`)
      .then(r => r.json())
      .then((all: ProductInfo[]) => {
        const cartIds = new Set(items.map(i => i.productId))
        setPromoted(all.filter(p => p.promoted && p.price > 0 && !cartIds.has(p.id)).slice(0, 5))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  if (promoted.length === 0) return null

  return (
    <div className="card overflow-hidden !p-0">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <span>⚡</span>
        <p className="font-black text-sm uppercase tracking-widest text-gray-700">Add to your order</p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4" style={{ scrollbarWidth: 'none' }}>
        {promoted.map(product => (
          <button
            key={product.id}
            onClick={() => addItem({ productId: product.id, name: product.name, price: product.price, restricted: product.restrictedFlag })}
            className="product-card shrink-0 w-28 text-left active:scale-95 transition-transform"
          >
            <div className="relative aspect-square bg-gray-50">
              {product.imageUrl ? (
                <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-1.5" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  {CAT_ICON[product.category ?? ''] ?? '🛒'}
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1">{product.name}</p>
              <p className="text-gray-900 font-black text-xs">{formatCents(product.price)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const { items, total, substitutionPreference, clearCart } = useCart()
  const isDemo = storeId === 'store_demo'
  const serviceFee = calcServiceFee(total)
  const grandTotal = total + serviceFee

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
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

  if (items.length === 0 && !submitted) {
    router.replace(`/store/${storeId}`)
    return null
  }

  async function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your name.'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        substitutionPreference,
        items: items.map(i => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty })),
        paymentToken: 'demo',
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Order failed.')
      setSubmitting(false)
      return
    }
    const order = await res.json()
    setSubmitted(true)
    clearCart()
    router.push(`/store/${storeId}/order/${order.id}`)
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
    setSubmitted(true)
    clearCart()
    router.push(`/store/${storeId}/order/${order.id}`)
  }

  if (isDemo) {
    return (
      <div className="min-h-screen pb-10">
        <div className="panel sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            <Link href={`/store/${storeId}/cart`} className="text-gray-500 text-2xl leading-none">‹</Link>
            <h1 className="font-bold text-lg">Checkout</h1>
          </div>
        </div>
        <form onSubmit={handleDemoSubmit} className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Your Info</h2>
            <input type="text" placeholder="Name *" value={name} onChange={e => setName(e.target.value)} required className="input" />
            <input type="tel" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} className="input" />
          </div>
          <div className="card space-y-2">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Order Summary</h2>
            {items.map(i => (
              <div key={i.productId} className="flex justify-between text-sm">
                <span className="text-gray-700">{i.name} × {i.qty}</span>
                <span className="text-gray-700">{formatCents(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-2 space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatCents(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Convenience Fee (12.5%)</span>
                <span>{formatCents(serviceFee)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-gray-700">
                <span>Estimated Total</span>
                <span className="text-brand">{formatCents(grandTotal)}</span>
              </div>
            </div>
          </div>

          <ImpulseBuySection storeId={storeId} />

          <div className="card space-y-2 border border-yellow-800/50">
            <p className="text-yellow-400 text-xs font-semibold">🎭 Demo Mode — no payment required</p>
            <p className="text-gray-500 text-xs">Orders flow through the full fulfillment process without charging a card.</p>
          </div>
          {error && <p className="text-red-600 text-sm text-center bg-red-600/20 rounded-xl px-4 py-3">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Placing order…' : `Place Demo Order – ${formatCents(grandTotal)}`}
          </button>
        </form>
      </div>
    )
  }

  return (
    <>
      <Script src={squareSrc} onLoad={initSquare} />

      <div className="min-h-screen pb-10">
        <div className="panel sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            <Link href={`/store/${storeId}/cart`} className="text-gray-500 text-2xl leading-none">‹</Link>
            <h1 className="font-bold text-lg">Checkout</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          {/* Contact */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Your Info</h2>
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
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Order Summary</h2>
            {items.map(i => (
              <div key={i.productId} className="flex justify-between text-sm">
                <span className="text-gray-700">{i.name} × {i.qty}</span>
                <span className="text-gray-700">{formatCents(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-2 space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatCents(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Convenience Fee (12.5%)</span>
                <span>{formatCents(serviceFee)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-gray-700">
                <span>Estimated Total</span>
                <span className="text-brand">{formatCents(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Impulse upsells */}
          <ImpulseBuySection storeId={storeId} />

          {/* Payment */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Payment</h2>
            <p className="text-xs text-gray-500">
              A hold will be placed. You&apos;re only charged for items handed to you.
            </p>
            <div
              id="card-container"
              className="min-h-[80px] rounded-xl bg-gray-100 px-3 py-3"
            />
            {!squareReady && (
              <p className="text-xs text-gray-500 animate-pulse">Loading payment form…</p>
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center bg-red-600/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !squareReady}
            className="btn-primary"
          >
            {submitting ? 'Processing…' : `Place Order & Authorize ${formatCents(grandTotal)}`}
          </button>

          <p className="text-xs text-gray-600 text-center pb-6">
            By placing your order you agree to a payment hold. Unused funds are released automatically.
          </p>
        </form>
      </div>
    </>
  )
}
