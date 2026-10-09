import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getCurrentProfile } from '@/services/dataService'
import type { BreakfastBallot, BreakfastItem, BreakfastWeek, BreakfastWeekStatus } from '@/types'
import { isOpen, lastServedMap, MAX_PICKS, minPicks, upcomingBreakfast } from '@/utils/breakfast'
import { addDays, todayISO } from '@/utils/date'

export interface BreakfastData {
  week: string
  items: BreakfastItem[]
  ballots: BreakfastBallot[]
  /** null until Ban điều hành orders, skips or the Saturday tally goes out */
  status: BreakfastWeek | null
  lastServed: Record<string, string>
  /** Each branch's latest headcount before this week, to prefill the form */
  lastHeadcount: Record<string, number>
}

const mapItem = (r: any): BreakfastItem => ({ id: r.id, name: r.name, note: r.note, active: r.active, sortOrder: r.sort_order })
const mapWeek = (r: any): BreakfastWeek => ({ weekDate: r.week_date, status: r.status, finalItemIds: r.final_item_ids ?? [], note: r.note, orderedAt: r.ordered_at, notifiedAt: r.notified_at })
const mapBallot = (r: any): BreakfastBallot => ({ weekDate: r.week_date, branchId: r.branch_id, itemIds: r.item_ids ?? [], headcount: r.headcount, updatedBy: r.updated_by_name, updatedAt: r.updated_at })
const byOrder = (a: BreakfastItem, b: BreakfastItem) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi')
function latestHeadcounts(ballots: { branchId: string; weekDate: string; headcount: number | null }[]) {
  const out: Record<string, number> = {}; const at: Record<string, string> = {}
  for (const b of ballots) if (b.headcount != null && (!at[b.branchId] || at[b.branchId] < b.weekDate)) { out[b.branchId] = b.headcount; at[b.branchId] = b.weekDate }
  return out
}

// ── Demo mode: menu, ballots and weeks live in localStorage ───────────────────
const DEMO_KEY = 'tntt-demo-breakfast-v1'
type DemoStore = { items: BreakfastItem[]; ballots: BreakfastBallot[]; weeks: BreakfastWeek[] }
function seedDemo(): DemoStore {
  const items = ['Phở bò', 'Bún bò Huế', 'Bánh mì ốp la', 'Hủ tiếu Nam Vang', 'Xôi gà', 'Bánh cuốn']
    .map((name, i) => ({ id: `bf-${i + 1}`, name, note: null, active: true, sortOrder: (i + 1) * 10 }))
  const week = upcomingBreakfast(todayISO()); const at = new Date().toISOString()
  const ballot = (branchId: string, itemIds: string[], headcount: number): BreakfastBallot => ({ weekDate: week, branchId, itemIds, headcount, updatedBy: 'Demo', updatedAt: at })
  return {
    items,
    ballots: [ballot('branch-chien', ['bf-1', 'bf-3', 'bf-5'], 12), ballot('branch-au', ['bf-2', 'bf-1'], 15), ballot('branch-nghia', ['bf-3', 'bf-1', 'bf-2'], 9)],
    weeks: [{ weekDate: addDays(week, -7), status: 'ORDERED', finalItemIds: ['bf-1'], note: null, orderedAt: at, notifiedAt: at }],
  }
}
function readDemo(): DemoStore {
  try { const d = JSON.parse(localStorage.getItem(DEMO_KEY) ?? ''); if (d?.items) return d } catch { /* first run */ }
  const d = seedDemo(); writeDemo(d); return d
}
function writeDemo(d: DemoStore) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)) } catch { /* demo only */ } }

