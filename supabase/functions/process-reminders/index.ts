import { corsHeaders, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/clients.ts'
import { makePusher } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const expected = Deno.env.get('CRON_SECRET')
  if (expected && req.headers.get('x-cron-secret') !== expected) return json({ error: 'Unauthorized' }, 401)
  try {
    const db = serviceClient()
    const { pushToUser, stats } = makePusher(db)

    const body = await req.json().catch(() => ({}))
    if (body?.test) {
      if (!stats.configured) return json({ error: 'FIREBASE_SERVICE_ACCOUNT chưa được cấu hình' }, 500)
      const { data: subs, error } = await db.from('push_subscriptions').select('user_id')
      if (error) throw error
      const userIds = [...new Set((subs ?? []).map(s => s.user_id))]
      for (const uid of userIds) await pushToUser(uid, { title: '🔔 Thử thông báo TNTT', body: 'Nếu bạn thấy tin này, thông báo đã hoạt động.', url: '/reminders' })
      return json({ ok: true, test: true, users: userIds.length, sent: stats.sent, failed: stats.failed, errors: stats.errors })
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

    const startOf = (s: any): string | null => s.start_time
      ?? (branchTimes ?? []).find((t: any) => t.task_type_id === s.task_type_id && t.branch_id === s.branch_id)?.start_time
      ?? null
    async function notifyBranch(s: any, title: string, body: string, url: string) {
      const { data: profiles } = await db.from('profiles').select('id').or(`role.eq.SUPER_ADMIN,branch_id.eq.${s.branch_id}`)
      for (const p of profiles ?? []) {
        await db.from('notifications').insert({ user_id: p.id, schedule_id: s.id, title, body })
        await pushToUser(p.id, { title, body, url, schedule_id: s.id })
      }
    }

    let delivered = 0
    for (const r of items ?? []) {
      const s: any = r.schedules
      if (['COMPLETED', 'CANCELLED'].includes(s.status)) continue
      const startTime = startOf(s)
      if (!startTime) continue
      const eventMs = new Date(`${s.scheduled_date}T${startTime.slice(0, 5)}:00+07:00`).getTime()
      const dueMs = eventMs - r.offset_minutes * 60_000
      if (dueMs > now || dueMs < now - 60 * 60_000) continue

      const assignees: string[] = (s.assignment_assignees ?? []).map((a: any) => a.members?.full_name ?? a.classes?.name).filter(Boolean)
      const title = `🔔 ${s.task_types?.name ?? 'Công việc'}`
      const timeStr = startTime.slice(0, 5)
      const dayStr = s.scheduled_date === today ? 'hôm nay' : `ngày ${s.scheduled_date}`
      const msg = assignees.length ? `${assignees.join(', ')} – ${timeStr} ${dayStr}` : `Bắt đầu lúc ${timeStr} ${dayStr}`

      await notifyBranch(s, title, msg, '/reminders')

      await db.from('reminders').update({ delivered_at: new Date().toISOString() }).eq('id', r.id)
      delivered++
    }

    // "Chưa điểm danh": from 21:00 remind each branch once about today's unmarked schedules
    // (yesterday's too, in case the cron was down at night)
    let attendanceReminded = 0
    const vnHour = new Date(now + 7 * 3600_000).getUTCHours()
    const { data: unmarked, error: ue } = await db.from('schedules')
      .select('id,branch_id,scheduled_date,start_time,task_type_id,task_types(name),assignment_assignees(id),attendance(id)')
      .gte('scheduled_date', yesterday)
      .lte('scheduled_date', vnHour >= 21 ? today : yesterday)
      .not('status', 'in', '(CANCELLED,COMPLETED)')
      .is('attendance_reminded_at', null)
    if (ue) throw ue
    // Nobody picked = the whole branch, which is marked person by person too
    const { data: activeMembers } = await db.from('members').select('branch_id').eq('active', true)
    const branchesWithMembers = new Set((activeMembers ?? []).map((m: any) => m.branch_id))
    const due = (unmarked ?? []).filter((s: any) => (s.assignment_assignees?.length || branchesWithMembers.has(s.branch_id)) && !s.attendance?.length)
    const byBranch = new Map<string, any[]>()
    for (const s of due) byBranch.set(s.branch_id, [...(byBranch.get(s.branch_id) ?? []), s])
    for (const [branchId, list] of byBranch) {
      // Branch admins mark their own branch; fall back to super admins when the branch has none
      let { data: admins } = await db.from('profiles').select('id').eq('branch_id', branchId)
      if (!admins?.length) ({ data: admins } = await db.from('profiles').select('id').eq('role', 'SUPER_ADMIN'))
      const what = list.map((s: any) => `${s.task_types?.name ?? 'Công việc'}${(startOf(s) ?? '').slice(0, 5) ? ' ' + startOf(s)!.slice(0, 5) : ''}${s.scheduled_date === today ? '' : ` (${s.scheduled_date.slice(8, 10)}/${s.scheduled_date.slice(5, 7)})`}`).join(', ')
      const title = '📋 Nhớ điểm danh nhé'
      const body = `${what} chưa được điểm danh. Bấm để điểm danh.`
      for (const p of admins ?? []) {
        await db.from('notifications').insert({ user_id: p.id, title, body })
        await pushToUser(p.id, { title, body, url: '/attendance' })
      }
      await db.from('schedules').update({ attendance_reminded_at: new Date().toISOString() }).in('id', list.map((s: any) => s.id))
      attendanceReminded += list.length
    }

    // "Báo cáo tháng": from 08:00 on the 1st, tell Ban điều hành once that last month's report is ready
    let monthReports = 0
    const vnNow = new Date(now + 7 * 3600_000)
    if (vnNow.getUTCDate() === 1 && vnHour >= 8) {
      const prev = new Date(Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth() - 1, 1))
      const ym = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
      const title = `📊 Báo cáo tháng ${prev.getUTCMonth() + 1}/${prev.getUTCFullYear()}`
      const body = 'Báo cáo chuyên cần tháng trước đã sẵn sàng. Bấm để xem, gửi Zalo hoặc đính kèm vào buổi họp.'
      const { data: supers } = await db.from('profiles').select('id').eq('role', 'SUPER_ADMIN')
      for (const p of supers ?? []) {
        // The notification row doubles as the "already sent" marker, so the 5-minute cron sends it once
        const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('title', title)
        if (count) continue
        await db.from('notifications').insert({ user_id: p.id, title, body })
        await pushToUser(p.id, { title, body, url: `/kpi?report=${ym}` })
        monthReports++
      }
    }

    if (stats.errors.length) console.error('[process-reminders] push errors', stats.errors)
    return json({ ok: true, delivered, attendance_reminded: attendanceReminded, month_reports: monthReports, sent: stats.sent, failed: stats.failed, push_configured: stats.configured, errors: stats.errors.slice(0, 5) })
  } catch (e: any) {
    console.error('[process-reminders]', e)
    return json({ error: e?.message ?? 'Reminder error' }, 500)
  }
})
