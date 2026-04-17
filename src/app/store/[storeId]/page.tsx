'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { formatCents } from '@/lib/utils'
import type { ProductInfo, StoreInfo } from '@/types'

type GroupedProducts = Record<string, ProductInfo[]>

export default function MenuPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [loading, setLoading] = useState(true)
  const { addItem, items, itemCount, total } = useCart()

  useEffect(() => {
    Promise.all([
      fetch(`/api/stores/${storeId}`).then(r => r.json()),
      fetch(`/api/stores/${storeId}/menu`).then(r => r.json()),
    ]).then(([s, p]) => {
      setStore(s)
      setProducts(p)
      setLoading(false)
    })
  }, [storeId])

  const grouped = products.reduce<GroupedProducts>((acc, p) => {
    const cat = p.category ?? 'Other'
    acc[cat] = acc[cat] ? [...acc[cat], p] : [p]
    return acc
  }, {})

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading menu…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-black text-lg text-brand">WINDOW MODE</h1>
              <p className="text-xs text-gray-400">{store?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-green-900 text-green-400">● OPEN</span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        <p className="text-xs text-gray-500 text-center">
          Tap items to add • Pay at checkout • Show code at window
        </p>

        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              {category}
            </h2>
            <div className="space-y-2">
              {items.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  qty={useCartQty(items, product.id)}
                  onAdd={() =>
                    addItem({
                      productId: product.id,
                      name: product.name,
                      price: product.price,
                      restricted: product.restrictedFlag,
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-950 border-t border-gray-800">
          <div className="max-w-lg mx-auto">
            <Link
              href={`/store/${storeId}/cart`}
              className="btn-primary flex items-center justify-between"
            >
              <span className="bg-brand-dark rounded-lg px-2 py-0.5 text-sm font-bold">
                {itemCount}
              </span>
              <span>View Cart</span>
              <span>{formatCents(total)}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function useCartQty(cartItems: ProductInfo[], productId: string): number {
  const { items } = useCart()
  return items.find(i => i.productId === productId)?.qty ?? 0
}

function ProductCard({
  product,
  qty,
  onAdd,
}: {
  product: ProductInfo
  qty: number
  onAdd: () => void
}) {
  return (
    <div className="card flex items-center gap-3">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-gray-800 flex-shrink-0 flex items-center justify-center text-2xl">
          🛒
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">{product.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-brand font-bold text-sm">{formatCents(product.price)}</span>
          {product.restrictedFlag && (
            <span className="badge bg-red-900 text-red-400">21+</span>
          )}
        </div>
      </div>
      <button
        onClick={onAdd}
        className="w-9 h-9 rounded-full bg-brand text-white font-bold text-xl flex items-center justify-center active:bg-brand-dark flex-shrink-0"
      >
        {qty > 0 ? qty : '+'}
      </button>
    </div>
  )
}