export async function loadBreakfast(week: string): Promise<BreakfastData> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo()
    return {
      week, items: [...d.items].sort(byOrder), ballots: d.ballots.filter(b => b.weekDate === week),
      status: d.weeks.find(w => w.weekDate === week) ?? null,
      lastServed: lastServedMap(d.weeks.filter(w => w.status === 'ORDERED' && w.weekDate < week)),
      lastHeadcount: latestHeadcounts(d.ballots.filter(b => b.weekDate < week)),
    }
  }
  const [itemsR, ballotsR, weekR, historyR, prevR] = await Promise.all([
    supabase.from('breakfast_menu_items').select('id,name,note,active,sort_order').order('sort_order').order('created_at'),
    supabase.from('breakfast_ballots').select('week_date,branch_id,item_ids,headcount,updated_by_name,updated_at').eq('week_date', week),
    supabase.from('breakfast_weeks').select('week_date,status,final_item_ids,note,ordered_at,notified_at').eq('week_date', week).maybeSingle(),
    // Half a year of orders is plenty to know which dish was eaten longest ago
    supabase.from('breakfast_weeks').select('week_date,final_item_ids').eq('status', 'ORDERED').lt('week_date', week).order('week_date', { ascending: false }).limit(26),
    supabase.from('breakfast_ballots').select('week_date,branch_id,headcount').lt('week_date', week).not('headcount', 'is', null).order('week_date', { ascending: false }).limit(30),
  ])
  for (const r of [itemsR, ballotsR, weekR, historyR, prevR]) if (r.error) throw r.error
  return {
    week, items: (itemsR.data ?? []).map(mapItem), ballots: (ballotsR.data ?? []).map(mapBallot),
    status: weekR.data ? mapWeek(weekR.data) : null,
    lastServed: lastServedMap((historyR.data ?? []).map((w: any) => ({ weekDate: w.week_date, finalItemIds: w.final_item_ids ?? [] }))),
    lastHeadcount: latestHeadcounts((prevR.data ?? []).map((b: any) => ({ branchId: b.branch_id, weekDate: b.week_date, headcount: b.headcount }))),
  }
}

/** Saves a branch's 2–3 dishes (in order of preference); an empty list clears the ballot. The server checks the deadline. */
export async function saveBallot(week: string, branchId: string, itemIds: string[], headcount: number | null): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    // Same rules as save_breakfast_ballot, so the demo behaves like the real app
    const d = readDemo(); const p = await getCurrentProfile(); const isSuper = p?.role === 'SUPER_ADMIN'
    const status = d.weeks.find(w => w.weekDate === week)?.status
    if (!isSuper && p?.branchId !== branchId) throw new Error('Bạn chỉ chọn được món cho ngành mình')
    if (status === 'SKIPPED') throw new Error('Chủ nhật này nghỉ ăn sáng')
    if (!isSuper && status === 'ORDERED') throw new Error('Ban điều hành đã chốt món tuần này, liên hệ Ban điều hành nếu cần đổi')
    if (!isSuper && !isOpen(week)) throw new Error('Đã qua hạn chót (thứ 6, 23:59). Liên hệ Ban điều hành nếu cần đổi')
    const active = d.items.filter(i => i.active)
    if (itemIds.length && (itemIds.length > MAX_PICKS || itemIds.length < minPicks(active.length))) throw new Error('Hãy chọn từ 2 đến 3 món')
    d.ballots = d.ballots.filter(b => !(b.weekDate === week && b.branchId === branchId))
    if (itemIds.length) d.ballots.push({ weekDate: week, branchId, itemIds, headcount, updatedBy: p?.fullName ?? null, updatedAt: new Date().toISOString() })
    writeDemo(d); return
  }
  const { error } = await supabase.rpc('save_breakfast_ballot', { p_week: week, p_branch: branchId, p_items: itemIds, p_headcount: headcount })
  if (error) throw error
}

