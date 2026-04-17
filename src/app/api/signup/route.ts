import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeName, ownerName, ownerEmail, password } = body as {
      storeName: string
      ownerName: string
      ownerEmail: string
      password: string
    }

    if (!storeName) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
    }
    if (!ownerEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check if email already registered
    const existing = await db.account.findUnique({ where: { email: ownerEmail.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 })
    }

    const store = await db.store.create({
      data: {
        name: storeName,
        ownerName: ownerName ?? null,
        ownerEmail: ownerEmail ?? null,
        onboardingComplete: false,
      },
    })

    const passwordHash = await bcrypt.hash(password, 10)
    await db.account.create({
      data: {
        email: ownerEmail.toLowerCase(),
        passwordHash,
        storeId: store.id,
      },
    })

    return NextResponse.json({ storeId: store.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
