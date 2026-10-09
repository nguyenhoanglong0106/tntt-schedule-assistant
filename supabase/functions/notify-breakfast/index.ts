import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/clients.ts'
import { makePusher } from '../_shared/push.ts'
import { ddmm } from '../_shared/breakfast.ts'

// Ban điều hành taps "Chốt món & báo mọi người" (or marks a Sunday off): every other leader gets an in-app notice and a push
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireUser(req)
    const db = serviceClient()
    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (me?.role !== 'SUPER_ADMIN') return json({ error: 'Chỉ Ban điều hành được gửi thông báo ăn sáng' }, 403)

    const { week_date } = await req.json().catch(() => ({}))
    if (!week_date) return json({ error: 'Thiếu week_date' }, 400)
    const { data: week, error } = await db.from('breakfast_weeks').select('status,final_item_ids,note').eq('week_date', week_date).maybeSingle()
    if (error) throw error
    if (!week || week.status === 'OPEN') return json({ error: 'Tuần này chưa chốt món' }, 400)

    let title: string, body: string
    if (week.status === 'SKIPPED') {
      title = `😴 CN ${ddmm(week_date)} nghỉ ăn sáng`
      body = week.note || 'Chủ nhật này không có ăn sáng chung.'
    } else {
      const { data: items } = await db.from('breakfast_menu_items').select('id,name').in('id', week.final_item_ids ?? [])
      const names = (week.final_item_ids ?? []).map((id: string) => items?.find(i => i.id === id)?.name).filter(Boolean)
      title = `🍜 Ăn sáng CN ${ddmm(week_date)} lúc 08:00`
      body = `Món: ${names.join(', ') || 'đã chốt'}.${week.note ? ` ${week.note}` : ''}`
    }
    const { pushToUser, stats } = makePusher(db)
    const { data: profiles } = await db.from('profiles').select('id').neq('id', user.id)
    for (const p of profiles ?? []) {
      await db.from('notifications').insert({ user_id: p.id, title, body })
      await pushToUser(p.id, { title, body, url: '/breakfast' })
    }
    await db.from('breakfast_weeks').update({ notified_at: new Date().toISOString() }).eq('week_date', week_date)
    if (stats.errors.length) console.error('[notify-breakfast] push errors', stats.errors)
    return json({ ok: true, users: (profiles ?? []).length, sent: stats.sent, failed: stats.failed, push_configured: stats.configured })
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return json({ error: 'Chưa đăng nhập' }, 401)
    console.error('[notify-breakfast]', e)
    return json({ error: e?.message ?? 'Notify error' }, 500)
  }
})
