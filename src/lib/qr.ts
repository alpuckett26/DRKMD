import QRCode from 'qrcode'

export async function generateQRDataURL(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export async function generateStoreQR(storeId: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  return generateQRDataURL(`${baseUrl}/store/${storeId}`)
}

export async function generatePickupQR(pickupCode: string): Promise<string> {
  return generateQRDataURL(pickupCode)
}
