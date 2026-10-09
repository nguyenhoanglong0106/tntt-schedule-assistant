import { meetingDigest } from '@/services/meetingService'
import { loadBreakfast } from '@/services/breakfastService'
import type { AppData, Profile } from '@/types'
import { BREAKFAST_TIME, deadlineDay, isOpen, tallyBreakfast, upcomingBreakfast } from '@/utils/breakfast'
import { computeScores, pendingAttendance, periodRange, POINTS, SUBSTITUTE_POINTS, type MemberScore } from '@/utils/kpi'
import { computeMonthReport } from '@/utils/monthReport'

// The phone already computes attendance and diligence exactly as the KPI screen shows them (group tasks,
// substitutes…), so the AI chat gets these figures from here instead of re-deriving them server-side.
const shiftMonth = (m: string, d: number) => { const t = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}` }

let meetingsCache: { at: number; value: Awaited<ReturnType<typeof meetingDigest>> } | null = null
let breakfastCache: { at: number; value: Awaited<ReturnType<typeof breakfastDigest>> | null } | null = null

/** The coming Sunday breakfast as the Ăn sáng screen shows it: ranking, who has chosen, headcount, what was ordered */
async function breakfastDigest(data: AppData, today: string) {
  const week = upcomingBreakfast(today); const d = await loadBreakfast(week)
  const branch = (id: string) => data.branches.find(b => b.id === id)?.name ?? ''
  const dish = (id: string) => d.items.find(i => i.id === id)?.name ?? ''
  const { rows, voters, headcount } = tallyBreakfast(d.items, d.ballots, d.lastServed)
  return {
    sunday: week, time: BREAKFAST_TIME, deadline: `${deadlineDay(week)} 23:59`, choosing_open: isOpen(week),
    status: d.status?.status ?? 'OPEN', ordered_dishes: (d.status?.finalItemIds ?? []).map(dish), note: d.status?.note ?? null,
    menu: d.items.filter(i => i.active).map(i => i.name),
    results: rows.filter(r => r.count).map(r => ({ dish: r.item.name, percent: r.percent, points: r.points, branches: r.picks.map(p => `${branch(p.branchId)} (ưu tiên ${p.rank})`) })),
    branches_chosen: `${voters}/${data.branches.length}`,
    not_chosen: data.branches.filter(b => !d.ballots.some(x => x.branchId === b.id)).map(b => b.name),
    headcount_total: headcount,
    headcount_by_branch: d.ballots.map(b => ({ branch: branch(b.branchId), headcount: b.headcount })),
  }
}

export async function buildAiInsights(data: AppData, profile: Profile, today: string) {
  const branchName = (id: string) => data.branches.find(b => b.id === id)?.name ?? ''
  const people = (scores: MemberScore[]) => scores.filter(s => s.assigned || s.substitutes).map(s => ({
    name: s.member.fullName, branch: branchName(s.member.branchId), points: s.points,
    present: s.present, late: s.late, excused: s.excused, absent: s.absent, unmarked: s.unmarked, substitutes: s.substitutes,
    rate_percent: s.rate == null ? null : Math.round(s.rate * 100),
  }))
  const month = periodRange('month', today), year = periodRange('schoolYear', today)
  const last = computeMonthReport(data, shiftMonth(today.slice(0, 7), -1), today)
  // Meetings change rarely; don't hit the server on every chat message
  // Ballots change during the week, so breakfast is refreshed more often
  await Promise.all([
    (!meetingsCache || Date.now() - meetingsCache.at > 5 * 60_000) && meetingDigest().catch(() => meetingsCache?.value ?? []).then(value => { meetingsCache = { at: Date.now(), value } }),
    (!breakfastCache || Date.now() - breakfastCache.at > 60_000) && breakfastDigest(data, today).catch(() => breakfastCache?.value ?? null).then(value => { breakfastCache = { at: Date.now(), value } }),
  ])
  return {
    scoring: `Có mặt +${POINTS.PRESENT}, Trễ +${POINTS.LATE}, Có phép ${POINTS.EXCUSED}, Vắng ${POINTS.ABSENT}, Làm thay +${SUBSTITUTE_POINTS.PRESENT}. rate_percent = (có mặt + trễ) / số buổi đã điểm danh. unmarked = buổi được phân công nhưng chưa điểm danh.`,
    attendance_this_month: { label: month.label, people: people(computeScores(data, { ...month, today })) },
    attendance_school_year: { label: year.label, people: people(computeScores(data, { ...year, today })) },
    last_month_report: {
      label: last.label, sessions: last.sessions, marked: last.marked, rate_percent: last.rate == null ? null : Math.round(last.rate * 100),
      branches: last.branches.map(b => ({ branch: b.branch.name, sessions: b.sessions, marked: b.marked, rate_percent: b.rate == null ? null : Math.round(b.rate * 100), top: b.top, often_absent: b.watch })),
    },
    unmarked_sessions: pendingAttendance(data, profile, today).slice(0, 20).map(s => ({ date: s.date, task: s.taskName, branch: branchName(s.branchId) })),
    meetings: meetingsCache?.value ?? [],
    breakfast: breakfastCache?.value ?? null,
  }
}
