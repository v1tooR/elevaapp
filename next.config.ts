import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options',           value: 'DENY' },
        { key: 'X-Content-Type-Options',    value: 'nosniff' },
        { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
        { key: 'X-DNS-Prefetch-Control',    value: 'on' },
        { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache' },
        { key: 'Content-Type', value: 'application/javascript' },
      ],
    },
    {
      source: '/manifest.json',
      headers: [
        { key: 'Content-Type', value: 'application/manifest+json' },
      ],
    },
  ],
}

export default nextConfig
