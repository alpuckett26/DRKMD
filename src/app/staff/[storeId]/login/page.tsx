'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface StaffMember {
  id: string
  name: string
  lockedUntil: string | null
}

export default function StaffLogin() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(true)

  useEffect(() => {
    fetch(`/api/staff/${storeId}/login`)
      .then(r => r.json())
      .then(data => { setStaff(data); setLoadingStaff(false) })
      .catch(() => setLoadingStaff(false))
  }, [storeId])

  async function submitPin(fullPin: string) {
    if (!selectedStaff) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/staff/${storeId}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: selectedStaff.id, pin: fullPin }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setPin('')
      setLoading(false)
      // Re-fetch staff list to get updated lockout status
      fetch(`/api/staff/${storeId}/login`)
        .then(r => r.json())
        .then(setStaff)
      return
    }
    router.push(`/fulfillment/${storeId}`)
  }

  function pressDigit(d: string) {
    if (loading) return
    const next = pin + d
    if (next.length <= 4) {
      setPin(next)
      if (next.length === 4) submitPin(next)
    }
  }

  function backspace() {
    setPin(p => p.slice(0, -1))
  }

  function selectStaffMember(member: StaffMember) {
    if (member.lockedUntil && new Date(member.lockedUntil) > new Date()) return
    setSelectedStaff(member)
    setPin('')
    setError('')
  }

  function goBack() {
    setSelectedStaff(null)
    setPin('')
    setError('')
  }

  if (loadingStaff) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading…</p>
      </div>
    )
  }

  // Step 1: Staff name selection
  if (!selectedStaff) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 px-4">
        <div className="text-center">
          <h1 className="font-black text-2xl text-brand">WendOS</h1>
          <p className="text-gray-500 text-sm mt-1">Staff Login — Who are you?</p>
        </div>

        {staff.length === 0 ? (
          <div className="card text-center space-y-2 w-full max-w-sm">
            <p className="text-gray-400">No staff accounts found.</p>
            <p className="text-xs text-gray-600">Ask your manager to add staff members in the admin panel.</p>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-3">
            {staff.map(member => {
              const locked = member.lockedUntil && new Date(member.lockedUntil) > new Date()
              return (
                <button
                  key={member.id}
                  onClick={() => selectStaffMember(member)}
                  disabled={!!locked}
                  className={`w-full rounded-2xl p-4 text-left font-semibold text-lg transition-colors ${
                    locked
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-800 text-white active:bg-brand hover:bg-gray-700'
                  }`}
                >
                  <span>{member.name}</span>
                  {locked && (
                    <span className="text-xs text-red-400 block font-normal mt-0.5">
                      Locked — try again later
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Step 2: PIN entry
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="font-black text-2xl text-brand">WendOS</h1>
        <p className="text-gray-400 text-base mt-1 font-semibold">{selectedStaff.name}</p>
        <p className="text-gray-600 text-sm">Enter your PIN</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              i < pin.length ? 'bg-brand border-brand' : 'border-gray-600'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm text-center max-w-xs">{error}</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k === '' ? (
            <div key={i} />
          ) : k === '⌫' ? (
            <button
              key={i}
              onClick={backspace}
              disabled={loading}
              className="h-16 rounded-2xl bg-gray-800 text-gray-400 text-xl font-bold active:bg-gray-700 transition-colors"
            >
              ⌫
            </button>
          ) : (
            <button
              key={i}
              onClick={() => pressDigit(k)}
              disabled={loading}
              className="h-16 rounded-2xl bg-gray-800 text-white text-xl font-bold active:bg-brand transition-colors"
            >
              {k}
            </button>
          )
        )}
      </div>

      <button onClick={goBack} className="text-gray-600 text-sm underline">
        ← Back
      </button>
    </div>
  )
}
