import { encode } from 'uqr'
import { drawFooter, drawHeader, FONT, HEADER_H, PAD, roundRect, W, wrap } from './weekImage'

/** Dark/light modules of the QR, without the quiet zone (callers add their own margin) */
export const qrModules = (text: string) => encode(text, { ecc: 'M', border: 0 }).data

/** SVG path with one unit square per dark module, sharp at any display size */
export function qrPath(modules: boolean[][]): string {
  let d = ''
  modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x} ${y}h1v1h-1z` }))
  return d
}

const STEPS = ['Mở Camera điện thoại, hướng vào mã QR.', 'Bấm vào đường link hiện ra trên màn hình.', 'Bấm “Cài app vào điện thoại” rồi làm theo hướng dẫn.']
const QR = 640, QUIET = 4, STEP_LINE = 40, STEP_GAP = 22

/** Picture to send in the Zalo group or print: the Đoàn header, a QR big enough to scan off a phone screen, and the steps */
export async function renderInstallQrImage(link: string): Promise<Blob> {
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!
  const modules = qrModules(link), cell = QR / (modules.length + QUIET * 2)
  const textX = PAD + 100, textW = W - PAD - 30 - textX

  // Measure pass: a step may wrap on narrow fonts
  ctx.font = `700 30px ${FONT}`
  const steps = STEPS.map(s => wrap(ctx, s, textW))
  const stepsH = steps.reduce((t, lines) => t + lines.length * STEP_LINE + STEP_GAP, STEP_GAP)
  const qrTop = HEADER_H + 40, linkY = qrTop + QR + 52, stepsTop = linkY + 34
  const H = stepsTop + stepsH + 130
  canvas.width = W; canvas.height = H

  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#fff7ed'); bg.addColorStop(1, '#eff6ff')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  await drawHeader(ctx, { title: 'CÀI APP TNTT LỊCH', subtitle: 'Quét mã để cài app vào điện thoại' })

  // White card holding the code; the quiet zone inside it is what scanners need around the modules
  const qrX = (W - QR) / 2
  ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.12)'; ctx.shadowBlur = 30; ctx.fillStyle = '#fff'
  roundRect(ctx, qrX, qrTop, QR, QR, 36); ctx.fill(); ctx.restore()
  ctx.fillStyle = '#0f172a'
  modules.forEach((row, y) => row.forEach((dark, x) => {
    // Overlap by a hair so anti-aliasing leaves no white seams between modules
    if (dark) ctx.fillRect(qrX + (x + QUIET) * cell, qrTop + (y + QUIET) * cell, cell + 0.5, cell + 0.5)
  }))

  ctx.textAlign = 'center'; ctx.fillStyle = '#1d4ed8'; ctx.font = `700 28px ${FONT}`
  ctx.fillText(link.replace(/^https?:\/\//, ''), W / 2, linkY, W - PAD * 2)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#fff'; roundRect(ctx, PAD, stepsTop, W - PAD * 2, stepsH, 26); ctx.fill()
  let y = stepsTop + STEP_GAP
  steps.forEach((lines, i) => {
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(PAD + 52, y + 20, 24, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `900 26px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), PAD + 52, y + 29)
    ctx.textAlign = 'left'; ctx.fillStyle = '#0f172a'; ctx.font = `700 30px ${FONT}`
    lines.forEach((line, j) => ctx.fillText(line, textX, y + 31 + j * STEP_LINE))
    y += lines.length * STEP_LINE + STEP_GAP
  })

  drawFooter(ctx, stepsTop + stepsH + 20)

  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Không tạo được ảnh')), 'image/png'))
}
