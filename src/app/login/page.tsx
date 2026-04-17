'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
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
    router.push(`/admin/${data.storeId}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-black text-3xl text-brand">WINDOW MODE</h1>
          <p className="text-gray-500 text-sm mt-1">Store Admin Login</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input" placeholder="you@yourstore.com" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="input" placeholder="••••••••" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600">
          New store? <a href="/signup" className="text-brand underline">Get started</a>
        </p>
      </div>
    </div>
  )
}
