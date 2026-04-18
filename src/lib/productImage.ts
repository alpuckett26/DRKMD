const GOOGLE_KEY = process.env.GOOGLE_SEARCH_API_KEY
const GOOGLE_CX = process.env.GOOGLE_SEARCH_ENGINE_ID

export async function fetchProductImage(name: string): Promise<string | null> {
  if (!GOOGLE_KEY || !GOOGLE_CX) return null
  try {
    const q = encodeURIComponent(name + ' product packshot')
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_KEY}&cx=${GOOGLE_CX}&q=${q}&searchType=image&num=3&imgSize=medium&safe=active`,
    )
    if (!res.ok) return null
    const data = await res.json() as { items?: { link?: string }[] }
    const img = data.items?.find(i => i.link?.startsWith('https://'))
    return img?.link ?? null
  } catch {
    return null
  }
}
