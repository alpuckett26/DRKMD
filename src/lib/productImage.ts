const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY

// Reject OFF results where the product name doesn't meaningfully overlap
// with the query — prevents "Fromage Blanc" showing up for "Reese's Cups"
function isRelevantMatch(query: string, productName: string): boolean {
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  if (words.length === 0) return true
  const result = productName.toLowerCase()
  const hits = words.filter(w => result.includes(w)).length
  return hits >= Math.ceil(words.length / 2)
}

async function tryOpenFoodFacts(name: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      search_terms: name,
      search_simple: '1',
      json: '1',
      fields: 'product_name,image_front_url',
      page_size: '5',
      tagtype_0: 'countries',
      tag_contains_0: 'contains',
      tag_0: 'en:united-states',
    })
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?${params}`,
      { headers: { 'User-Agent': 'WendOS/1.0 (https://drkmd.vercel.app)' } },
    )
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json') && !ct.includes('text/plain')) return null
    const data = await res.json() as { products?: { product_name?: string; image_front_url?: string }[] }
    const product = data.products?.find(p =>
      p.image_front_url &&
      isRelevantMatch(name, p.product_name ?? ''),
    )
    return product?.image_front_url ?? null
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
