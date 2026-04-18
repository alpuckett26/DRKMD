'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'

interface StaffMember {
  id: string
  name: string
  role: 'admin' | 'staff'
  active: boolean
  failedAttempts: number
  lockedUntil: string | null
  sessionToken: string | null
  sessionExpires: string | null
  createdAt: string
  shifts: { id: string; startedAt: string; endedAt: string | null }[]
  orders: { finalTotal: number | null }[]
}

export default function StaffPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newRole, setNewRole] = useState<'staff' | 'admin'>('staff')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Per-staff action state
  const [resetPinId, setResetPinId] = useState<string | null>(null)
  const [resetPinValue, setResetPinValue] = useState('')
  const [resetPinError, setResetPinError] = useState('')

  async function loadStaff() {
    const res = await fetch(`/api/admin/stores/${storeId}/staff`)
    if (res.ok) {
      const data = await res.json()
      setStaff(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStaff()
  }, [storeId])

  async function addStaff(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError('')
    const res = await fetch(`/api/admin/stores/${storeId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, pin: newPin, role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAddError(data.error ?? 'Failed to add staff')
      setAddLoading(false)
      return
    }
    setNewName('')
    setNewPin('')
    setNewRole('staff')
    setShowAdd(false)
    setAddLoading(false)
    loadStaff()
  }

  async function patchStaff(staffId: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/stores/${storeId}/staff/${staffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    loadStaff()
  }

  async function submitResetPin(staffId: string) {
    setResetPinError('')
    if (resetPinValue.length !== 4 || !/^\d{4}$/.test(resetPinValue)) {
      setResetPinError('PIN must be 4 digits')
      return
    }
    await patchStaff(staffId, { pin: resetPinValue })
    setResetPinId(null)
    setResetPinValue('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading…</p>
      </div>
    )
  }

  const activeStaff = staff.filter(s => s.active)
  const inactiveStaff = staff.filter(s => !s.active)

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-black text-lg text-brand">Staff Management</h1>
            <p className="text-sm text-gray-400">{activeStaff.length} active member{activeStaff.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href={`/admin/${storeId}`} className="text-gray-400 text-2xl leading-none">‹</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Add Staff Button */}
        <button
          onClick={() => setShowAdd(v => !v)}
          className="btn-primary w-full"
        >
          {showAdd ? '✕ Cancel' : '+ Add Staff Member'}
        </button>

        {/* Add Staff Form */}
        {showAdd && (
          <form onSubmit={addStaff} className="card space-y-4">
            <h2 className="font-bold">New Staff Member</h2>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">4-Digit PIN</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                required
                className="input tracking-widest text-center text-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Role</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'staff' | 'admin')}
                className="input"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {addError && <p className="text-red-400 text-sm">{addError}</p>}
            <button type="submit" disabled={addLoading} className="btn-primary w-full">
              {addLoading ? 'Adding…' : 'Add Staff Member'}
            </button>
          </form>
        )}

        {/* Active Staff */}
        {activeStaff.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-gray-400 text-xs uppercase tracking-wider px-1">Active Staff</h2>
            {activeStaff.map(member => (
              <StaffCard
                key={member.id}
                member={member}
                storeId={storeId}
                resetPinId={resetPinId}
                resetPinValue={resetPinValue}
                resetPinError={resetPinError}
                setResetPinId={setResetPinId}
                setResetPinValue={setResetPinValue}
                setResetPinError={setResetPinError}
                submitResetPin={submitResetPin}
                patchStaff={patchStaff}
              />
            ))}
          </div>
        )}

        {/* Inactive Staff */}
        {inactiveStaff.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-gray-400 text-xs uppercase tracking-wider px-1">Inactive / Terminated</h2>
            {inactiveStaff.map(member => (
              <StaffCard
                key={member.id}
                member={member}
                storeId={storeId}
                resetPinId={resetPinId}
                resetPinValue={resetPinValue}
                resetPinError={resetPinError}
                setResetPinId={setResetPinId}
                setResetPinValue={setResetPinValue}
                setResetPinError={setResetPinError}
                submitResetPin={submitResetPin}
                patchStaff={patchStaff}
              />
            ))}
          </div>
        )}

        {staff.length === 0 && (
          <div className="card text-center space-y-2">
            <p className="text-3xl">👥</p>
            <p className="text-gray-400 font-semibold">No staff yet</p>
            <p className="text-xs text-gray-600">Add staff members so they can log in on the fulfillment tablet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StaffCard({
  member,
  storeId,
  resetPinId,
  resetPinValue,
  resetPinError,
  setResetPinId,
  setResetPinValue,
  setResetPinError,
  submitResetPin,
  patchStaff,
}: {
  member: StaffMember
  storeId: string
  resetPinId: string | null
  resetPinValue: string
  resetPinError: string
  setResetPinId: (id: string | null) => void
  setResetPinValue: (v: string) => void
  setResetPinError: (e: string) => void
  submitResetPin: (staffId: string) => void
  patchStaff: (staffId: string, body: Record<string, unknown>) => void
}) {
  const isLocked = member.lockedUntil && new Date(member.lockedUntil) > new Date()
  const isLoggedIn =
    member.sessionToken && member.sessionExpires && new Date(member.sessionExpires) > new Date()
  const weeklyTotal = member.orders.reduce((s, o) => s + (o.finalTotal ?? 0), 0)
  const lastShift = member.shifts[0]

  return (
    <div className={`card space-y-3 ${!member.active ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-base">{member.name}</p>
            {member.role === 'admin' && (
              <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full">Admin</span>
            )}
            {!member.active && (
              <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Terminated</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isLoggedIn ? (
              <span className="text-xs text-green-400">● Online</span>
            ) : (
              <span className="text-xs text-gray-600">○ Offline</span>
            )}
            {isLocked && (
              <span className="text-xs text-red-400">🔒 Locked</span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>This week</p>
          <p className="text-brand font-bold text-sm">{formatCents(weeklyTotal)}</p>
          <p>{member.orders.length} order{member.orders.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Last shift info */}
      {lastShift && (
        <p className="text-xs text-gray-600">
          Last shift: {new Date(lastShift.startedAt).toLocaleDateString()}{' '}
          {lastShift.endedAt ? '' : '(active)'}
        </p>
      )}

      {/* Reset PIN form */}
      {resetPinId === member.id && (
        <div className="space-y-2 border-t border-gray-700 pt-3">
          <label className="text-xs text-gray-500 block">New 4-Digit PIN</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={resetPinValue}
            onChange={e => {
              setResetPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))
              setResetPinError('')
            }}
            placeholder="1234"
            className="input tracking-widest text-center text-lg w-32"
            autoFocus
          />
          {resetPinError && <p className="text-red-400 text-xs">{resetPinError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => submitResetPin(member.id)}
              className="btn-primary text-sm"
            >
              Save PIN
            </button>
            <button
              onClick={() => { setResetPinId(null); setResetPinValue(''); setResetPinError('') }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {resetPinId !== member.id && (
        <div className="flex flex-wrap gap-2 border-t border-gray-700 pt-3">
          <button
            onClick={() => { setResetPinId(member.id); setResetPinValue(''); setResetPinError('') }}
            className="btn-secondary text-xs"
          >
            Reset PIN
          </button>
          {isLocked && (
            <button
              onClick={() => patchStaff(member.id, { clearLockout: true })}
              className="btn-secondary text-xs text-yellow-400"
            >
              Clear Lockout
            </button>
          )}
          {member.active ? (
            <button
              onClick={() => {
                if (confirm(`Terminate ${member.name}? They will no longer be able to log in.`)) {
                  patchStaff(member.id, { active: false })
                }
              }}
              className="btn-secondary text-xs text-red-400"
            >
              Terminate
            </button>
          ) : (
            <button
              onClick={() => patchStaff(member.id, { active: true })}
              className="btn-secondary text-xs text-green-400"
            >
              Reactivate
            </button>
          )}
        </div>
      )}
    </div>
  )
}
