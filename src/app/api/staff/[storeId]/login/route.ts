import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const staff = await db.staff.findMany({
    where: { storeId: params.storeId, active: true },
    select: { id: true, name: true, lockedUntil: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(staff)
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  const { staffId, pin } = await req.json()
  const { storeId } = params

  const member = await db.staff.findFirst({ where: { id: staffId, storeId, active: true } })
  if (!member) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

  // Check lockout
  if (member.lockedUntil && member.lockedUntil > new Date()) {
    const mins = Math.ceil((member.lockedUntil.getTime() - Date.now()) / 60000)
    return NextResponse.json(
      { error: `Locked out. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.` },
      { status: 423 },
    )
  }

  const valid = await bcrypt.compare(pin, member.pin)
  if (!valid) {
    const attempts = member.failedAttempts + 1
    await db.staff.update({
      where: { id: member.id },
      data: {
        failedAttempts: attempts,
        ...(attempts >= 3 ? { lockedUntil: new Date(Date.now() + 10 * 60 * 1000) } : {}),
      },
    })
    const remaining = 3 - attempts
    const msg =
      attempts >= 3
        ? 'Account locked for 10 minutes.'
        : `Invalid PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  // Reset failed attempts
  await db.staff.update({
    where: { id: member.id },
    data: { failedAttempts: 0, lockedUntil: null },
  })

  // Create session
  const token = randomUUID()
  await db.staff.update({
    where: { id: member.id },
    data: {
      sessionToken: token,
      sessionExpires: new Date(Date.now() + 86400000),
    },
  })

  // Start shift
  await db.staffShift.create({ data: { staffId: member.id, storeId } })

  const res = NextResponse.json({ ok: true, staffName: member.name })
  res.cookies.set(`staffSession_${storeId}`, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
  })
  return res
}
