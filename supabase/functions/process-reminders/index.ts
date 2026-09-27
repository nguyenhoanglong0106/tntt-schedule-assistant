import { corsHeaders, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/clients.ts'

type ServiceAccount = { project_id: string; client_email: string; private_key: string }

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
    return { ok: false, stale, error: `${res.status} ${text.slice(0, 300)}` }
  } catch (e: any) {
    return { ok: false, stale: false, error: e?.message ?? String(e) }
  }
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!raw) return null
  const sa = JSON.parse(raw)
  if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id/client_email/private_key')
  return sa
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const expected = Deno.env.get('CRON_SECRET')
  if (expected && req.headers.get('x-cron-secret') !== expected) return json({ error: 'Unauthorized' }, 401)
  try {
    const db = serviceClient()
    const sa = loadServiceAccount()
    let accessToken: string | null = null
    const pushToken = async () => (accessToken ??= await getAccessToken(sa!))

    let sent = 0, failed = 0
    const errors: string[] = []
    async function pushToUser(userId: string, data: Record<string, string>) {
      if (!sa) return
      const { data: subs } = await db.from('push_subscriptions').select('id,fcm_token').eq('user_id', userId)
      for (const sub of subs ?? []) {
        const r = await fcmSend(sa, await pushToken(), sub.fcm_token, data)
        if (r.ok) { sent++; continue }
        failed++
        if (r.error) errors.push(r.error)
        if (r.stale) await db.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }

    const body = await req.json().catch(() => ({}))
    if (body?.test) {
      if (!sa) return json({ error: 'FIREBASE_SERVICE_ACCOUNT chưa được cấu hình' }, 500)
      const { data: subs, error } = await db.from('push_subscriptions').select('user_id')
      if (error) throw error
      const userIds = [...new Set((subs ?? []).map(s => s.user_id))]
      for (const uid of userIds) await pushToUser(uid, { title: '🔔 Thử thông báo TNTT', body: 'Nếu bạn thấy tin này, thông báo đã hoạt động.', url: '/reminders' })
      return json({ ok: true, test: true, users: userIds.length, sent, failed, errors })
    }

    const now = Date.now()
    const today = new Date(now + 7 * 3600_000).toISOString().slice(0, 10)
    const yesterday = new Date(now + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10)
    const horizon = new Date(now + 7 * 3600_000 + 2 * 86400_000).toISOString().slice(0, 10)
    const [{ data: items, error }, { data: branchTimes }] = await Promise.all([
      db.from('reminders')
        .select('id,offset_minutes,schedules!inner(id,task_type_id,branch_id,scheduled_date,start_time,status,task_types(name),assignment_assignees(members(full_name),classes(name)))')
        .is('delivered_at', null)
        .gte('schedules.scheduled_date', yesterday)
        .lte('schedules.scheduled_date', horizon),
      db.from('task_type_branch_times').select('task_type_id,branch_id,start_time'),
    ])
    if (error) throw error

    let delivered = 0
    for (const r of items ?? []) {
      const s: any = r.schedules
      if (['COMPLETED', 'CANCELLED'].includes(s.status)) continue
      const startTime: string | null = s.start_time
        ?? (branchTimes ?? []).find((t: any) => t.task_type_id === s.task_type_id && t.branch_id === s.branch_id)?.start_time
        ?? null
      if (!startTime) continue
      const eventMs = new Date(`${s.scheduled_date}T${startTime.slice(0, 5)}:00+07:00`).getTime()
      const dueMs = eventMs - r.offset_minutes * 60_000
      if (dueMs > now || dueMs < now - 60 * 60_000) continue

      const assignees: string[] = (s.assignment_assignees ?? []).map((a: any) => a.members?.full_name ?? a.classes?.name).filter(Boolean)
      const title = `🔔 ${s.task_types?.name ?? 'Công việc'}`
      const timeStr = startTime.slice(0, 5)
      const dayStr = s.scheduled_date === today ? 'hôm nay' : `ngày ${s.scheduled_date}`
      const msg = assignees.length ? `${assignees.join(', ')} – ${timeStr} ${dayStr}` : `Bắt đầu lúc ${timeStr} ${dayStr}`

      const { data: profiles } = await db.from('profiles').select('id').or(`role.eq.SUPER_ADMIN,branch_id.eq.${s.branch_id}`)
      for (const p of profiles ?? []) {
        await db.from('notifications').insert({ user_id: p.id, schedule_id: s.id, title, body: msg })
        await pushToUser(p.id, { title, body: msg, url: '/reminders', schedule_id: s.id })
      }

      await db.from('reminders').update({ delivered_at: new Date().toISOString() }).eq('id', r.id)
      delivered++
    }
    if (errors.length) console.error('[process-reminders] push errors', errors)
    return json({ ok: true, delivered, sent, failed, push_configured: !!sa, errors: errors.slice(0, 5) })
  } catch (e: any) {
    console.error('[process-reminders]', e)
    return json({ error: e?.message ?? 'Reminder error' }, 500)
  }
})
