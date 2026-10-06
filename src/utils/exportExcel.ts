import type { AppData, Schedule, ScheduleStatus } from '@/types'
import { todayISO } from './date'
import { computeScores, STATUS_META } from './kpi'

const ORG = 'Đoàn TNTT Đaminh Savio – Giáo xứ Bắc Thần'
const STATUS: Record<ScheduleStatus, string> = {
  UNASSIGNED: 'Chưa phân công', ASSIGNED: 'Đã phân công', UPCOMING: 'Sắp tới', REMINDED: 'Đã nhắc',
  COMPLETED: 'Hoàn thành', MISSED: 'Bỏ lỡ', CANCELLED: 'Đã hủy',
}
const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

const HEAD = { fontWeight: 'bold', backgroundColor: '#1D4ED8', textColor: '#FFFFFF', align: 'center', alignVertical: 'center', height: 24, borderColor: '#CBD5E1', borderStyle: 'thin' } as const
const CELL = { borderColor: '#E2E8F0', borderStyle: 'thin', alignVertical: 'top' } as const
const title = (text: string, span: number) => [{ value: text, fontWeight: 'bold' as const, fontSize: 14, textColor: '#B91C1C', columnSpan: span, height: 28, alignVertical: 'center' as const }]
const head = (labels: string[]) => labels.map(value => ({ value, ...HEAD }))

/** Years that have schedules, plus the current one, newest first */
export function exportYears(data: AppData, current: string) {
  return [...new Set([current.slice(0, 4), ...data.schedules.map(s => s.date.slice(0, 4))])].sort().reverse()
}

