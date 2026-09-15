import type { Branch, ReadingRotationConfig } from '../types/index'

const TZ = 'Asia/Ho_Chi_Minh'
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function parseISO(date: string): Date { return new Date(`${date}T12:00:00+07:00`) }
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export function addDays(date: string, days: number): string { const d = parseISO(date); d.setDate(d.getDate()+days); return toISO(d) }
export function startOfWeek(date: string): string {
  const d = parseISO(date); const day = d.getDay(); const diff = day === 0 ? -6 : 1-day; d.setDate(d.getDate()+diff); return toISO(d)
}
export function endOfWeek(date: string): string { return addDays(startOfWeek(date), 6) }
export function formatDate(date: string): string { const d = parseISO(date); return new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', timeZone: TZ }).format(d) }
export function formatShortDate(date: string): string { const d = parseISO(date); return new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', timeZone: TZ }).format(d) }
export function weekdayLabel(date: string): string { const d = parseISO(date); const day = d.getDay(); return day === 0 ? 'CN' : `T${day+1}` }
export function weekLabel(date: string): string { return `${formatShortDate(startOfWeek(date))} – ${formatShortDate(endOfWeek(date))}` }
export function datesOfWeek(date: string): string[] { const s = startOfWeek(date); return Array.from({length:7}, (_,i)=>addDays(s,i)) }

export function readingBranchForDate(date: string, cfg: ReadingRotationConfig, branches: Branch[]): Branch | undefined {
  if (!cfg.startDate || !cfg.startBranchId || branches.length === 0) return undefined
  const start = parseISO(startOfWeek(cfg.startDate)).getTime()
  const target = parseISO(startOfWeek(date)).getTime()
  const weeks = Math.floor((target - start) / (7*24*60*60*1000))
  const ordered = [...branches].sort((a,b)=>a.rotationIndex-b.rotationIndex)
  const startIndex = ordered.findIndex(b=>b.id===cfg.startBranchId)
  if (startIndex < 0) return undefined
  const idx = ((startIndex + weeks) % ordered.length + ordered.length) % ordered.length
  return ordered[idx]
}

export function nextWeekdayInWeek(weekDate: string, jsWeekday: number): string {
  const s = startOfWeek(weekDate)
  const offset = jsWeekday === 0 ? 6 : jsWeekday - 1
  return addDays(s, offset)
}
