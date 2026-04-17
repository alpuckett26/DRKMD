import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const staff = await db.staff.findMany({
    where: { storeId: params.storeId },
    include: {
      shifts: { orderBy: { startedAt: 'desc' }, take: 1 },
      orders: {
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          status: { in: ['captured', 'completed'] },
        },
        select: { finalTotal: true },
      },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(staff)
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  const { name, pin, role } = await req.json()
  if (!name || !pin) return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
  }
  const pinHash = await bcrypt.hash(pin, 10)
  const member = await db.staff.create({
    data: { storeId: params.storeId, name, pin: pinHash, role: role ?? 'staff' },
  })
  return NextResponse.json(member, { status: 201 })
}
