import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const MAX_SHIFT_MS = 10 * 60 * 60 * 1000 // 10 hours

export async function GET(req: Request) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - MAX_SHIFT_MS)

  // Find staff with open shifts started more than 10 hours ago
  const staleShifts = await db.staffShift.findMany({
    where: { endedAt: null, startedAt: { lt: cutoff } },
    include: { staff: true },
  })

  let expired = 0

  for (const shift of staleShifts) {
    const orders = await db.order.findMany({
      where: {
        staffId: shift.staffId,
        createdAt: { gte: shift.startedAt },
        status: { in: ['captured', 'completed'] },
      },
    })

    await db.staffShift.update({
      where: { id: shift.id },
      data: {
        endedAt: new Date(),
        orderCount: orders.length,
        totalSales: orders.reduce((s, o) => s + (o.finalTotal ?? 0), 0),
      },
    })

    // Clear session so they show Offline
    await db.staff.update({
      where: { id: shift.staffId },
      data: { sessionToken: null, sessionExpires: null },
    })

    expired++
  }

  return NextResponse.json({ ok: true, expired })
}
