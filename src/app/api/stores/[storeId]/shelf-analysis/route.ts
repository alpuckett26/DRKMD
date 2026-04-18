import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { fetchProductImage } from '@/lib/productImage'

export const maxDuration = 60

const client = new Anthropic()

function tooSimilar(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  const wa = words(a), wb = words(b)
  if (!wa.length || !wb.length) return false
  const shared = wa.filter(w => wb.includes(w)).length
  return shared / Math.max(wa.length, wb.length) >= 0.85
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  const { images } = await req.json() as { images: string[] }
  const storeId = params.storeId
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

  // Deduplicate within scan results
  const seen = new Set<string>()
  products = products.filter(p => {
    const key = p.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Filter out products too similar to existing ones in DB
  const existing = await db.product.findMany({ where: { storeId, active: true }, select: { name: true } })
  products = products.filter(p => !existing.some(e => tooSimilar(p.name, e.name)))

  const enriched = await Promise.all(
    products.map(async p => ({ ...p, imageUrl: await fetchProductImage(p.name) })),
  )

  return NextResponse.json({ products: enriched })
}
