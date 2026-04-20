import { PRESET_CATALOG } from './catalog'

/**
 * Fuzzy-match a loose detection label (e.g. "Snickers chocolate bar" from
 * Claude) to the closest canonical entry in our curated catalog (e.g.
 * "Snickers King Size 3.29oz"). This is what keeps product naming
 * consistent across every store instead of drifting into whatever Claude
 * happens to describe on a given photo.
 *
 * Returns the catalog name + hint if we're confident, else null.
 */

interface CanonicalMatch {
  canonicalName: string
  category: string
  restricted: boolean
  score: number // 0..1 overlap ratio
}

const STOP = new Set([
  'box', 'bag', 'pack', 'with', 'and', 'the', 'pcs', 'piece', 'pieces',
  'count', 'size', 'share', 'fun', 'mini', 'jumbo', 'family',
  'candy', 'chocolate', 'bar', 'cups', 'cup', 'flavor', 'flavored',
])

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*oz\b/g, '$1oz') // normalize "1.86 oz" -> "1.86oz"
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP.has(w))
}

/** Boost score when a size token (e.g. "1.86oz" or "king") is shared. */
function sizeSignal(a: string[], b: string[]): number {
  const sizeRx = /^\d+(\.\d+)?(oz|pt|ml|l|pk|ct)?$|^king$|^share$|^mini$|^jumbo$/
  const sa = a.filter(t => sizeRx.test(t))
  const sb = b.filter(t => sizeRx.test(t))
  if (sa.length === 0 || sb.length === 0) return 0
  return sa.some(t => sb.includes(t)) ? 0.15 : 0
}

export function canonicalize(label: string): CanonicalMatch | null {
  const q = tokens(label)
  if (q.length === 0) return null

  let best: CanonicalMatch | null = null

  for (const item of PRESET_CATALOG) {
    const c = tokens(item.name)
    if (c.length === 0) continue

    const shared = q.filter(t => c.includes(t)).length
    if (shared === 0) continue

    // Overlap = shared / max(q, c). Penalizes both super-vague queries AND
    // matching too much against specific catalog entries.
    const base = shared / Math.max(q.length, c.length)
    const score = Math.min(1, base + sizeSignal(q, c))

    if (!best || score > best.score) {
      best = {
        canonicalName: item.name,
        category: item.category,
        restricted: item.restrictedFlag === 'true',
        score,
      }
    }
  }

  if (!best || best.score < 0.45) return null
  return best
}

/** Same but returns the original label when no confident match exists. */
export function canonicalizeOrPassThrough(label: string): {
  name: string
  category: string | null
  restricted: boolean | null
  matched: boolean
} {
  const m = canonicalize(label)
  if (m) {
    return { name: m.canonicalName, category: m.category, restricted: m.restricted, matched: true }
  }
  return { name: label, category: null, restricted: null, matched: false }
}
