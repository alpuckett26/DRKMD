const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY

export async function fetchProductImage(name: string): Promise<string | null> {
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
