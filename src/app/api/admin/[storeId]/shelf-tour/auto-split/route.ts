import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { detectShelfProducts } from '@/lib/shelfDetect'

// 300s = Vercel Pro max. Hobby plans cap at 60. Parallel cell loop should
// stay well under either, but bigger grids (5x6+) may need the headroom.
export const maxDuration = 300

/** Take one high-res shelf photo and auto-split it into the store's
 *  configured grid (shelfRows × shelfCols). Each cell becomes its own
 *  ShelfPhoto with its own SAM+Claude detection pass — just like the
 *  admin captured each section individually, but without having to. */
export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { imageBase64 } = await req.json() as { imageBase64: string }
    const storeId = params.storeId
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const store = await db.store.findUnique({
      where: { id: storeId },
      select: { shelfRows: true, shelfCols: true },
    })
    const rows = store?.shelfRows ?? 0
    const cols = store?.shelfCols ?? 0
    if (rows < 1 || cols < 1) {
      return NextResponse.json({
        error: 'Configure shelves and shelf length first.',
      }, { status: 400 })
    }

    // Normalize once up front — applies EXIF and reduces buffer size.
    const incoming = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const normalized = await sharp(Buffer.from(incoming, 'base64'))
      .rotate()
      .jpeg({ quality: 88 })
      .toBuffer()
    const meta = await sharp(normalized).metadata()
    const W = meta.width ?? 0
    const H = meta.height ?? 0
    if (!W || !H) return NextResponse.json({ error: 'Could not read image dimensions' }, { status: 400 })

    const cellW = Math.floor(W / cols)
    const cellH = Math.floor(H / rows)

    // Clear any existing grid photos for this store so the new split
    // cleanly replaces them. Preserves free-form photos (null coords).
    await db.shelfPhoto.updateMany({
      where: { storeId, active: true, NOT: { shelfIndex: null } },
      data: { active: false },
    })

    // Build all cell crop tasks first, then run detection in parallel.
    // Sequential 16-cell loop blew through Vercel's 60s function timeout.
    const cellJobs: Array<{ r: number; c: number; left: number; top: number; width: number; height: number }> = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = c * cellW
        const top = r * cellH
        const width = c === cols - 1 ? W - left : cellW
        const height = r === rows - 1 ? H - top : cellH
        cellJobs.push({ r, c, left, top, width, height })
      }
    }

    const results = await Promise.all(cellJobs.map(async job => {
      try {
        const cropBuf = await sharp(normalized)
          .extract({ left: job.left, top: job.top, width: job.width, height: job.height })
          .jpeg({ quality: 88 })
          .toBuffer()
        const cropBase64 = cropBuf.toString('base64')

        const { detections } = await detectShelfProducts(cropBase64, storeId, { alreadyNormalized: true })

        const dataUrl = `data:image/jpeg;base64,${cropBase64}`
        await db.shelfPhoto.create({
          data: {
            storeId,
            imageUrl: dataUrl,
            label: `Shelf ${job.r + 1} · Section ${job.c + 1}`,
            shelfIndex: job.r,
            sectionIndex: job.c,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            detections: detections as any,
          },
        })

        return {
          row: job.r, col: job.c,
          detected: detections.length,
          matched: detections.filter(d => d.matched).length,
        }
      } catch (err) {
        return {
          row: job.r, col: job.c, detected: 0, matched: 0,
          error: err instanceof Error ? err.message : 'Cell failed',
        }
      }
    }))

    const totalDetected = results.reduce((s, r) => s + r.detected, 0)
    const totalMatched = results.reduce((s, r) => s + r.matched, 0)
    const failedCells = results.filter(r => r.error).length

    console.info('[auto-split]', { rows, cols, cells: rows * cols, detected: totalDetected, matched: totalMatched, failedCells })

    return NextResponse.json({
      rows, cols, cells: rows * cols,
      detected: totalDetected,
      matched: totalMatched,
      failedCells,
      results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('auto-split failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
