'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const REFRESH_INTERVAL_MS = 15_000
const MIN_REFRESH_GAP_MS = 2_000

export function PortalAutoRefresh() {
  const router = useRouter()
  const lastRefreshAt = useRef(0)

  const refresh = useCallback(() => {
    const now = Date.now()
    if (!navigator.onLine || now - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return
    lastRefreshAt.current = now
    router.refresh()
  }, [router])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, REFRESH_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh])

  return null
}
