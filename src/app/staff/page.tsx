import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function StaffEntryPage() {
  const stores = await db.store.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-brand">Staff Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Select your store</p>
        </div>
        <div className="space-y-2">
          {stores.map(store => (
            <Link
              key={store.id}
              href={`/staff/${store.id}/orders`}
              className="card flex items-center justify-between hover:bg-gray-800 transition-colors"
            >
              <div>
                <p className="font-semibold">{store.name}</p>
                <p className="text-xs text-gray-500">{store.location}</p>
              </div>
              <span className="text-gray-500 text-xl">›</span>
            </Link>
          ))}
        </div>
        <p className="text-center text-xs text-gray-600">
          <Link href="/" className="underline">← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
