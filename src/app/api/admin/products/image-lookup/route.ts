import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ imageUrl: null })

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(name)}&fields=image_front_url,image_url&page_size=5&json=1`,
      {
        headers: {
          'User-Agent': 'WendOS/1.0 (https://drkmd.vercel.app)',
          'Accept': 'application/json',
        },
      },
    )
    if (!res.ok) return NextResponse.json({ imageUrl: null })
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return NextResponse.json({ imageUrl: null })
    const data = await res.json() as { products?: { image_front_url?: string; image_url?: string }[] }
    const product = data.products?.find(p => p.image_front_url || p.image_url)
    const imageUrl = product?.image_front_url ?? product?.image_url ?? null
    return NextResponse.json({ imageUrl })
  } catch {
    return NextResponse.json({ imageUrl: null })
  }
}
