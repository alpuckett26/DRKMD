import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

async function checkAuth() {
  const session = (await cookies()).get('platformSession')?.value
  return session && session === process.env.PLATFORM_ADMIN_PASSWORD
}

export async function GET(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const limit = parseInt(searchParams.get('limit') ?? '100')

  const orders = await db.order.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      store: { select: { name: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(orders.map(o => ({
    id: o.id,
    storeId: o.storeId,
    storeName: o.store.name,
    customerName: o.customerName,
    status: o.status,
    pickupCode: o.pickupCode,
    estimatedTotal: o.estimatedTotal,
    finalTotal: o.finalTotal,
    itemCount: o.items.length,
    createdAt: o.createdAt,
  })))
}
