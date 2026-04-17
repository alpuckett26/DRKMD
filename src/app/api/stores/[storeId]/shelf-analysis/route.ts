import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic()

export async function POST(req: Request) {
  const { images } = await req.json() as { images: string[] }
  if (!images?.length) return NextResponse.json({ error: 'No images provided' }, { status: 400 })

  const imageBlocks = images.slice(0, 6).map(img => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data: img.replace(/^data:image\/\w+;base64,/, ''),
    },
  }))

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: `You are cataloging inventory for a convenience store. Analyze these shelf photos and list every distinct product you can identify.

For each product return:
- name: specific product name (brand + variant if readable, e.g. "Monster Energy Ultra White 16oz")
- category: exactly one of: Drinks, Energy, Coffee & Tea, Beer, Wine & Spirits, Snacks, Candy & Chocolate, Food, Health & Beauty, Tobacco, Electronics, Household, General
- restricted: true only for alcohol or tobacco
- estimatedPrice: realistic US convenience store retail price as a number in dollars (e.g. 3.99), or null if unsure

Return ONLY a JSON array, no other text:
[{"name":"...","category":"...","restricted":false,"estimatedPrice":2.49}]`,
        },
      ],
    }],
  })

  const text = message.content.find(b => b.type === 'text')?.text ?? '[]'
  const match = text.match(/\[[\s\S]*\]/)
  let products: { name: string; category: string; restricted: boolean; estimatedPrice: number | null }[] = []
  if (match) {
    try { products = JSON.parse(match[0]) } catch {}
  }

  // Deduplicate by name
  const seen = new Set<string>()
  products = products.filter(p => {
    const key = p.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Enrich with Open Food Facts images in parallel
  const enriched = await Promise.all(
    products.map(async p => {
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(p.name)}&search_simple=1&action=process&json=1&page_size=3`,
          { headers: { 'User-Agent': 'WendOS inventory app - support@wendos.com' } },
        )
        const data = await res.json() as { products?: { image_front_url?: string; image_url?: string }[] }
        const img = data.products?.map(x => x.image_front_url ?? x.image_url).find(u => u?.startsWith('https://'))
        return { ...p, imageUrl: img ?? null }
      } catch {
        return { ...p, imageUrl: null }
      }
    }),
  )

  return NextResponse.json({ products: enriched })
}
