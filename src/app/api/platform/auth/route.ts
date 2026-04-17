import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { password } = await req.json()
  const expected = process.env.PLATFORM_ADMIN_PASSWORD
  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('platformSession', expected, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('platformSession')
  return res
}
