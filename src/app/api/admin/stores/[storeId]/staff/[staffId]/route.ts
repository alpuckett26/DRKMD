import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function PATCH(
  req: Request,
  { params }: { params: { storeId: string; staffId: string } },
) {
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.role !== undefined) data.role = body.role
  if (body.active !== undefined) data.active = body.active
  if (body.clearLockout) {
    data.failedAttempts = 0
    data.lockedUntil = null
  }
  if (body.pin) {
    if (body.pin.length !== 4 || !/^\d{4}$/.test(body.pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
    }
    data.pin = await bcrypt.hash(body.pin, 10)
  }
  const member = await db.staff.update({ where: { id: params.staffId }, data })
  return NextResponse.json(member)
}
