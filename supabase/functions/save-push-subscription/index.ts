import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser } from '../_shared/clients.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { db, user } = await requireUser(req)
    const { endpoint, p256dh, auth } = await req.json()
    if (!endpoint || !p256dh || !auth) return json({ error: 'Missing fields' }, 400)
    await db.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: 'endpoint' }
    )
    return json({ ok: true })
  } catch (e: any) {
    return json({ error: e?.message ?? 'Error' }, 401)
  }
})

