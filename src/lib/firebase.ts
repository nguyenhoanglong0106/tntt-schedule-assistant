import { initializeApp, getApps } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'
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
export const messaging = getMessaging(firebaseApp)

export async function initMessaging() {
  if (!browser || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  } catch (_) {}
}