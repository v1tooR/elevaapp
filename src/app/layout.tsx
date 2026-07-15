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
  applicationName: 'Eleva App',
  title: {
    default: 'Eleva App',
    template: '%s | Eleva App',
  },
  description: 'Gestão de processos e isenções para pessoas com deficiência.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Eleva App',
  },
}

export const viewport: Viewport = {
  themeColor: '#A14F2A',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${redHatDisplay.variable} ${dmSans.variable} h-full`}>
      <body className="h-full antialiased" suppressHydrationWarning>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}
