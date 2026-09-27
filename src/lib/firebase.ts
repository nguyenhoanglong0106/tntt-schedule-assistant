import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, type Messaging } from 'firebase/messaging'
import { browser } from '@/utils/browser'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

// getMessaging throws on browsers without Push API (e.g. iOS Safari outside an installed PWA)
export let messaging: Messaging | null = null
try { messaging = getMessaging(firebaseApp) } catch (_) { messaging = null }

// Push shares the app's single service worker (/sw.js); a second worker at scope "/" would replace it.
export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!browser || !('serviceWorker' in navigator)) return null
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}
