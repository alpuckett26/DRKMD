import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

async function checkAuth() {
  const session = (await cookies()).get('platformSession')?.value
  return session && session === process.env.PLATFORM_ADMIN_PASSWORD
}

export async function PATCH(req: Request, { params }: { params: { storeId: string } }) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const store = await db.store.update({
    where: { id: params.storeId },
    data: {
      ...(body.windowModeEnabled !== undefined && { windowModeEnabled: body.windowModeEnabled }),
      ...(body.onboardingComplete !== undefined && { onboardingComplete: body.onboardingComplete }),
    },
  })
  return NextResponse.json(store)
}

export async function DELETE(_req: Request, { params }: { params: { storeId: string } }) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (params.storeId === 'store_demo') {
    return NextResponse.json({ error: 'Cannot delete demo store' }, { status: 400 })
  }
  await db.store.delete({ where: { id: params.storeId } })
  return NextResponse.json({ ok: true })
}
