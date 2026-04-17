import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const MarkItemSchema = z.object({
  itemId: z.string(),
  status: z.enum(['found', 'unavailable', 'substituted', 'refused_restricted']),
  qtyFound: z.number().int().min(0).optional(),
  substitutionReason: z.string().optional(),
  finalPrice: z.number().int().optional(),
})

export async function PATCH(req: Request, { params }: { params: { orderId: string } }) {
  const body = await req.json()
  const parsed = MarkItemSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { itemId, status, qtyFound, substitutionReason, finalPrice } = parsed.data

  const item = await db.orderItem.update({
    where: { id: itemId },
    data: {
      status,
      qtyFound: qtyFound ?? (status === 'found' ? undefined : 0),
      substitutionReason,
      finalPrice,
    },
  })

  await db.orderEvent.create({
    data: {
      orderId: params.orderId,
      eventType: 'item_marked',
      notes: `${item.requestedName} → ${status}`,
    },
  })

  // Check if all items have been marked to auto-advance order status
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: { items: true },
  })

  if (order && order.status === 'picking') {
    const allMarked = order.items.every(i => i.status !== 'requested')
    if (allMarked) {
      const hasAny = order.items.some(
        i => i.status === 'found' || i.status === 'substituted',
      )
      const allUnavailable = order.items.every(
        i => i.status === 'unavailable' || i.status === 'refused_restricted',
      )

      const newStatus = allUnavailable
        ? 'voided'
        : order.items.some(i => i.status === 'unavailable' || i.status === 'refused_restricted')
          ? 'partially_ready'
          : 'ready'

      await db.order.update({
        where: { id: params.orderId },
        data: { status: newStatus },
      })
    }
  }

  return NextResponse.json(item)
}
