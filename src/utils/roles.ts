import type { Profile, Role } from '@/types'

// Thư ký ngành: one shared login per branch so its members can see their schedules and get the branch's reminders.
// It can change nothing; the server enforces that too (current_branch_id() is null for it).
export const isSecretary = (p?: Profile | null) => p?.role === 'BRANCH_SECRETARY'

/** May create, edit and mark attendance for this branch */
export const canEditBranch = (p: Profile | null | undefined, branchId: string) =>
  !!p && (p.role === 'SUPER_ADMIN' || (p.role === 'BRANCH_ADMIN' && p.branchId === branchId))

/** The branch a screen starts filtered to: one's own branch, or the whole Đoàn for Ban điều hành */
export const homeBranch = (p?: Profile | null) => (p && p.role !== 'SUPER_ADMIN' ? p.branchId : null)

export const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: 'Super Admin', BRANCH_ADMIN: 'Admin Ngành', BRANCH_SECRETARY: 'Thư ký Ngành' }
