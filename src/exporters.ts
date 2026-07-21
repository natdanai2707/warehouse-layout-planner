import { CATALOG } from './catalog'
import { bboxOf, elementArea, elementLength, fmt, formatRai, polygonArea } from './geometry'
import { svgCapture } from './components/SiteCanvas'
import { useStore } from './store'

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

/**
 * Build a standalone plan SVG from the live canvas: take the world <g> (all
 * geometry is in real-world meters), strip UI-only nodes (handles, guides,
 * selection), frame the viewBox on the plot, and add a north arrow + scale
 * bar + area caption for sharing.
 */
export function buildExportSvg(): string | null {
  const live = svgCapture.el
  if (!live) return null
  const s = useStore.getState()
  const world = live.querySelector('#world')
  if (!world) return null

  const clone = world.cloneNode(true) as SVGGElement
  clone.removeAttribute('transform')
  clone.querySelectorAll('[data-ui="1"]').forEach((n) => n.remove())

  const bb = bboxOf(s.plot.pts)
  const m = 12 // margin (m)
  const x = bb.minX - m
  const y = bb.minY - m
  const w = bb.maxX - bb.minX + 2 * m
  const h = bb.maxY - bb.minY + 2 * m + 8 // extra room for the caption

  const areaSqm = polygonArea(s.plot.pts)
  const caption = `พื้นที่แปลง ${fmt(areaSqm)} ตร.ม. · ${formatRai(areaSqm)}`

  // north arrow (top-right) + scale bar (bottom-left) in world units
  const naX = bb.maxX + m - 6
  const naY = bb.minY - m + 8
  const sbLen = w > 150 ? 50 : w > 60 ? 20 : 10
  const sbX = bb.minX
  const sbY = bb.maxY + m + 2

  const extras = `
  <g transform="rotate(${s.plot.northAngle} ${naX} ${naY})">
    <path d="M${naX} ${naY - 5} L${naX + 2} ${naY + 4} L${naX} ${naY + 2} L${naX - 2} ${naY + 4} Z" fill="#b42318"/>
    <text x="${naX}" y="${naY + 8}" text-anchor="middle" font-size="3" font-weight="700" fill="#2b2926">N</text>
  </g>
  <g>
    <rect x="${sbX}" y="${sbY}" width="${sbLen}" height="1" fill="#2b2926"/>
    <rect x="${sbX}" y="${sbY}" width="${sbLen / 2}" height="1" fill="#ffffff" stroke="#2b2926" stroke-width="0.15"/>
    <text x="${sbX + sbLen + 2}" y="${sbY + 1.2}" font-size="2.5" fill="#2b2926">${sbLen} ม.</text>
  </g>
  <text x="${bb.minX + (bb.maxX - bb.minX) / 2}" y="${sbY + 5.5}" text-anchor="middle" font-size="3" font-weight="600" fill="#2b2926">${caption}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" font-family="'Segoe UI','Sukhumvit Set','Noto Sans Thai',sans-serif" style="background:#ffffff">
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>
${clone.outerHTML}
${extras}
</svg>`
}

export function exportSvgFile() {
  const svg = buildExportSvg()
  if (!svg) return
  downloadBlob('site-layout.svg', new Blob([svg], { type: 'image/svg+xml' }))
}

export function exportPngFile() {
  const svg = buildExportSvg()
  if (!svg) return
  const s = useStore.getState()
  const bb = bboxOf(s.plot.pts)
  const w = bb.maxX - bb.minX + 24
  const h = bb.maxY - bb.minY + 32
  const scale = 2400 / Math.max(w, h)
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    download('site-layout.png', canvas.toDataURL('image/png'))
  }
  img.src = url
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
