import { NextResponse } from 'next/server'
import { generateStoreQR } from '@/lib/qr'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const store = await db.store.findUnique({ where: { id: params.storeId } })
  if (!store) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const qr = await generateStoreQR(params.storeId)
  return NextResponse.json({ storeId: params.storeId, storeName: store.name, qrDataUrl: qr })
}
