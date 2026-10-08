import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Meeting, MeetingFile, MeetingSummary } from '@/types'
import { normalizeVi } from '@/utils/normalize'

const BUCKET = 'meeting-files'
// Links stay valid for a long meeting-day session; the list is reloaded each time the page opens
const URL_TTL = 6 * 3600
export const MAX_FILE_MB = 25

/** Phone photos are 3–6 MB; shrinking to 1600px keeps them sharp on a phone and quick to load on weak signal */
export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url })
    URL.revokeObjectURL(url)
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

// Storage keys must be plain ASCII; the original name is kept in the table
const safeName = (name: string) => normalizeVi(name).replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'file'

// ── Demo mode: meetings and files (as data URLs) live in localStorage ─────────
const DEMO_KEY = 'tntt-demo-meetings-v1'
type DemoStore = { meetings: Omit<Meeting, 'files' | 'viewedByMe' | 'viewers'>[]; files: MeetingFile[]; views: string[] }
const readDemo = (): DemoStore => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) ?? '') } catch { return { meetings: [], files: [], views: [] } } }
function writeDemo(d: DemoStore) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)) } catch { throw new Error('Bộ nhớ demo đã đầy, hãy xoá bớt file.') }
}
const toDataUrl = (f: File) => new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(f) })

export async function listMeetings(isSuper: boolean): Promise<Meeting[]> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo()
    return [...d.meetings].sort((a, b) => b.date.localeCompare(a.date)).map(m => ({
      ...m, files: d.files.filter(f => f.meetingId === m.id), viewedByMe: d.views.includes(m.id), viewers: isSuper ? [] : null,
    }))
  }
  const { data, error } = await supabase.from('meetings')
    .select('id,title,meeting_date,notes,created_at,notified_at,summary,summarized_at,meeting_files(id,name,path,mime,size,created_at)')
    .order('meeting_date', { ascending: false })
  if (error) throw error
  const { data: { session } } = await supabase.auth.getSession()
  const me = session?.user.id
  // RLS returns only my own views, or everyone's for Ban điều hành
  const [{ data: views }, leadersR] = await Promise.all([
    supabase.from('meeting_views').select('meeting_id,user_id,viewed_at'),
    isSuper ? supabase.from('profiles').select('id,full_name').eq('role', 'BRANCH_ADMIN').order('full_name') : Promise.resolve({ data: null }),
  ])
  const paths = (data ?? []).flatMap((m: any) => (m.meeting_files ?? []).map((f: any) => f.path))
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, URL_TTL)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  return (data ?? []).map((m: any) => ({
    id: m.id, title: m.title, date: m.meeting_date, notes: m.notes, createdAt: m.created_at, notifiedAt: m.notified_at, summary: m.summary ?? null, summarizedAt: m.summarized_at,
    files: (m.meeting_files ?? []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((f: any) => ({
      id: f.id, meetingId: m.id, name: f.name, path: f.path, mime: f.mime, size: f.size, createdAt: f.created_at, url: urls.get(f.path) ?? null,
    })),
    viewedByMe: (views ?? []).some(v => v.meeting_id === m.id && v.user_id === me),
    viewers: leadersR.data ? leadersR.data.map((p: any) => ({ userId: p.id, name: p.full_name, viewedAt: (views ?? []).find(v => v.meeting_id === m.id && v.user_id === p.id)?.viewed_at ?? null })) : null,
  }))
}

export async function saveMeeting(input: { id?: string; title: string; date: string; notes: string | null }): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo()
    const existing = d.meetings.find(m => m.id === input.id)
    if (existing) Object.assign(existing, { title: input.title, date: input.date, notes: input.notes })
    else d.meetings.push({ id: crypto.randomUUID(), title: input.title, date: input.date, notes: input.notes, createdAt: new Date().toISOString(), notifiedAt: null, summary: null, summarizedAt: null })
    writeDemo(d); return existing?.id ?? d.meetings[d.meetings.length - 1].id
  }
  const row = { title: input.title, meeting_date: input.date, notes: input.notes }
  const { data, error } = input.id
    ? await supabase.from('meetings').update(row).eq('id', input.id).select('id').single()
    : await supabase.from('meetings').insert(row).select('id').single()
  if (error) throw error
  return data.id
}

export async function deleteMeeting(m: Meeting): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo(); d.meetings = d.meetings.filter(x => x.id !== m.id); d.files = d.files.filter(f => f.meetingId !== m.id); writeDemo(d); return
  }
  if (m.files.length) { const { error } = await supabase.storage.from(BUCKET).remove(m.files.map(f => f.path)); if (error) throw error }
  const { error } = await supabase.from('meetings').delete().eq('id', m.id); if (error) throw error
}

