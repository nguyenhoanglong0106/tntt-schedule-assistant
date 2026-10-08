import { meetingDigest } from '@/services/meetingService'
import type { AppData, Profile } from '@/types'
import { computeScores, pendingAttendance, periodRange, POINTS, SUBSTITUTE_POINTS, type MemberScore } from '@/utils/kpi'
import { computeMonthReport } from '@/utils/monthReport'

// The phone already computes attendance and diligence exactly as the KPI screen shows them (group tasks,
// substitutes…), so the AI chat gets these figures from here instead of re-deriving them server-side.
const shiftMonth = (m: string, d: number) => { const t = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}` }

let meetingsCache: { at: number; value: Awaited<ReturnType<typeof meetingDigest>> } | null = null

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
  if (!meetingsCache || Date.now() - meetingsCache.at > 5 * 60_000) {
    meetingsCache = { at: Date.now(), value: await meetingDigest().catch(() => meetingsCache?.value ?? []) }
  }
  return {
    scoring: `Có mặt +${POINTS.PRESENT}, Trễ +${POINTS.LATE}, Có phép ${POINTS.EXCUSED}, Vắng ${POINTS.ABSENT}, Làm thay +${SUBSTITUTE_POINTS.PRESENT}. rate_percent = (có mặt + trễ) / số buổi đã điểm danh. unmarked = buổi được phân công nhưng chưa điểm danh.`,
    attendance_this_month: { label: month.label, people: people(computeScores(data, { ...month, today })) },
    attendance_school_year: { label: year.label, people: people(computeScores(data, { ...year, today })) },
    last_month_report: {
      label: last.label, sessions: last.sessions, marked: last.marked, rate_percent: last.rate == null ? null : Math.round(last.rate * 100),
      branches: last.branches.map(b => ({ branch: b.branch.name, sessions: b.sessions, marked: b.marked, rate_percent: b.rate == null ? null : Math.round(b.rate * 100), top: b.top, often_absent: b.watch })),
    },
    unmarked_sessions: pendingAttendance(data, profile, today).slice(0, 20).map(s => ({ date: s.date, task: s.taskName, branch: branchName(s.branchId) })),
    meetings: meetingsCache.value,
  }
}
