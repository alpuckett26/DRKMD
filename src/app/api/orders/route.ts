import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authorizePayment } from '@/lib/square'
import { generatePickupQR } from '@/lib/qr'
import { calcServiceFee } from '@/lib/utils'
import { z } from 'zod'

const CreateOrderSchema = z.object({
  storeId: z.string(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  substitutionPreference: z.enum(['none', 'allow_similar']),
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      price: z.number().int().positive(),
      qty: z.number().int().positive(),
    }),
  ).min(1),
  paymentToken: z.string(),
})

function generatePickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { storeId, customerName, customerPhone, substitutionPreference, items, paymentToken } = parsed.data

  const store = await db.store.findUnique({ where: { id: storeId } })
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const isDemo = storeId === 'store_demo'
  if (!isDemo && !store.windowModeEnabled) {
    return NextResponse.json({ error: 'Store is not currently accepting orders.' }, { status: 409 })
  }

  const itemsSubtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const estimatedTotal = itemsSubtotal + calcServiceFee(itemsSubtotal)
  const pickupCode = generatePickupCode()
  const pickupCodeQr = await generatePickupQR(pickupCode)

  let paymentAuthId: string | undefined
  if (isDemo && paymentToken === 'demo') {
    paymentAuthId = 'demo'
  } else {
    try {
      const { paymentId } = await authorizePayment(
        paymentToken,
        estimatedTotal,
        `Order at ${store.name} – code ${pickupCode}`,
      )
      paymentAuthId = paymentId
    } catch (err) {
      console.error('Square auth error:', err)
      return NextResponse.json({ error: 'Payment authorization failed' }, { status: 402 })
    }
  }

  const order = await db.order.create({
    data: {
      storeId,
      customerName,
      customerPhone,
      status: 'authorized',
      estimatedTotal,
      substitutionPreference,
      pickupCode,
      pickupCodeQr,
      paymentAuthId,
      items: {
        create: items.map(i => ({
          productId: i.productId,
          requestedName: i.name,
          requestedPrice: i.price,
          qtyRequested: i.qty,
          status: 'requested',
        })),
      },
      events: {
        create: [
          { eventType: 'submitted' },
          { eventType: 'authorized', notes: `Auth ID: ${paymentAuthId}` },
        ],
      },
    },
    include: { items: true },
  })

  return NextResponse.json(order, { status: 201 })
}
