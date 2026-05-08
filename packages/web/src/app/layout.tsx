import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://reflog.app'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: 'reflog — dev metrics for people who ship',
  description: 'Track your GitHub activity, streaks, and productivity metrics in one place.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
