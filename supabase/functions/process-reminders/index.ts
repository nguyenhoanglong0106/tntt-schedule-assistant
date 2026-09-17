import { corsHeaders, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/clients.ts'
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});const expected=Deno.env.get('CRON_SECRET');if(expected&&req.headers.get('x-cron-secret')!==expected)return json({error:'Unauthorized'},401);try{const db=serviceClient();const now=Date.now();const horizon=new Date(now+25*60_000).toISOString().slice(0,10);const{data:items,error}=await db.from('reminders').select('id,offset_minutes,delivered_at,schedules!inner(id,branch_id,scheduled_date,start_time,status,task_types(name))').is('delivered_at',null).lte('schedules.scheduled_date',horizon);if(error)throw error;let delivered=0;for(const r of items??[]){const s:any=r.schedules;if(!s.start_time||['COMPLETED','CANCELLED'].includes(s.status))continue;const eventMs=new Date(`${s.scheduled_date}T${s.start_time}+07:00`).getTime();const dueMs=eventMs-r.offset_minutes*60_000;if(dueMs>now||dueMs<now-60*60_000)continue;const{data:profiles}=await db.from('profiles').select('id').or(`role.eq.SUPER_ADMIN,branch_id.eq.${s.branch_id}`);for(const p of profiles??[])await db.from('notifications').insert({user_id:p.id,schedule_id:s.id,title:`Nhắc việc: ${s.task_types?.name??'Công việc'}`,body:`Bắt đầu lúc ${s.start_time.slice(0,5)} ngày ${s.scheduled_date}.`});await db.from('reminders').update({delivered_at:new Date().toISOString()}).eq('id',r.id);delivered++}return json({ok:true,delivered})}catch(e:any){return json({error:e?.message??'Reminder error'},500)}})

// ── VAPID Web Push helper ──────────────────────────────────────────────────────
// Implements RFC 8292 VAPID + RFC 8030 Web Push using only Web Crypto API
// (no npm packages needed in Deno Edge Functions)

async function importVapidPrivateKey(b64urlPriv: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64urlPriv.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  // Build PKCS#8 DER for P-256 private key
  const oid = new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]) // P-256
  const privOctet = new Uint8Array([0x04, 0x20, ...raw])
  const ecPriv = new Uint8Array([0x30, privOctet.length + 2, 0x02, 0x01, 0x01, ...privOctet])
  const algId = new Uint8Array([0x30, oid.length + 2, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, ...oid])
  const seq = new Uint8Array([0x30, algId.length + ecPriv.length + 4, ...algId, 0x04, ecPriv.length, ...ecPriv])
  return crypto.subtle.importKey('pkcs8', seq, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function buildVapidJwt(audience: string, subject: string, privKeyB64: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }
  const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const enc = (o: object) => b64url(unescape(encodeURIComponent(JSON.stringify(o))))
  const data = `${enc(header)}.${enc(payload)}`
  const key = await importVapidPrivateKey(privKeyB64)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(data))
  const sigArr = new Uint8Array(sig)
  return `${data}.${btoa(String.fromCharCode(...sigArr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, title: string, body: string, vapidPub: string, vapidPriv: string): Promise<boolean> {
  // 1. Build plaintext payload
  const payload = JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-512.png', tag: 'tntt-reminder', data: { url: '/reminders' } })
  const payloadBytes = new TextEncoder().encode(payload)

  // 2. Decode subscription keys
  const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const subPub = fromB64url(sub.p256dh)
  const authSecret = fromB64url(sub.auth)
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey))
  const recipientPub = await crypto.subtle.importKey('raw', subPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientPub }, serverKeyPair.privateKey, 256)

  // 3. HKDF to derive content-encryption key & nonce (aes128gcm, RFC 8291)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hkdf = async (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number) => {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8))
  }
  const prk = await hkdf(new Uint8Array(sharedBits), authSecret, concatBytes(new TextEncoder().encode('WebPush: info\x00'), subPub, serverPubRaw), 32)
  const cek = await hkdf(prk, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16)
  const nonce = await hkdf(prk, salt, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12)
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])

  // 4. Encrypt (pad to 4096 block: payload + \x02 + zeros)
  const padded = new Uint8Array(Math.min(payloadBytes.length + 1 + 100, 4096))
  padded.set(payloadBytes)
  padded[payloadBytes.length] = 0x02
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded))

  // 5. Build aes128gcm content-encoding header + body
  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, 4096, false)
  const header = concatBytes(salt, recordSize, new Uint8Array([serverPubRaw.length]), serverPubRaw)
  const body = concatBytes(header, ciphertext)

  // 6. VAPID auth header
  const url = new URL(sub.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const jwt = await buildVapidJwt(audience, 'mailto:admin@tntt.app', vapidPriv)
  const authHeader = `vapid t=${jwt},k=${vapidPub}`

  // 7. Send to push service
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': authHeader,
      'TTL': '86400',
    },
    body: body
  })
  return res.ok || res.status === 201
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const expected = Deno.env.get('CRON_SECRET')
  if (expected && req.headers.get('x-cron-secret') !== expected) return json({ error: 'Unauthorized' }, 401)

  const VAPID_PUB = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const VAPID_PRIV = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

  try {
    const db = serviceClient()
    const now = Date.now()
    const horizon = new Date(now + 25 * 60_000).toISOString().slice(0, 10)

    const { data: items, error } = await db
      .from('reminders')
      .select('id,offset_minutes,delivered_at,schedules!inner(id,branch_id,scheduled_date,start_time,status,task_types(name),assignment_assignees(members(full_name),classes(name)))')
      .is('delivered_at', null)
      .lte('schedules.scheduled_date', horizon)
    if (error) throw error

    let delivered = 0
    for (const r of items ?? []) {
      const s: any = r.schedules
      if (!s.start_time || ['COMPLETED', 'CANCELLED'].includes(s.status)) continue
      const eventMs = new Date(`${s.scheduled_date}T${s.start_time}+07:00`).getTime()
      const dueMs = eventMs - r.offset_minutes * 60_000
      if (dueMs > now || dueMs < now - 60 * 60_000) continue

      // Build nice assignee label
      const assignees: string[] = (s.assignment_assignees ?? []).map((a: any) => a.members?.full_name ?? a.classes?.name).filter(Boolean)
      const taskName: string = s.task_types?.name ?? 'Công việc'
      const timeStr: string = s.start_time.slice(0, 5)
      const title = `🔔 ${taskName}`
      const body = assignees.length
        ? `${assignees.join(', ')} – ${timeStr} ngày ${s.scheduled_date}`
        : `Bắt đầu lúc ${timeStr} ngày ${s.scheduled_date}`

      // Insert in-app notification for all admins/branch members
      const { data: profiles } = await db.from('profiles').select('id').or(`role.eq.SUPER_ADMIN,branch_id.eq.${s.branch_id}`)
      for (const p of profiles ?? []) {
        await db.from('notifications').insert({ user_id: p.id, schedule_id: s.id, title, body })

        // Send Web Push if subscription exists
        if (VAPID_PUB && VAPID_PRIV) {
          const { data: subs } = await db.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', p.id)
          for (const sub of subs ?? []) {
            try { await sendPush(sub, title, body, VAPID_PUB, VAPID_PRIV) } catch (_) { /* skip bad sub */ }
          }
        }
      }

      await db.from('reminders').update({ delivered_at: new Date().toISOString() }).eq('id', r.id)
      delivered++
    }
    return json({ ok: true, delivered })
  } catch (e: any) {
    return json({ error: e?.message ?? 'Reminder error' }, 500)
  }
})
