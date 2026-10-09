// Sunday breakfast helpers for the reminder cron and notify-breakfast.
// Ranks dishes the same way as src/utils/breakfast.ts (the app's results screen); keep the two in step.
const RANK_POINTS = [3, 2, 1]

export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
export function addDaysISO(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10)
}

/** Picked dishes by: branches picking it, then preference points (① 3, ② 2, ③ 1), then eaten longest ago */
export function rankDishes(items: { id: string; name: string }[], ballots: { item_ids: string[] | null }[], lastServed: Record<string, string> = {}) {
  const voted = ballots.filter(b => b.item_ids?.length)
  const rows = items.map(it => {
    let count = 0, points = 0
    for (const b of voted) { const i = b.item_ids!.indexOf(it.id); if (i >= 0) { count++; points += RANK_POINTS[i] ?? 0 } }
    return { id: it.id, name: it.name, count, points, percent: voted.length ? Math.round(count / voted.length * 100) : 0 }
  }).filter(r => r.count)
  rows.sort((a, b) => b.count - a.count || b.points - a.points || (lastServed[a.id] ?? '').localeCompare(lastServed[b.id] ?? ''))
  return { rows, voters: voted.length }
}
