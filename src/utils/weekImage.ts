import type { AppData, Branch, Schedule } from '@/types'
import { datesOfWeek, parseISO, readingBranchForDate } from './date'

const ORG_NAME = 'ĐOÀN TNTT ĐAMINH SAVIO · GX BẮC THẦN'
const MOTTO = 'Cầu nguyện – Rước lễ – Hy sinh – Làm việc tông đồ'
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

// dd/MM regardless of the browser's locale quirks (some render vi-VN dates as dd-MM)
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export const W = 1080, PAD = 44, CARD_PAD = 26, TIME_W = 118, LINE = 38, WHO_LINE = 34, ROW_GAP = 18, DAY_HEAD = 66, HEADER_H = 270

export type WeekImageOptions = { data: AppData; weekStart: string; branchId?: string | null }

// Schedules without their own time use the branch default (same rule as the calendar and reminders)
const timeOf = (s: Schedule, data: AppData) => s.startTime ?? data.taskTypeBranchTimes.find(t => t.taskTypeId === s.taskTypeId && t.branchId === s.branchId)?.startTime ?? null

export function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return false
  const n = parseInt(m[1], 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 170
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []; let cur = ''
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word
    if (ctx.measureText(next).width <= maxW || !cur) cur = next
    else { lines.push(cur); cur = word }
  }
  if (cur) lines.push(cur)
  return lines
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src })
}

