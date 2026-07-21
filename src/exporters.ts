import { CATALOG, defById } from './catalog'
import {
  bboxOf,
  elementArea,
  elementLength,
  fmt,
  formatRai,
  polygonArea,
  polygonCentroid,
  polylineLength,
} from './geometry'
import { canvasCapture } from './components/Scene'
import { useStore } from './store'
import type { PlacedElement, Vec2 } from './types'

export function download(filename: string, url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  download(filename, url)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// PNG = screenshot of the live 3D canvas (same as the gym planner)
export function exportPngFile() {
  const el = canvasCapture.el
  if (!el) return
  download('site-layout.png', el.toDataURL('image/png'))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const path = (pts: Vec2[], close: boolean) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') + (close ? ' Z' : '')

function elementSvg(el: PlacedElement): string {
  const def = defById(el.defId)
  const parts: string[] = []
  if (el.kind === 'rect') {
    parts.push(
      `<g transform="translate(${el.x} ${el.y}) rotate(${el.rot})"><rect x="${-el.w / 2}" y="${-el.d / 2}" width="${el.w}" height="${el.d}" fill="${el.color}" fill-opacity="${def?.fillOpacity ?? 0.6}" stroke="${el.color}" stroke-width="0.3"/></g>`,
    )
    parts.push(
      `<text x="${el.x}" y="${el.y}" text-anchor="middle" font-size="2.2" font-weight="700" fill="#1f2937">${esc(el.label)}</text>`,
      `<text x="${el.x}" y="${el.y + 2.4}" text-anchor="middle" font-size="1.6" fill="#374151">${fmt(el.w)}×${fmt(el.d)} ม.${def?.showArea ? ` · ${fmt(el.w * el.d)} ตร.ม.` : ''}</text>`,
    )
  } else if (el.kind === 'polygon') {
    const c = polygonCentroid(el.pts)
    parts.push(
      `<path d="${path(el.pts, true)}" fill="${el.color}" fill-opacity="0.5" stroke="${el.color}" stroke-width="0.3" stroke-linejoin="round"/>`,
      `<text x="${c.x}" y="${c.y}" text-anchor="middle" font-size="2.2" font-weight="700" fill="#1f2937">${esc(el.label)}</text>`,
    )
    if (def?.showArea)
      parts.push(
        `<text x="${c.x}" y="${c.y + 2.4}" text-anchor="middle" font-size="1.6" fill="#374151">${fmt(polygonArea(el.pts))} ตร.ม.</text>`,
      )
  } else if (el.kind === 'polyline') {
    const d = path(el.pts, false)
    parts.push(
      `<path d="${d}" fill="none" stroke="${el.color}" stroke-opacity="0.85" stroke-width="${el.width}" stroke-linejoin="round"${def?.dashed ? ' stroke-dasharray="1.5 1"' : ''}/>`,
    )
    if (def?.centerline && el.width >= 3)
      parts.push(`<path d="${d}" fill="none" stroke="#ffffff" stroke-width="0.25" stroke-dasharray="3 2"/>`)
    if (def?.flowArrows) parts.push(`<path d="${d}" fill="none" stroke="none" marker-mid="url(#flow)" marker-end="url(#flow)"/>`)
    const mid = el.pts[Math.floor((el.pts.length - 1) / 2)]
    parts.push(
      `<text x="${mid.x}" y="${mid.y - el.width / 2 - 0.6}" text-anchor="middle" font-size="1.6" font-weight="600" fill="#374151">${esc(el.label)} · ${fmt(polylineLength(el.pts))} ม.</text>`,
    )
  } else {
    parts.push(
      `<circle cx="${el.x}" cy="${el.y}" r="${el.radius}" fill="${el.color}" fill-opacity="0.35" stroke="${el.color}" stroke-width="0.25"/>`,
      `<text x="${el.x}" y="${el.y + el.radius * 0.5}" text-anchor="middle" font-size="${el.radius * 1.4}">${def?.icon ?? '•'}</text>`,
    )
  }
  return parts.join('\n')
}

/**
 * Build a clean top-down 2D plan SVG straight from the layout data (the live
 * view is 3D, so the plan is generated, not screenshotted): plot boundary,
 * every visible element with labels, north arrow, scale bar, area caption.
 */
export function buildExportSvg(): string {
  const s = useStore.getState()
  const bb = bboxOf(s.plot.pts)
  const m = 12 // margin (m)
  const x = bb.minX - m
  const y = bb.minY - m
  const w = bb.maxX - bb.minX + 2 * m
  const h = bb.maxY - bb.minY + 2 * m + 8 // extra room for the caption

  const areaSqm = polygonArea(s.plot.pts)
  const caption = `พื้นที่แปลง ${fmt(areaSqm)} ตร.ม. · ${formatRai(areaSqm)}`

  const naX = bb.maxX + m - 6
  const naY = bb.minY - m + 8
  const sbLen = w > 150 ? 50 : w > 60 ? 20 : 10
  const sbX = bb.minX
  const sbY = bb.maxY + m + 2

  const elements = s.elements
    .filter((el) => !s.hiddenLayers.includes(el.layer))
    .map(elementSvg)
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" font-family="'Segoe UI','Sukhumvit Set','Noto Sans Thai',sans-serif" style="background:#ffffff">
<defs><marker id="flow" markerUnits="userSpaceOnUse" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0.5 0.5 L3.5 2 L0.5 3.5 Z" fill="#6366f1"/></marker></defs>
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>
<path d="${path(s.plot.pts, true)}" fill="#f3efe4" stroke="#8a8474" stroke-width="0.4" stroke-dasharray="2 1.2"/>
${elements}
<g transform="rotate(${s.plot.northAngle} ${naX} ${naY})">
  <path d="M${naX} ${naY - 5} L${naX + 2} ${naY + 4} L${naX} ${naY + 2} L${naX - 2} ${naY + 4} Z" fill="#b42318"/>
  <text x="${naX}" y="${naY + 8}" text-anchor="middle" font-size="3" font-weight="700" fill="#2b2926">N</text>
</g>
<g>
  <rect x="${sbX}" y="${sbY}" width="${sbLen}" height="1" fill="#2b2926"/>
  <rect x="${sbX}" y="${sbY}" width="${sbLen / 2}" height="1" fill="#ffffff" stroke="#2b2926" stroke-width="0.15"/>
  <text x="${sbX + sbLen + 2}" y="${sbY + 1.2}" font-size="2.5" fill="#2b2926">${sbLen} ม.</text>
</g>
<text x="${bb.minX + (bb.maxX - bb.minX) / 2}" y="${sbY + 5.5}" text-anchor="middle" font-size="3" font-weight="600" fill="#2b2926">${caption}</text>
</svg>`
}

export function exportSvgFile() {
  downloadBlob('site-plan.svg', new Blob([buildExportSvg()], { type: 'image/svg+xml' }))
}

// Simple bill of quantities: one row per element type with counts and totals
export function exportCsvFile() {
  const { elements } = useStore.getState()
  const byDef = new Map<string, { count: number; area: number; length: number }>()
  for (const el of elements) {
    const e = byDef.get(el.defId) ?? { count: 0, area: 0, length: 0 }
    e.count++
    e.area += elementArea(el)
    e.length += elementLength(el)
    byDef.set(el.defId, e)
  }
  const rows = [['ประเภท (TH)', 'Type (EN)', 'จำนวน', 'พื้นที่รวม (ตร.ม.)', 'ความยาวรวม (ม.)']]
  for (const def of CATALOG) {
    const e = byDef.get(def.id)
    if (!e) continue
    rows.push([def.labelTh, def.labelEn, String(e.count), e.area ? e.area.toFixed(1) : '', e.length ? e.length.toFixed(1) : ''])
  }
  const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n')
  downloadBlob('site-boq.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}
