'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MediaAsset } from '@/components/MediaAsset'
import { useCart } from '@/context/CartContext'
import { formatCents } from '@/lib/utils'
import type { ProductInfo, StoreInfo } from '@/types'
import type { UpcDetail } from '@/app/api/upc-lookup/route'

const CAT_ICON: Record<string, string> = {
  // Drinks family
  'Drinks': '🥤', 'Soft Drinks': '🥤', 'Water': '💧', 'Juice': '🧃',
  'Energy': '⚡', 'Energy Drinks': '⚡', 'Sports Drinks': '🧃',
  'Coffee': '☕', 'Coffee & Tea': '☕', 'Tea': '🍵',
  // Alcohol (legacy + new)
  'Beer': '🍺', 'Wine & Spirits': '🍷', 'Wine': '🍷', 'Spirits': '🥃',
  // Snacks family
  'Snacks': '🍿', 'Chips': '🍟', 'Nuts': '🥜', 'Meat Snacks': '🥓',
  'Candy & Chocolate': '🍬', 'Candy': '🍬', 'Chocolate': '🍫',
  'Bars': '🍫', 'Pastry': '🥐',
  // Food
  'Food': '🌮', 'Hot Food': '🌭',
  // Health/Beauty
  'Health': '💊', 'Pain Relief': '💊', 'Stomach': '🩹', 'Sleep': '💤',
  'Health & Beauty': '🧴', 'Personal Care': '🧴',
  // Tobacco family
  'Tobacco': '🚬', 'Cigarettes': '🚬', 'Cigars': '🚬',
  'Smokeless': '🌿', 'Vape': '💨', 'Nicotine Pouches': '🧃',
  'Accessories': '🔥',
  // Misc
  'Electronics': '🔋', 'Household': '🏠', 'Baby': '👶', 'General': '🛒',
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good evening'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function MenuPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const { addItem, items, itemCount, total } = useCart()
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const searchRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/stores/${storeId}`).then(r => r.json()),
      fetch(`/api/stores/${storeId}/menu`).then(r => r.json()),
    ]).then(([s, p]) => { setStore(s); setProducts(p); setLoading(false) })
  }, [storeId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const searchSuggestions = search.length > 0
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category ?? '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : []

  const promoted = products.filter(p => p.promoted && p.price > 0)
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category ?? 'Other')))]

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.category ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'All' || (p.category ?? 'Other') === activeCategory
    return matchSearch && matchCat
  })

  const grouped = filtered.reduce<Record<string, ProductInfo[]>>((acc, p) => {
    const cat = p.category ?? 'Other'
    acc[cat] = acc[cat] ? [...acc[cat], p] : [p]
    return acc
  }, {})

  function scrollToCategory(cat: string) {
    setActiveCategory(cat)
    setSearch('')
    if (cat === 'All') { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setTimeout(() => catRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="panel sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {(store as StoreInfo & { logoUrl?: string })?.logoUrl ? (
                <Image
                  src={(store as StoreInfo & { logoUrl?: string }).logoUrl!}
                  alt="Store"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-xl object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center text-xl">🏪</div>
              )}
              <div>
                <h1 className="font-black text-base leading-tight">{store?.name}</h1>
                <p className="text-xs text-gray-500">Tap items • Pay at checkout • Show code at window</p>
              </div>
            </div>
            {storeId === 'store_demo' || store?.windowModeEnabled
              ? <span className="badge bg-green-100 text-green-700 text-xs shrink-0">● OPEN</span>
              : <span className="badge bg-red-100 text-red-700 text-xs shrink-0">● CLOSED</span>
            }
          </div>

          {/* Search */}
          <div className="relative mb-2" ref={searchRef}>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm z-10">🔍</span>
            <input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveCategory('All') }}
              onFocus={() => setSearchFocused(true)}
              className="input pl-9 py-2.5 text-sm"
            />

            {/* Predictive suggestions dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden z-50 bg-white border border-gray-200"
                style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}
              >
                {searchSuggestions.map(p => (
                  <SearchSuggestionRow
                    key={p.id}
                    product={p}
                    qty={items.find(i => i.productId === p.id)?.qty ?? 0}
                    onAdd={() => { addItem({ productId: p.id, name: p.name, price: p.price, restricted: p.restrictedFlag }); setSearchFocused(false) }}
                    onOpen={() => { setSelectedProduct(p); setSearchFocused(false); setSearch('') }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category chips */}
        {!search && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`cat-pill shrink-0${activeCategory === cat ? ' active' : ''}`}
              >
                {cat !== 'All' && <span className="text-base">{CAT_ICON[cat] ?? '🛒'}</span>} {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hero banner */}
      {!search && activeCategory === 'All' && (store as StoreInfo & { logoUrl?: string })?.logoUrl && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: '42vw', maxHeight: 220 }}>
            <MediaAsset
              src={(store as StoreInfo & { logoUrl?: string }).logoUrl!}
              alt={store?.name ?? ''}
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        {/* Greeting */}
        {!search && activeCategory === 'All' && (
          <div>
            <h2 className="text-2xl font-black text-gray-900">{greeting()}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Browse the shelf and we&apos;ll have it ready at the window.</p>
          </div>
        )}

        {/* Quick category pills (DoorDash-style cuisine row) */}
        {!search && activeCategory === 'All' && categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.slice(1, 9).map(cat => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className="cat-pill shrink-0"
              >
                <span className="text-base">{CAT_ICON[cat] ?? '🛒'}</span>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Hot Picks impulse strip */}
        {promoted.length > 0 && !search && activeCategory === 'All' && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚡</span>
              <h2 className="font-black text-sm uppercase tracking-widest text-gray-700">Hot Picks</h2>
              <span className="text-xs text-brand font-semibold">Staff favorites</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {promoted.map(product => (
                <ImpulseCard
                  key={product.id}
                  product={product}
                  qty={items.find(i => i.productId === product.id)?.qty ?? 0}
                  onAdd={() => addItem({ productId: product.id, name: product.name, price: product.price, restricted: product.restrictedFlag })}
                  onOpen={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Product grid */}
        {Object.keys(grouped).length === 0 && (
          <p className="text-center text-gray-500 pt-16">No products found.</p>
        )}

        {Object.entries(grouped).map(([category, catProducts]) => (
          <div key={category} ref={el => { catRefs.current[category] = el }} style={{ scrollMarginTop: '175px' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{CAT_ICON[category] ?? '🛒'}</span>
              <h2 className="font-black text-sm uppercase tracking-widest text-gray-700">{category}</h2>
              <span className="text-xs text-gray-600">({catProducts.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {catProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  qty={items.find(i => i.productId === product.id)?.qty ?? 0}
                  onAdd={() => addItem({ productId: product.id, name: product.name, price: product.price, restricted: product.restrictedFlag })}
                  onOpen={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-30 panel">
          <div className="max-w-lg mx-auto">
            <Link href={`/store/${storeId}/cart`} className="btn-primary flex items-center justify-between">
              <span className="bg-brand-dark/60 rounded-lg px-2 py-0.5 text-sm font-bold">{itemCount}</span>
              <span>View Cart</span>
              <span>{formatCents(total)}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Product detail sheet */}
      {selectedProduct && (
        <ProductDetailSheet
          product={selectedProduct}
          qty={items.find(i => i.productId === selectedProduct.id)?.qty ?? 0}
          onAdd={() => addItem({ productId: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, restricted: selectedProduct.restrictedFlag })}
          onClose={() => setSelectedProduct(null)}
          allProducts={products}
          onSelectVariety={p => setSelectedProduct(p)}
        />
      )}
    </div>
  )
}

function SearchSuggestionRow({ product, qty, onAdd, onOpen }: { product: ProductInfo; qty: number; onAdd: () => void; onOpen: () => void }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors active:bg-gray-50 hover:bg-gray-50"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center relative shrink-0">
        {product.imageUrl && !imgError ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-1" unoptimized onError={() => setImgError(true)} />
        ) : (
          <span className="text-xl">{CAT_ICON[product.category ?? ''] ?? '🛒'}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{product.name}</p>
        <p className="text-xs text-gray-500 truncate">{product.category ?? 'General'}{product.restrictedFlag ? ' · 21+' : ''}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-gray-900 font-black text-sm">{formatCents(product.price)}</span>
        <AddBtn qty={qty} onAdd={onAdd} />
      </div>
    </div>
  )
}

function VarietyChip({ product, onSelect }: { product: ProductInfo; onSelect: () => void }) {
  const [imgError, setImgError] = useState(false)
  return (
    <button
      onClick={onSelect}
      className="shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl text-center active:scale-95 transition-transform bg-gray-50 border border-gray-200 hover:bg-gray-100"
      style={{ minWidth: 80, maxWidth: 96 }}
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center relative shrink-0">
        {product.imageUrl && !imgError ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-1" unoptimized onError={() => setImgError(true)} />
        ) : (
          <span className="text-2xl">{CAT_ICON[product.category ?? ''] ?? '🛒'}</span>
        )}
      </div>
      <p className="text-xs font-semibold leading-tight line-clamp-2 w-full">{product.name}</p>
      <span className="text-gray-900 text-xs font-black">{formatCents(product.price)}</span>
    </button>
  )
}

function ImpulseCard({ product, qty, onAdd, onOpen }: { product: ProductInfo; qty: number; onAdd: () => void; onOpen: () => void }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      onClick={onOpen}
      className="product-card shrink-0 w-36 cursor-pointer active:scale-95 transition-transform"
    >
      <div className="relative aspect-square bg-gray-50">
        {product.imageUrl && !imgError ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" unoptimized onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {CAT_ICON[product.category ?? ''] ?? '🛒'}
          </div>
        )}
        {qty > 0 && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">{qty}</span>
        )}
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        <p className="text-xs font-semibold leading-snug line-clamp-2">{product.name}</p>
        <div className="flex items-center justify-between">
          <span className="text-gray-900 font-black text-sm">{formatCents(product.price)}</span>
          <AddBtn qty={qty} onAdd={onAdd} />
        </div>
      </div>
    </div>
  )
}

function AddBtn({ qty, onAdd }: { qty: number; onAdd: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onAdd() }}
      className={`w-8 h-8 rounded-full font-bold text-base flex items-center justify-center transition-colors shrink-0 ${
        qty > 0 ? 'bg-brand text-white' : 'bg-gray-100 text-gray-900 hover:bg-white/20 border border-gray-300'
      }`}
    >
      {qty > 0 ? qty : '+'}
    </button>
  )
}

function ProductCard({ product, qty, onAdd, onOpen }: { product: ProductInfo; qty: number; onAdd: () => void; onOpen: () => void }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div onClick={onOpen} className="product-card cursor-pointer active:scale-95 transition-transform">
      {/* 4:3 image area — 33% taller than before */}
      <div className="relative w-full bg-gray-100" style={{ paddingBottom: '75%' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {product.imageUrl && !imgError ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" unoptimized onError={() => setImgError(true)} />
          ) : (
            <span className="text-5xl">{CAT_ICON[product.category ?? ''] ?? '🛒'}</span>
          )}
        </div>
        {product.restrictedFlag && (
          <span className="absolute top-2 left-2 badge bg-red-600/80 text-white text-xs backdrop-blur-sm">21+</span>
        )}
        {product.promoted && (
          <span className="absolute top-2 right-2 text-base">⚡</span>
        )}
        {qty > 0 && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">{qty}</span>
        )}
      </div>
      <div className="p-2.5 flex flex-col flex-1 justify-between gap-2">
        <p className="text-xs font-semibold leading-snug line-clamp-2">{product.name}</p>
        <div className="flex items-center justify-between gap-1">
          <span className="text-gray-900 font-black text-sm">{formatCents(product.price)}</span>
          <AddBtn qty={qty} onAdd={onAdd} />
        </div>
      </div>
    </div>
  )
}

function getVarieties(product: ProductInfo, allProducts: ProductInfo[]): ProductInfo[] {
  const firstWord = product.name.split(/\s+/)[0].toLowerCase()
  if (firstWord.length < 3) return []
  return allProducts.filter(p => p.id !== product.id && p.name.toLowerCase().startsWith(firstWord))
}

function ProductDetailSheet({
  product,
  qty,
  onAdd,
  onClose,
  allProducts,
  onSelectVariety,
}: {
  product: ProductInfo
  qty: number
  onAdd: () => void
  onClose: () => void
  allProducts: ProductInfo[]
  onSelectVariety: (p: ProductInfo) => void
}) {
  const [detail, setDetail] = useState<UpcDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [imgError, setImgError] = useState(false)
  const varieties = getVarieties(product, allProducts)

  useEffect(() => {
    setLoadingDetail(true)
    setDetail(null)
    setImgError(false)
    fetch(`/api/upc-lookup?name=${encodeURIComponent(product.name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setDetail(d); setLoadingDetail(false) })
      .catch(() => setLoadingDetail(false))
  }, [product.id])

  const displayImage = detail?.image ?? product.imageUrl
  const brand = detail?.brand
  const description = detail?.description
  const size = detail?.size

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-white rounded-t-3xl"
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Image */}
        <div
          className="mx-4 mt-2 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center relative"
          style={{ height: 220 }}
        >
          {displayImage && !imgError ? (
            <Image
              src={displayImage}
              alt={product.name}
              fill
              className="object-contain p-4"
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-7xl">{CAT_ICON[product.category ?? ''] ?? '🛒'}</span>
          )}
          {product.restrictedFlag && (
            <span className="absolute top-3 left-3 badge bg-red-100 text-red-700">21+ ID Required</span>
          )}
        </div>

        {/* Info */}
        <div className="px-4 pt-4 pb-6 space-y-4">
          {/* Name + price */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="font-black text-xl leading-tight">{product.name}</h2>
              {brand && <p className="text-sm text-gray-500 mt-0.5">{brand}{size ? ` · ${size}` : ''}</p>}
            </div>
            <span className="text-brand font-black text-2xl shrink-0">{formatCents(product.price)}</span>
          </div>

          {/* Description */}
          {loadingDetail && (
            <p className="text-sm text-gray-600 animate-pulse">Loading product info…</p>
          )}
          {description && (
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
          )}

          {/* Category tag */}
          {product.category && (
            <div className="flex items-center gap-2">
              <span className="text-lg">{CAT_ICON[product.category] ?? '🛒'}</span>
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{product.category}</span>
            </div>
          )}

          {/* Varieties */}
          {varieties.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">More varieties</p>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {varieties.map(v => (
                  <VarietyChip key={v.id} product={v} onSelect={() => onSelectVariety(v)} />
                ))}
              </div>
            </div>
          )}

          {/* Add to cart */}
          <button
            onClick={() => { onAdd(); onClose() }}
            className="btn-primary w-full flex items-center justify-between px-6"
          >
            <span className="text-base font-black">Add to Cart</span>
            <span className="text-base font-black">{formatCents(product.price)}</span>
          </button>

          {qty > 0 && (
            <p className="text-center text-xs text-gray-500">{qty} already in your cart</p>
          )}
        </div>
      </div>
    </>
  )
}
