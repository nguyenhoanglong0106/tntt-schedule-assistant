import type { AppData, AttendanceStatus, Member, Profile, Schedule } from '@/types'
import { addDays } from './date'

export const STATUS_META: Record<AttendanceStatus, { label: string; short: string; icon: string; color: string }> = {
  PRESENT: { label: 'Có mặt', short: 'Có mặt', icon: '✅', color: '#16a34a' },
  LATE: { label: 'Đi trễ', short: 'Trễ', icon: '⏰', color: '#d97706' },
  EXCUSED: { label: 'Vắng có phép', short: 'Có phép', icon: '🟡', color: '#ca8a04' },
  ABSENT: { label: 'Vắng không phép', short: 'Vắng', icon: '❌', color: '#dc2626' },
}
export const POINTS: Record<AttendanceStatus, number> = { PRESENT: 10, LATE: 5, EXCUSED: 0, ABSENT: -5 }
/** Coming in someone else's place */
export const SUBSTITUTE_POINTS: Record<'PRESENT' | 'LATE', number> = { PRESENT: 12, LATE: 5 }

export type Period = 'month' | 'schoolYear' | 'year'
export const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'Tháng này' }, { id: 'schoolYear', label: 'Năm học' }, { id: 'year', label: 'Năm nay' },
]
/** TNTT school year runs 01/09 → 31/08 */
export function periodRange(period: Period, today: string): { from: string; to: string; label: string } {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7))
  if (period === 'month') { const from = `${today.slice(0, 7)}-01`; return { from, to: addDays(`${y + (m === 12 ? 1 : 0)}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1), label: `Tháng ${m}/${y}` } }
  if (period === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Năm ${y}` }
  const start = m >= 9 ? y : y - 1
  return { from: `${start}-09-01`, to: `${start + 1}-08-31`, label: `Năm học ${start}–${start + 1}` }
}

export const timeOf = (s: Schedule, data: AppData) => s.startTime ?? data.taskTypeBranchTimes.find(t => t.taskTypeId === s.taskTypeId && t.branchId === s.branchId)?.startTime ?? null

/** Has the schedule started (VN time)? Schedules without a time count from the start of their day */
export function hasStarted(s: Schedule, data: AppData, now = new Date()) {
  const t = timeOf(s, data) ?? '00:00'
  return new Date(`${s.date}T${t.slice(0, 5)}:00+07:00`).getTime() <= now.getTime()
}

export const canMark = (s: Schedule, profile: Profile) => profile.role === 'SUPER_ADMIN' || s.branchId === profile.branchId

/** A task given to a whole class, or to the whole branch (nobody picked), is marked person by person */
export const isGroupTask = (s: Schedule) => !s.assignees.length || s.assignees.some(a => a.type === 'CLASS')

/** Group members of a schedule, one entry per person: everyone in an assigned class, or the whole branch when nobody was picked */
export function groupMembersOf(s: Schedule, data: AppData): { member: Member; group: string }[] {
  const active = data.members.filter(m => m.active && m.branchId === s.branchId)
  const className = (id?: string | null) => data.classes.find(c => c.id === id)?.name ?? 'Chưa xếp lớp'
  if (!s.assignees.length) return active.map(member => ({ member, group: className(member.classId) }))
  return s.assignees.filter(a => a.type === 'CLASS').flatMap(a => active.filter(m => m.classId === a.classId).map(member => ({ member, group: a.label })))
}

/** Is there anyone to mark? Named people, or members in the assigned class / branch */
export const hasPeople = (s: Schedule, data: AppData) => s.assignees.length > 0 || data.members.some(m => m.active && m.branchId === s.branchId)

/** Started, not cancelled, has someone to mark, within the last `days` days and not marked yet */
export function pendingAttendance(data: AppData, profile: Profile, today: string, days = 30) {
  const marked = new Set(data.attendance.map(a => a.scheduleId))
  const from = addDays(today, -days)
  return data.schedules
    .filter(s => s.date >= from && s.date <= today && s.status !== 'CANCELLED' && hasPeople(s, data) && !marked.has(s.id) && canMark(s, profile) && hasStarted(s, data))
    .sort((a, b) => b.date.localeCompare(a.date) || (timeOf(b, data) ?? '').localeCompare(timeOf(a, data) ?? ''))
}

export type Session = { schedule: Schedule; status: AttendanceStatus | null; isSubstitute: boolean; points: number }
export type MemberScore = {
  member: Member; points: number; rate: number | null; assigned: number; marked: number; unmarked: number
  present: number; late: number; excused: number; absent: number; substitutes: number; sessions: Session[]; badges: string[]
}

export function computeScores(data: AppData, opts: { from: string; to: string; branchId?: string | null; today: string }): MemberScore[] {
  // Only what has already happened counts; future assignments are neither credit nor "chưa điểm danh"
  const to = opts.to < opts.today ? opts.to : opts.today
  const schedules = data.schedules.filter(s => s.date >= opts.from && s.date <= to && s.status !== 'CANCELLED' && (!opts.branchId || s.branchId === opts.branchId))
  const byId = new Map(schedules.map(s => [s.id, s]))
  const rows = data.attendance.filter(a => byId.has(a.scheduleId))
  const members = data.members.filter(m => m.active && (!opts.branchId || m.branchId === opts.branchId))

  const scores = members.map<MemberScore>(member => {
    const sessions: Session[] = []
    for (const s of schedules) {
      const row = rows.find(r => r.scheduleId === s.id && r.memberId === member.id && !r.isSubstitute)
      if (s.assignees.some(a => a.memberId === member.id)) {
        sessions.push({ schedule: s, status: row?.status ?? null, isSubstitute: false, points: row ? POINTS[row.status] : 0 })
        continue
      }
      // Class / whole-branch tasks count per person, but only once marked: an unmarked branch activity
      // would otherwise show as "chưa điểm danh" for everyone. Older class-level marks apply to each member.
      const inClass = s.assignees.some(a => a.type === 'CLASS' && a.classId && a.classId === member.classId)
      const inBranch = !s.assignees.length && s.branchId === member.branchId
      if (!inClass && !inBranch) continue
      const groupRow = row ?? (inClass ? rows.find(r => r.scheduleId === s.id && r.classId === member.classId && !r.isSubstitute) : undefined)
      if (groupRow) sessions.push({ schedule: s, status: groupRow.status, isSubstitute: false, points: POINTS[groupRow.status] })
    }
    for (const r of rows) {
      if (r.memberId !== member.id || !r.isSubstitute) continue
      const st = r.status === 'LATE' ? 'LATE' : 'PRESENT'
      sessions.push({ schedule: byId.get(r.scheduleId)!, status: st, isSubstitute: true, points: SUBSTITUTE_POINTS[st] })
    }
    sessions.sort((a, b) => b.schedule.date.localeCompare(a.schedule.date))
    const own = sessions.filter(x => !x.isSubstitute)
    const count = (st: AttendanceStatus) => own.filter(x => x.status === st).length
    const present = count('PRESENT'), late = count('LATE'), excused = count('EXCUSED'), absent = count('ABSENT')
    const marked = present + late + excused + absent
    const substitutes = sessions.length - own.length
    const badges: string[] = []
    if (marked >= 3 && absent === 0 && excused === 0) badges.push('💯 Chưa vắng buổi nào')
    if (present >= 5 && late === 0) badges.push('⏱️ Luôn đúng giờ')
    if (substitutes >= 2) badges.push('🤝 Hay làm thay')
    return {
      member, sessions, present, late, excused, absent, marked, substitutes, badges,
      assigned: own.length, unmarked: own.length - marked,
      points: sessions.reduce((t, x) => t + x.points, 0),
      rate: marked ? (present + late) / marked : null,
    }
  })
  return scores.sort((a, b) => b.points - a.points || (b.rate ?? -1) - (a.rate ?? -1) || a.member.fullName.localeCompare(b.member.fullName, 'vi'))
}
