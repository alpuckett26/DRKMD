import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const locationId = process.env.SQUARE_LOCATION_ID ?? ''
  const appId = process.env.SQUARE_APPLICATION_ID ?? ''
  const token = process.env.SQUARE_ACCESS_TOKEN ?? ''
  const dbUrl = process.env.DATABASE_URL ?? ''

  let dbHost = 'NOT SET'
  let dbUser = 'NOT SET'
  try {
    const url = new URL(dbUrl)
    dbHost = url.hostname + ':' + url.port
    dbUser = url.username
  } catch {}

  let dbConnected = false
  let dbError = ''
  try {
    await db.$queryRaw`SELECT 1`
    dbConnected = true
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    ok: !!(locationId && appId && token) && dbConnected,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT ?? 'NOT SET',
    SQUARE_LOCATION_ID: locationId || 'NOT SET',
    SQUARE_APPLICATION_ID: appId ? `${appId.slice(0, 12)}…` : 'NOT SET',
    SQUARE_ACCESS_TOKEN: token ? `${token.slice(0, 6)}…` : 'NOT SET',
    DATABASE_URL_HOST: dbHost,
    DATABASE_URL_USER: dbUser,
    DATABASE_CONNECTED: dbConnected,
    DATABASE_ERROR: dbError || null,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? 'NOT SET',
  })
}
