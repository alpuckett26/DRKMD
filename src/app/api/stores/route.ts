import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const stores = await db.store.findMany({
    where: { onboardingComplete: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      logoUrl: true,
      windowModeEnabled: true,
      windowModeStart: true,
      windowModeEnd: true,
    },
  })

  // Include the demo store even if onboardingComplete is false, so the app is
  // explorable out of the box.
  const hasDemoStore = stores.some(s => s.id === 'store_demo')
  if (!hasDemoStore) {
    const demo = await db.store.findUnique({
      where: { id: 'store_demo' },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        logoUrl: true,
        windowModeEnabled: true,
        windowModeStart: true,
        windowModeEnd: true,
      },
    })
    if (demo) stores.unshift(demo)
  }

  return NextResponse.json(stores)
}
