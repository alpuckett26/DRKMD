import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const store = await db.store.findUnique({ where: { id: params.storeId } })
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  return NextResponse.json(store)
}

export async function PATCH(req: Request, { params }: { params: { storeId: string } }) {
  const body = await req.json()
  const store = await db.store.update({
    where: { id: params.storeId },
    data: {
      windowModeEnabled: body.windowModeEnabled,
      windowModeStart: body.windowModeStart,
      windowModeEnd: body.windowModeEnd,
    },
  })
  return NextResponse.json(store)
}
