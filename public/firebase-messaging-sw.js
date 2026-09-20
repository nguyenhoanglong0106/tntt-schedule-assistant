importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyArlTGzbtSyt4sdMo2AXkYUwRRm_1eECpw",
  authDomain: "tntt-26354.firebaseapp.com",
  projectId: "tntt-26354",
  storageBucket: "tntt-26354.firebasestorage.app",
  messagingSenderId: "402499107063",
  appId: "1:402499107063:web:652e27449bd965925abbf2"
});

const messaging = firebase.messaging();

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch (_) { data = { title: 'TNTT', body: event.data?.text() ?? '' } }
  const title = data.title ?? 'Nhắc việc TNTT'
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/icon-192.png',
    badge: data.badge ?? '/icon-512.png',
    tag: data.tag ?? 'tntt-reminder',
    requireInteraction: false,
    data: data.data ?? { url: '/reminders' },
    actions: [{ action: 'open', title: 'Mở ứng dụng' }]
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

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