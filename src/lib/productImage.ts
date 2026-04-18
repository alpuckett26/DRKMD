const PIXABAY_KEY = process.env.PIXABAY_API_KEY

export async function fetchProductImage(name: string): Promise<string | null> {
  if (!PIXABAY_KEY) return null
  try {
    const q = encodeURIComponent(name)
    const res = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${q}&image_type=photo&per_page=3&safesearch=true`,
    )
    if (!res.ok) return null
    const data = await res.json() as { hits?: { webformatURL?: string }[] }
    return data.hits?.[0]?.webformatURL ?? null
  } catch {
    return null
  }
}
