import { getToken, onMessage } from 'firebase/messaging'
import { messaging, getPushRegistration } from '@/lib/firebase'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

async function currentToken(): Promise<string | null> {
  if (!messaging) return null
  const serviceWorkerRegistration = await getPushRegistration()
  if (!serviceWorkerRegistration) return null
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() || undefined
  return (await getToken(messaging, { vapidKey, serviceWorkerRegistration })) || null
}

async function callSubscriptionApi(method: 'POST' | 'DELETE', token: string): Promise<Response | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { console.warn('[push] no session'); return null }
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-push-subscription`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ token }),
  })
}

export async function registerPushSubscription(): Promise<boolean> {
  try {
    if (!messaging || !isSupabaseConfigured || !supabase) { console.warn('[push] not supported on this browser'); return false }
    if (Notification.permission === 'denied') { console.warn('[push] permission blocked - please enable in browser settings'); return false }
    if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return false
    const token = await currentToken()
    if (!token) { console.warn('[push] no token'); return false }
    const res = await callSubscriptionApi('POST', token)
    if (!res?.ok) { console.warn('[push] save failed:', res?.status, await res?.text()); return false }
    return true
  } catch (e) { console.error('[push]', e); return false }
}

export async function unregisterPushSubscription(): Promise<boolean> {
  try {
    if (!messaging || typeof Notification === 'undefined' || Notification.permission !== 'granted') return true
    const token = await currentToken()
    if (token) await callSubscriptionApi('DELETE', token)
    return true
  } catch (_) { return false }
}

export function onPushMessage(callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void) {
  if (!messaging) return
  onMessage(messaging, (payload) => {
    callback({
      title: payload.notification?.title ?? payload.data?.title ?? 'TNTT',
      body: payload.notification?.body ?? payload.data?.body ?? '',
      data: payload.data as Record<string, string> | undefined
    })
  })
}
