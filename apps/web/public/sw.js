/* Network-first PWA worker: keeps installs, avoids stale app shells. */
const CACHE = 'haru-shell-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/favicon.svg'])),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API and uploads must always hit the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return

  // HTML navigations: network first, then cache fallback.
  const isDocument =
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')

  if (isDocument) {
    event.respondWith(networkFirst(request))
    return
  }

  // Versioned assets from Vite (/assets/*): cache first is fine, names change on deploy.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request))
})

async function networkFirst(request) {
  try {
    const fresh = await fetch(request)
    if (fresh.ok) {
      const cache = await caches.open(CACHE)
      void cache.put(request, fresh.clone())
    }
    return fresh
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/')
      if (fallback) return fallback
    }
    throw new Error('offline')
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const fresh = await fetch(request)
  if (fresh.ok) {
    const cache = await caches.open(CACHE)
    void cache.put(request, fresh.clone())
  }
  return fresh
}