export async function uploadMeetingFile(meetingId: string, original: File): Promise<void> {
  const file = await compressImage(original)
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`"${original.name}" lớn hơn ${MAX_FILE_MB} MB.`)
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo()
    d.files.push({ id: crypto.randomUUID(), meetingId, name: file.name, path: `${meetingId}/${safeName(file.name)}`, mime: file.type || null, size: file.size, createdAt: new Date().toISOString(), url: await toDataUrl(file) })
    writeDemo(d); return
  }
  const path = `${meetingId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(file.name)}`
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (up.error) throw up.error
  const { error } = await supabase.from('meeting_files').insert({ meeting_id: meetingId, name: file.name, path, mime: file.type || null, size: file.size })
  // Don't leave an orphan file nobody can see
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error }
}

export async function deleteMeetingFile(f: MeetingFile): Promise<void> {
  if (!isSupabaseConfigured || !supabase) { const d = readDemo(); d.files = d.files.filter(x => x.id !== f.id); writeDemo(d); return }
  const { error } = await supabase.storage.from(BUCKET).remove([f.path]); if (error) throw error
  const { error: e2 } = await supabase.from('meeting_files').delete().eq('id', f.id); if (e2) throw e2
}

export async function markMeetingViewed(meetingId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) { const d = readDemo(); if (!d.views.includes(meetingId)) { d.views.push(meetingId); writeDemo(d) } return }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await supabase.from('meeting_views').upsert({ meeting_id: meetingId, user_id: session.user.id, viewed_at: new Date().toISOString() }, { onConflict: 'meeting_id,user_id' })
}

/** Push + in-app notice to every other leader; returns how many people were notified */
export async function notifyMeeting(meetingId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo(); const m = d.meetings.find(x => x.id === meetingId); if (m) m.notifiedAt = new Date().toISOString(); writeDemo(d); return 0
  }
  const { data, error } = await supabase.functions.invoke('notify-meeting', { body: { meeting_id: meetingId } })
  if (error) throw error
  return data?.users ?? 0
}

/** The newest meeting if I haven't opened it yet, for the home-screen banner (cheap: no file links) */
export async function latestUnseenMeeting(): Promise<{ id: string; title: string } | null> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo(); const m = [...d.meetings].sort((a, b) => b.date.localeCompare(a.date))[0]
    return m && !d.views.includes(m.id) ? { id: m.id, title: m.title } : null
  }
  const { data } = await supabase.from('meetings').select('id,title').order('meeting_date', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  const { data: { session } } = await supabase.auth.getSession()
  const { data: view } = await supabase.from('meeting_views').select('meeting_id').eq('meeting_id', data.id).eq('user_id', session?.user.id ?? '').maybeSingle()
  return view ? null : data
}

/** AI reads the notes, photos, PDFs and Word files server-side and stores the summary on the meeting */
export async function summarizeMeeting(meetingId: string): Promise<MeetingSummary> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo has no AI: split the notes into points so the layout can be tried
    const d = readDemo(); const m = d.meetings.find(x => x.id === meetingId)
    const points = (m?.notes ?? '').split(/\n|(?=\d+\.\s)/).map(s => s.replace(/^\s*[-–\d.]+\s*/, '').trim()).filter(Boolean)
    const summary: MeetingSummary = { points: points.length ? points : ['(Demo) Chưa có nội dung để tóm tắt'], actions: [{ task: '(Demo) Gửi danh sách trại sinh', owner: 'Ngành Thiếu', due: '20/10' }] }
    if (m) { m.summary = summary; m.summarizedAt = new Date().toISOString(); writeDemo(d) }
    return summary
  }
  const { data, error } = await supabase.functions.invoke('summarize-meeting', { body: { meeting_id: meetingId } })
  if (error) {
    // The function's own message (AI quá tải…) is in the response body
    const body = await (error as any).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message)
  }
  return data.summary
}

/** Recent meetings without file links, to pick one to attach a report to */
export async function recentMeetings(limit = 6): Promise<{ id: string; title: string; date: string }[]> {
  if (!isSupabaseConfigured || !supabase) return [...readDemo().meetings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit).map(m => ({ id: m.id, title: m.title, date: m.date }))
  const { data, error } = await supabase.from('meetings').select('id,title,meeting_date').order('meeting_date', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map(m => ({ id: m.id, title: m.title, date: m.meeting_date }))
}

/** Latest meetings as plain text for the AI chat: notes, AI summary and file names (no links) */
export async function meetingDigest(limit = 3): Promise<{ title: string; date: string; notes: string | null; summary: MeetingSummary | null; files: string[] }[]> {
  if (!isSupabaseConfigured || !supabase) {
    const d = readDemo()
    return [...d.meetings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
      .map(m => ({ title: m.title, date: m.date, notes: m.notes, summary: m.summary ?? null, files: d.files.filter(f => f.meetingId === m.id).map(f => f.name) }))
  }
  const { data, error } = await supabase.from('meetings').select('title,meeting_date,notes,summary,meeting_files(name)').order('meeting_date', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map((m: any) => ({ title: m.title, date: m.meeting_date, notes: m.notes ? String(m.notes).slice(0, 1500) : null, summary: m.summary ?? null, files: (m.meeting_files ?? []).map((f: any) => f.name) }))
}
