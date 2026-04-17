import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const staff = await getStaffSession(params.storeId)
  if (!staff) return NextResponse.json(null)
  return NextResponse.json({ id: staff.id, name: staff.name, role: staff.role })
}
