'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Script from 'next/script'

const STEPS = ['Welcome', 'Photo', 'Hours', 'Purchase', 'Done']

interface SquareConfig { appId: string; locationId: string; environment: string }

export default function SetupWizard() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [storeName, setStoreName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoSaving, setLogoSaving] = useState(false)
  const [windowStart, setWindowStart] = useState('22:00')
  const [windowEnd, setWindowEnd] = useState('06:00')
  const [squareConfig, setSquareConfig] = useState<SquareConfig | null>(null)
  const [squareLoaded, setSquareLoaded] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const cardRef = useRef<unknown>(null)

  useEffect(() => {
    fetch(`/api/stores/${storeId}`).then(r => r.json()).then(s => setStoreName(s.name))
    fetch('/api/square/config').then(r => r.json()).then(setSquareConfig)
  }, [storeId])

  useEffect(() => {
    if (step !== 3 || !squareConfig || !squareLoaded) return
    let card: unknown
    async function init() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sq = (window as any).Square
        const payments = sq.payments(squareConfig!.appId, squareConfig!.locationId)
        card = await payments.card()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (card as any).attach('#sq-card')
        cardRef.current = card
      } catch { setPayError('Failed to load payment form. Refresh and try again.') }
    }
    init()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (cardRef.current as any)?.destroy(); cardRef.current = null }
  }, [step, squareConfig, squareLoaded])

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoSaving(true)
    const base64 = await compressImage(file, 800, 0.75)
    setLogoUrl(base64)
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: base64 }),
    })
    setLogoSaving(false)
  }

  async function saveHours() {
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowModeStart: windowStart, windowModeEnd: windowEnd }),
    })
    setStep(3)
  }

  async function handlePurchase() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(cardRef.current as any)) return
    setPaying(true); setPayError('')
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (cardRef.current as any).tokenize()
      if (result.status !== 'OK') throw new Error(result.errors?.[0]?.message ?? 'Card declined')
      const res = await fetch(`/api/stores/${storeId}/activate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: result.token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const qr = await fetch(`/api/qr/${storeId}`).then(r => r.json())
      setQrUrl(qr.qrDataUrl)
      setStep(4)
    } catch (e) { setPayError(e instanceof Error ? e.message : 'Payment failed') }
    setPaying(false)
  }

  const scriptSrc = squareConfig?.environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'

  return (
    <>
      {squareConfig && <Script src={scriptSrc} onLoad={() => setSquareLoaded(true)} />}
      <div className="min-h-screen bg-gray-950 pb-10">
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="font-black text-brand">Setup Wizard</h1>
                <p className="text-xs text-gray-500">{storeName}</p>
              </div>
              <span className="text-xs text-gray-500">Step {step + 1} of {STEPS.length}</span>
            </div>
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-brand' : 'bg-gray-700'}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-8">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <p className="text-6xl">🪟</p>
                <h2 className="font-black text-2xl">Welcome, {storeName || '…'}!</h2>
                <p className="text-gray-400 text-sm">Let&apos;s get your window ready. Takes about 3 minutes.</p>
              </div>
              <div className="card space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">What we&apos;ll set up</p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs flex items-center justify-center font-bold">1</span> Storefront photo</div>
                  <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs flex items-center justify-center font-bold">2</span> Window hours</div>
                  <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs flex items-center justify-center font-bold">3</span> Starter kit purchase</div>
                </div>
              </div>
              <button onClick={() => setStep(1)} className="btn-primary w-full">Let&apos;s Go →</button>
            </div>
          )}

          {/* Step 1: Photo */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Storefront Photo</h2>
                <p className="text-gray-400 text-sm mt-1">Customers see this on your menu. Take a photo of your storefront or add your logo.</p>
              </div>
              {logoUrl
                ? <img src={logoUrl} alt="Preview" className="w-full max-h-52 object-cover rounded-2xl" />
                : <div className="w-full h-40 rounded-2xl bg-gray-800 flex items-center justify-center text-gray-600">No photo yet</div>
              }
              <label className={`btn-primary flex items-center justify-center gap-2 cursor-pointer ${logoSaving ? 'opacity-60 pointer-events-none' : ''}`}>
                {logoSaving ? 'Saving…' : logoUrl ? '📷 Retake Photo' : '📷 Take / Choose Photo'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
              </label>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
                <button onClick={() => setStep(2)} className="btn-primary flex-1">{logoUrl ? 'Next →' : 'Skip for Now →'}</button>
              </div>
            </div>
          )}

          {/* Step 2: Hours */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Window Hours</h2>
                <p className="text-gray-400 text-sm mt-1">When is your window open for orders?</p>
              </div>
              <div className="card grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Opens</label>
                  <input type="time" value={windowStart} onChange={e => setWindowStart(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Closes</label>
                  <input type="time" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} className="input" />
                </div>
              </div>
              <p className="text-xs text-gray-600">You can change these anytime from your admin dashboard.</p>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                <button onClick={saveHours} className="btn-primary flex-1">Next →</button>
              </div>
            </div>
          )}

          {/* Step 3: Purchase */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Starter Kit</h2>
                <p className="text-gray-400 text-sm mt-1">Everything you need to start taking window orders.</p>
              </div>
              <div className="card space-y-3">
                <p className="font-bold text-brand">Window Mode Starter Kit</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>💡 Lighted window sign with QR code</li>
                  <li>📱 Dedicated fulfillment tablet</li>
                  <li>🔧 Tablet stand / mount</li>
                  <li>🪟 Custom window decal</li>
                  <li>⚙️ Platform setup &amp; onboarding</li>
                </ul>
                <div className="border-t border-gray-700 pt-3 flex justify-between items-end">
                  <div>
                    <p className="text-xs text-gray-500">One-time</p>
                    <p className="font-black text-3xl">$349</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Then monthly</p>
                    <p className="font-black text-xl text-brand">$99<span className="text-xs font-normal text-gray-400">/mo</span></p>
                  </div>
                </div>
              </div>
              <div id="sq-card" className="min-h-[100px] rounded-xl overflow-hidden" />
              {payError && <p className="text-red-400 text-sm">{payError}</p>}
              {!squareLoaded && <p className="text-xs text-gray-500 text-center">Loading payment form…</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1" disabled={paying}>Back</button>
                <button onClick={handlePurchase} className="btn-primary flex-1" disabled={paying || !squareLoaded}>
                  {paying ? 'Processing…' : 'Purchase $349 →'}
                </button>
              </div>
              <p className="text-xs text-gray-600 text-center">Monthly billing starts after your kit ships. Cancel anytime.</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center space-y-6">
              <div>
                <p className="text-6xl">🎉</p>
                <h2 className="font-black text-2xl mt-3">You&apos;re all set!</h2>
                <p className="text-gray-400 text-sm mt-2">Your kit is on its way. Your store is live.</p>
              </div>
              <div className="card space-y-2 text-sm text-gray-400 text-left">
                <p>📦 Kit ships within 3–5 business days</p>
                <p>📧 Confirmation sent to your email</p>
                <p>💬 We&apos;ll contact you to confirm your address</p>
              </div>
              {qrUrl && (
                <div className="card space-y-2">
                  <p className="text-xs text-gray-500">Your store QR code — post it at your window</p>
                  <img src={qrUrl} alt="QR Code" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" />
                </div>
              )}
              <button onClick={() => router.push(`/admin/${storeId}`)} className="btn-primary w-full">
                Go to Admin Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}
