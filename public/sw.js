// Eleva App — service worker
const CACHE_VERSION = 'eleva-pwa-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const OFFLINE_PAGE = '/offline.html'
const MAX_RUNTIME_ENTRIES = 80

const PRECACHE_ASSETS = [
  OFFLINE_PAGE,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('eleva-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
      self.registration.navigationPreload?.enable(),
    ]),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

const canCache = (response) => response?.ok && response.type === 'basic'

async function trimRuntimeCache(cache) {
  const keys = await cache.keys()
  const excess = keys.length - MAX_RUNTIME_ENTRIES
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)))
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) return cachedResponse

  const networkResponse = await fetch(request)
  if (canCache(networkResponse)) {
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.put(request, networkResponse.clone())
    await trimRuntimeCache(cache)
  }
  return networkResponse
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cachedResponse = await cache.match(request)
  const networkResponse = fetch(request).then(async (response) => {
    if (canCache(response)) {
      await cache.put(request, response.clone())
      await trimRuntimeCache(cache)
    }
    return response
  })

  if (cachedResponse) {
    event.waitUntil(networkResponse.catch(() => undefined))
    return cachedResponse
  }

  return networkResponse
}

async function navigate(request, preloadResponse) {
  try {
    return (await preloadResponse) || (await fetch(request))
  } catch {
    return (await caches.match(OFFLINE_PAGE)) || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request, event.preloadResponse))
    return
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (
    url.pathname.startsWith('/icons/') ||
    ['/favicon.ico', '/icon.png', '/apple-icon.png', '/manifest.webmanifest'].includes(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
