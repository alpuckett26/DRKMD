import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const products = await db.product.findMany({
    where: {
      storeId: params.storeId,
      nighttimeAvailable: true,
      active: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(products)
}
