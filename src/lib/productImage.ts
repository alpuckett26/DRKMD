const BING_KEY = process.env.BING_IMAGE_SEARCH_KEY

export async function fetchProductImage(name: string): Promise<string | null> {
  if (!BING_KEY) return null
  try {
    const res = await fetch(
      `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(name + ' product')}&count=3&safeSearch=Moderate&imageType=Photo`,
      { headers: { 'Ocp-Apim-Subscription-Key': BING_KEY } },
    )
    if (!res.ok) return null
    const data = await res.json() as { value?: { contentUrl?: string; thumbnailUrl?: string }[] }
    const img = data.value?.find(v => v.contentUrl?.startsWith('https://') || v.thumbnailUrl?.startsWith('https://'))
    return img?.thumbnailUrl ?? img?.contentUrl ?? null
  } catch {
    return null
  }
}
