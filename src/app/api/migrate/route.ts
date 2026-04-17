import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST() {
  try {
    const output = execSync('npx prisma db push --accept-data-loss', {
      env: { ...process.env },
      timeout: 60000,
    }).toString()
    return NextResponse.json({ ok: true, output })
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; message?: string }
    return NextResponse.json({
      ok: false,
      error: err.message,
      stdout: err.stdout?.toString(),
      stderr: err.stderr?.toString(),
    }, { status: 500 })
  }
}