// ── Ban điều hành: the week ─────────────────────────────────────────────────
/** Chốt món (ORDERED + dishes), nghỉ (SKIPPED) or mở lại (OPEN) */
export async function setBreakfastWeek(week: string, status: BreakfastWeekStatus, finalItemIds: string[] = [], note: string | null = null): Promise<void> {
  const now = new Date().toISOString()
  const ordered = status === 'ORDERED'
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo(); const old = d.weeks.find(w => w.weekDate === week)
    d.weeks = d.weeks.filter(w => w.weekDate !== week)
    d.weeks.push({ weekDate: week, status, finalItemIds: ordered ? finalItemIds : [], note, orderedAt: ordered ? now : null, notifiedAt: old?.notifiedAt ?? null })
    writeDemo(d); return
  }
  const { error } = await supabase.from('breakfast_weeks').upsert({
    week_date: week, status, final_item_ids: ordered ? finalItemIds : [], note, ordered_at: ordered ? now : null, updated_at: now,
  }, { onConflict: 'week_date' })
  if (error) throw error
}

/** Push + in-app notice to every leader about the ordered dishes or the week off; returns how many people */
export async function notifyBreakfast(week: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo(); const w = d.weeks.find(x => x.weekDate === week); if (w) w.notifiedAt = new Date().toISOString(); writeDemo(d); return 0
  }
  const { data, error } = await supabase.functions.invoke('notify-breakfast', { body: { week_date: week } })
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message)
  }
  return data?.users ?? 0
}

// ── Ban điều hành: the menu ─────────────────────────────────────────────────
export async function saveMenuItem(input: { id?: string; name: string; note: string | null }): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo(); const it = d.items.find(i => i.id === input.id)
    if (it) Object.assign(it, { name: input.name, note: input.note })
    else d.items.push({ id: crypto.randomUUID(), name: input.name, note: input.note, active: true, sortOrder: Math.max(0, ...d.items.map(i => i.sortOrder)) + 10 })
    writeDemo(d); return
  }
  if (input.id) {
    const { error } = await supabase.from('breakfast_menu_items').update({ name: input.name, note: input.note }).eq('id', input.id); if (error) throw error
    return
  }
  // New dishes go to the end of the menu
  const { data: last } = await supabase.from('breakfast_menu_items').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase.from('breakfast_menu_items').insert({ name: input.name, note: input.note, sort_order: (last?.sort_order ?? 0) + 10 })
  if (error) throw error
}

/** Hidden dishes leave the menu but keep their name in past weeks */
export async function setMenuItemActive(id: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured || !supabase) { const d = readDemo(); const it = d.items.find(i => i.id === id); if (it) it.active = active; writeDemo(d); return }
  const { error } = await supabase.from('breakfast_menu_items').update({ active }).eq('id', id); if (error) throw error
}

/** Cheap look at the coming Sunday for the home-screen banner and tips */
export async function breakfastGlance(week: string): Promise<{ menu: number; status: BreakfastWeek | null; votedBranchIds: string[]; finalNames: string[] }> {
  let items: BreakfastItem[], status: BreakfastWeek | null, voted: string[]
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo(); items = d.items; status = d.weeks.find(w => w.weekDate === week) ?? null; voted = d.ballots.filter(b => b.weekDate === week).map(b => b.branchId)
  } else {
    const [itemsR, weekR, ballotsR] = await Promise.all([
      supabase.from('breakfast_menu_items').select('id,name,note,active,sort_order'),
      supabase.from('breakfast_weeks').select('week_date,status,final_item_ids,note,ordered_at,notified_at').eq('week_date', week).maybeSingle(),
      supabase.from('breakfast_ballots').select('branch_id').eq('week_date', week),
    ])
    for (const r of [itemsR, weekR, ballotsR]) if (r.error) throw r.error
    items = (itemsR.data ?? []).map(mapItem); status = weekR.data ? mapWeek(weekR.data) : null; voted = (ballotsR.data ?? []).map((b: any) => b.branch_id)
  }
  return {
    menu: items.filter(i => i.active).length, status, votedBranchIds: voted,
    finalNames: (status?.finalItemIds ?? []).map(id => items.find(i => i.id === id)?.name).filter((n): n is string => !!n),
  }
}
