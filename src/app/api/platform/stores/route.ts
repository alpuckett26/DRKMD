import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

async function checkAuth() {
  const session = (await cookies()).get('platformSession')?.value
  return session && session === process.env.PLATFORM_ADMIN_PASSWORD
}

export async function GET() {
  if (!await checkAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stores = await db.store.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { orders: true, products: true, staff: true } },
    },
  })

  const storeIds = stores.map(s => s.id)

  const orderStats = await db.order.groupBy({
    by: ['storeId'],
    where: { storeId: { in: storeIds } },
    _sum: { finalTotal: true, estimatedTotal: true },
    _count: { id: true },
  })

  const statsMap = Object.fromEntries(
    orderStats.map(s => [s.storeId, {
      orderCount: s._count.id,
      revenue: s._sum.finalTotal ?? 0,
    }])
  )

  const result = stores.map(s => ({
    id: s.id,
    name: s.name,
    ownerName: s.ownerName,
    ownerEmail: s.ownerEmail,
    onboardingComplete: s.onboardingComplete,
    createdAt: s.createdAt,
    productCount: s._count.products,
    staffCount: s._count.staff,
    orderCount: statsMap[s.id]?.orderCount ?? 0,
    revenue: statsMap[s.id]?.revenue ?? 0,
  }))

  return NextResponse.json(result)
}
