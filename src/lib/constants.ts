import type { Branch, TaskType } from '@/types'

export const DEMO_BRANCHES: Branch[] = [
  { id: 'branch-chien', code: 'CHIEN', name: 'Chiên', colorHex: '#F472B6', rotationIndex: 0 },
  { id: 'branch-au', code: 'AU', name: 'Ấu', colorHex: '#22C55E', rotationIndex: 1 },
  { id: 'branch-thieu', code: 'THIEU', name: 'Thiếu', colorHex: '#3B82F6', rotationIndex: 2 },
  { id: 'branch-nghia', code: 'NGHIA', name: 'Nghĩa', colorHex: '#EAB308', rotationIndex: 3 },
  { id: 'branch-hiep', code: 'HIEP', name: 'Hiệp', colorHex: '#92400E', rotationIndex: 4 },
]

export const DEMO_TASK_TYPES: TaskType[] = [
  { id: 'task-reading', code: 'READING', name: 'Đọc sách', icon: '📖' },
  { id: 'task-icecream', code: 'ICE_CREAM', name: 'Bán kem', icon: '🍦' },
  { id: 'task-office', code: 'OFFICE_DUTY', name: 'Trực văn phòng', icon: '🏢' },
  { id: 'task-cleaning', code: 'CLEANING', name: 'Vệ sinh Nhà Giáo Lý', icon: '🧹' },
]

export const READING_WEEKDAYS = [1, 2, 4, 0] // Mon, Tue, Thu, Sun
export const REMINDER_PRESETS = [1440, 720, 180, 60, 30]
