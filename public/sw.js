const CACHE = 'tntt-shell-v5'
const SHELL = ['/', '/manifest.webmanifest']
const MAX_ENTRIES = 120

// A new sw.js takes over at once; pages are network-first, so there is nothing stale to protect
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
})

self.addEventListener('activate', event => {
  // Drop shells cached by older service workers
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

// Old builds' hashed files pile up across deploys; drop the oldest ones
async function trim(cache) {
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) if (new URL(k.url).pathname !== '/') await cache.delete(k)
}

// Everything the app itself serves is kept, so the app still opens without signal (e.g. at church)
async function networkFirst(request, isPage) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const copy = res.clone()
      // Every route serves the same index.html; keep the latest one under '/' for offline starts
      caches.open(CACHE).then(c => c.put(isPage ? '/' : request, copy)).then(() => caches.open(CACHE)).then(trim).catch(() => undefined)
    }
    return res
  } catch {
    return (await caches.match(isPage ? '/' : request)) || Response.error()
  }
}

// Built files under /assets/ have a content hash in their name and never change: serve them from the cache
async function cacheFirst(request) {
  const hit = await caches.match(request)
  return hit || networkFirst(request, false)
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Supabase/Firebase/fonts go straight to the network; the app caches its own data
  if (url.origin !== self.location.origin || url.pathname === '/version.json') return
  if (req.mode === 'navigate') event.respondWith(networkFirst(req, true))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(cacheFirst(req))
  else event.respondWith(networkFirst(req, false))
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
    self.addEventListener('activate', function handler() {
      self.removeEventListener('activate', handler)
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'UPDATE_APPLIED' }))
      })
    })
  }
})

// ── Push notification handler (FCM) ──────────────────────────────────
self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch (_) { payload = { data: { body: event.data?.text() ?? '' } } }
  // FCM v1 wraps fields as { notification?: {...}, data: {...} }
  const n = payload.notification ?? {}
  const d = payload.data ?? {}

  const title = n.title ?? d.title ?? 'Nhắc việc TNTT'
  const options = {
    body: n.body ?? d.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.schedule_id ? `tntt-${d.schedule_id}` : 'tntt-reminder',
    requireInteraction: false,
    data: { url: d.url ?? '/reminders' },
    actions: [{ action: 'open', title: 'Mở ứng dụng' }]
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click → open or focus the app ─────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/reminders'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})