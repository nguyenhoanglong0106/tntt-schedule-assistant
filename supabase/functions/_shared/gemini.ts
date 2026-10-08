// Gemini generateContent with the same model fallback as ai-chat: Google retires/restricts model ids over
// time and each model has its own quota, so move on after 404/429 and retry 500/503 with backoff.
export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }
export type GeminiResult = { ok: true; text: string } | { ok: false; status: number; message: string }

export async function generate(opts: { system: string; parts: GeminiPart[]; json?: boolean; deadlineMs?: number }): Promise<GeminiResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return { ok: false, status: 0, message: 'AI chưa được cấu hình (thiếu GEMINI_API_KEY).' }
  const models = [...new Set([Deno.env.get('GEMINI_MODEL')?.trim(), 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'].filter(Boolean) as string[])]
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: opts.json ? { responseMimeType: 'application/json' } : {},
  })
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  const backoff = (attempt: number, res?: Response) => { const ra = Number(res?.headers.get('retry-after')); return Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 4000) : 800 * 2 ** (attempt - 1) + Math.random() * 400 }
  const deadline = Date.now() + (opts.deadlineMs ?? 45_000)
  let lastStatus = 0
  outer: for (const model of models) {
    for (let attempt = 1; attempt <= 3 && Date.now() < deadline; attempt++) {
      let res: Response
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: payload,
        })
      } catch { lastStatus = 0; await sleep(backoff(attempt)); continue }
      if (res.ok) {
        const raw = await res.json()
        const text = (raw?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('')
        if (text) return { ok: true, text }
        lastStatus = 200; console.error(`[gemini] ${model} empty`, JSON.stringify(raw).slice(0, 300)); continue outer
      }
      lastStatus = res.status
      console.error(`[gemini] ${model} -> ${lastStatus}`, (await res.text()).slice(0, 300))
      if (lastStatus === 404 || lastStatus === 429) continue outer
      if (lastStatus !== 503 && lastStatus !== 500) break outer
      if (attempt < 3) await sleep(backoff(attempt, res))
    }
  }
  const message = lastStatus === 0 ? 'Lỗi kết nối AI.' : [429, 500, 503].includes(lastStatus) ? 'AI đang quá tải, thử lại sau ít phút.' : `AI lỗi (${lastStatus}).`
  return { ok: false, status: lastStatus, message }
}
