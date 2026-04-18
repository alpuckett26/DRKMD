const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY

async function tryOpenFoodFacts(name: string): Promise<string | null> {
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
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return null
    const data = await res.json() as { products?: { image_front_url?: string; image_url?: string }[] }
    const product = data.products?.find(p => p.image_front_url || p.image_url)
    return product?.image_front_url ?? product?.image_url ?? null
  } catch {
    return null
  }
}

async function tryBraveSearch(name: string): Promise<string | null> {
  if (!BRAVE_KEY) return null
  try {
    const q = encodeURIComponent(name + ' product')
    const res = await fetch(
      `https://api.search.brave.com/res/v1/images/search?q=${q}&count=3&safesearch=strict`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': BRAVE_KEY,
        },
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { results?: { properties?: { url?: string } }[] }
    const url = data.results?.[0]?.properties?.url
    return url?.startsWith('https://') ? url : null
  } catch {
    return null
  }
}

export async function fetchProductImage(name: string): Promise<string | null> {
  return (await tryOpenFoodFacts(name)) ?? (await tryBraveSearch(name))
}
