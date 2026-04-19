'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    router.push(next || `/admin/${data.storeId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input" placeholder="you@yourstore.com" autoComplete="email" />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="input" placeholder="••••••••" autoComplete="current-password" />
      </div>
      {error && <p className="text-red-700 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Signing in…' : 'Sign In →'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-black text-4xl text-brand glow-text">WendOS</h1>
          <p className="text-gray-500 text-sm mt-2">Store Admin Login</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-center text-xs text-gray-600">
          New store? <a href="/signup" className="text-brand underline">Get started</a>
        </p>
      </div>
    </div>
  )
}
