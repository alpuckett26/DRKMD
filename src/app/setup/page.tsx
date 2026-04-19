'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function runMigration() {
    setLoading(true)
    setStatus('Running...')
    const res = await fetch('/api/migrate', { method: 'POST' })
    const data = await res.json()
    setStatus(data.ok ? '✅ Tables created!' : `❌ ${data.error}\n${data.stderr}`)
    setLoading(false)
  }

  async function runSeed() {
    setLoading(true)
    setStatus('Seeding...')
    const res = await fetch('/api/seed', { method: 'POST' })
    const data = await res.json()
    setStatus(data.ok ? '✅ Seeded!' : `❌ ${data.error}`)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 max-w-sm mx-auto">
      <h1 className="text-2xl font-black text-brand">Database Setup</h1>
      <button onClick={runMigration} disabled={loading} className="btn-primary">
        1. Create Tables
      </button>
      <button onClick={runSeed} disabled={loading} className="btn-primary">
        2. Seed Demo Data
      </button>
      {status && (
        <pre className="text-sm text-gray-700 bg-white rounded-xl p-4 w-full whitespace-pre-wrap break-all">
          {status}
        </pre>
      )}
    </div>
  )
}
