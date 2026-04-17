'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [storeName, setStoreName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, ownerName, ownerEmail, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signup failed')
      router.push(`/admin/${data.storeId}/setup`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-5xl">🪟</p>
          <h1 className="font-black text-3xl text-brand">DRKMD</h1>
          <p className="text-gray-400 text-sm">C-store window ordering — set up your store in minutes.</p>
        </div>

        <div className="card space-y-5">
          <h2 className="font-black text-xl">Create Your Store</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Store Name</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder="Main St. Convenience"
                required
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Your Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Email</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                className="input"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Creating…' : 'Create Store →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600">
          Already have an account? <a href="/login" className="text-brand underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}
