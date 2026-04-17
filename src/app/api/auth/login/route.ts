import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createAdminSession } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()
  const account = await db.account.findUnique({ where: { email: email?.toLowerCase() } })
  if (!account) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  const valid = await bcrypt.compare(password, account.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  const token = await createAdminSession(account.id)
  const res = NextResponse.json({ storeId: account.storeId })
  res.cookies.set('adminSession', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400 })
  return res
}
