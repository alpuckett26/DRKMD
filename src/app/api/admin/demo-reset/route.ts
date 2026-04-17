import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEMO_STORE_ID = 'store_demo'

export async function POST() {
  await db.store.update({
    where: { id: DEMO_STORE_ID },
    data: {
      onboardingComplete: false,
      logoUrl: null,
      phone: null,
      businessLegalName: null,
      businessType: null,
      ein: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      tosAcceptedAt: null,
      windowModeEnabled: false,
    },
  })
  return NextResponse.json({ ok: true })
}
