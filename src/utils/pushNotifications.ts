// Push notification subscription helper
// Registers the browser for Web Push and saves the subscription to Supabase.

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const array = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i)
  return array
}

export async function registerPushSubscription(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { console.warn('[push] no serviceWorker or PushManager'); return false }
    if (!VAPID_PUBLIC_KEY) { console.warn('[push] no VAPID key'); return false }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { console.warn('[push] permission:', permission); return false }

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any
    })

    const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    if (!keys?.p256dh || !keys?.auth) { console.warn('[push] missing keys'); return false }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-push-subscription`
    const { data: { session } } = await supabase!.auth.getSession()
    if (!session) { console.warn('[push] no session'); return false }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token ?? ''}`
      },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
    })
    if (!res.ok) { console.warn('[push] save failed:', res.status); return false }
    return true
  } catch (e) { console.error('[push]', e); return false }
}
//comnet
export async function isPushEnabled(): Promise<boolean> {
  try {
    if (!('PushManager' in window)) return false
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub && Notification.permission === 'granted'
  } catch (_) {
    return false
  }
}

export async function unregisterPushSubscription(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
    }
    return true
  } catch (_) {
    return false
  }
}

