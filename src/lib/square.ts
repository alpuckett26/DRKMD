import { Client, Environment } from 'squareup'
import { randomUUID } from 'crypto'

const environment =
  process.env.SQUARE_ENVIRONMENT === 'production'
    ? Environment.Production
    : Environment.Sandbox

export const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment,
})

export async function authorizePayment(
  sourceId: string,
  amountCents: number,
  note: string,
): Promise<{ paymentId: string; versionToken: string | undefined }> {
  const { result } = await squareClient.paymentsApi.createPayment({
    sourceId,
    idempotencyKey: randomUUID(),
    amountMoney: {
      amount: BigInt(amountCents),
      currency: 'USD',
    },
    autocomplete: false,
    note,
  })

  if (!result.payment?.id) throw new Error('Square: no payment ID returned')

  return {
    paymentId: result.payment.id,
    versionToken: result.payment.versionToken,
  }
}

export async function capturePayment(
  paymentId: string,
  finalAmountCents: number,
): Promise<string> {
  // Update to adjusted amount before completing
  const { result: updated } = await squareClient.paymentsApi.updatePayment(
    paymentId,
    {
      idempotencyKey: randomUUID(),
      payment: {
        amountMoney: {
          amount: BigInt(finalAmountCents),
          currency: 'USD',
        },
      },
    },
  )

  await squareClient.paymentsApi.completePayment(paymentId, {})

  return updated.payment?.id ?? paymentId
}

export async function voidPayment(paymentId: string): Promise<void> {
  await squareClient.paymentsApi.cancelPayment(paymentId)
}
