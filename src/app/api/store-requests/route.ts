import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface Payload {
  storeName?: string
  city?: string
  state?: string
  address?: string
  ownerName?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
}

export async function POST(req: Request) {
  const body = (await req.json()) as Payload
  const storeName = body.storeName?.trim()
  if (!storeName) {
    return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
  }
  if (!body.contactEmail?.trim() && !body.contactPhone?.trim()) {
    return NextResponse.json({ error: 'Provide an email or phone so we can reach out' }, { status: 400 })
  }

  const request = await db.storeRequest.create({
    data: {
      storeName,
      city: body.city?.trim() || null,
      state: body.state?.trim() || null,
      address: body.address?.trim() || null,
      ownerName: body.ownerName?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
      contactPhone: body.contactPhone?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  })

  return NextResponse.json({ id: request.id })
}
