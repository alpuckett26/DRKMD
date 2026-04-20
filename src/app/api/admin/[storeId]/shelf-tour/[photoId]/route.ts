import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_req: Request, { params }: { params: { storeId: string; photoId: string } }) {
  await db.shelfPhoto.update({
    where: { id: params.photoId },
    data: { active: false },
  })
  return NextResponse.json({ ok: true })
}
