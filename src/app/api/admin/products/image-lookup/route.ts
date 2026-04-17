import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ imageUrl: null })

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=5`,
      { headers: { 'User-Agent': 'DRKMD/1.0' } },
    )
    const data = await res.json() as { products?: { image_front_url?: string; image_url?: string }[] }
    const product = data.products?.find(p => p.image_front_url || p.image_url)
    const imageUrl = product?.image_front_url ?? product?.image_url ?? null
    return NextResponse.json({ imageUrl })
  } catch {
    return NextResponse.json({ imageUrl: null })
  }
}
