'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import confetti from 'canvas-confetti'

const STEPS = ['Welcome', 'Business', 'Photo', 'Shelf', 'Hours', 'Terms', 'Purchase', 'Done']
const BUSINESS_TYPES = ['Sole Proprietorship', 'LLC', 'Corporation', 'Partnership', 'Other']

interface SquareConfig { appId: string; locationId: string; environment: string }
interface SuggestedProduct { name: string; category: string; restricted: boolean; estimatedPrice: number | null; imageUrl: string | null; selected: boolean; customPrice: string }

export default function SetupWizard() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [storeName, setStoreName] = useState('')

  const [phone, setPhone] = useState('')
  const [businessLegalName, setBusinessLegalName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [ein, setEin] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [zip, setZip] = useState('')

  const [logoUrl, setLogoUrl] = useState('')
  const [logoSaving, setLogoSaving] = useState(false)

  // Shelf photos
  const [shelfPhotos, setShelfPhotos] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedProduct[]>([])
  const [addingItems, setAddingItems] = useState(false)
  const [itemsAdded, setItemsAdded] = useState(false)

  const [windowStart, setWindowStart] = useState('22:00')
  const [windowEnd, setWindowEnd] = useState('06:00')

  const [tosChecked, setTosChecked] = useState(false)
  const [billingChecked, setBillingChecked] = useState(false)
  const [authorizedChecked, setAuthorizedChecked] = useState(false)

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

  useEffect(() => {
    if (step !== 6 || !squareConfig || !squareLoaded) return
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

  useEffect(() => {
    if (step !== 7) return
    const end = Date.now() + 2500
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#2EA8FF', '#44b4ff', '#1A8FE3'] })
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#2EA8FF', '#44b4ff', '#1A8FE3'] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [step])

  async function saveBusinessInfo() {
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, businessLegalName, businessType, ein, address, city, state: stateVal, zip }),
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

  async function handleShelfPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const compressed = await Promise.all(files.map(f => compressImage(f, 600, 0.6)))
    setShelfPhotos(prev => [...prev, ...compressed].slice(0, 6))
    setSuggestions([])
    setItemsAdded(false)
    e.target.value = ''
  }

  async function analyzeShelf() {
    if (!shelfPhotos.length) return
    setAnalyzing(true)
    setSuggestions([])
    try {
      const res = await fetch(`/api/stores/${storeId}/shelf-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: shelfPhotos }),
      })
      const data = await res.json()
      setSuggestions((data.products ?? []).map((p: Omit<SuggestedProduct, 'selected' | 'customPrice'>) => ({
        ...p,
        selected: true,
        customPrice: p.estimatedPrice != null ? String(p.estimatedPrice) : '',
      })))
    } catch {
      setSuggestions([])
    }
    setAnalyzing(false)
  }

  async function addSelectedItems() {
    const selected = suggestions.filter(s => s.selected)
    if (!selected.length) return
    setAddingItems(true)
    await Promise.all(selected.map(p => {
      const priceVal = parseFloat(p.customPrice)
      const priceCents = !isNaN(priceVal) && priceVal > 0 ? Math.round(priceVal * 100) : 0
      return fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, name: p.name, category: p.category,
          price: priceCents,
          restrictedFlag: p.restricted,
          nighttimeAvailable: true,
          imageUrl: p.imageUrl ?? undefined,
        }),
      })
    }))
    setAddingItems(false)
    setItemsAdded(true)
  }

  async function saveHours() {
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowModeStart: windowStart, windowModeEnd: windowEnd }),
    })
    setStep(5)
  }

  async function acceptTerms() {
    await fetch(`/api/stores/${storeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tosAcceptedAt: new Date().toISOString() }),
    })
    if (isDemo) { setStep(7); return }
    setStep(6)
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
      setStep(7)
    } catch (e) { setPayError(e instanceof Error ? e.message : 'Payment failed') }
    setPaying(false)
  }

  const scriptSrc = squareConfig?.environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'

  const canAcceptTerms = tosChecked && billingChecked && authorizedChecked
  const selectedCount = suggestions.filter(s => s.selected && s.customPrice).length

  return (
    <>
      {squareConfig && !isDemo && <Script src={scriptSrc} onLoad={() => setSquareLoaded(true)} />}
      <div className="min-h-screen pb-10">
        <div className="panel px-4 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="font-black text-brand glow-text">Setup Wizard</h1>
                <p className="text-xs text-gray-500">{storeName}{isDemo && ' · DEMO MODE'}</p>
              </div>
              <span className="text-xs text-gray-500">{step + 1} / {STEPS.length}</span>
            </div>
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-brand' : 'bg-gray-700'}`}
                  style={i <= step ? { boxShadow: '0 0 6px rgba(46,168,255,0.5)' } : {}} />
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
                  {['Business & shipping info', 'Storefront photo', 'Shelf inventory photos', 'Window hours', 'Terms & agreement', isDemo ? 'Kit purchase (skipped in demo)' : 'Kit purchase — $349'].map((label, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                      <span className={isDemo && i === 5 ? 'text-gray-600 line-through' : ''}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {isDemo && <p className="text-xs text-center text-yellow-500 bg-yellow-900/20 rounded-xl p-3">Demo mode — payment step is skipped.</p>}
              <button onClick={() => setStep(1)} className="btn-primary">Let&apos;s Go →</button>
            </div>
          )}

          {/* Step 1: Business */}
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
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street Address" className="input" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="input" />
                  <input type="text" value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="State" maxLength={2} className="input uppercase" />
                </div>
                <input type="text" value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP Code" maxLength={5} className="input" />
              </div>
              <div className="card space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tax Information</p>
                <input type="text" value={businessLegalName} onChange={e => setBusinessLegalName(e.target.value)} placeholder="Business Legal Name" className="input" />
                <select value={businessType} onChange={e => setBusinessType(e.target.value)} className="input">
                  <option value="">Business Type…</option>
                  {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">EIN / Tax ID <span className="text-gray-600">(or last 4 of SSN if sole prop)</span></label>
                  <input type="text" value={ein} onChange={e => setEin(e.target.value)} placeholder="XX-XXXXXXX" className="input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
                <button onClick={saveBusinessInfo} disabled={!address || !city || !stateVal || !zip} className="btn-primary flex-1">Save & Continue →</button>
              </div>
            </div>
          )}

          {/* Step 2: Storefront Photo */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Storefront Photo</h2>
                <p className="text-gray-400 text-sm mt-1">Customers see this on your menu. Take a photo of your storefront or logo.</p>
              </div>
              {logoUrl
                ? <img src={logoUrl} alt="Preview" className="w-full max-h-52 object-cover rounded-2xl" />
                : <div className="w-full h-40 rounded-2xl glass flex items-center justify-center text-gray-600">No photo yet</div>
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

          {/* Step 3: Shelf Photos */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Shelf Inventory</h2>
                <p className="text-gray-400 text-sm mt-1">Take photos of your shelves — we&apos;ll use AI to build your menu automatically.</p>
              </div>

              <div className="card space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">📸 Tips for best results</p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Stand 2–3 feet back so the full shelf is in frame</li>
                  <li>• Take one photo per shelf section or aisle</li>
                  <li>• Make sure labels are readable — good lighting helps</li>
                  <li>• Cover all sections: drinks, snacks, beer, tobacco, etc.</li>
                  <li>• Up to 6 photos total</li>
                </ul>
              </div>

              {/* Photo grid */}
              {shelfPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {shelfPhotos.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                      <img src={img} alt={`Shelf ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => { setShelfPhotos(p => p.filter((_, j) => j !== i)); setSuggestions([]); setItemsAdded(false) }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {shelfPhotos.length < 6 && (
                <label className="btn-secondary flex items-center justify-center gap-2 cursor-pointer">
                  📷 {shelfPhotos.length === 0 ? 'Take Shelf Photos' : `Add More (${shelfPhotos.length}/6)`}
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleShelfPhoto} />
                </label>
              )}

              {shelfPhotos.length > 0 && !itemsAdded && (
                <button onClick={analyzeShelf} disabled={analyzing} className="btn-primary">
                  {analyzing ? '🔍 Analyzing shelves…' : `✨ Identify Products (${shelfPhotos.length} photo${shelfPhotos.length !== 1 ? 's' : ''})`}
                </button>
              )}

              {analyzing && (
                <div className="card text-center py-6 space-y-2">
                  <p className="text-brand animate-pulse font-semibold">Scanning your shelves…</p>
                  <p className="text-xs text-gray-500">This takes 15–30 seconds</p>
                </div>
              )}

              {suggestions.length > 0 && !itemsAdded && (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">✨ Found {suggestions.length} products</p>
                    <div className="flex gap-3 text-xs">
                      <button onClick={() => setSuggestions(p => p.map(s => ({ ...s, selected: true })))} className="text-brand underline">All</button>
                      <button onClick={() => setSuggestions(p => p.map(s => ({ ...s, selected: false })))} className="text-gray-500 underline">None</button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <div key={i}
                        className={`flex items-center gap-3 py-2 cursor-pointer transition-opacity ${s.selected ? '' : 'opacity-40'}`}
                        onClick={() => setSuggestions(p => p.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                      >
                        <input type="checkbox" checked={s.selected} readOnly
                          className="accent-brand w-4 h-4 shrink-0" />
                        {s.imageUrl
                          ? <img src={s.imageUrl} alt={s.name} className="w-10 h-10 rounded-lg object-contain bg-gray-800 shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-gray-800 shrink-0 flex items-center justify-center text-lg">🛒</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.category}{s.restricted ? ' · 21+' : ''}</p>
                        </div>
                        <input
                          type="number" step="0.01" min="0" placeholder="Price"
                          value={s.customPrice}
                          onChange={e => { e.stopPropagation(); setSuggestions(p => p.map((x, j) => j === i ? { ...x, customPrice: e.target.value } : x)) }}
                          onClick={e => e.stopPropagation()}
                          className="input text-sm py-1 w-20 shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={addSelectedItems} disabled={addingItems || selectedCount === 0} className="btn-primary">
                    {addingItems ? 'Adding items…' : `Add ${selectedCount} item${selectedCount !== 1 ? 's' : ''} to Menu`}
                  </button>
                </div>
              )}

              {itemsAdded && (
                <div className="card text-center py-4 space-y-1" style={{ borderColor: 'rgba(46,168,255,0.4)' }}>
                  <p className="text-brand font-bold">✓ {selectedCount} items added to your menu</p>
                  <p className="text-xs text-gray-500">You can add more items anytime from your dashboard.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
                <button onClick={() => setStep(4)} className="btn-primary flex-1">
                  {shelfPhotos.length === 0 ? 'Skip for Now →' : 'Next →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Hours */}
          {step === 4 && (
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
                <button onClick={() => setStep(3)} className="btn-secondary flex-1">Back</button>
                <button onClick={saveHours} className="btn-primary flex-1">Next →</button>
              </div>
            </div>
          )}

          {/* Step 5: Terms */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Terms & Agreement</h2>
                <p className="text-gray-400 text-sm mt-1">Please review before purchasing.</p>
              </div>
              <div className="card space-y-3">
                <p className="font-bold text-sm">How Customer Payments Work</p>
                <div className="space-y-2 text-xs text-gray-400">
                  <p>① Customer orders and their card is <strong className="text-gray-200">authorized</strong> (hold placed, not charged yet).</p>
                  <p>② You fulfill the order and mark items found or unavailable.</p>
                  <p>③ Final amount is <strong className="text-gray-200">captured</strong> when you mark the order ready.</p>
                  <p>④ Voided or canceled orders are fully <strong className="text-gray-200">released</strong> — customer is never charged.</p>
                </div>
              </div>
              <div className="card space-y-3">
                <p className="font-bold text-sm">Platform Fees</p>
                <div className="space-y-1 text-xs text-gray-400">
                  <p>• <strong className="text-gray-200">$349 one-time</strong> — Starter Kit (hardware + setup)</p>
                  <p>• <strong className="text-gray-200">$99/month</strong> — Platform access, starting after kit ships</p>
                  <p>• <strong className="text-gray-200">No transaction fees</strong> — we don&apos;t take a cut of your sales</p>
                  <p>• Cancel with 30 days notice. No refunds on kit hardware.</p>
                </div>
              </div>
              <div className="card space-y-1 border-brand/20">
                <a href="/legal/service-agreement" target="_blank" className="flex items-center justify-between py-2 text-sm hover:text-brand transition-colors">
                  <span>📄 Platform Service Agreement</span>
                  <span className="text-gray-500 text-xs">Read →</span>
                </a>
                <div className="border-t border-gray-800" />
                <a href="/legal/pilot-agreement" target="_blank" className="flex items-center justify-between py-2 text-sm hover:text-brand transition-colors">
                  <span>🧪 Pilot Program Agreement</span>
                  <span className="text-gray-500 text-xs">Read →</span>
                </a>
              </div>
              <div className="card space-y-4">
                {[
                  { key: 'tos', checked: tosChecked, set: setTosChecked, label: 'I have read and agree to the WendOS Platform Service Agreement. I understand how customer payment authorization and capture works, and I agree to comply with all age-verification requirements for restricted items.' },
                  { key: 'billing', checked: billingChecked, set: setBillingChecked, label: 'I authorize WendOS to charge my card on file $349 for the Starter Kit now, and $99/month after the kit ships. I understand I can cancel with 30 days written notice and that hardware must be returned upon cancellation.' },
                  { key: 'auth', checked: authorizedChecked, set: setAuthorizedChecked, label: 'I confirm I am authorized to enter this agreement on behalf of the business listed above, and I consent to receive SMS and email notifications from WendOS related to my account and orders.' },
                ].map(({ key, checked, set, label }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} className="mt-0.5 accent-brand w-4 h-4 shrink-0" />
                    <span className="text-xs text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="btn-secondary flex-1">Back</button>
                <button onClick={acceptTerms} disabled={!canAcceptTerms} className="btn-primary flex-1">
                  {isDemo ? 'Accept & Finish Demo →' : 'Accept & Purchase →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Purchase */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-xl">Starter Kit</h2>
                <p className="text-gray-400 text-sm mt-1">Everything you need to start taking window orders.</p>
              </div>
              <div className="card space-y-3">
                <p className="font-bold text-brand">WendOS Starter Kit</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>💡 Lighted window sign with QR code</li>
                  <li>📱 Dedicated fulfillment tablet</li>
                  <li>🔧 Tablet stand / mount</li>
                  <li>🪟 Custom window decal</li>
                  <li>⚙️ Platform setup & onboarding</li>
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
              <p className="text-xs text-gray-500">Shipping to: {address}, {city}, {stateVal} {zip}</p>
              <div id="sq-card" className="min-h-[100px] rounded-xl overflow-hidden" />
              {payError && <p className="text-red-400 text-sm">{payError}</p>}
              {!squareLoaded && <p className="text-xs text-gray-500 text-center">Loading payment form…</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(5)} className="btn-secondary flex-1" disabled={paying}>Back</button>
                <button onClick={handlePurchase} className="btn-primary flex-1" disabled={paying || !squareLoaded}>
                  {paying ? 'Processing…' : 'Pay $349 →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Done */}
          {step === 7 && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-6xl">🎉</p>
                <h2 className="font-black text-3xl mt-3">
                  Welcome to the team{storeName ? `, ${storeName}` : ''}!
                </h2>
                <p className="text-gray-400 text-sm mt-2">
                  {isDemo ? 'Demo complete. Reset and run again anytime.' : 'Your kit is on its way. Your store goes live once hardware arrives.'}
                </p>
              </div>

              {!isDemo && (
                <>
                  <div className="card space-y-2 text-sm text-gray-400">
                    <p className="font-bold text-white text-xs uppercase tracking-widest mb-3">What happens next</p>
                    <p>📦 Kit ships within 3–5 business days</p>
                    <p>📧 Confirmation sent to your email</p>
                    <p>💬 Our team will call to schedule your installation</p>
                    <p>💳 Monthly billing begins after kit ships</p>
                  </div>

                  <div className="card space-y-4">
                    <p className="font-bold text-white text-xs uppercase tracking-widest">Go-Live Checklist</p>
                    <p className="text-xs text-gray-500">Complete this with your WendOS installer on the day your kit arrives.</p>
                    {[
                      'Tablet is mounted, plugged in, and connected to Wi-Fi',
                      'QR code sign is posted at the service window',
                      'Window decal is applied and visible from the street',
                      'Staff have logged in and completed a test order',
                      'Order alerts (SMS/email) confirmed working',
                      'Store owner/manager has been trained on the fulfillment app',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-gray-400">
                        <div className="w-5 h-5 mt-0.5 rounded border border-gray-600 shrink-0 flex items-center justify-center text-xs text-gray-600">{i + 1}</div>
                        <span>{item}</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-600">Your installer will sign off on this checklist. A copy will be emailed to you and kept on file by WendOS.</p>
                  </div>
                </>
              )}

              {qrUrl && (
                <div className="card space-y-2 text-center">
                  <p className="text-xs text-gray-500">Your store QR — post it at your window</p>
                  <img src={qrUrl} alt="QR Code" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" />
                </div>
              )}

              {isDemo && (
                <div className="card space-y-2 border border-yellow-800/40">
                  <p className="text-yellow-400 text-xs font-semibold">Demo Complete</p>
                  <p className="text-xs text-gray-500">Ready to go live? Sign up for a real account to receive your Starter Kit and activate your window.</p>
                </div>
              )}

              <button onClick={() => router.push(`/admin/${storeId}`)} className="btn-primary">
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
