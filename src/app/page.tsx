export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-brand">WendOS</h1>
          <p className="text-gray-400 text-sm">Scan the QR code at the store window to begin your order.</p>
        </div>
        <div className="card space-y-3 text-left text-sm text-gray-400">
          <p>🔒 Store is locked for safety</p>
          <p>📱 Order from your phone</p>
          <p>💳 Pay securely – charged only for what you receive</p>
          <p>🪟 Show pickup code at window</p>
        </div>
        <div className="flex justify-center gap-4 text-xs text-gray-600">
          <p>Staff? <a href="/staff" className="text-brand underline">Staff login</a></p>
          <p>Store owner? <a href="/login" className="text-brand underline">Admin</a></p>
        </div>
      </div>
    </main>
  )
}
