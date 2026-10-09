import { describe, expect, it } from 'vitest'
import { canMark, pendingAttendance } from '../src/utils/kpi'
import { canEditBranch, homeBranch, isSecretary } from '../src/utils/roles'

const superAdmin = { id: 's', fullName: 'BĐH', role: 'SUPER_ADMIN' as const, branchId: null }
const leader = { id: 'l', fullName: 'Admin Thiếu', role: 'BRANCH_ADMIN' as const, branchId: 'thieu' }
const secretary = { id: 't', fullName: 'Thư ký Thiếu', role: 'BRANCH_SECRETARY' as const, branchId: 'thieu' }

describe('thư ký ngành', () => {
  it('cannot edit anything, not even its own branch', () => {
    expect(canEditBranch(secretary, 'thieu')).toBe(false)
    expect(canEditBranch(leader, 'thieu')).toBe(true)
    expect(canEditBranch(leader, 'au')).toBe(false)
    expect(canEditBranch(superAdmin, 'au')).toBe(true)
  })
  it('starts on its own branch like a leader', () => {
    expect(homeBranch(secretary)).toBe('thieu')
    expect(homeBranch(leader)).toBe('thieu')
    expect(homeBranch(superAdmin)).toBeNull()
    expect(isSecretary(secretary)).toBe(true)
    expect(isSecretary(leader)).toBe(false)
  })
  it('is never asked to mark attendance', () => {
    const s: any = { id: 'x', branchId: 'thieu', date: '2026-10-04', startTime: '08:00', status: 'ASSIGNED', taskCode: 'CLEANING', assignees: [{ type: 'MEMBER', memberId: 'an', label: 'An' }] }
    const data: any = { schedules: [s], attendance: [], members: [{ id: 'an', branchId: 'thieu', fullName: 'An', active: true }], classes: [], taskTypeBranchTimes: [] }
    expect(canMark(s, secretary)).toBe(false)
    expect(pendingAttendance(data, secretary, '2026-10-09')).toEqual([])
    expect(pendingAttendance(data, leader, '2026-10-09')).toHaveLength(1)
  })
})
