import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const cookieName = `staffSession_${params.storeId}`
  const match = cookieHeader.split(';').find(c => c.trim().startsWith(`${cookieName}=`))
  const token = match ? match.trim().slice(cookieName.length + 1) : null

  if (token) {
    const staff = await db.staff.findUnique({ where: { sessionToken: token } })
    if (staff) {
      // End current open shift
      const shift = await db.staffShift.findFirst({
        where: { staffId: staff.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      })
      if (shift) {
        const orders = await db.order.findMany({
          where: {
            staffId: staff.id,
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
      }
      await db.staff.update({
        where: { id: staff.id },
        data: { sessionToken: null, sessionExpires: null },
      })
    }
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete(`staffSession_${params.storeId}`)
  return res
}
