import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { fetchProductImage } from '@/lib/productImage'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface IdentifiedProduct {
  name: string
  category: string
  estimatedPrice: number | null
}

export async function POST(req: Request) {
  const { imageBase64, mediaType } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType ?? 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `You are a convenience store inventory assistant. Look at this shelf photo and identify every distinct product you can see.

For each product, provide:
- name: the most specific product name (brand + variant, e.g. "Red Bull Energy Drink 8.4oz")
- category: one of Drinks, Energy Drinks, Beer, Wine, Spirits, Snacks, Candy, Tobacco, Health, Personal Care, Household, Food, Other
- estimatedPrice: a realistic US convenience store retail price in dollars as a number (e.g. 3.99), or null if you can't estimate

Respond ONLY with a valid JSON array. No markdown, no explanation. Example:
[{"name":"Doritos Nacho Cheese 2.75oz","category":"Snacks","estimatedPrice":2.49}]

Identify as many products as you can clearly see.`,
          },
        ],
      },
    ],
  })

  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'No response from vision model' }, { status: 500 })
  }

  let products: IdentifiedProduct[]
  try {
    const raw = textBlock.text.trim()
    const jsonStr = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['))
    products = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'Failed to parse product list', raw: textBlock.text }, { status: 500 })
  }

  const enriched = await Promise.all(
    products.map(async p => ({ ...p, imageUrl: await fetchProductImage(p.name) })),
  )

  return NextResponse.json({ products: enriched })
}
