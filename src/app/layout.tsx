import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PWARegister } from '@/components/pwa-register'

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
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="h-full bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}
