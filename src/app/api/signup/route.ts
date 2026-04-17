import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeName, ownerName, ownerEmail } = body as {
      storeName: string
      ownerName: string
      ownerEmail: string
    }

    if (!storeName) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
    }

    const store = await db.store.create({
      data: {
        name: storeName,
        ownerName: ownerName ?? null,
        ownerEmail: ownerEmail ?? null,
        onboardingComplete: false,
      },
    })

    return NextResponse.json({ storeId: store.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
