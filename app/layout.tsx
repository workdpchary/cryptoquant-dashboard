import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/app/components/Nav'

export const metadata: Metadata = {
  title       : 'CryptoQuant',
  description : 'Personal crypto quant dashboard — live signals, real backtest, portfolio tracking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen grid-bg">
        <Nav />
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-20">
          {children}
        </main>
      </body>
    </html>
  )
}
