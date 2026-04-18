import { NextResponse } from 'next/server'

interface UpcItem {
  title: string
  brand: string
  description: string
  size: string
  category: string
  images: string[]
  lowest_recorded_price: number
  highest_recorded_price: number
}

export interface UpcDetail {
  title: string
  brand: string | null
  description: string | null
  size: string | null
  category: string | null
  image: string | null
  lowestPrice: number | null
  highestPrice: number | null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json(null)

  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(name)}&type=product`,
      { headers: { 'User-Agent': 'WendOS/1.0 (https://drkmd.vercel.app)' } },
    )
    if (!res.ok) return NextResponse.json(null)
    const data = await res.json() as { items?: UpcItem[] }
    const item = data.items?.[0]
    if (!item) return NextResponse.json(null)

    const detail: UpcDetail = {
      title: item.title,
      brand: item.brand || null,
      description: item.description || null,
      size: item.size || null,
      category: item.category || null,
      image: item.images?.[0] ?? null,
      lowestPrice: item.lowest_recorded_price ?? null,
      highestPrice: item.highest_recorded_price ?? null,
    }
    return NextResponse.json(detail)
  } catch {
    return NextResponse.json(null)
  }
}
