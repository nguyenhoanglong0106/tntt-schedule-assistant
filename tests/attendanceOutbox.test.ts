import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveAttendance = vi.fn()
vi.mock('../src/services/dataService', () => ({ saveAttendance }))

// Node has no localStorage/navigator; give the outbox a minimal phone-like environment
const store = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
const nav = { onLine: true }
vi.stubGlobal('navigator', nav)

const { saveAttendanceOrQueue, flushOutbox, applyOutbox, outboxIds, outboxError } = await import('../src/services/attendanceOutbox')
const rows = [{ memberId: 'm1', classId: null, status: 'ABSENT' as const, isSubstitute: false }]
const data: any = { attendance: [], schedules: [{ id: 's1', status: 'ASSIGNED' }, { id: 's2', status: 'ASSIGNED' }] }

describe('offline attendance', () => {
  beforeEach(() => { store.clear(); outboxIds.value = []; outboxError.value = ''; nav.onLine = true; saveAttendance.mockReset() })

  it('queues without signal and shows it as marked', async () => {
    nav.onLine = false
    expect(await saveAttendanceOrQueue('s1', rows)).toBe('queued')
    expect(saveAttendance).not.toHaveBeenCalled()
    expect(outboxIds.value).toEqual(['s1'])
    const shown = applyOutbox(data)
    expect(shown.attendance).toEqual([{ ...rows[0], scheduleId: 's1' }])
    expect(shown.schedules.find(s => s.id === 's1')?.status).toBe('COMPLETED')
  })

  it('queues when the request fails on a dropped connection', async () => {
    saveAttendance.mockRejectedValueOnce(new TypeError('Load failed'))
    expect(await saveAttendanceOrQueue('s1', rows)).toBe('queued')
    expect(outboxIds.value).toEqual(['s1'])
  })

  it('surfaces server errors instead of queueing them', async () => {
    saveAttendance.mockRejectedValueOnce({ message: 'permission denied for table attendance' })
    await expect(saveAttendanceOrQueue('s1', rows)).rejects.toBeTruthy()
    expect(outboxIds.value).toEqual([])
  })

  it('sends waiting saves once back online', async () => {
    nav.onLine = false
    await saveAttendanceOrQueue('s1', rows); await saveAttendanceOrQueue('s2', rows)
    nav.onLine = true; saveAttendance.mockResolvedValue(undefined)
    expect(await flushOutbox()).toBe(2)
    expect(saveAttendance).toHaveBeenCalledWith('s1', rows)
    expect(outboxIds.value).toEqual([])
  })

  it('keeps the rest when the signal drops mid-way', async () => {
    nav.onLine = false
    await saveAttendanceOrQueue('s1', rows); await saveAttendanceOrQueue('s2', rows)
    nav.onLine = true
    saveAttendance.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await flushOutbox()).toBe(1)
    expect(outboxIds.value).toEqual(['s2'])
  })

  it('drops a save the server refuses and tells the user', async () => {
    nav.onLine = false
    await saveAttendanceOrQueue('s1', rows)
    nav.onLine = true; saveAttendance.mockRejectedValueOnce({ message: 'schedule not found' })
    expect(await flushOutbox()).toBe(0)
    expect(outboxIds.value).toEqual([])
    expect(outboxError.value).toContain('schedule not found')
  })
})
