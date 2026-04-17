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
      ...(body.windowModeEnabled !== undefined && { windowModeEnabled: body.windowModeEnabled }),
      ...(body.windowModeStart !== undefined && { windowModeStart: body.windowModeStart }),
      ...(body.windowModeEnd !== undefined && { windowModeEnd: body.windowModeEnd }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.businessLegalName !== undefined && { businessLegalName: body.businessLegalName }),
      ...(body.businessType !== undefined && { businessType: body.businessType }),
      ...(body.ein !== undefined && { ein: body.ein }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.state !== undefined && { state: body.state }),
      ...(body.zip !== undefined && { zip: body.zip }),
      ...(body.tosAcceptedAt !== undefined && { tosAcceptedAt: body.tosAcceptedAt }),
    },
  })
  return NextResponse.json(store)
}
