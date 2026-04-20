import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const photos = await db.shelfPhoto.findMany({
    where: { storeId: params.storeId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, imageUrl: true, label: true, detections: true, shelfIndex: true, sectionIndex: true, areaName: true },
  })
  return NextResponse.json(photos)
}
