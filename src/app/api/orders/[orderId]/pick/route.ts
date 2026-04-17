import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Staff starts picking – advances order from authorized → picking
export async function POST(_req: Request, { params }: { params: { orderId: string } }) {
  const order = await db.order.findUnique({ where: { id: params.orderId } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'authorized') {
    return NextResponse.json({ error: 'Order is not in authorized state' }, { status: 409 })
  }

  const updated = await db.order.update({
    where: { id: params.orderId },
    data: { status: 'picking' },
  })

  await db.orderEvent.create({
    data: { orderId: params.orderId, eventType: 'picking_started' },
  })

  return NextResponse.json(updated)
}
