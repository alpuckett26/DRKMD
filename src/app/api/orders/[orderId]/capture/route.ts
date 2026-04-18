import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { capturePayment, voidPayment } from '@/lib/square'
import { calcFinalTotal, calcServiceFee } from '@/lib/utils'

export async function POST(_req: Request, { params }: { params: { orderId: string } }) {
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: { items: true },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['ready', 'partially_ready', 'voided'].includes(order.status)) {
    return NextResponse.json({ error: 'Order not ready for capture' }, { status: 409 })
  }
  if (!order.paymentAuthId) {
    return NextResponse.json({ error: 'No payment authorization on file' }, { status: 409 })
  }

  const itemsTotal = calcFinalTotal(
    order.items.map(i => ({
      status: i.status,
      qtyFound: i.qtyFound,
      requestedPrice: i.requestedPrice,
      finalPrice: i.finalPrice,
    })),
  )
  const finalTotal = itemsTotal + calcServiceFee(itemsTotal)

  const isDemo = order.paymentAuthId === 'demo'

  if (finalTotal === 0 || order.status === 'voided') {
    if (!isDemo) await voidPayment(order.paymentAuthId)
    await db.order.update({
      where: { id: params.orderId },
      data: { status: 'voided', finalTotal: 0 },
    })
    await db.orderEvent.create({
      data: { orderId: params.orderId, eventType: 'voided', notes: 'All items unavailable' },
    })
    return NextResponse.json({ status: 'voided', finalTotal: 0 })
  }

  const captureId = isDemo ? 'demo-capture' : await capturePayment(order.paymentAuthId, finalTotal)

  await db.order.update({
    where: { id: params.orderId },
    data: {
      status: 'captured',
      finalTotal,
      paymentCaptureId: captureId,
    },
  })

  await db.orderEvent.create({
    data: {
      orderId: params.orderId,
      eventType: 'captured',
      notes: `Captured $${(finalTotal / 100).toFixed(2)}`,
    },
  })

  return NextResponse.json({ status: 'captured', finalTotal })
}
