import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const HandoffSchema = z.object({ pickupCode: z.string() })

export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const body = await req.json()
  const parsed = HandoffSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const order = await db.order.findUnique({ where: { id: params.orderId } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (order.pickupCode !== parsed.data.pickupCode) {
    return NextResponse.json({ error: 'Pickup code mismatch' }, { status: 403 })
  }

  if (!['captured', 'ready', 'partially_ready'].includes(order.status)) {
    return NextResponse.json({ error: 'Order not ready for handoff' }, { status: 409 })
  }

  const updated = await db.order.update({
    where: { id: params.orderId },
    data: { status: 'completed', completedAt: new Date() },
  })

  await db.orderEvent.create({
    data: { orderId: params.orderId, eventType: 'completed', notes: 'Handoff verified' },
  })

  return NextResponse.json(updated)
}
