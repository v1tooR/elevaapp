import type { Metadata, Viewport } from 'next'
import { DM_Sans, Red_Hat_Display } from 'next/font/google'
import './globals.css'
import { PWARegister } from '@/components/pwa-register'

const redHatDisplay = Red_Hat_Display({
  subsets: ['latin'],
  variable: '--font-red-hat-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Eleva Isenções',
  description: 'Sistema de Gestão de Processos PCD - Eleva Isenções',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Eleva Isenções',
  },
}

export const viewport: Viewport = {
  themeColor: '#1E1A17',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${redHatDisplay.variable} ${dmSans.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="h-full antialiased" suppressHydrationWarning>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}
