import { ref } from 'vue'
import { saveAttendance } from '@/services/dataService'
import type { AppData, Attendance } from '@/types'

// Attendance saved without signal (church basements…) waits here and is sent once the phone is back online.
// One entry per schedule: re-marking the same schedule offline just replaces the waiting rows.
type Rows = Omit<Attendance, 'scheduleId'>[]
type Outbox = Record<string, { rows: Rows; queuedAt: string }>
const KEY = 'tntt-attendance-outbox-v1'
const SAVE_TIMEOUT = 15_000

function read(): Outbox {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}
function write(o: Outbox) {
  try { localStorage.setItem(KEY, JSON.stringify(o)) } catch { /* storage full/blocked: the entry stays in memory only */ }
  outboxIds.value = Object.keys(o)
}

/** Schedule ids whose attendance is waiting to be sent */
export const outboxIds = ref<string[]>(Object.keys(read()))
/** Set when the server refused a waiting save, so the user knows to mark it again */
export const outboxError = ref('')

/** No signal, a dropped request or a request that hangs on weak signal; server rejections are not network errors */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = String((e as any)?.message ?? e ?? '')
  return e instanceof TypeError || /Failed to fetch|Load failed|NetworkError|network|timed out|hết thời gian/i.test(msg)
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), SAVE_TIMEOUT))])
}

/** Sends now when possible; returns 'queued' when there is no signal so the caller can tell the user */
export async function saveAttendanceOrQueue(scheduleId: string, rows: Rows): Promise<'sent' | 'queued'> {
  if (!navigator.onLine) { queue(scheduleId, rows); return 'queued' }
  try {
    await withTimeout(saveAttendance(scheduleId, rows))
  } catch (e) {
    if (!isNetworkError(e)) throw e
    queue(scheduleId, rows); return 'queued'
  }
  // A newer save supersedes anything still waiting for this schedule
  const o = read(); if (o[scheduleId]) { delete o[scheduleId]; write(o) }
  return 'sent'
}

function queue(scheduleId: string, rows: Rows) {
  const o = read(); o[scheduleId] = { rows, queuedAt: new Date().toISOString() }; write(o)
}

/** Shows waiting saves as already marked, so the lists and KPI match what the user entered */
export function applyOutbox(data: AppData): AppData {
  const o = read(); const ids = Object.keys(o)
  if (!ids.length) return data
  return {
    ...data,
    attendance: [...data.attendance.filter(a => !o[a.scheduleId]), ...ids.flatMap(id => o[id].rows.map(r => ({ ...r, scheduleId: id })))],
    schedules: data.schedules.map(s => o[s.id] && s.status !== 'CANCELLED' ? { ...s, status: 'COMPLETED' as const } : s),
  }
}

let flushing: Promise<number> | null = null
/** Sends every waiting save; stops at the first network failure and keeps the rest for next time. Returns how many were sent. */
export function flushOutbox(): Promise<number> {
  return flushing ??= (async () => {
    let sent = 0
    try {
      for (const [id, entry] of Object.entries(read())) {
        if (!navigator.onLine) break
        let ok = true
        try { await withTimeout(saveAttendance(id, entry.rows)) } catch (e: any) {
          if (isNetworkError(e)) break
          // The server refused it (schedule deleted, no permission…): retrying forever would not help
          ok = false
          console.error('[attendanceOutbox] dropped', id, e)
          outboxError.value = `Một buổi điểm danh chờ gửi bị máy chủ từ chối (${e?.message ?? 'lỗi không rõ'}). Vui lòng điểm danh lại buổi đó.`
        }
        const o = read()
        // Only drop it if it was not re-marked while this request was in flight
        if (o[id]?.queuedAt === entry.queuedAt) { delete o[id]; write(o) }
        if (ok) sent++
      }
    } finally { flushing = null }
    return sent
  })()
}
