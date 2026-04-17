import { cookies } from 'next/headers'
import { db } from './db'
import { randomUUID } from 'crypto'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function createAdminSession(accountId: string): Promise<string> {
  const token = randomUUID()
  const expires = new Date(Date.now() + SESSION_DURATION_MS)
  await db.account.update({
    where: { id: accountId },
    data: { sessionToken: token, sessionExpires: expires },
  })
  return token
}

export async function getAdminSession() {
  const token = (await cookies()).get('adminSession')?.value
  if (!token) return null
  const account = await db.account.findUnique({
    where: { sessionToken: token },
    include: { store: true },
  })
  if (!account || !account.sessionExpires || account.sessionExpires < new Date()) return null
  return account
}

export async function createStaffSession(staffId: string): Promise<string> {
  const token = randomUUID()
  const expires = new Date(Date.now() + SESSION_DURATION_MS)
  await db.staff.update({
    where: { id: staffId },
    data: { sessionToken: token, sessionExpires: expires },
  })
  return token
}

export async function getStaffSession(storeId: string) {
  const token = (await cookies()).get(`staffSession_${storeId}`)?.value
  if (!token) return null
  const staff = await db.staff.findUnique({ where: { sessionToken: token } })
  if (!staff || !staff.sessionExpires || staff.sessionExpires < new Date()) return null
  if (staff.storeId !== storeId) return null
  return staff
}
