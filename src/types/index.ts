export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN'
export type TaskCode = string
export type ScheduleStatus = 'UNASSIGNED' | 'ASSIGNED' | 'UPCOMING' | 'REMINDED' | 'COMPLETED' | 'MISSED' | 'CANCELLED'
export type AssigneeType = 'MEMBER' | 'CLASS'

export interface Branch { id: string; code: string; name: string; colorHex: string; rotationIndex: number }
export interface Profile { id: string; fullName: string; role: Role; branchId: string | null }
export interface ClassGroup { id: string; branchId: string; name: string }
export interface Member { id: string; branchId: string; classId?: string | null; fullName: string; active: boolean }
export interface TaskType { id: string; code: TaskCode; name: string; icon: string }
export interface TaskTypeBranchTime { taskTypeId: string; branchId: string; startTime: string; endTime: string; fixedDayOfWeek?: number | null }
export interface Assignee { id?: string; type: AssigneeType; memberId?: string; classId?: string; label: string }
export interface Schedule {
  id: string
  taskTypeId: string
  taskCode: TaskCode
  taskName: string
  taskIcon: string
  branchId: string
  date: string
  startTime?: string | null
  endTime?: string | null
  status: ScheduleStatus
  notes?: string | null
  assignees: Assignee[]
  reminderOffsets: number[]
  createdBy?: string | null
  completedAt?: string | null
  completedBy?: string | null
}
export interface ReadingRotationConfig { startDate: string; startBranchId: string }
export interface AppNotification { id:string; scheduleId?:string|null; title:string; body:string; readAt?:string|null; createdAt:string }
export interface AppData { branches: Branch[]; taskTypes: TaskType[]; members: Member[]; classes: ClassGroup[]; schedules: Schedule[]; rotation: ReadingRotationConfig; notifications: AppNotification[]; taskTypeBranchTimes: TaskTypeBranchTime[] }
export interface PendingAction {
  id: string
  intent: string
  previewTitle: string
  previewLines: string[]
  payload: Record<string, unknown>
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'
}
