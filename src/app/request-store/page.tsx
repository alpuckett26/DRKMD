'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RequestStorePage() {
  const router = useRouter()
  const [storeName, setStoreName] = useState('')
  const [city, setCity] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [address, setAddress] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/store-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          city,
          state: stateCode,
          address,
          ownerName,
          contactEmail: email,
          contactPhone: phone,
          notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit')
      }
      setSubmitted(true)
      setTimeout(() => router.push('/'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-4">
          <p className="text-5xl">🔔</p>
          <h1 className="text-2xl font-black">You&apos;re on the list</h1>
          <p className="text-sm text-gray-500">
            We&apos;ll reach out to <span className="font-bold text-gray-800">{storeName}</span> about Window Mode — and ping you the moment they go live so you can place your first order.
          </p>
          <p className="text-xs text-gray-500">Redirecting to home…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-16">
      <header className="panel sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-2xl leading-none">‹</Link>
          <h1 className="font-bold text-lg">Request your store</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">
        {/* Sales pitch */}
        <div className="card space-y-3">
          <p className="text-2xl">🪟</p>
          <h2 className="text-lg font-black leading-tight">Bring Window Mode to your favorite corner store.</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Late-night customers order from their phone, pay in-app, and pick up through the locked window.
            Safer shifts for staff, more sales for the owner, zero new hardware.
          </p>
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Fact value="+28%" label="nighttime revenue" />
            <Fact value="<$0" label="hardware cost" />
            <Fact value="24/7" label="safe ordering" />
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Store name *" required>
            <input className="input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Corner Stop 24" />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="City">
                <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Houston" />
              </Field>
            </div>
            <Field label="State">
              <input className="input" value={stateCode} onChange={e => setStateCode(e.target.value.toUpperCase())} maxLength={2} placeholder="TX" />
            </Field>
          </div>

          <Field label="Address (optional)">
            <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" />
          </Field>

          <div className="pt-3 pb-1 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-brand font-bold flex items-center gap-1.5"><span>🔔</span> Notify me when it&apos;s live</p>
            <p className="text-xs text-gray-500">We&apos;ll message you the instant this store switches on Window Mode.</p>
          </div>

          <Field label="Your name">
            <input className="input" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner or regular customer" />
          </Field>

          <Field label="Email *">
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>

          <Field label="Phone (optional for SMS)">
            <input type="tel" className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" />
          </Field>

          <Field label="Anything else?">
            <textarea className="input h-24 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Late hours, favorite items, owner contact…" />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting || !storeName.trim() || (!email.trim() && !phone.trim())} className="btn-primary">
            {submitting ? 'Sending…' : '🔔 Notify me when it goes live'}
          </button>

          <p className="text-xs text-gray-500 text-center pt-2">
            No obligation. We&apos;ll reach out to the store about Window Mode and ping you the moment they&apos;re live.
          </p>
        </form>
      </div>
    </main>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-gray-700">{label}{required && <span className="text-brand"> *</span>}</span>
      {children}
    </label>
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-2 text-center">
      <p className="text-sm font-black text-brand">{value}</p>
      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{label}</p>
    </div>
  )
}
