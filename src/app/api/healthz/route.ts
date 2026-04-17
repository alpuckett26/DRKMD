import { NextResponse } from 'next/server'

export async function GET() {
  const locationId = process.env.SQUARE_LOCATION_ID ?? ''
  const appId = process.env.SQUARE_APPLICATION_ID ?? ''
  const token = process.env.SQUARE_ACCESS_TOKEN ?? ''

  return NextResponse.json({
    ok: !!(locationId && appId && token),
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT ?? 'NOT SET',
    SQUARE_LOCATION_ID: locationId || 'NOT SET',
    SQUARE_APPLICATION_ID: appId ? `${appId.slice(0, 8)}…` : 'NOT SET',
    SQUARE_ACCESS_TOKEN: token ? `${token.slice(0, 6)}…` : 'NOT SET',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? 'NOT SET',
  })
}
