import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request, { params }: { params: { storeId: string } }) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? undefined
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

  const orders = await db.order.findMany({
    where: {
      storeId: params.storeId,
      ...(status ? { status: status as never } : {}),
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(orders)
}
