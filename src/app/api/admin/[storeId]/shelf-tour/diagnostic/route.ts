import { NextResponse } from 'next/server'
import Replicate from 'replicate'

/** Hit this endpoint to check your SAM setup end-to-end:
 *    GET /api/admin/<storeId>/shelf-tour/diagnostic
 *  Returns a JSON report of token presence, model version, and either the
 *  raw model output or the exact error. */
export async function GET() {
  const token = process.env.REPLICATE_API_TOKEN
  const modelEnv = process.env.REPLICATE_SAM_MODEL
  const model = (modelEnv || 'lucataco/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83') as `${string}/${string}:${string}`

  const report: Record<string, unknown> = {
    hasToken: !!token,
    tokenPrefix: token ? token.slice(0, 4) + '…' : null,
    model,
    modelIsFromEnv: !!modelEnv,
  }

  if (!token) {
    report.conclusion = 'REPLICATE_API_TOKEN is not set in this environment.'
    return NextResponse.json(report)
  }

  // 1x1 red PNG, base64, so we don't need an actual shelf image to diagnose.
  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Zo1mFsAAAAASUVORK5CYII='

  try {
    const replicate = new Replicate({ auth: token })
    const output = await replicate.run(model, {
      input: {
        image: tinyPng,
        points_per_side: 4,
        pred_iou_thresh: 0.5,
        stability_score_thresh: 0.5,
      },
    })
    report.sampleOutputKeys = output && typeof output === 'object'
      ? Array.isArray(output)
        ? `array(${output.length}) first=${JSON.stringify(Array.isArray(output[0]) ? 'array' : typeof output[0])}`
        : Object.keys(output as object)
      : typeof output
    report.sampleOutputPreview = JSON.stringify(output).slice(0, 500)
    report.conclusion = 'SAM call succeeded. Check the preview to confirm output shape matches our parser.'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    report.error = msg
    report.conclusion = /404/.test(msg)
      ? 'Model version does not exist. Pick a real one at replicate.com and set REPLICATE_SAM_MODEL as owner/name:version.'
      : /402|insufficient credit|payment required/i.test(msg)
        ? 'Replicate credit is $0. Go to replicate.com/account/billing and load some credit (a few dollars gets you hundreds of runs).'
        : /401|403|authen|unauth/i.test(msg)
          ? 'Auth failed. Double-check REPLICATE_API_TOKEN and that billing is set up.'
          : /input/i.test(msg)
            ? "Model exists but our input shape doesn't match it. Pick a different SAM auto-mask model or update sam.ts."
            : 'Unknown failure — see error field.'
  }
  return NextResponse.json(report)
}
