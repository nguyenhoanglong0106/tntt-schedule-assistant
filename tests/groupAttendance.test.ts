import { describe, expect, it } from 'vitest'
import { computeScores, groupMembersOf, pendingAttendance } from '../src/utils/kpi'

const base: any = {
  branches: [{ id: 'b1' }], classes: [{ id: 'c1', branchId: 'b1', name: 'Hiệp Sĩ 2' }], taskTypeBranchTimes: [],
  members: [
    { id: 'm1', branchId: 'b1', classId: 'c1', fullName: 'An', active: true },
    { id: 'm2', branchId: 'b1', classId: 'c1', fullName: 'Bình', active: true },
    { id: 'm3', branchId: 'b1', classId: null, fullName: 'Chi', active: true },
  ],
}
const sched = (id: string, assignees: any[]) => ({ id, branchId: 'b1', date: '2026-10-05', startTime: '08:00', status: 'ASSIGNED', assignees })
const classTask = sched('s1', [{ type: 'CLASS', classId: 'c1', label: 'Hiệp Sĩ 2' }])
const branchTask = sched('s2', [])
const opts = { from: '2026-10-01', to: '2026-10-31', today: '2026-10-08' }
const pointsOf = (data: any, id: string) => computeScores(data, opts).find(s => s.member.id === id)!

describe('class / whole-branch attendance', () => {
  it('lists everyone in the class, or the whole branch when nobody was picked', () => {
    expect(groupMembersOf(classTask as any, base).map(x => x.member.id)).toEqual(['m1', 'm2'])
    expect(groupMembersOf(branchTask as any, base).map(x => [x.member.id, x.group])).toEqual([['m1', 'Hiệp Sĩ 2'], ['m2', 'Hiệp Sĩ 2'], ['m3', 'Chưa xếp lớp']])
  })

  it('whole-branch tasks now show up as needing attendance', () => {
    const data = { ...base, schedules: [branchTask], attendance: [] }
    expect(pendingAttendance(data, { role: 'SUPER_ADMIN' } as any, '2026-10-08').map(s => s.id)).toEqual(['s2'])
  })

  it('scores each person once marked', () => {
    const data = { ...base, schedules: [classTask], attendance: [
      { scheduleId: 's1', memberId: 'm1', classId: null, status: 'PRESENT', isSubstitute: false },
      { scheduleId: 's1', memberId: 'm2', classId: null, status: 'ABSENT', isSubstitute: false },
    ] }
    expect(pointsOf(data, 'm1').points).toBe(10)
    expect(pointsOf(data, 'm2').points).toBe(-5)
    expect(pointsOf(data, 'm3').assigned).toBe(0)
  })

  it('an unmarked group task is not "chưa điểm danh" for everyone', () => {
    const data = { ...base, schedules: [classTask, branchTask], attendance: [] }
    expect(pointsOf(data, 'm1').unmarked).toBe(0)
    expect(pointsOf(data, 'm1').assigned).toBe(0)
  })

  it('an older class-level mark applies to each member of the class', () => {
    const data = { ...base, schedules: [classTask], attendance: [{ scheduleId: 's1', memberId: null, classId: 'c1', status: 'LATE', isSubstitute: false }] }
    expect(pointsOf(data, 'm1').points).toBe(5)
    expect(pointsOf(data, 'm2').points).toBe(5)
  })
})