export async function exportYearExcel(data: AppData, year: string) {
  // Loaded on demand so the library never weighs on normal page loads
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const branchName = (id: string) => data.branches.find(b => b.id === id)?.name ?? ''
  const timeOf = (s: Schedule) => s.startTime ?? data.taskTypeBranchTimes.find(t => t.taskTypeId === s.taskTypeId && t.branchId === s.branchId)?.startTime ?? ''
  const branchOrder = new Map(data.branches.map(b => [b.id, b.rotationIndex]))
  const schedules = data.schedules
    .filter(s => s.date.startsWith(year))
    .sort((a, b) => a.date.localeCompare(b.date) || (timeOf(a) || '99:99').localeCompare(timeOf(b) || '99:99') || (branchOrder.get(a.branchId) ?? 0) - (branchOrder.get(b.branchId) ?? 0))
  const counted = schedules.filter(s => s.status !== 'CANCELLED')
  const taskTypes = data.taskTypes.filter(t => counted.some(s => s.taskTypeId === t.id))

  // Sheet 1: every schedule of the year
  const sheet1 = [
    title(`LỊCH CÔNG TÁC NĂM ${year} – ${ORG}`, 9),
    head(['STT', 'Ngày', 'Thứ', 'Giờ', 'Công việc', 'Ngành', 'Người phụ trách', 'Trạng thái', 'Ghi chú']),
    ...schedules.map((s, i) => [
      { value: i + 1, ...CELL, align: 'center' as const },
      { value: new Date(`${s.date}T00:00:00Z`), type: Date, format: 'dd/mm/yyyy', ...CELL },
      { value: WEEKDAY[new Date(`${s.date}T12:00:00Z`).getUTCDay()], ...CELL },
      { value: timeOf(s), ...CELL, align: 'center' as const },
      { value: `${s.taskIcon} ${s.taskName}`, ...CELL },
      { value: branchName(s.branchId), ...CELL },
      { value: s.assignees.map(a => a.label).join(', ') || 'Cả ngành', ...CELL, wrap: true },
      { value: STATUS[s.status] ?? s.status, ...CELL, ...(s.status === 'CANCELLED' ? { textColor: '#94A3B8' } : {}) },
      { value: s.notes ?? '', ...CELL, wrap: true },
    ]),
  ]

  // Sheet 2: diligence ranking per branch, same scoring as the "Bảng siêng năng" screen
  const today = todayISO()
  const NUM = { type: Number, ...CELL, align: 'center' as const }
  const rankRows = data.branches.flatMap(b => {
    const scores = computeScores(data, { from: `${year}-01-01`, to: `${year}-12-31`, branchId: b.id, today }).filter(s => s.assigned || s.substitutes)
    return scores.map((s, i) => [
      { ...NUM, value: i + 1, ...(i < 3 && s.points > 0 ? { fontWeight: 'bold' as const, backgroundColor: ['#FDE68A', '#E2E8F0', '#FED7AA'][i] } : {}) },
      { value: s.member.fullName, ...CELL, fontWeight: 'bold' as const }, { value: b.name, ...CELL },
      { value: data.classes.find(c => c.id === s.member.classId)?.name ?? '', ...CELL },
      { ...NUM, value: s.assigned }, { ...NUM, value: s.present }, { ...NUM, value: s.late }, { ...NUM, value: s.excused }, { ...NUM, value: s.absent },
      { ...NUM, value: s.substitutes }, { ...NUM, value: s.unmarked },
      s.rate === null ? { value: '—', ...CELL, align: 'center' as const } : { ...NUM, value: s.rate, format: '0%' },
      { ...NUM, value: s.points, fontWeight: 'bold' as const, textColor: '#1D4ED8' },
      { value: s.badges.join(', '), ...CELL },
    ])
  })
  const sheet2 = [
    title(`XẾP HẠNG SIÊNG NĂNG – NĂM ${year} (hạng tính trong từng ngành)`, 14),
    head(['Hạng', 'Họ tên', 'Ngành', 'Lớp', 'Số buổi', 'Có mặt', 'Đi trễ', 'Có phép', 'Vắng', 'Làm thay', 'Chưa ĐD', 'Chuyên cần', 'Điểm', 'Huy hiệu']),
    ...rankRows,
  ]

  // Sheet 3: every attendance mark of the year
  const byId = new Map(schedules.map(s => [s.id, s]))
  const marks = data.attendance.filter(a => byId.has(a.scheduleId))
    .map(a => ({ a, s: byId.get(a.scheduleId)! }))
    .sort((x, y) => x.s.date.localeCompare(y.s.date) || timeOf(x.s).localeCompare(timeOf(y.s)))
  const who = (a: typeof marks[number]['a']) => a.memberId ? data.members.find(m => m.id === a.memberId)?.fullName ?? '' : `Lớp ${data.classes.find(c => c.id === a.classId)?.name ?? ''}`
  const sheet3 = [
    title(`ĐIỂM DANH – NĂM ${year}`, 7),
    head(['Ngày', 'Giờ', 'Công việc', 'Ngành', 'Người', 'Điểm danh', 'Làm thay']),
    ...marks.map(({ a, s }) => [
      { value: new Date(`${s.date}T00:00:00Z`), type: Date, format: 'dd/mm/yyyy', ...CELL },
      { value: timeOf(s), ...CELL, align: 'center' as const },
      { value: `${s.taskIcon} ${s.taskName}`, ...CELL }, { value: branchName(s.branchId), ...CELL }, { value: who(a), ...CELL },
      { value: `${STATUS_META[a.status].icon} ${STATUS_META[a.status].label}`, ...CELL, textColor: STATUS_META[a.status].color.toUpperCase() },
      { value: a.isSubstitute ? 'Có' : '', ...CELL, align: 'center' as const },
    ]),
  ]

  // Sheet 4: how many times each person/class was assigned each task (cancelled ones not counted)
  const perPerson = new Map<string, { name: string; branchId: string; kind: string; counts: Map<string, number> }>()
  for (const s of counted) for (const a of s.assignees) {
    const key = a.memberId ?? a.classId ?? a.label
    const row = perPerson.get(key) ?? { name: a.label, branchId: s.branchId, kind: a.type === 'CLASS' ? 'Lớp' : 'Thành viên', counts: new Map() }
    row.counts.set(s.taskTypeId, (row.counts.get(s.taskTypeId) ?? 0) + 1)
    perPerson.set(key, row)
  }
  const total = (c: Map<string, number>) => [...c.values()].reduce((a, b) => a + b, 0)
  const people = [...perPerson.values()].sort((a, b) => (branchOrder.get(a.branchId) ?? 0) - (branchOrder.get(b.branchId) ?? 0) || total(b.counts) - total(a.counts) || a.name.localeCompare(b.name, 'vi'))
  const sheet4 = [
    title(`SỐ LẦN PHÂN CÔNG THEO NGƯỜI – NĂM ${year}`, 3 + taskTypes.length + 1),
    head(['Họ tên', 'Ngành', 'Loại', ...taskTypes.map(t => t.name), 'Tổng']),
    ...people.map(p => [
      { value: p.name, ...CELL }, { value: branchName(p.branchId), ...CELL }, { value: p.kind, ...CELL },
      ...taskTypes.map(t => ({ ...NUM, value: p.counts.get(t.id) ?? 0 })),
      { ...NUM, value: total(p.counts), fontWeight: 'bold' as const },
    ]),
  ]

  // Sheet 5: per branch
  const sheet5 = [
    title(`SỐ CÔNG TÁC THEO NGÀNH – NĂM ${year}`, 1 + taskTypes.length + 1),
    head(['Ngành', ...taskTypes.map(t => t.name), 'Tổng']),
    ...data.branches.map(b => {
      const mine = counted.filter(s => s.branchId === b.id)
      return [
        { value: b.name, ...CELL, fontWeight: 'bold' as const },
        ...taskTypes.map(t => ({ ...NUM, value: mine.filter(s => s.taskTypeId === t.id).length })),
        { ...NUM, value: mine.length, fontWeight: 'bold' as const },
      ]
    }),
  ]

  await writeXlsxFile([
    { sheet: 'Xếp hạng siêng năng', data: sheet2, stickyRowsCount: 2, columns: [{ width: 7 }, { width: 28 }, { width: 13 }, { width: 14 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 8 }, { width: 40 }] },
    { sheet: 'Lịch công tác', data: sheet1, stickyRowsCount: 2, columns: [{ width: 6 }, { width: 12 }, { width: 11 }, { width: 8 }, { width: 22 }, { width: 13 }, { width: 42 }, { width: 15 }, { width: 30 }] },
    { sheet: 'Điểm danh', data: sheet3, stickyRowsCount: 2, columns: [{ width: 12 }, { width: 8 }, { width: 22 }, { width: 13 }, { width: 28 }, { width: 20 }, { width: 10 }] },
    { sheet: 'Theo người', data: sheet4, stickyRowsCount: 2, columns: [{ width: 28 }, { width: 13 }, { width: 11 }, ...taskTypes.map(() => ({ width: 14 })), { width: 9 }] },
    { sheet: 'Theo ngành', data: sheet5, stickyRowsCount: 2, columns: [{ width: 16 }, ...taskTypes.map(() => ({ width: 14 })), { width: 9 }] },
  ]).toFile(`Danh-gia-TNTT-${year}.xlsx`)
}
