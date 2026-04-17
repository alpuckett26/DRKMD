import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const staff = await getStaffSession(params.storeId)
  if (!staff) return NextResponse.json(null, { status: 401 })

  // Get current open shift
  const shift = await db.staffShift.findFirst({
    where: { staffId: staff.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })

  if (!shift) {
    return NextResponse.json({
      staffName: staff.name,
      shiftDurationMinutes: 0,
      orderCount: 0,
      totalSales: 0,
    })
  }

  const now = new Date()
  const durationMinutes = Math.floor((now.getTime() - shift.startedAt.getTime()) / 60000)

  const orders = await db.order.findMany({
    where: {
      staffId: staff.id,
      createdAt: { gte: shift.startedAt },
      status: { in: ['captured', 'completed'] },
    },
  })

  return NextResponse.json({
    staffName: staff.name,
    shiftDurationMinutes: durationMinutes,
    orderCount: orders.length,
    totalSales: orders.reduce((s, o) => s + (o.finalTotal ?? 0), 0),
  })
}
