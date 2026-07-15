'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

function subscribeToConnectionChange(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange)
  window.addEventListener('offline', onStoreChange)

  return () => {
    window.removeEventListener('online', onStoreChange)
    window.removeEventListener('offline', onStoreChange)
  }
}

export function PWARegister() {
  const isOffline = useSyncExternalStore(
    subscribeToConnectionChange,
    () => !navigator.onLine,
    () => false,
  )
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const reloadAfterUpdate = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))

      return
    }

    let registration: ServiceWorkerRegistration | undefined
    let updateTimer: ReturnType<typeof setInterval> | undefined

    const offerUpdate = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) setWaitingWorker(worker)
    }

    const watchRegistration = (nextRegistration: ServiceWorkerRegistration) => {
      registration = nextRegistration
      offerUpdate(nextRegistration.waiting)

      nextRegistration.addEventListener('updatefound', () => {
        const installingWorker = nextRegistration.installing
        if (!installingWorker) return

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') offerUpdate(installingWorker)
        })
      })
    }

    const register = async () => {
      try {
        watchRegistration(
          await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none',
          }),
        )

        updateTimer = setInterval(() => void registration?.update(), 60 * 60 * 1000)
      } catch (error) {
        console.error('Não foi possível registrar o modo aplicativo.', error)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void registration?.update()
    }

    const handleControllerChange = () => {
      if (reloadAfterUpdate.current) window.location.reload()
    }

    window.addEventListener('load', register)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    if (document.readyState === 'complete') void register()

    return () => {
      if (updateTimer) clearInterval(updateTimer)
      window.removeEventListener('load', register)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const applyUpdate = () => {
    if (!waitingWorker) return
    reloadAfterUpdate.current = true
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!isOffline && !waitingWorker) return null

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-100 mx-auto flex max-w-md flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {isOffline && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-elevated">
          Você está sem conexão. Alguns recursos ficam indisponíveis até a internet voltar.
        </div>
      )}

      {waitingWorker && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-elevated">
          <span>Uma nova versão do Eleva está disponível.</span>
          <button
            type="button"
            onClick={applyUpdate}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Atualizar
          </button>
        </div>
      )}
    </div>
  )
}
