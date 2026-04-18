import type { Metadata, Viewport } from 'next'
import { CartProvider } from '@/context/CartContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'WendOS – Order Safely',
  description: 'Scan & order through the window. No entry required.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WendOS',
  },
  formatDetection: { telephone: false },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050A12',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