/** Red band with the Đoàn logo, name, a big title and subtitle (+ optional white pill); shared by the week and month images */
export async function drawHeader(ctx: CanvasRenderingContext2D, { title, subtitle, pill }: { title: string; subtitle: string; pill?: string }) {
  const hg = ctx.createLinearGradient(0, 0, W, HEADER_H); hg.addColorStop(0, '#b91c1c'); hg.addColorStop(1, '#ef4444')
  ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, HEADER_H - 30); ctx.quadraticCurveTo(W / 2, HEADER_H + 30, 0, HEADER_H - 30); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.07)'
  for (const [x, y, r] of [[W - 90, 40, 150], [W - 250, 210, 80], [W - 30, 230, 60]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }

  const logo = await loadImage('/icon-512.png')
  const LOGO = 168, lx = PAD, ly = 40
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(lx + LOGO / 2, ly + LOGO / 2, LOGO / 2 + 6, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  if (logo) { ctx.save(); ctx.beginPath(); ctx.arc(lx + LOGO / 2, ly + LOGO / 2, LOGO / 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, lx, ly, LOGO, LOGO); ctx.restore() }

  const tx = lx + LOGO + 34
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fde68a'; ctx.font = `800 23px ${FONT}`; ctx.fillText(ORG_NAME, tx, 82, W - tx - PAD)
  ctx.fillStyle = '#fff'; ctx.font = `900 54px ${FONT}`; ctx.fillText(title, tx, 146, W - tx - PAD)
  ctx.font = `700 34px ${FONT}`; ctx.fillText(subtitle, tx, 196, W - tx - PAD)
  if (pill) {
    ctx.font = `800 24px ${FONT}`; const pw = ctx.measureText(pill).width + 36
    ctx.fillStyle = '#fff'; roundRect(ctx, tx, 214, pw, 42, 21); ctx.fill()
    ctx.fillStyle = '#b91c1c'; ctx.fillText(pill, tx + 18, 243)
  }
}

/** Motto and "made at" line, centred, starting at y */
export function drawFooter(ctx: CanvasRenderingContext2D, y: number) {
  ctx.textAlign = 'center'
  ctx.fillStyle = '#b91c1c'; ctx.font = `800 26px ${FONT}`; ctx.fillText(MOTTO, W / 2, y + 30, W - PAD * 2)
  const now = new Date()
  ctx.fillStyle = '#94a3b8'; ctx.font = `500 21px ${FONT}`
  ctx.fillText(`TNTT Lịch · cập nhật ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} ${now.toLocaleDateString('vi-VN')}`, W / 2, y + 70)
  ctx.textAlign = 'left'
}

type Row = { s: Schedule; time: string; branch?: Branch; who: string[]; h: number }
type Day = { date: string; rows: Row[]; h: number }

export async function renderWeekImage({ data, weekStart, branchId }: WeekImageOptions): Promise<Blob> {
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!
  const branchById = new Map(data.branches.map(b => [b.id, b]))
  const filterBranch = branchId ? branchById.get(branchId) : undefined
  const reading = readingBranchForDate(weekStart, data.rotation, data.branches)
  const contentX = PAD + CARD_PAD + TIME_W, contentW = W - PAD * 2 - CARD_PAD * 2 - TIME_W

  // Measure pass: row heights depend on how many lines the assignee list wraps to
  ctx.font = `500 27px ${FONT}`
  const days: Day[] = datesOfWeek(weekStart).map(date => {
    const rows: Row[] = data.schedules
      .filter(s => s.date === date && s.status !== 'CANCELLED' && (!branchId || s.branchId === branchId))
      .map(s => ({ s, time: timeOf(s, data) ?? '', branch: branchById.get(s.branchId), who: [], h: 0 }))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    for (const r of rows) {
      r.who = wrap(ctx, `👤 ${r.s.assignees.map(a => a.label).join(', ') || 'Cả ngành'}`, contentW)
      r.h = LINE + 8 + r.who.length * WHO_LINE + ROW_GAP * 2
    }
    return { date, rows, h: DAY_HEAD + rows.reduce((t, r) => t + r.h, 0) + 10 }
  }).filter(d => d.rows.length)

  const showReading = reading && (!filterBranch || filterBranch.id === reading.id)
  const READING_H = showReading ? 84 : 0
  const bodyH = days.length ? days.reduce((t, d) => t + d.h + 22, 0) : 200
  const H = HEADER_H + 30 + READING_H + bodyH + 150
  canvas.width = W; canvas.height = H

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#fff7ed'); bg.addColorStop(1, '#eff6ff')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  const end = datesOfWeek(weekStart)[6]
  await drawHeader(ctx, { title: 'LỊCH CÔNG TÁC TUẦN', subtitle: `${dm(weekStart)} – ${dm(end)}/${end.slice(0, 4)}`, pill: filterBranch ? `Ngành ${filterBranch.name}` : undefined })

  let y = HEADER_H + 30

  if (showReading && reading) {
    ctx.fillStyle = '#fff'; roundRect(ctx, PAD, y, W - PAD * 2, 64, 18); ctx.fill()
    ctx.fillStyle = reading.colorHex; roundRect(ctx, PAD, y, 10, 64, 5); ctx.fill()
    ctx.fillStyle = '#334155'; ctx.font = `700 27px ${FONT}`; ctx.fillText('📖 Tuần đọc sách:', PAD + 30, y + 42)
    const lw = ctx.measureText('📖 Tuần đọc sách:').width
    ctx.fillStyle = '#0f172a'; ctx.font = `900 27px ${FONT}`; ctx.fillText(`Ngành ${reading.name}`, PAD + 42 + lw, y + 42)
    y += READING_H
  }

  if (!days.length) {
    ctx.fillStyle = '#fff'; roundRect(ctx, PAD, y, W - PAD * 2, 170, 26); ctx.fill()
    ctx.fillStyle = '#64748b'; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'center'
    ctx.fillText('Tuần này chưa có lịch công tác.', W / 2, y + 96); ctx.textAlign = 'left'
    y += bodyH
  }

  for (const day of days) {
    // Card
    ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
    ctx.fillStyle = '#fff'; roundRect(ctx, PAD, y, W - PAD * 2, day.h, 26); ctx.fill(); ctx.restore()
    // Day header
    ctx.save(); roundRect(ctx, PAD, y, W - PAD * 2, day.h, 26); ctx.clip()
    ctx.fillStyle = '#1d4ed8'; ctx.fillRect(PAD, y, W - PAD * 2, DAY_HEAD - 8); ctx.restore()
    const dn = DAY_NAMES[parseISO(day.date).getDay()]
    ctx.fillStyle = '#fff'; ctx.font = `900 30px ${FONT}`; ctx.fillText(dn.toUpperCase(), PAD + CARD_PAD, y + 41)
    const dw = ctx.measureText(dn.toUpperCase()).width
    ctx.fillStyle = '#bfdbfe'; ctx.font = `700 27px ${FONT}`; ctx.fillText(dm(day.date), PAD + CARD_PAD + dw + 16, y + 41)
    let ry = y + DAY_HEAD
    day.rows.forEach((r, i) => {
      if (i) { ctx.fillStyle = '#eef2f7'; ctx.fillRect(PAD + CARD_PAD, ry, W - PAD * 2 - CARD_PAD * 2, 2) }
      const top = ry + ROW_GAP
      const color = r.branch?.colorHex ?? '#94a3b8'
      ctx.fillStyle = color; roundRect(ctx, PAD + CARD_PAD, top + 2, 8, r.h - ROW_GAP * 2 - 4, 4); ctx.fill()
      ctx.fillStyle = r.time ? '#1d4ed8' : '#94a3b8'; ctx.font = `900 30px ${FONT}`; ctx.fillText(r.time || '--:--', PAD + CARD_PAD + 22, top + 31)
      // Branch pill on the right, task name gets the remaining width
      let pillW = 0
      if (r.branch && !filterBranch) {
        ctx.font = `800 21px ${FONT}`; pillW = ctx.measureText(r.branch.name).width + 28
        const px = W - PAD - CARD_PAD - pillW
        ctx.fillStyle = color; roundRect(ctx, px, top + 2, pillW, 36, 18); ctx.fill()
        ctx.fillStyle = isLight(color) ? '#1f2937' : '#fff'; ctx.fillText(r.branch.name, px + 14, top + 27)
      }
      ctx.fillStyle = '#0f172a'; ctx.font = `800 30px ${FONT}`
      ctx.fillText(`${r.s.taskIcon} ${r.s.taskName}`, contentX, top + 31, contentW - (pillW ? pillW + 14 : 0))
      ctx.fillStyle = '#475569'; ctx.font = `500 27px ${FONT}`
      r.who.forEach((line, j) => ctx.fillText(line, contentX, top + LINE + 8 + (j + 1) * WHO_LINE - 8))
      ry += r.h
    })
    y += day.h + 22
  }

  drawFooter(ctx, y + 20)

  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Không tạo được ảnh')), 'image/png'))
}
