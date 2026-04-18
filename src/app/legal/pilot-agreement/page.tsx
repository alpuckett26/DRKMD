import Link from 'next/link'
import BackButton from '../BackButton'

export default function PilotAgreement() {
  return (
    <div className="min-h-screen pb-16">
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="font-bold text-base">WendOS Pilot Program Agreement</h1>
            <p className="text-xs text-gray-500">For 14-day and 30-day trial participants</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-8 text-sm text-gray-300 leading-relaxed">

        <div className="card border-yellow-800/40 space-y-2">
          <p className="text-yellow-400 text-xs font-semibold">PILOT / TRIAL AGREEMENT</p>
          <p className="text-xs text-gray-400">This Pilot Agreement governs your participation in the WendOS pilot program. It supplements — and in the event of conflict, is superseded by — the WendOS Platform Service Agreement. Capitalized terms not defined here have the meaning given in the Service Agreement.</p>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">1. Pilot Period</h2>
          <p>WendOS offers eligible stores a pilot period of <strong>14 or 30 calendar days</strong> as specified at enrollment. The pilot period begins on the date WendOS activates your store account and hardware.</p>
          <p>During the pilot period:</p>
          <ul className="space-y-1.5 ml-4 mt-2">
            <li>• The monthly platform subscription fee ($99/mo) is <strong className="text-green-400">waived</strong>.</li>
            <li>• The Starter Kit fee is deferred — no hardware payment is collected upfront.</li>
            <li>• All platform features are available in full.</li>
            <li>• WendOS may limit pilot hardware to a loaner unit that must be returned if the store does not convert.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">2. Hardware During Pilot</h2>
          <ul className="space-y-2 ml-4">
            <li>• All hardware provided during the pilot remains the property of WendOS.</li>
            <li>• Store is responsible for hardware safety. Damage or loss during the pilot will be billed at replacement cost (see Section 6 of the Service Agreement).</li>
            <li>• If Store does not convert to a paid plan at the end of the pilot, all hardware must be returned within <strong>10 business days</strong> via prepaid shipping label provided by WendOS.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">3. Conversion to Paid Plan</h2>
          <p>At the conclusion of the pilot period, Store may elect to:</p>
          <ul className="space-y-2 ml-4 mt-2">
            <li>• <strong>Convert to the standard plan</strong> — pay the $349 Starter Kit fee, retain hardware, and begin the $99/month subscription. No interruption to service.</li>
            <li>• <strong>Extend the pilot</strong> — at WendOS's discretion, the pilot may be extended by mutual written agreement.</li>
            <li>• <strong>Decline</strong> — return hardware within 10 business days. No charges will be applied.</li>
          </ul>
          <p className="mt-3">WendOS will contact Store via email at least <strong>3 days before</strong> the pilot expiration date to discuss conversion.</p>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">4. Early Termination</h2>
          <p>Either party may terminate the pilot at any time without cause. If Store terminates early:</p>
          <ul className="space-y-2 ml-4 mt-2">
            <li>• Hardware must be returned within 10 business days.</li>
            <li>• No fees are owed for the pilot period.</li>
            <li>• Store data will be retained for 30 days, then deleted upon request or automatically.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">5. No Guarantee</h2>
          <p>Participation in the pilot program does not guarantee conversion approval, ongoing pricing, or availability of the WendOS service in your area. WendOS reserves the right to decline any store's conversion request.</p>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">6. Store Responsibilities During Pilot</h2>
          <p>Store agrees to:</p>
          <ul className="space-y-2 ml-4 mt-2">
            <li>• Complete the onboarding process including staff training before going live.</li>
            <li>• Provide honest feedback to WendOS about the product experience — this feedback helps us improve.</li>
            <li>• Use the platform in good faith as a genuine trial, not to extract proprietary information.</li>
            <li>• Comply with all applicable laws during the pilot period, including age verification for restricted items.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">7. Relationship to Service Agreement</h2>
          <p>All terms of the <Link href="/legal/service-agreement" className="text-brand underline">WendOS Platform Service Agreement</Link> apply during the pilot period, except where expressly modified by this Pilot Agreement. Upon conversion to a paid plan, the full Service Agreement governs without modification.</p>
        </div>

        <div className="space-y-3">
          <h2 className="font-black text-base text-white border-b border-gray-800 pb-2">8. Confidentiality</h2>
          <p>Store agrees not to disclose proprietary information about the WendOS platform (including software, pricing structures, or operational methods) to competitors or third parties without written consent. This obligation survives termination of the pilot.</p>
        </div>

        <div className="card border-brand/20 text-center space-y-2">
          <p className="text-xs text-gray-400">Interested in the pilot program? Contact us at <strong className="text-gray-300">hello@wendos.com</strong></p>
          <p className="text-xs text-gray-600">WendOS, LLC · Pilot Program Agreement v1.0</p>
          <p className="text-xs text-yellow-600">Consult a licensed attorney before relying on any legal document.</p>
        </div>

      </div>
    </div>
  )
}
