const CACHE = 'tntt-shell-v4'
const SHELL = ['/', '/manifest.webmanifest']

// A new sw.js takes over at once; pages are network-first, so there is nothing stale to protect
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
})

self.addEventListener('activate', event => {
  // Drop shells cached by older service workers
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (new URL(event.request.url).pathname === '/version.json') return
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(r => r || caches.match('/'))))
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