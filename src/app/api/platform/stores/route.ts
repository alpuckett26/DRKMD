import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

async function checkAuth() {
  const session = (await cookies()).get('platformSession')?.value
  return session && session === process.env.PLATFORM_ADMIN_PASSWORD
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stores = await db.store.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { orders: true, products: true, staff: true } } },
  })

  const storeIds = stores.map(s => s.id)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [allStats, todayStats, weekStats, activeOrders] = await Promise.all([
    db.order.groupBy({
      by: ['storeId'],
      where: { storeId: { in: storeIds } },
      _sum: { finalTotal: true },
      _count: { id: true },
    }),
    db.order.groupBy({
      by: ['storeId'],
      where: { storeId: { in: storeIds }, createdAt: { gte: today } },
      _sum: { finalTotal: true },
      _count: { id: true },
    }),
    db.order.groupBy({
      by: ['storeId'],
      where: { storeId: { in: storeIds }, createdAt: { gte: weekAgo } },
      _sum: { finalTotal: true },
      _count: { id: true },
    }),
    db.order.groupBy({
      by: ['storeId'],
      where: {
        storeId: { in: storeIds },
        status: { in: ['authorized', 'picking', 'ready', 'partially_ready'] },
      },
      _count: { id: true },
    }),
  ])

  function toMap(rows: { storeId: string; _sum: { finalTotal: number | null }; _count: { id: number } }[]) {
    return Object.fromEntries(rows.map(r => [r.storeId, { revenue: r._sum.finalTotal ?? 0, orders: r._count.id }]))
  }
  const allMap = toMap(allStats)
  const todayMap = toMap(todayStats)
  const weekMap = toMap(weekStats)
  const activeMap = Object.fromEntries(activeOrders.map(r => [r.storeId, r._count.id]))

  return NextResponse.json(stores.map(s => ({
    id: s.id,
    name: s.name,
    ownerName: s.ownerName,
    ownerEmail: s.ownerEmail,
    onboardingComplete: s.onboardingComplete,
    windowModeEnabled: s.windowModeEnabled,
    createdAt: s.createdAt,
    productCount: s._count.products,
    staffCount: s._count.staff,
    orderCount: allMap[s.id]?.orders ?? 0,
    revenue: allMap[s.id]?.revenue ?? 0,
    todayOrders: todayMap[s.id]?.orders ?? 0,
    todayRevenue: todayMap[s.id]?.revenue ?? 0,
    weekOrders: weekMap[s.id]?.orders ?? 0,
    weekRevenue: weekMap[s.id]?.revenue ?? 0,
    activeOrders: activeMap[s.id] ?? 0,
  })))
}
