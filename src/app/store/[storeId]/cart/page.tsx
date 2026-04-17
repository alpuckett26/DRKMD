'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { formatCents } from '@/lib/utils'

export default function CartPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const { items, updateQty, removeItem, substitutionPreference, setSubstitutionPreference, total } = useCart()

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-gray-400">Your cart is empty.</p>
        <Link href={`/store/${storeId}`} className="btn-primary max-w-xs">
          Browse Menu
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/store/${storeId}`} className="text-gray-400 text-2xl leading-none">‹</Link>
          <h1 className="font-bold text-lg">Your Cart</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Items */}
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.productId} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{item.name}</p>
                <p className="text-brand text-sm font-bold">{formatCents(item.price)} ea</p>
                {item.restricted && (
                  <p className="text-xs text-red-400 mt-0.5">Age-restricted item</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => updateQty(item.productId, item.qty - 1)}
                  className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold">{item.qty}</span>
                <button
                  onClick={() => updateQty(item.productId, item.qty + 1)}
                  className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => removeItem(item.productId)}
                className="text-gray-600 text-xl ml-1 flex-shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Substitution preference */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-sm">If an item is unavailable:</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="sub"
              value="none"
              checked={substitutionPreference === 'none'}
              onChange={() => setSubstitutionPreference('none')}
              className="mt-1 accent-brand"
            />
            <div>
              <p className="text-sm font-medium">No substitutions</p>
              <p className="text-xs text-gray-500">Remove unavailable items, adjust total</p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="sub"
              value="allow_similar"
              checked={substitutionPreference === 'allow_similar'}
              onChange={() => setSubstitutionPreference('allow_similar')}
              className="mt-1 accent-brand"
            />
            <div>
              <p className="text-sm font-medium">Allow similar substitutions</p>
              <p className="text-xs text-gray-500">Staff may swap for a similar item</p>
            </div>
          </label>
        </div>

        {/* Order note */}
        <div className="card bg-yellow-900/30 border border-yellow-700/50 text-xs text-yellow-300 leading-relaxed">
          Estimated total shown. A temporary hold will be placed on your card. You will only be charged for items we confirm and hand to you.
        </div>

        {/* Total */}
        <div className="card flex justify-between items-center">
          <span className="text-gray-400 text-sm">Estimated Total</span>
          <span className="text-xl font-black text-brand">{formatCents(total)}</span>
        </div>
      </div>

      {/* Checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-950 border-t border-gray-800">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => router.push(`/store/${storeId}/checkout`)}
            className="btn-primary"
          >
            Continue to Checkout → {formatCents(total)}
          </button>
        </div>
      </div>
    </div>
  )
}
