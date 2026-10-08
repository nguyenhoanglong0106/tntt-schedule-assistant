import { describe, expect, it } from 'vitest'
import { computeMonthReport } from '../src/utils/monthReport'

const sched = (id: string, date: string, memberId: string, branchId = 'b1') => ({ id, branchId, date, startTime: '08:00', status: 'ASSIGNED', assignees: [{ type: 'MEMBER', memberId, label: memberId }] })
const row = (scheduleId: string, memberId: string, status: string) => ({ scheduleId, memberId, classId: null, status, isSubstitute: false })
const data: any = {
  branches: [{ id: 'b1', name: 'Thiếu', colorHex: '#2563eb' }, { id: 'b2', name: 'Ấu', colorHex: '#16a34a' }],
  classes: [], taskTypeBranchTimes: [],
  members: [
    { id: 'an', branchId: 'b1', fullName: 'An', active: true },
    { id: 'binh', branchId: 'b1', fullName: 'Bình', active: true },
  ],
  schedules: [
    sched('s1', '2026-09-06', 'an'), sched('s2', '2026-09-13', 'an'), sched('s3', '2026-09-20', 'binh'),
    sched('s4', '2026-09-27', 'binh'), sched('s5', '2026-09-28', 'binh'),
    sched('x', '2026-10-04', 'an'), // next month: not counted
  ],
  attendance: [row('s1', 'an', 'PRESENT'), row('s2', 'an', 'LATE'), row('s3', 'binh', 'ABSENT'), row('s4', 'binh', 'ABSENT')],
}

describe('monthly report', () => {
  const r = computeMonthReport(data, '2026-09', '2026-10-08')
  it('counts the month only', () => {
    expect(r.label).toBe('Tháng 9/2026')
    expect(r.sessions).toBe(5)
    expect(r.marked).toBe(4)
  })
  it('attendance rate is present or late over marked', () => expect(r.rate).toBe(0.5))
  it('ranks the diligent and flags frequent absence', () => {
    expect(r.top).toEqual([{ name: 'An', points: 15, branch: 'Thiếu' }])
    const thieu = r.branches.find(b => b.branch.id === 'b1')!
    expect(thieu.watch).toEqual([{ name: 'Bình', absent: 2, excused: 0 }])
  })
  it('leaves out branches with nothing that month', () => expect(r.branches.map(b => b.branch.id)).toEqual(['b1']))
})
