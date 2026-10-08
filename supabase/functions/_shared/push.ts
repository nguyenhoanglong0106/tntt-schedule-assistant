// FCM v1 web push shared by the reminder cron and on-demand notifications
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export type ServiceAccount = { project_id: string; client_email: string; private_key: string }
function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })))
  const pem = sa.private_key.replace(/-----[^-]+-----|\s/g, '')
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claim}`)))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${b64url(sig)}` }),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token) throw new Error(`Google OAuth failed: ${JSON.stringify(body)}`)
  return body.access_token
}

type SendResult = { ok: boolean; stale: boolean; error?: string }

async function fcmSend(sa: ServiceAccount, accessToken: string, token: string, data: Record<string, string>): Promise<SendResult> {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      // data-only so the app's own service worker renders it (no duplicate from the Firebase SDK)
      body: JSON.stringify({ message: { token, data, webpush: { headers: { Urgency: 'high', TTL: '3600' } } } }),
    })
    if (res.ok) return { ok: true, stale: false }
    const text = await res.text()
    const stale = res.status === 404 || text.includes('UNREGISTERED') || (res.status === 400 && text.includes('registration token'))
    return { ok: false, stale, error: `[${token.slice(0, 12)}] ${res.status} ${text.slice(0, 300)}` }
  } catch (e: any) {
    return { ok: false, stale: false, error: e?.message ?? String(e) }
  }
}

export function loadServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!raw) return null
  const sa = JSON.parse(raw)
  if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id/client_email/private_key')
  return sa
}

/** Sends to every device a user registered; drops tokens FCM reports as gone. Collects counts/errors for the response. */
export function makePusher(db: SupabaseClient) {
  const sa = loadServiceAccount()
  let accessToken: string | null = null
  const stats = { sent: 0, failed: 0, errors: [] as string[], configured: !!sa }
  async function pushToUser(userId: string, data: Record<string, string>) {
    if (!sa) return
    const { data: subs } = await db.from('push_subscriptions').select('id,fcm_token').eq('user_id', userId)
    for (const sub of subs ?? []) {
      const r = await fcmSend(sa, accessToken ??= await getAccessToken(sa), sub.fcm_token, data)
      if (r.ok) { stats.sent++; continue }
      stats.failed++
      if (r.error) stats.errors.push(r.error)
      if (r.stale) await db.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
  return { pushToUser, stats }
}
