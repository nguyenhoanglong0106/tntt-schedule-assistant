import type { Profile, Role } from '@/types'

// Thư ký ngành: one shared login per branch so its members can see their schedules and get the branch's reminders.
// It can change nothing; the server enforces that too (current_branch_id() is null for it).
export const isSecretary = (p?: Profile | null) => p?.role === 'BRANCH_SECRETARY'

/** May create, edit and mark attendance for this branch */
export const canEditBranch = (p: Profile | null | undefined, branchId: string) =>
  !!p && (p.role === 'SUPER_ADMIN' || (p.role === 'BRANCH_ADMIN' && p.branchId === branchId))

/** The branch a screen starts filtered to: one's own branch, or the whole Đoàn for Ban điều hành */
export const homeBranch = (p?: Profile | null) => (p && p.role !== 'SUPER_ADMIN' ? p.branchId : null)

/** Two letters for a branch avatar: "Thiếu Nhi" → "TN", "Chiên" → "CH" */
export function branchInitials(name = ''): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase()
}

/** Dark text on light branch colours (Nghĩa's yellow), white on the rest */
export function textOn(hex: string): string {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.45 ? '#422006' : '#ffffff'
}

export const ROLE_LABEL: Record<Role, string> ={ SUPER_ADMIN: 'Super Admin', BRANCH_ADMIN: 'Admin Ngành', BRANCH_SECRETARY: 'Thư ký Ngành' }
