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
    <main className="min-h-screen pb-28">
      {/* Top bar */}
      <header className="panel sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Delivery to</p>
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
          <h1 className="text-2xl font-black text-white">{greeting()}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Order from a locked, safe window shop near you.</p>
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
            <div key={promo.id} className="snap-start shrink-0 w-[88%] rounded-2xl overflow-hidden bg-gray-800 relative" style={{ aspectRatio: '16 / 9' }}>
              {promo.media ? (
                <MediaAsset src={promo.media} alt={promo.title} className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand/30 via-transparent to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-[11px] font-semibold text-brand uppercase tracking-widest">{promo.tag}</p>
                <p className="text-xl font-black text-white leading-tight mt-0.5">{promo.title}</p>
                <p className="text-xs text-gray-200 mt-0.5">{promo.subtitle}</p>
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
              <p className="font-bold text-white text-base">Don&apos;t see your favorite store?</p>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">Tell us where to roll out Window Mode next — we&apos;ll ping the owner and notify you the moment they go live.</p>
              <p className="text-sm text-brand font-semibold mt-2">Request your store →</p>
            </div>
          </div>
        </Link>

        {/* How it works */}
        <div className="card text-sm text-gray-400 space-y-2">
          <p className="font-bold text-gray-200">How Window Mode works</p>
          <p>🪟 Pick a store → tap items → pay → show your code at the window.</p>
          <p>🔒 Store stays locked for safety. Staff brings your order out.</p>
        </div>

        <div className="flex justify-center gap-6 text-xs text-gray-500 pt-2">
          <Link href="/legal/service-agreement" className="hover:text-gray-300">Terms</Link>
          <Link href="/legal/pilot-agreement" className="hover:text-gray-300">Pilot agreement</Link>
        </div>
      </div>

      {/* Sticky bottom search pill (DoorDash-style) */}
      <div className="fixed bottom-4 left-0 right-0 z-30 px-4 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
            <input
              type="search"
              placeholder="Search stores, cities"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-full pl-10 pr-4 py-3.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-brand/50"
              style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
            />
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
      className="block rounded-2xl overflow-hidden bg-white/4 border border-white/8 active:scale-[0.99] transition-transform"
    >
      <div className="relative w-full bg-gray-800" style={{ aspectRatio: '16 / 9' }}>
        {store.logoUrl ? (
          <MediaAsset src={store.logoUrl} alt={store.name} className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-white/5 to-black">
            🏪
          </div>
        )}
        <div className="absolute top-3 left-3">
          {store.windowModeEnabled
            ? <span className="badge bg-green-900/90 text-green-300 backdrop-blur-sm">● OPEN NOW</span>
            : <span className="badge bg-gray-900/90 text-gray-300 backdrop-blur-sm">● CLOSED</span>}
        </div>
      </div>
      <div className="p-3">
        <p className="font-bold text-white text-base leading-tight">{store.name}</p>
        <p className="text-xs text-gray-400 mt-1">📍 {locationStr}</p>
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
