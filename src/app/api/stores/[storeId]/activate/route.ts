import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authorizePayment, capturePayment } from '@/lib/square'

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } },
) {
  try {
    const { sourceId } = (await req.json()) as { sourceId: string }

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
    }

    const { paymentId } = await authorizePayment(
      sourceId,
      34900,
      'Window Mode Starter Kit',
    )

    await capturePayment(paymentId, 34900)

    await db.store.update({
      where: { id: params.storeId },
      data: { onboardingComplete: true },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
