import { randomUUID } from 'crypto'

const BASE_URL =
  process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'

async function squareFetch(path: string, method: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Square-Version': '2024-01-18',
      'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data
}

export async function authorizePayment(
  sourceId: string,
  amountCents: number,
  note: string,
): Promise<{ paymentId: string }> {
  const data = await squareFetch('/v2/payments', 'POST', {
    source_id: sourceId,
    idempotency_key: randomUUID(),
    amount_money: { amount: amountCents, currency: 'USD' },
    autocomplete: false,
    note,
  })
  const payment = (data as { payment: { id: string } }).payment
  if (!payment?.id) throw new Error('Square: no payment ID returned')
  return { paymentId: payment.id }
}

export async function capturePayment(
  paymentId: string,
  finalAmountCents: number,
): Promise<string> {
  await squareFetch(`/v2/payments/${paymentId}`, 'PUT', {
    idempotency_key: randomUUID(),
    payment: {
      amount_money: { amount: finalAmountCents, currency: 'USD' },
    },
  })
  await squareFetch(`/v2/payments/${paymentId}/complete`, 'POST', {})
  return paymentId
}

export async function voidPayment(paymentId: string): Promise<void> {
  await squareFetch(`/v2/payments/${paymentId}/cancel`, 'POST', {})
}
