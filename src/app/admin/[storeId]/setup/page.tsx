'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import confetti from 'canvas-confetti'

const STEPS = ['Welcome', 'Business', 'Photo', 'Hours', 'Terms', 'Purchase', 'Done']

const BUSINESS_TYPES = ['Sole Proprietorship', 'LLC', 'Corporation', 'Partnership', 'Other']

interface SquareConfig { appId: string; locationId: string; environment: string }

export default function SetupWizard() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [storeName, setStoreName] = useState('')

  // Business info
  const [phone, setPhone] = useState('')
  const [businessLegalName, setBusinessLegalName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [ein, setEin] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')

  // Photo
  const [logoUrl, setLogoUrl] = useState('')
  const [logoSaving, setLogoSaving] = useState(false)

  // Hours
  const [windowStart, setWindowStart] = useState('22:00')
  const [windowEnd, setWindowEnd] = useState('06:00')

  // Terms
  const [tosChecked, setTosChecked] = useState(false)
  const [billingChecked, setBillingChecked] = useState(false)
  const [authorizedChecked, setAuthorizedChecked] = useState(false)

  // Payment
  const [squareConfig, setSquareConfig] = useState<SquareConfig | null>(null)
  const [squareLoaded, setSquareLoaded] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const cardRef = useRef<unknown>(null)

  const isDemo = storeId === 'store_demo'

  useEffect(() => {
    fetch(`/api/stores/${storeId}`).then(r => r.json()).then(s => setStoreName(s.name))
    fetch('/api/square/config').then(r => r.json()).then(setSquareConfig)
  }, [storeId])

  // Init Square card on purchase step
  useEffect(() => {
    if (step !== 5 || !squareConfig || !squareLoaded) return
    async function init() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payments = (window as any).Square.payments(squareConfig!.appId, squareConfig!.locationId)
        const card = await payments.card()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (card as any).attach('#sq-card')
        cardRef.current = card
      } catch { setPayError('Failed to load payment form. Refresh and try again.') }
    }
    init()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (cardRef.current as any)?.destroy(); cardRef.current = null }
  }, [step, squareConfig, squareLoaded])

  // Confetti on done
  useEffect(() => {
    if (step !== 6) return
    const end = Date.now() + 2500
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f97316', '#fb923c', '#fdba74'] })
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#f97316', '#fb923c', '#fdba74'] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [step])

  async function saveBusinessInfo() {
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, businessLegalName, businessType, ein, address, city, state, zip }),
    })
    setStep(2)
  }

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
    setStep(4)
  }

  async function acceptTerms() {
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tosAcceptedAt: new Date().toISOString() }),
    })
    if (isDemo) { setStep(6); return }
    setStep(5)
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
      setStep(6)
    } catch (e) { setPayError(e instanceof Error ? e.message : 'Payment failed') }
    setPaying(false)
  }

  const scriptSrc = squareConfig?.environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'

  const canAcceptTerms = tosChecked && billingChecked && authorizedChecked

  return (
    <>
      {squareConfig && !isDemo && <Script src={scriptSrc} onLoad={() => setSquareLoaded(true)} />}
      <div className="min-h-screen bg-gray-950 pb-10">
        {/* Header + progress */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="font-black text-brand">Setup Wizard</h1>
                <p className="text-xs text-gray-500">{storeName}{isDemo && ' · DEMO MODE'}</p>
              </div>
              <span className="text-xs text-gray-500">{step + 1} / {STEPS.length}</span>
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
                <p className="text-gray-400 text-sm">Let&apos;s get your window ready. About 5 minutes.</p>
              </div>
              <div className="card space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">What we&apos;ll cover</p>
                <div className="space-y-3 text-sm">
                  {['Business & shipping info', 'Storefront photo', 'Window hours', 'Terms & agreement', isDemo ? 'Kit purchase (skipped in demo)' : 'Kit purchase — $349'].map((label, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                      <span className={isDemo && i === 4 ? 'text-gray-600 line-through' : ''}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {isDemo && <p className="text-xs text-center text-yellow-500 bg-yellow-900/20 rounded-xl p-3">Demo mode — payment step is skipped. Reset anytime from admin.</p>}
              <button onClick={() => setStep(1)} className="btn-primary w-full">Let&apos;s Go →</button>
            </div>
          )}

          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Business Info</h2>
                <p className="text-gray-400 text-sm mt-1">Used for kit shipping, billing, and tax records.</p>
              </div>
              <div className="card space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Contact</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Phone Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className="input" />
                </div>
              </div>
              <div className="card space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Kit Shipping Address</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Street Address</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" className="input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">City</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Chicago" className="input" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">State</label>
                    <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="IL" maxLength={2} className="input uppercase" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">ZIP Code</label>
                  <input type="text" value={zip} onChange={e => setZip(e.target.value)} placeholder="60601" maxLength={5} className="input" />
                </div>
              </div>
              <div className="card space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tax Information</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Business Legal Name</label>
                  <input type="text" value={businessLegalName} onChange={e => setBusinessLegalName(e.target.value)} placeholder="Your LLC or legal name" className="input" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Business Type</label>
                  <select value={businessType} onChange={e => setBusinessType(e.target.value)} className="input">
                    <option value="">Select type…</option>
                    {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">EIN / Tax ID <span className="text-gray-600">(or last 4 of SSN if sole prop)</span></label>
                  <input type="text" value={ein} onChange={e => setEin(e.target.value)} placeholder="XX-XXXXXXX" className="input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
                <button onClick={saveBusinessInfo} disabled={!address || !city || !state || !zip} className="btn-primary flex-1">Save &amp; Continue →</button>
              </div>
              <p className="text-xs text-gray-600 text-center">Tax info is stored securely and used only for compliance reporting.</p>
            </div>
          )}

          {/* Step 2: Photo */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Storefront Photo</h2>
                <p className="text-gray-400 text-sm mt-1">Customers see this on your menu. Take a photo of your storefront or logo.</p>
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
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1">{logoUrl ? 'Next →' : 'Skip for Now →'}</button>
              </div>
            </div>
          )}

          {/* Step 3: Hours */}
          {step === 3 && (
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
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
                <button onClick={saveHours} className="btn-primary flex-1">Next →</button>
              </div>
            </div>
          )}

          {/* Step 4: Terms */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Terms &amp; Agreement</h2>
                <p className="text-gray-400 text-sm mt-1">Please review before purchasing.</p>
              </div>

              {/* How payments work */}
              <div className="card space-y-3">
                <p className="font-bold text-sm">How Customer Payments Work</p>
                <div className="space-y-2 text-xs text-gray-400">
                  <p>① Customer places an order and their card is <strong className="text-gray-200">authorized</strong> (hold placed, no charge yet).</p>
                  <p>② You fulfill the order and mark items found or unavailable.</p>
                  <p>③ When you mark the order ready, the final amount is <strong className="text-gray-200">captured</strong> (charged to their card).</p>
                  <p>④ If an order is voided or canceled, the authorization is <strong className="text-gray-200">released</strong> — the customer is never charged.</p>
                  <p>⑤ Substitutions, if allowed, are reflected in the final captured amount.</p>
                </div>
              </div>

              {/* Platform fees */}
              <div className="card space-y-3">
                <p className="font-bold text-sm">Platform Fees</p>
                <div className="space-y-1 text-xs text-gray-400">
                  <p>• <strong className="text-gray-200">$349 one-time</strong> — Starter Kit (hardware + setup)</p>
                  <p>• <strong className="text-gray-200">$99/month</strong> — Platform access, starting after kit ships</p>
                  <p>• <strong className="text-gray-200">No transaction fees</strong> — we don&apos;t take a cut of your sales</p>
                  <p>• Cancel with 30 days notice. No refunds on kit hardware.</p>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="card space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={tosChecked} onChange={e => setTosChecked(e.target.checked)} className="mt-0.5 accent-brand w-4 h-4 shrink-0" />
                  <span className="text-xs text-gray-300">I have read and agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>. I understand how customer payment authorization and capture works as described above.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={billingChecked} onChange={e => setBillingChecked(e.target.checked)} className="mt-0.5 accent-brand w-4 h-4 shrink-0" />
                  <span className="text-xs text-gray-300">I authorize Window Mode to charge my card <strong>$99/month</strong> after my kit ships. I can cancel with 30 days written notice.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={authorizedChecked} onChange={e => setAuthorizedChecked(e.target.checked)} className="mt-0.5 accent-brand w-4 h-4 shrink-0" />
                  <span className="text-xs text-gray-300">I confirm I am <strong>authorized</strong> to enter this agreement on behalf of the business listed above.</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="btn-secondary flex-1">Back</button>
                <button onClick={acceptTerms} disabled={!canAcceptTerms} className="btn-primary flex-1">
                  {isDemo ? 'Accept & Finish Demo →' : 'Accept & Purchase →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Purchase (skipped for demo) */}
          {step === 5 && (
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
              <p className="text-xs text-gray-500">Shipping to: {address}, {city}, {state} {zip}</p>
              <div id="sq-card" className="min-h-[100px] rounded-xl overflow-hidden" />
              {payError && <p className="text-red-400 text-sm">{payError}</p>}
              {!squareLoaded && <p className="text-xs text-gray-500 text-center">Loading payment form…</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="btn-secondary flex-1" disabled={paying}>Back</button>
                <button onClick={handlePurchase} className="btn-primary flex-1" disabled={paying || !squareLoaded}>
                  {paying ? 'Processing…' : 'Pay $349 →'}
                </button>
              </div>
              <p className="text-xs text-gray-600 text-center">Monthly billing starts after your kit ships.</p>
            </div>
          )}

          {/* Step 6: Done */}
          {step === 6 && (
            <div className="text-center space-y-6">
              <div>
                <p className="text-6xl">🎉</p>
                <h2 className="font-black text-3xl mt-3">
                  Welcome to the team{storeName ? `, ${storeName}` : ''}!
                </h2>
                <p className="text-gray-400 text-sm mt-2">
                  {isDemo ? 'Demo complete. Reset and run again anytime.' : 'Your kit is on its way. Your store is live.'}
                </p>
              </div>
              {!isDemo && (
                <div className="card space-y-2 text-sm text-gray-400 text-left">
                  <p>📦 Kit ships within 3–5 business days</p>
                  <p>📧 Confirmation sent to your email</p>
                  <p>💬 We&apos;ll contact you to confirm your shipping address</p>
                  <p>💳 Monthly billing begins after kit ships</p>
                </div>
              )}
              {qrUrl && (
                <div className="card space-y-2">
                  <p className="text-xs text-gray-500">Your store QR — post it at your window</p>
                  <img src={qrUrl} alt="QR Code" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" />
                </div>
              )}
              <button onClick={() => router.push(`/admin/${storeId}`)} className="btn-primary w-full">
                Go to Dashboard →
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
