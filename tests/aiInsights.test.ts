import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/meetingService', () => ({
  meetingDigest: async () => [{ title: 'Họp tháng 9/2026', date: '2026-09-27', notes: null, summary: { points: ['Chuẩn bị trại'], actions: [{ task: 'Gửi danh sách', owner: 'Ngành Thiếu', due: '05/10' }] }, files: ['bien-ban.jpg'] }],
}))
const { buildAiInsights } = await import('../src/services/aiInsights')

const sched = (id: string, date: string, memberId: string) => ({ id, branchId: 'b1', date, startTime: '08:00', status: 'ASSIGNED', taskName: 'Đọc sách', assignees: [{ type: 'MEMBER', memberId, label: memberId }] })
const data: any = {
  branches: [{ id: 'b1', name: 'Thiếu', colorHex: '#2563eb' }], classes: [], taskTypeBranchTimes: [],
  members: [{ id: 'an', branchId: 'b1', fullName: 'An', active: true }, { id: 'binh', branchId: 'b1', fullName: 'Bình', active: true }],
  schedules: [sched('s1', '2026-10-04', 'an'), sched('s2', '2026-10-05', 'binh'), sched('s3', '2026-10-06', 'binh'), sched('s0', '2026-09-20', 'an')],
  attendance: [
    { scheduleId: 's1', memberId: 'an', classId: null, status: 'PRESENT', isSubstitute: false },
    { scheduleId: 's2', memberId: 'binh', classId: null, status: 'ABSENT', isSubstitute: false },
    { scheduleId: 's0', memberId: 'an', classId: null, status: 'LATE', isSubstitute: false },
  ],
}

describe('AI chat insights', async () => {
  const x = await buildAiInsights(data, { role: 'SUPER_ADMIN', branchId: null } as any, '2026-10-08')
  it('gives this month per person, matching the KPI screen', () => {
    expect(x.attendance_this_month.people).toEqual([
      { name: 'An', branch: 'Thiếu', points: 10, present: 1, late: 0, excused: 0, absent: 0, unmarked: 0, substitutes: 0, rate_percent: 100 },
      { name: 'Bình', branch: 'Thiếu', points: -5, present: 0, late: 0, excused: 0, absent: 1, unmarked: 1, substitutes: 0, rate_percent: 0 },
    ])
  })
  it('covers the school year and last month', () => {
    expect(x.attendance_school_year.people.find(p => p.name === 'An')?.points).toBe(15)
    expect(x.last_month_report.label).toBe('Tháng 9/2026')
    expect(x.last_month_report.sessions).toBe(1)
  })
  it('lists sessions still to mark and the latest meetings', () => {
    expect(x.unmarked_sessions).toEqual([{ date: '2026-10-06', task: 'Đọc sách', branch: 'Thiếu' }])
    expect(x.meetings[0].summary?.actions[0].owner).toBe('Ngành Thiếu')
  })
})
