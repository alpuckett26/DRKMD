'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MediaAsset } from '@/components/MediaAsset'

interface StoreCard {
  id: string
  name: string
  city: string | null
  state: string | null
  logoUrl: string | null
  windowModeEnabled: boolean
}

export default function Home() {
  const [stores, setStores] = useState<StoreCard[]>([])
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [locationLabel, setLocationLabel] = useState('Pick your store')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/stores')
      .then(r => r.json())
      .then((s: StoreCard[]) => { setStores(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      () => { setLocationLabel('Current location'); setLocating(false) },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  return (
    <main className="min-h-screen pb-36">
      {/* Top bar */}
      <header className="panel sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Window pickup near</p>
            <button onClick={useMyLocation} className="flex items-center gap-1.5 font-bold text-base">
              {locating ? 'Locating…' : locationLabel}
              <span className="text-gray-500 text-xs">▾</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/staff" className="icon-btn text-sm" aria-label="Staff">🧑‍💼</Link>
            <Link href="/login" className="icon-btn text-sm" aria-label="Admin">🔑</Link>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-black text-gray-900">{greeting()}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Order from a locked, safe window shop near you.</p>
        </div>

        {/* Top category chip row (DoorDash-style) */}
        <div className="flex gap-5 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {TOP_CATS.map(c => (
            <button key={c.label} className="cat-chip shrink-0">
              <span className="cat-chip-icon text-2xl">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {/* Featured promos (sponsored-style banner — replace src with video URLs) */}
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
          {FEATURED_PROMOS.map(promo => (
            <div key={promo.id} className="snap-start shrink-0 w-[88%] rounded-2xl overflow-hidden bg-gray-100 relative" style={{ aspectRatio: '16 / 9' }}>
              {promo.media ? (
                <MediaAsset src={promo.media} alt={promo.title} className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand/30 via-transparent to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-[11px] font-semibold text-white/90 uppercase tracking-widest">{promo.tag}</p>
                <p className="text-xl font-black text-white leading-tight mt-0.5">{promo.title}</p>
                <p className="text-xs text-white/90 mt-0.5">{promo.subtitle}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stores list */}
        <div>
          <div className="section-header mb-3">
            <h2>Stores near you</h2>
            {stores.length > 0 && <span className="text-xs text-gray-500">{stores.length} available</span>}
          </div>

          {loading && <p className="text-center text-gray-500 py-12 animate-pulse">Finding stores…</p>}

          {!loading && stores.length === 0 && (
            <div className="card text-center py-10 space-y-2">
              <p className="text-3xl">🏪</p>
              <p className="font-bold">No stores yet in your area</p>
              <p className="text-xs text-gray-500">Want your corner store to join?</p>
            </div>
          )}

          <div className="space-y-4">
            {stores
              .filter(s => {
                if (!search.trim()) return true
                const q = search.toLowerCase()
                return (
                  s.name.toLowerCase().includes(q) ||
                  (s.city ?? '').toLowerCase().includes(q) ||
                  (s.state ?? '').toLowerCase().includes(q)
                )
              })
              .map(store => <StoreListCard key={store.id} store={store} />)}
          </div>
        </div>

        {/* Request-your-store CTA */}
        <Link
          href="/request-store"
          className="block rounded-2xl p-4 bg-gradient-to-br from-brand/15 to-white/4 border border-brand/30 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🔔</span>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-base">Don&apos;t see your favorite store?</p>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">Tell us where to roll out Window Mode next — we&apos;ll ping the owner and notify you the moment they go live.</p>
              <p className="text-sm text-brand font-semibold mt-2">Request your store →</p>
            </div>
          </div>
        </Link>

        {/* How it works */}
        <div className="card text-sm text-gray-500 space-y-2">
          <p className="font-bold text-gray-800">How Window Mode works</p>
          <p>🪟 Pick a store → tap items → pay → show your code at the window.</p>
          <p>🔒 Store stays locked for safety. Staff brings your order out.</p>
        </div>

        <div className="flex justify-center gap-6 text-xs text-gray-500 pt-2">
          <Link href="/legal/service-agreement" className="hover:text-gray-700">Terms</Link>
          <Link href="/legal/pilot-agreement" className="hover:text-gray-700">Pilot agreement</Link>
        </div>
      </div>

      {/* Sticky bottom search (DoorDash-style, elevated) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,1) 35%, rgba(255,255,255,0))' }}
        />
        <div className="relative max-w-lg mx-auto px-4 pb-5 pointer-events-auto">
          <div
            className="flex items-center gap-2 bg-white rounded-full border border-gray-200 pl-5 pr-2 py-2"
            style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)' }}
          >
            <span className="text-gray-500 text-lg shrink-0">🔍</span>
            <input
              type="search"
              placeholder="Search stores, products, brands"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-0 py-2.5 text-base font-medium text-gray-900 placeholder-gray-500 focus:outline-none"
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors shrink-0"
                aria-label="Clear"
              >
                ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const el = document.querySelector<HTMLInputElement>('input[type=search]')
                  el?.focus()
                }}
                className="w-9 h-9 rounded-full bg-brand text-white text-sm font-bold shrink-0 active:scale-95 transition-transform"
                aria-label="Search"
              >
                →
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function StoreListCard({ store }: { store: StoreCard }) {
  const locationStr = [store.city, store.state].filter(Boolean).join(', ') || 'Location coming soon'
  return (
    <Link
      href={`/store/${store.id}`}
      className="block rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 active:scale-[0.99] transition-transform"
    >
      <div className="relative w-full bg-gray-100" style={{ aspectRatio: '16 / 9' }}>
        {store.logoUrl ? (
          <MediaAsset src={store.logoUrl} alt={store.name} className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-white/5 to-black">
            🏪
          </div>
        )}
        <div className="absolute top-3 left-3">
          {store.windowModeEnabled
            ? <span className="badge bg-green-100 text-green-700 backdrop-blur-sm">● OPEN NOW</span>
            : <span className="badge bg-white/90 text-gray-700 backdrop-blur-sm">● CLOSED</span>}
        </div>
      </div>
      <div className="p-3">
        <p className="font-bold text-gray-900 text-base leading-tight">{store.name}</p>
        <p className="text-xs text-gray-500 mt-1">📍 {locationStr}</p>
        <p className="text-xs text-gray-500 mt-2">Tap to browse • Window pickup</p>
      </div>
    </Link>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good evening'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const TOP_CATS: { icon: string; label: string }[] = [
  { icon: '🥤', label: 'Drinks' },
  { icon: '🍿', label: 'Snacks' },
  { icon: '🍬', label: 'Candy' },
  { icon: '🚬', label: 'Tobacco' },
  { icon: '💨', label: 'Vape' },
  { icon: '🍺', label: 'Beer' },
  { icon: '💊', label: 'Health' },
  { icon: '🌮', label: 'Food' },
  { icon: '🏠', label: 'Household' },
]

// Swap `media` values for the URLs of your placeholder videos (.mp4/.webm) or
// images — MediaAsset auto-detects. Leave `media` empty for a gradient slate.
const FEATURED_PROMOS: { id: string; tag: string; title: string; subtitle: string; media: string }[] = [
  { id: 'safer-nights', tag: 'Window Mode', title: 'Safer nights. Same corner store.', subtitle: 'Order through the window — no one has to unlock the door.', media: '' },
  { id: 'ready-in-2', tag: 'Fast pickup', title: 'Ready in 2 minutes', subtitle: 'Tap, pay, and grab it at the window. That simple.', media: '' },
  { id: '21-plus', tag: '21+ friendly', title: 'ID scan built in', subtitle: 'Checkout verifies age before staff hands off.', media: '' },
]
