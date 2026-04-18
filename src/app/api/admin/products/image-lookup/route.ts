import { NextResponse } from 'next/server'
import { fetchProductImage } from '@/lib/productImage'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ imageUrl: null })
  const imageUrl = await fetchProductImage(name)
  return NextResponse.json({ imageUrl })
}
