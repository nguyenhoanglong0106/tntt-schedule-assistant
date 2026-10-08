import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { strFromU8, unzipSync } from 'npm:fflate@0.8.2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/clients.ts'
import { generate, type GeminiPart } from '../_shared/gemini.ts'

// Ban điều hành taps "Tóm tắt bằng AI": read the notes, photos of handwritten minutes, PDFs and Word files,
// and store a short summary + action list on the meeting so every leader reads the gist on their phone.
const MAX_INLINE = 14 * 1024 * 1024 // Gemini accepts ~20 MB per request; leave room for text and base64 growth

const SYSTEM = `Bạn là thư ký của Đoàn Thiếu Nhi Thánh Thể. Bạn nhận nội dung một buổi họp Ban điều hành: ghi chú, ảnh chụp biên bản (có thể viết tay), file PDF/Word.
Hãy đọc kỹ và trả về JSON đúng dạng:
{"points": ["..."], "actions": [{"task": "...", "owner": "...", "due": "..."}]}
- points: 3 đến 7 ý chính quan trọng nhất, mỗi ý một câu ngắn, tiếng Việt có dấu.
- actions: các việc cần làm sau buổi họp. owner = người hoặc ngành phụ trách nếu tài liệu có ghi, nếu không thì "". due = hạn chót dạng dd/mm nếu có, nếu không thì "".
- Chỉ dùng thông tin có trong tài liệu, không bịa thêm. Nếu không đọc được gì, trả về points rỗng.`

// .docx is a zip; the text lives in word/document.xml as <w:t> runs inside <w:p> paragraphs
function docxText(bytes: Uint8Array): string {
  const xml = strFromU8(unzipSync(bytes, { filter: f => f.name === 'word/document.xml' })['word/document.xml'] ?? new Uint8Array())
  return xml.split(/<\/w:p>/).map(p => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('')).filter(Boolean).join('\n')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireUser(req)
    const db = serviceClient()
    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (me?.role !== 'SUPER_ADMIN') return json({ error: 'Chỉ Ban điều hành được dùng tóm tắt AI' }, 403)
    const { meeting_id } = await req.json().catch(() => ({}))
    if (!meeting_id) return json({ error: 'Thiếu meeting_id' }, 400)
    const { data: m, error } = await db.from('meetings').select('id,title,meeting_date,notes,meeting_files(name,path,mime,size)').eq('id', meeting_id).maybeSingle()
    if (error) throw error
    if (!m) return json({ error: 'Không tìm thấy buổi họp' }, 404)

    const parts: GeminiPart[] = [{ text: `Buổi họp: ${m.title} (ngày ${m.meeting_date})\nGhi chú:\n${m.notes || '(không có)'}` }]
    const skipped: string[] = []
    let inline = 0
    for (const f of m.meeting_files ?? []) {
      const name = String(f.name); const mime = String(f.mime ?? '')
      const readable = mime.startsWith('image/') || mime === 'application/pdf' || /\.docx$/i.test(name)
      if (!readable) { skipped.push(name); continue }
      const { data: blob, error: de } = await db.storage.from('meeting-files').download(f.path)
      if (de || !blob) { skipped.push(name); continue }
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if (/\.docx$/i.test(name)) {
        try { parts.push({ text: `File Word "${name}":\n${docxText(bytes).slice(0, 60_000)}` }) } catch { skipped.push(name) }
        continue
      }
      if (inline + bytes.length > MAX_INLINE) { skipped.push(name); continue }
      inline += bytes.length
      parts.push({ text: `Tệp đính kèm "${name}":` }, { inlineData: { mimeType: mime, data: encodeBase64(bytes) } })
    }

    const r = await generate({ system: SYSTEM, parts, json: true })
    if (!r.ok) return json({ error: r.message, retry: true }, 502)
    let parsed: any
    try { parsed = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { return json({ error: 'AI trả về nội dung không đọc được, thử lại nhé.', retry: true }, 502) }
    const summary = {
      points: (Array.isArray(parsed?.points) ? parsed.points : []).map((p: unknown) => String(p).trim()).filter(Boolean).slice(0, 10),
      actions: (Array.isArray(parsed?.actions) ? parsed.actions : []).map((a: any) => ({ task: String(a?.task ?? '').trim(), owner: String(a?.owner ?? '').trim(), due: String(a?.due ?? '').trim() })).filter((a: any) => a.task).slice(0, 15),
      skipped,
    }
    if (!summary.points.length && !summary.actions.length) return json({ error: 'AI không đọc được nội dung. Hãy chụp ảnh rõ hơn hoặc ghi vài ý vào phần nội dung chính.' }, 422)
    const { error: ue } = await db.from('meetings').update({ summary, summarized_at: new Date().toISOString() }).eq('id', meeting_id)
    if (ue) throw ue
    return json({ ok: true, summary })
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') return json({ error: 'Chưa đăng nhập' }, 401)
    console.error('[summarize-meeting]', e)
    return json({ error: e?.message ?? 'Summarize error' }, 500)
  }
})
