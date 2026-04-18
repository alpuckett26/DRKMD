export const SERVICE_FEE_PCT = 0.125

export function calcServiceFee(subtotal: number): number {
  return Math.round(subtotal * SERVICE_FEE_PCT)
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function generatePickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function calcFinalTotal(
  items: Array<{ status: string; qtyFound: number; requestedPrice: number; finalPrice: number | null }>,
): number {
  return items.reduce((sum, item) => {
    if (item.status === 'found' || item.status === 'substituted') {
      const price = item.finalPrice ?? item.requestedPrice
      return sum + price * item.qtyFound
    }
    return sum
  }, 0)
}

export function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    submitted: 'Order Received',
    authorized: 'Payment Held',
    picking: 'Being Prepared',
    ready: 'Ready for Pickup',
    partially_ready: 'Ready (Partial)',
    captured: 'Payment Complete',
    completed: 'Completed',
    voided: 'Voided – No Charge',
    canceled: 'Canceled',
  }
  return labels[status] ?? status
}
