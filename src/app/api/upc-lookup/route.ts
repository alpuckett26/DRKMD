import { NextResponse } from 'next/server'

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

interface OFFProduct {
  product_name?: string
  brands?: string
  quantity?: string
  categories?: string
  ingredients_text?: string
  image_front_url?: string
  image_url?: string
}

function isRelevantMatch(query: string, productName: string): boolean {
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  if (words.length === 0) return true
  const result = productName.toLowerCase()
  const hits = words.filter(w => result.includes(w)).length
  return hits >= Math.ceil(words.length / 2)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json(null)

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(name)}&fields=product_name,brands,quantity,categories,ingredients_text,image_front_url,image_url&page_size=5&json=1&countries_tags_en=united-states&sort_by=unique_scans_n`,
      {
        headers: {
          'User-Agent': 'WendOS/1.0 (https://drkmd.vercel.app)',
          'Accept': 'application/json',
        },
      },
    )
    if (!res.ok) return NextResponse.json(null)
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return NextResponse.json(null)

    const data = await res.json() as { products?: OFFProduct[] }
    const item = data.products?.find(p => isRelevantMatch(name, p.product_name ?? ''))
    if (!item) return NextResponse.json(null)

    const topCategory = item.categories?.split(',')[0]?.trim() ?? null

    const detail: UpcDetail = {
      title: item.product_name ?? name,
      brand: item.brands?.split(',')[0]?.trim() ?? null,
      description: item.ingredients_text?.slice(0, 200) ?? null,
      size: item.quantity ?? null,
      category: topCategory,
      image: item.image_front_url ?? item.image_url ?? null,
      lowestPrice: null,
      highestPrice: null,
    }
    return NextResponse.json(detail)
  } catch {
    return NextResponse.json(null)
  }
}
