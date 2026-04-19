'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatCents } from '@/lib/utils'

interface ShiftSummary {
  staffName: string
  shiftDurationMinutes: number
  orderCount: number
  totalSales: number
}

export default function ShiftEndPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [summary, setSummary] = useState<ShiftSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    // Fetch current staff session to get name, and last shift for stats
    fetch(`/api/staff/${storeId}/shift-summary`)
      .then(r => r.json())
      .then(data => { setSummary(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [storeId])

  async function handleDone() {
    setLoggingOut(true)
    await fetch(`/api/staff/${storeId}/logout`, { method: 'POST' })
    router.push(`/staff/${storeId}/login`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading…</p>
      </div>
    )
  }

  const hours = summary ? Math.floor(summary.shiftDurationMinutes / 60) : 0
  const mins = summary ? summary.shiftDurationMinutes % 60 : 0
  const durationStr =
    hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-8">
      <div className="text-center">
        <p className="text-5xl mb-3">✅</p>
        <h1 className="font-black text-2xl text-brand">Shift Complete</h1>
        {summary && (
          <p className="text-gray-500 text-lg mt-1">{summary.staffName}</p>
        )}
      </div>

      {summary && (
        <div className="card w-full max-w-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Duration</p>
              <p className="font-black text-2xl text-gray-900">{durationStr}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Orders</p>
              <p className="font-black text-2xl text-gray-900">{summary.orderCount}</p>
            </div>
            <div className="col-span-2 text-center border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500 mb-1">Total Sales</p>
              <p className="font-black text-3xl text-brand">{formatCents(summary.totalSales)}</p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleDone}
        disabled={loggingOut}
        className="btn-primary w-full max-w-sm"
      >
        {loggingOut ? 'Logging out…' : 'Done — Log Out'}
      </button>
    </div>
  )
}
