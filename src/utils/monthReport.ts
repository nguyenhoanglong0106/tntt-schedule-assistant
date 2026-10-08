import type { AppData, Branch } from '@/types'
import { computeScores, hasPeople, hasStarted } from './kpi'
import { drawFooter, drawHeader, FONT, HEADER_H, isLight, PAD, roundRect, W, wrap } from './weekImage'

type Person = { name: string; points: number }
export type BranchReport = {
  branch: Branch; sessions: number; marked: number; rate: number | null
  top: Person[]
  /** Absent twice or more, or absent + excused three times or more: worth a word from the branch leader */
  watch: { name: string; absent: number; excused: number }[]
}
export type MonthReport = { month: string; label: string; sessions: number; marked: number; rate: number | null; top: (Person & { branch: string })[]; branches: BranchReport[] }

const pct = (r: number | null) => r == null ? '–' : `${Math.round(r * 100)}%`

/** Numbers for one calendar month (YYYY-MM): sessions held, how many were marked, attendance rate and who stood out */
export function computeMonthReport(data: AppData, month: string, today: string): MonthReport {
  const from = `${month}-01`
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7))
  const to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  const marked = new Set(data.attendance.map(a => a.scheduleId))
  const held = data.schedules.filter(s => s.date >= from && s.date <= to && s.status !== 'CANCELLED' && hasPeople(s, data) && hasStarted(s, data))
  const rateOf = (scores: ReturnType<typeof computeScores>) => {
    const ok = scores.reduce((t, s) => t + s.present + s.late, 0), all = scores.reduce((t, s) => t + s.marked, 0)
    return all ? ok / all : null
  }
  const topOf = (scores: ReturnType<typeof computeScores>, n: number) => scores.filter(s => s.points > 0).slice(0, n)
  const branches = data.branches.map<BranchReport>(branch => {
    const scores = computeScores(data, { from, to, today, branchId: branch.id })
    const mine = held.filter(s => s.branchId === branch.id)
    return {
      branch, sessions: mine.length, marked: mine.filter(s => marked.has(s.id)).length, rate: rateOf(scores),
      top: topOf(scores, 3).map(s => ({ name: s.member.fullName, points: s.points })),
      watch: scores.filter(s => s.absent >= 2 || s.absent + s.excused >= 3).sort((a, b) => b.absent - a.absent || b.excused - a.excused).slice(0, 5)
        .map(s => ({ name: s.member.fullName, absent: s.absent, excused: s.excused })),
    }
  }).filter(b => b.sessions)
  const all = computeScores(data, { from, to, today })
  return {
    month, label: `Tháng ${m}/${y}`, sessions: held.length, marked: held.filter(s => marked.has(s.id)).length, rate: rateOf(all),
    top: topOf(all, 3).map(s => ({ name: s.member.fullName, points: s.points, branch: data.branches.find(b => b.id === s.member.branchId)?.name ?? '' })),
    branches,
  }
}

const TILE_H = 150, LINE = 40

