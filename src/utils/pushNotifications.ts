import { getToken, onMessage } from 'firebase/messaging'
import { messaging, initMessaging } from '@/lib/firebase'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export async function registerPushSubscription(): Promise<boolean> {
  try {
    if (!messaging || !isSupabaseConfigured || !supabase) { console.warn('[push] not ready'); return false }
    if (Notification.permission === 'denied') {
      console.warn('[push] permission blocked - please enable in browser settings');
      return false
    }
    await initMessaging()
    const tokenOpts: {vapidKey?:string} = {}
    if (import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()) tokenOpts.vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    const token = await getToken(messaging, tokenOpts)
    if (!token) { console.warn('[push] no token'); return false }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { console.warn('[push] no session'); return false }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-push-subscription`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token ?? ''}`
      },
      body: JSON.stringify({ token })
    })
    if (!res.ok) { console.warn('[push] save failed:', res.status); return false }
    return true
  } catch (e) { console.error('[push]', e); return false }
}

export async function isPushEnabled(): Promise<boolean> {
  try {
    if (!messaging) return false
    if (Notification.permission === 'denied') return false
    await initMessaging()
    const tokenOpts: {vapidKey?:string} = {}
    if (import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()) tokenOpts.vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    const token = await getToken(messaging, tokenOpts)
    return !!token
  } catch (_) { return false }
}

export async function unregisterPushSubscription(): Promise<boolean> {
  try {
    if (!messaging) return false
    if (!supabase) return true
    await initMessaging()
    const tokenOpts: {vapidKey?:string} = {}
    if (import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()) tokenOpts.vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    const token = await getToken(messaging, tokenOpts)
    if (!token) return true
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return true
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-push-subscription`
    await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token ?? ''}`
      },
      body: JSON.stringify({ token })
    })
    return true
  } catch (_) { return false }
}

export function onPushMessage(callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void) {
  if (!messaging) return
  onMessage(messaging, (payload) => {
    callback({
      title: payload.notification?.title ?? 'TNTT',
      body: payload.notification?.body ?? '',
      data: payload.data as Record<string, string> | undefined
    })
  })
}