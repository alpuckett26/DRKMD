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
    const { imageBase64, yBoundaries, xBoundaries, areaName, rows: bodyRows, cols: bodyCols } = await req.json() as {
      imageBase64: string
      yBoundaries?: number[]
      xBoundaries?: [number, number] // normalized [leftX, rightX] to crop sides
      areaName?: string | null
      rows?: number
      cols?: number
    }
    const storeId = params.storeId
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const store = await db.store.findUnique({
      where: { id: storeId },
      select: { shelfRows: true, shelfCols: true },
    })
    const rows = typeof bodyRows === 'number' && bodyRows > 0 ? bodyRows : (store?.shelfRows ?? 0)
    const cols = typeof bodyCols === 'number' && bodyCols > 0 ? bodyCols : (store?.shelfCols ?? 0)
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

    // Horizontal crop: defaults to full width unless the admin pushed the
    // left/right crop lines in the calibration step.
    const xLeftN = Array.isArray(xBoundaries) && typeof xBoundaries[0] === 'number'
      ? Math.max(0, Math.min(1, xBoundaries[0]))
      : 0
    const xRightN = Array.isArray(xBoundaries) && typeof xBoundaries[1] === 'number'
      ? Math.max(xLeftN + 0.02, Math.min(1, xBoundaries[1]))
      : 1
    const xLeftPx = Math.floor(xLeftN * W)
    const xRightPx = Math.floor(xRightN * W)
    const workW = Math.max(1, xRightPx - xLeftPx)
    const cellW = Math.floor(workW / cols)

    // Y boundaries in pixels. If the admin calibrated shelves (yBoundaries
    // length = rows + 1, normalized 0..1), use those. Otherwise fall back
    // to equal-height rows.
    const yEdges: number[] = Array.isArray(yBoundaries) && yBoundaries.length === rows + 1
      ? [...yBoundaries]
          .map(v => Math.max(0, Math.min(1, v)))
          .sort((a, b) => a - b)
          .map(v => Math.round(v * H))
      : Array.from({ length: rows + 1 }, (_, i) => Math.round((i / rows) * H))

    // Clear existing grid photos for THIS area only (or legacy null-area
    // photos when areaName isn't supplied) so we cleanly re-slice.
    await db.shelfPhoto.updateMany({
      where: {
        storeId,
        active: true,
        NOT: { shelfIndex: null },
        areaName: areaName ?? null,
      },
      data: { active: false },
    })

    // Build all cell crop tasks first, then run detection in parallel.
    // Sequential 16-cell loop blew through Vercel's 60s function timeout.
    const cellJobs: Array<{ r: number; c: number; left: number; top: number; width: number; height: number }> = []
    for (let r = 0; r < rows; r++) {
      const top = yEdges[r]
      const bottom = yEdges[r + 1]
      const height = Math.max(1, bottom - top)
      for (let c = 0; c < cols; c++) {
        const left = xLeftPx + c * cellW
        const width = c === cols - 1 ? xRightPx - left : cellW
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

        const { detections } = await detectShelfProducts(cropBase64, storeId, {
          alreadyNormalized: true,
          areaName: areaName ?? null,
        })

        const dataUrl = `data:image/jpeg;base64,${cropBase64}`
        await db.shelfPhoto.create({
          data: {
            storeId,
            imageUrl: dataUrl,
            label: `Shelf ${job.r + 1} · Section ${job.c + 1}`,
            shelfIndex: job.r,
            sectionIndex: job.c,
            areaName: areaName ?? null,
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