export async function renderMonthReport(r: MonthReport): Promise<Blob> {
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!
  const innerW = W - PAD * 2 - 52

  // Measure pass: branch cards grow with wrapped name lists
  ctx.font = `500 28px ${FONT}`
  const cards = r.branches.map(b => {
    const top = b.top.length ? wrap(ctx, `🏆 ${b.top.map(p => `${p.name} (+${p.points})`).join(', ')}`, innerW) : []
    const watch = wrap(ctx, b.watch.length ? `⚠️ Cần quan tâm: ${b.watch.map(w => `${w.name} (${[w.absent && `vắng ${w.absent}`, w.excused && `phép ${w.excused}`].filter(Boolean).join(', ')})`).join('; ')}` : '✅ Không ai vắng nhiều', innerW)
    return { b, top, watch, h: 76 + 44 + (top.length + watch.length) * LINE + 30 }
  })
  const bodyH = cards.length ? cards.reduce((t, c) => t + c.h + 22, 0) : 200
  // The podium card fits however many people scored (1–3)
  const TOP_H = 92 + r.top.length * 48
  const H = HEADER_H + 30 + TILE_H + 26 + (r.top.length ? TOP_H + 26 : 0) + bodyH + 150
  canvas.width = W; canvas.height = H

  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#fff7ed'); bg.addColorStop(1, '#eff6ff')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  await drawHeader(ctx, { title: 'BÁO CÁO THÁNG', subtitle: r.label })
  let y = HEADER_H + 30

  // Three headline numbers
  const tiles: [string, string, string][] = [
    [String(r.sessions), 'buổi công tác', '#1d4ed8'],
    [r.sessions ? `${r.marked}/${r.sessions}` : '–', 'đã điểm danh', r.marked < r.sessions ? '#ea580c' : '#15803d'],
    [pct(r.rate), 'chuyên cần', '#15803d'],
  ]
  const tw = (W - PAD * 2 - 2 * 18) / 3
  tiles.forEach(([value, label, color], i) => {
    const x = PAD + i * (tw + 18)
    ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
    ctx.fillStyle = '#fff'; roundRect(ctx, x, y, tw, TILE_H, 24); ctx.fill(); ctx.restore()
    ctx.textAlign = 'center'
    ctx.fillStyle = color; ctx.font = `900 56px ${FONT}`; ctx.fillText(value, x + tw / 2, y + 82, tw - 20)
    ctx.fillStyle = '#64748b'; ctx.font = `700 25px ${FONT}`; ctx.fillText(label, x + tw / 2, y + 122, tw - 20)
    ctx.textAlign = 'left'
  })
  y += TILE_H + 26

  // Top 3 of the whole Đoàn
  if (r.top.length) {
    ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
    ctx.fillStyle = '#fff'; roundRect(ctx, PAD, y, W - PAD * 2, TOP_H, 26); ctx.fill(); ctx.restore()
    ctx.fillStyle = '#0f172a'; ctx.font = `900 32px ${FONT}`; ctx.fillText('🏆 Siêng năng nhất tháng', PAD + 26, y + 54)
    const medals = ['🥇', '🥈', '🥉']
    r.top.forEach((p, i) => {
      const ry = y + 104 + i * 48
      ctx.fillStyle = '#0f172a'; ctx.font = `800 30px ${FONT}`; ctx.fillText(`${medals[i]} ${p.name}`, PAD + 26, ry, 560)
      ctx.fillStyle = '#64748b'; ctx.font = `600 26px ${FONT}`; ctx.fillText(p.branch, PAD + 620, ry, 220)
      ctx.fillStyle = '#15803d'; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`+${p.points}`, W - PAD - 26, ry); ctx.textAlign = 'left'
    })
    y += TOP_H + 26
  }

  if (!cards.length) {
    ctx.fillStyle = '#fff'; roundRect(ctx, PAD, y, W - PAD * 2, 170, 26); ctx.fill()
    ctx.fillStyle = '#64748b'; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'center'
    ctx.fillText('Tháng này chưa có buổi công tác nào.', W / 2, y + 96); ctx.textAlign = 'left'
    y += bodyH
  }

  for (const c of cards) {
    const color = c.b.branch.colorHex || '#64748b'
    ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
    ctx.fillStyle = '#fff'; roundRect(ctx, PAD, y, W - PAD * 2, c.h, 26); ctx.fill(); ctx.restore()
    ctx.save(); roundRect(ctx, PAD, y, W - PAD * 2, c.h, 26); ctx.clip(); ctx.fillStyle = color; ctx.fillRect(PAD, y, W - PAD * 2, 66); ctx.restore()
    ctx.fillStyle = isLight(color) ? '#1f2937' : '#fff'; ctx.font = `900 32px ${FONT}`; ctx.fillText(`Ngành ${c.b.branch.name}`, PAD + 26, y + 45)
    let ly = y + 66 + 48
    ctx.fillStyle = '#334155'; ctx.font = `700 28px ${FONT}`
    ctx.fillText(`${c.b.sessions} buổi · điểm danh ${c.b.marked}/${c.b.sessions} · chuyên cần ${pct(c.b.rate)}`, PAD + 26, ly, innerW)
    ly += 14
    ctx.font = `500 28px ${FONT}`
    ctx.fillStyle = '#0f172a'; for (const line of c.top) { ly += LINE; ctx.fillText(line, PAD + 26, ly) }
    ctx.fillStyle = c.b.watch.length ? '#b45309' : '#15803d'; for (const line of c.watch) { ly += LINE; ctx.fillText(line, PAD + 26, ly) }
    y += c.h + 22
  }

  drawFooter(ctx, y + 20)
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Không tạo được ảnh')), 'image/png'))
}
