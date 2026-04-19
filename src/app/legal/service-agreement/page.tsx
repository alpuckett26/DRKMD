import BackButton from '../BackButton'

const EFFECTIVE = 'April 17, 2025'

export default function ServiceAgreement() {
  return (
    <div className="min-h-screen pb-16">
      <div className="panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="font-bold text-base">WendOS Platform Service Agreement</h1>
            <p className="text-xs text-gray-500">Effective {EFFECTIVE}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-8 text-sm text-gray-700 leading-relaxed">

        <div className="card border-brand/30 space-y-2">
          <p className="text-xs text-gray-500">This agreement is between <strong className="text-gray-900">WendOS, LLC</strong> ("WendOS," "we," "us") and the registered store operator ("Store," "you") who has completed the onboarding process. By checking the agreement box during onboarding or by using the WendOS platform, you accept these terms in full.</p>
        </div>

        <Section title="1. Services Provided">
          <p>WendOS provides the following to Store during the subscription term:</p>
          <ul className="space-y-1.5 mt-2 ml-4">
            <li>• <strong>Window Ordering Platform</strong> — customer-facing QR ordering system accessible via a unique store URL and QR code</li>
            <li>• <strong>Fulfillment Application</strong> — tablet-based staff interface for receiving, picking, and handing off orders</li>
            <li>• <strong>Payment Processing Integration</strong> — connection to Square for customer card authorization and capture</li>
            <li>• <strong>Order Notifications</strong> — SMS and email alerts to customers for order status updates</li>
            <li>• <strong>Inventory Management</strong> — admin panel for managing product listings, categories, and availability</li>
            <li>• <strong>Platform Updates</strong> — ongoing software improvements at no additional charge</li>
            <li>• <strong>Standard Support</strong> — email and chat support during business hours (Monday–Friday, 9 AM–6 PM CT)</li>
          </ul>
          <p className="mt-3 text-gray-500 text-xs">WendOS does not provide payment processing directly. Square's terms and fee schedule apply separately to payment transactions.</p>
        </Section>

        <Section title="2. Subscription & Pricing">
          <div className="space-y-3">
            <Row label="Starter Kit (one-time)" value="$349" sub="Hardware, window sign, QR decal, tablet mount, setup" />
            <Row label="Monthly Platform Fee" value="$99/mo" sub="Begins the billing cycle after Starter Kit ships" />
            <Row label="Transaction Fees" value="None" sub="WendOS takes no percentage of your sales" />
          </div>
          <p className="mt-4">WendOS reserves the right to adjust pricing with <strong>30 days written notice</strong> via email. Continued use after that date constitutes acceptance of the new pricing.</p>
        </Section>

        <Section title="3. Payment Terms">
          <ul className="space-y-2 ml-4">
            <li>• Monthly subscription is billed on the same calendar day each month beginning after kit shipment.</li>
            <li>• You authorize WendOS to charge the card on file for all recurring fees.</li>
            <li>• If a payment fails, WendOS will retry for up to 7 days. Accounts not resolved within 7 days may be suspended until payment is received.</li>
            <li>• Hardware is shipped only after the one-time Starter Kit payment is successfully processed.</li>
            <li>• All fees are in U.S. dollars. No refunds are issued on monthly subscription fees or hardware.</li>
          </ul>
        </Section>

        <Section title="4. Term & Cancellation">
          <ul className="space-y-2 ml-4">
            <li>• This agreement is month-to-month and begins on the date the Starter Kit is shipped.</li>
            <li>• Either party may terminate this agreement with <strong>30 days written notice</strong> to support@wendos.com.</li>
            <li>• Upon cancellation, Store access is terminated at the end of the current billing period.</li>
            <li>• No refunds are issued on partial months, hardware, or any prepaid fees.</li>
            <li>• All hardware (tablet, sign, mount) must be returned to WendOS within 30 days of cancellation. Unreturned hardware will be billed at replacement cost (see Section 6).</li>
          </ul>
        </Section>

        <Section title="5. Store Responsibilities">
          <p>Store agrees to:</p>
          <ul className="space-y-2 mt-2 ml-4">
            <li>• Provide reliable internet access at the installation location (minimum 10 Mbps recommended).</li>
            <li>• Keep the fulfillment tablet plugged in and connected to Wi-Fi during all operating hours.</li>
            <li>• Display the WendOS QR code sign at a visible window location accessible to customers.</li>
            <li>• Train relevant staff on the fulfillment application before going live.</li>
            <li>• Maintain accurate product listings including proper age-restriction flags for alcohol and tobacco.</li>
            <li>• Comply with all applicable laws regarding the sale of restricted products, including in-person age verification at the window.</li>
            <li>• Maintain a valid Square account in good standing for payment processing.</li>
            <li>• Promptly report hardware damage or malfunctions to WendOS support.</li>
          </ul>
        </Section>

        <Section title="6. Hardware Ownership & Care">
          <p>All hardware included in the Starter Kit remains the property of WendOS. Store is the custodian and is responsible for its care.</p>
          <div className="mt-3 space-y-2">
            <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">Replacement Costs (Damage or Loss)</p>
            <Row label="Fulfillment Tablet" value="$299" />
            <Row label="Window Sign" value="$149" />
            <Row label="Tablet Mount / Stand" value="$79" />
            <Row label="Window Decal" value="$49" />
          </div>
          <p className="mt-3">Normal wear and tear is expected. Store will not be charged for cosmetic wear from ordinary use. Hardware must be returned in working condition upon cancellation.</p>
        </Section>

        <Section title="7. Uptime & Service Levels">
          <ul className="space-y-2 ml-4">
            <li>• WendOS targets 99.5% platform availability measured monthly, excluding scheduled maintenance.</li>
            <li>• Scheduled maintenance will be communicated at least 24 hours in advance via email.</li>
            <li>• Service outages do not entitle Store to refunds or credits unless downtime exceeds 48 consecutive hours in a calendar month, in which case Store may receive a prorated credit for that period.</li>
            <li>• WendOS does not guarantee any particular volume of customer orders, revenue, or sales outcomes.</li>
          </ul>
        </Section>

        <Section title="8. Limitation of Liability">
          <ul className="space-y-2 ml-4">
            <li>• WendOS's total liability under this agreement is limited to the monthly subscription fees paid in the prior 3 months.</li>
            <li>• WendOS is not liable for lost revenue, lost profits, lost data, or any indirect, incidental, or consequential damages, even if advised of the possibility.</li>
            <li>• The platform is provided "as is." WendOS makes no warranties of merchantability or fitness for a particular purpose beyond what is expressly stated herein.</li>
            <li>• Store is solely responsible for compliance with all local, state, and federal laws governing retail sales, including liquor licensing, tobacco age restrictions, and food safety.</li>
          </ul>
        </Section>

        <Section title="9. Data & Privacy">
          <ul className="space-y-2 ml-4">
            <li>• WendOS collects and processes customer order data (name, phone, items, payment status) on behalf of Store.</li>
            <li>• Customer payment data is processed exclusively by Square and is not stored by WendOS.</li>
            <li>• WendOS will not sell or share Store or customer data with third parties, except as required by law or to provide the service.</li>
            <li>• Store owns its customer relationship. WendOS will provide a data export upon request within 30 days of cancellation.</li>
          </ul>
        </Section>

        <Section title="10. SMS & Communications">
          <p>By using the WendOS platform, Store agrees to receive:</p>
          <ul className="space-y-1.5 mt-2 ml-4">
            <li>• Operational SMS and email notifications related to orders and account status</li>
            <li>• Platform update announcements and billing notifications</li>
            <li>• Onboarding and support communications</li>
          </ul>
          <p className="mt-3">Store may opt out of non-essential communications at any time by contacting support@wendos.com. Operational order notifications cannot be disabled while service is active.</p>
        </Section>

        <Section title="11. ACH & Card Authorization">
          <p>By completing onboarding and checking the billing authorization box, Store authorizes WendOS to charge the card provided on file for:</p>
          <ul className="space-y-1.5 mt-2 ml-4">
            <li>• The one-time Starter Kit fee ($349) at time of purchase</li>
            <li>• The monthly platform subscription ($99/month) beginning after kit ships</li>
            <li>• Any hardware replacement fees assessed per Section 6</li>
          </ul>
          <p className="mt-3">This authorization remains in effect until Store cancels per Section 4. Store may update payment information at any time in the admin dashboard.</p>
        </Section>

        <Section title="12. Governing Law & Disputes">
          <ul className="space-y-2 ml-4">
            <li>• This agreement is governed by the laws of the State of Illinois, without regard to conflict-of-law principles.</li>
            <li>• Any dispute arising from this agreement that cannot be resolved informally within 30 days will be submitted to binding arbitration under the rules of the American Arbitration Association.</li>
            <li>• Class action and jury trial rights are waived by both parties.</li>
            <li>• Prevailing party in arbitration is entitled to recover reasonable attorney fees.</li>
          </ul>
        </Section>

        <Section title="13. Modifications to This Agreement">
          <p>WendOS may update this agreement at any time with 30 days written notice. Continued use of the platform after the effective date of changes constitutes acceptance. If Store does not agree to changes, Store may cancel per Section 4 before the effective date.</p>
        </Section>

        <div className="card border-brand/20 text-center space-y-2">
          <p className="text-xs text-gray-500">Questions? Reach us at <strong className="text-gray-700">support@wendos.com</strong></p>
          <p className="text-xs text-gray-600">WendOS, LLC · Service Agreement v1.0 · Effective {EFFECTIVE}</p>
          <p className="text-xs text-yellow-600">This document is provided for informational purposes. Consult a licensed attorney before relying on any legal document.</p>
        </div>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-black text-base text-gray-900 border-b border-gray-200 pb-2">{title}</h2>
      <div className="space-y-2 text-gray-700">{children}</div>
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 border-b border-gray-200/50">
      <div>
        <p className="text-sm">{label}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
      <p className="font-black text-brand shrink-0">{value}</p>
    </div>
  )
}
