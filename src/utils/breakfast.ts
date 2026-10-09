import type { BreakfastBallot, BreakfastItem } from '@/types'
import { addDays, parseISO } from '@/utils/date'

// Breakfast is every Sunday at 08:00. Each branch picks 2–3 dishes in order of preference until Friday 23:59.
// supabase/functions/_shared/breakfast.ts ranks the Saturday tally the same way; keep the two in step.
export const BREAKFAST_TIME = '08:00'
export const MIN_PICKS = 2
export const MAX_PICKS = 3
/** ① = 3, ② = 2, ③ = 1 */
export const RANK_POINTS = [3, 2, 1]

/** The Sunday leaders are choosing for: this week's, or next week's once it is Sunday */
export function upcomingBreakfast(today: string): string {
  const dow = parseISO(today).getDay()
  return addDays(today, dow === 0 ? 7 : 7 - dow)
}
/** Friday before the breakfast, the last day to choose */
export const deadlineDay = (week: string) => addDays(week, -2)
/** Choosing closes when Saturday starts in Vietnam */
export const closesAt = (week: string) => Date.parse(`${addDays(week, -1)}T00:00:00+07:00`)
export const isOpen = (week: string, now = Date.now()) => now < closesAt(week)
/** With a tiny menu, picking 2 may not be possible */
export const minPicks = (activeItems: number) => Math.min(MIN_PICKS, activeItems)

/** "còn 2 ngày 3 giờ" until the deadline */
export function timeLeft(week: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((closesAt(week) - now) / 60_000))
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60
  if (d) return `còn ${d} ngày${h ? ` ${h} giờ` : ''}`
  if (h) return `còn ${h} giờ${m ? ` ${m} phút` : ''}`
  return `còn ${m} phút`
}

/** Latest Sunday each dish was ordered, from past ordered weeks (newest first or any order) */
export function lastServedMap(weeks: { weekDate: string; finalItemIds: string[] }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const w of weeks) for (const id of w.finalItemIds) if (!out[id] || out[id] < w.weekDate) out[id] = w.weekDate
  return out
}

export interface TallyRow {
  item: BreakfastItem
  /** Branches that picked it, with their preference (1–3) */
  picks: { branchId: string; rank: number }[]
  count: number
  /** count ÷ branches that have chosen */
  percent: number
  points: number
  lastServed: string | null
  /** Same % and points as another dish: the order between them came from "lâu chưa ăn" */
  tied: boolean
}

/**
 * Ranks the dishes: more branches picking it first (a dish most branches accept suits ordering for everyone),
 * then preference points, then the dish not eaten for the longest time.
 * Lists every active dish (unpicked ones at the bottom) plus hidden dishes that were still picked.
 */
export function tallyBreakfast(items: BreakfastItem[], ballots: BreakfastBallot[], lastServed: Record<string, string> = {}) {
  const voted = ballots.filter(b => b.itemIds.length)
  const voters = voted.length
  const rows: TallyRow[] = items.map(item => {
    const picks = voted.flatMap(b => { const i = b.itemIds.indexOf(item.id); return i < 0 ? [] : [{ branchId: b.branchId, rank: i + 1 }] })
    const points = picks.reduce((s, p) => s + (RANK_POINTS[p.rank - 1] ?? 0), 0)
    return { item, picks, count: picks.length, percent: voters ? Math.round(picks.length / voters * 100) : 0, points, lastServed: lastServed[item.id] ?? null, tied: false }
  }).filter(r => r.item.active || r.count)
  rows.sort((a, b) => b.count - a.count || b.points - a.points
    // Never eaten ('') counts as the longest ago
    || (a.lastServed ?? '').localeCompare(b.lastServed ?? '')
    || a.item.sortOrder - b.item.sortOrder || a.item.name.localeCompare(b.item.name, 'vi'))
  for (const r of rows) r.tied = r.count > 0 && rows.some(o => o !== r && o.count === r.count && o.points === r.points)
  const headcount = voted.reduce((s, b) => s + (b.headcount ?? 0), 0)
  return { rows, voters, headcount }
}
