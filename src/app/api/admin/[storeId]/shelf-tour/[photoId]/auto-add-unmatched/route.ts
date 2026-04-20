import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchProductImage } from '@/lib/productImage'

export const maxDuration = 60

interface BBox { x: number; y: number; w: number; h: number }
interface Detection {
  productId: string | null
  label: string
  bbox: BBox
  confidence: number
  estimatedPrice: number | null
  matched: boolean
}

interface OFFDetail {
  title: string
  brand: string | null
  size: string | null
  category: string | null
  image: string | null
}

/** OFF lookup for a single label — returns whatever structured info we can
 *  grab. Swallows all errors since enrichment is best-effort. */
async function lookupOFF(name: string): Promise<OFFDetail | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(name)}&fields=product_name,brands,quantity,categories,image_front_url,image_url&page_size=5&json=1&countries_tags_en=united-states&sort_by=unique_scans_n`,
      {
        headers: { 'User-Agent': 'WendOS/1.0 (https://drkmd.vercel.app)', 'Accept': 'application/json' },
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { products?: Array<{ product_name?: string; brands?: string; quantity?: string; categories?: string; image_front_url?: string; image_url?: string }> }
    const item = data.products?.[0]
    if (!item?.product_name) return null
    return {
      title: item.product_name,
      brand: item.brands?.split(',')[0]?.trim() || null,
      size: item.quantity || null,
      category: item.categories?.split(',')[0]?.trim() || null,
      image: item.image_front_url ?? item.image_url ?? null,
    }
  } catch { return null }
}

/** Guess an in-app category from the Claude label when OFF's category is
 *  missing or useless. Mirrors the review flow heuristics. */
function guessCategory(label: string): string {
  const l = label.toLowerCase()
  if (/cola|pepsi|soda|sprite|mountain dew|dr pepper|fanta/.test(l)) return 'Soft Drinks'
  if (/red bull|monster|celsius|rockstar|bang|ghost|reign|c4|energy/.test(l)) return 'Energy Drinks'
  if (/water|aquafina|dasani|fiji|smartwater|evian/.test(l)) return 'Water'
  if (/coffee|frappuccino|latte|espresso|cold brew/.test(l)) return 'Coffee'
  if (/juice|ocean spray|minute maid|tropicana|naked/.test(l)) return 'Juice'
  if (/beer|lager|ale|ipa|stout|pilsner|hard seltzer|white claw|truly|corona|modelo|bud|miller|coors|heineken/.test(l)) return 'Beer'
  if (/wine|pinot|chardonnay|cabernet/.test(l)) return 'Wine'
  if (/whiskey|bourbon|vodka|tequila|rum|gin|cognac|liqueur/.test(l)) return 'Spirits'
  if (/doritos|lays|cheetos|pringles|fritos|takis|ruffles|chips/.test(l)) return 'Chips'
  if (/snickers|twix|kit kat|reese|reeses|m&m|hershey|candy|skittles|starburst|haribo|airheads|twizzlers|milky way|milkyway|butterfinger|mamba|jolly rancher|crunch|3 musketeers|musketeers|baby ruth|pay ?day|almond joy|mounds|york|whatchamacallit/.test(l)) return 'Candy'
  if (/gum|orbit|trident|5 gum|extra|dentyne|stride|bubblicious|tic tac|mentos/.test(l)) return 'Candy'
  if (/clif|kind|rxbar|quest|protein bar|nature valley/.test(l)) return 'Bars'
  if (/peanuts|almonds|cashews|nuts|pistachio/.test(l)) return 'Nuts'
  if (/slim jim|jerky|meat stick/.test(l)) return 'Meat Snacks'
  if (/pop-tart|honey bun|donette|twinkie|ding dong/.test(l)) return 'Pastry'
  if (/marlboro|newport|camel|winston|pall mall|lucky strike|l&m|kool|parliament|virginia slims/.test(l)) return 'Cigarettes'
  if (/swisher|backwoods|black & mild|white owl|dutch master|phillies|cigar/.test(l)) return 'Cigars'
  if (/vuse|juul|njoy|elf bar|geek bar|lost mary|hyde|puff bar|vape|pod|disposable/.test(l)) return 'Vape'
  if (/zyn|on!|velo|rogue|lucy|nicotine pouch/.test(l)) return 'Nicotine Pouches'
  if (/copenhagen|grizzly|skoal|kodiak|snuff|chew/.test(l)) return 'Smokeless'
  if (/lighter|zippo|clipper|rolling paper|zig-zag|raw/.test(l)) return 'Accessories'
  if (/advil|tylenol|aleve|pepto|tums|nyquil|zzzquil|benadryl|claritin|zyrtec/.test(l)) return 'Health'
  if (/chapstick|lip balm|toothbrush|mouthwash|condom|sanitizer/.test(l)) return 'Personal Care'
  if (/battery|cable|charger|earbud/.test(l)) return 'Electronics'
  if (/trash bag|ziploc|paper towel|tissue|laundry|dish soap/.test(l)) return 'Household'
  if (/diaper|formula|pedialyte/.test(l)) return 'Baby'
  return 'General'
}

function looksRestricted(label: string): boolean {
  return /beer|lager|ale|ipa|stout|pilsner|hard seltzer|white claw|truly|corona|modelo|bud|miller|coors|heineken|wine|pinot|chardonnay|cabernet|whiskey|bourbon|vodka|tequila|rum|gin|cognac|marlboro|newport|camel|winston|pall mall|kool|parliament|swisher|backwoods|black & mild|white owl|dutch master|phillies|vuse|juul|njoy|elf bar|geek bar|lost mary|hyde|puff bar|vape|zyn|on!|velo|rogue|lucy|copenhagen|grizzly|skoal|kodiak|snuff|chew|lighter|rolling paper/i.test(label)
}

export async function POST(
  req: Request,
  { params }: { params: { storeId: string; photoId: string } },
) {
  const { storeId, photoId } = params

  const photo = await db.shelfPhoto.findFirst({
    where: { id: photoId, storeId },
  })
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detections = (photo.detections as any as Detection[])
  const unmatched = detections.map((d, i) => ({ d, i })).filter(({ d }) => !d.matched)

  // Enrich each unmatched in parallel (OFF + image). Best-effort.
  const enriched = await Promise.all(unmatched.map(async ({ d, i }) => {
    const [off, image] = await Promise.all([
      lookupOFF(d.label),
      fetchProductImage(d.label),
    ])
    const finalImage = image ?? off?.image ?? null
    const category = guessCategory(d.label) || off?.category || 'General'
    const restricted = looksRestricted(d.label)
    const priceCents = d.estimatedPrice != null ? Math.round(d.estimatedPrice * 100) : 0
    return { i, label: d.label, image: finalImage, category, restricted, priceCents, brand: off?.brand, size: off?.size }
  }))

  // Create products. Using upsert on (storeId, name) so a double-click
  // won't create duplicates.
  const results: Array<{ i: number; productId: string | null; error?: string }> = []
  for (const e of enriched) {
    try {
      const product = await db.product.upsert({
        where: { storeId_name: { storeId, name: e.label } },
        update: {
          imageUrl: e.image ?? undefined,
          price: e.priceCents || undefined,
          category: e.category,
          restrictedFlag: e.restricted,
          active: true,
        },
        create: {
          storeId,
          name: e.label,
          category: e.category,
          price: e.priceCents,
          restrictedFlag: e.restricted,
          nighttimeAvailable: true,
          imageUrl: e.image,
          active: true,
        },
      })
      results.push({ i: e.i, productId: product.id })
    } catch (err) {
      results.push({ i: e.i, productId: null, error: err instanceof Error ? err.message : 'create failed' })
    }
  }

  // Update the detections array to link the newly created products.
  const next = detections.map((det, idx) => {
    const r = results.find(x => x.i === idx)
    if (r?.productId) return { ...det, productId: r.productId, matched: true }
    return det
  })

  await db.shelfPhoto.update({
    where: { id: photoId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { detections: next as any },
  })

  const added = results.filter(r => r.productId).length
  const failed = results.length - added

  return NextResponse.json({ added, failed, total: results.length })
}
