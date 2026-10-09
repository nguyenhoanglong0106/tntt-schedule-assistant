import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/clients.ts'
import { makePusher } from '../_shared/push.ts'

// Ban điều hành taps "Gửi thông báo" after posting a meeting's files: every other leader gets an in-app notice and a push
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireUser(req)
    const db = serviceClient()
    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (me?.role !== 'SUPER_ADMIN') return json({ error: 'Chỉ Ban điều hành được gửi thông báo họp' }, 403)

    const { meeting_id } = await req.json().catch(() => ({}))
    if (!meeting_id) return json({ error: 'Thiếu meeting_id' }, 400)
    const { data: meeting, error } = await db.from('meetings').select('id,title,meeting_date,meeting_files(id)').eq('id', meeting_id).maybeSingle()
    if (error) throw error
    if (!meeting) return json({ error: 'Không tìm thấy buổi họp' }, 404)

    const d = meeting.meeting_date as string
    const title = `📁 ${meeting.title}`
    const files = (meeting.meeting_files ?? []).length
    const body = `Đã có ${files ? `${files} tài liệu` : 'nội dung'} cho buổi họp ngày ${d.slice(8, 10)}/${d.slice(5, 7)}. Bấm để xem.`
    const { pushToUser, stats } = makePusher(db)
    // Meeting documents are for leaders, not for the read-only thư ký ngành login
    const { data: profiles } = await db.from('profiles').select('id').neq('id', user.id).neq('role', 'BRANCH_SECRETARY')
    for (const p of profiles ?? []) {
      await db.from('notifications').insert({ user_id: p.id, title, body })
      await pushToUser(p.id, { title, body, url: '/meetings' })
    }
    await db.from('meetings').update({ notified_at: new Date().toISOString() }).eq('id', meeting_id)
    if (stats.errors.length) console.error('[notify-meeting] push errors', stats.errors)
    return json({ ok: true, users: (profiles ?? []).length, sent: stats.sent, failed: stats.failed, push_configured: stats.configured })
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return json({ error: 'Chưa đăng nhập' }, 401)
    console.error('[notify-meeting]', e)
    return json({ error: e?.message ?? 'Notify error' }, 500)
  }
})
