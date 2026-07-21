import type { PlacedElement, PlacedRect, Vec2 } from './types'

export const SQM_PER_RAI = 1600 // 1 ไร่ = 1600 m²

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export const snap = (v: number, cell: number) => Math.round(v / cell) * cell

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

// Shoelace formula (absolute value → winding-independent)
export function polygonArea(pts: Vec2[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

export function polygonCentroid(pts: Vec2[]): Vec2 {
  if (pts.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p.x
    y += p.y
  }
  return { x: x / pts.length, y: y / pts.length }
}

export function polylineLength(pts: Vec2[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i])
  return s
}

// Ray-casting point-in-polygon
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function rotateDeg(p: Vec2, center: Vec2, deg: number): Vec2 {
  const th = (deg * Math.PI) / 180
  const c = Math.cos(th)
  const s = Math.sin(th)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c }
}

export function rectCorners(r: Pick<PlacedRect, 'x' | 'y' | 'w' | 'd' | 'rot'>): Vec2[] {
  const c = { x: r.x, y: r.y }
  const hw = r.w / 2
  const hd = r.d / 2
  return [
    { x: r.x - hw, y: r.y - hd },
    { x: r.x + hw, y: r.y - hd },
    { x: r.x + hw, y: r.y + hd },
    { x: r.x - hw, y: r.y + hd },
  ].map((p) => rotateDeg(p, c, r.rot))
}

// The points that define an element's footprint (used for bbox + boundary check)
export function elementVertices(el: PlacedElement): Vec2[] {
  switch (el.kind) {
    case 'rect':
      return rectCorners(el)
    case 'polygon':
    case 'polyline':
      return el.pts
    case 'point':
      return [{ x: el.x, y: el.y }]
  }
}

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function bboxOf(pts: Vec2[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

export const elementBBox = (el: PlacedElement): BBox => bboxOf(elementVertices(el))

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// An element is flagged (red tint) when any of its defining vertices falls
// outside the plot boundary. Points sitting ON the boundary line (fences,
// gates) are tolerated. Flagged elements are NEVER auto-moved or deleted.
export function isOutsideBoundary(el: PlacedElement, plotPts: Vec2[]): boolean {
  if (plotPts.length < 3) return false
  const EDGE_TOL = 0.35
  return elementVertices(el).some((p) => {
    if (pointInPolygon(p, plotPts)) return false
    for (let i = 0; i < plotPts.length; i++) {
      if (distToSegment(p, plotPts[i], plotPts[(i + 1) % plotPts.length]) <= EDGE_TOL) return false
    }
    return true
  })
}

export function elementArea(el: PlacedElement): number {
  if (el.kind === 'rect') return el.w * el.d
  if (el.kind === 'polygon') return polygonArea(el.pts)
  return 0
}

export function elementLength(el: PlacedElement): number {
  return el.kind === 'polyline' ? polylineLength(el.pts) : 0
}

// Seed shape dropped for polygon-type elements: an octagon inscribed in the
// default size box (reads better than a bare rectangle for ponds/lawns).
export function makeSeedPolygon(center: Vec2, size: Vec2): Vec2[] {
  const hw = size.x / 2
  const hh = size.y / 2
  const cw = hw * 0.45
  const ch = hh * 0.45
  return [
    { x: -hw + cw, y: -hh },
    { x: hw - cw, y: -hh },
    { x: hw, y: -hh + ch },
    { x: hw, y: hh - ch },
    { x: hw - cw, y: hh },
    { x: -hw + cw, y: hh },
    { x: -hw, y: hh - ch },
    { x: -hw, y: -hh + ch },
  ].map((p) => ({ x: center.x + p.x, y: center.y + p.y }))
}

// Largest "nice" length whose on-screen size stays under maxPx (for the scale bar)
export function niceScaleLength(ppm: number, maxPx = 140): number {
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
  let best = nice[0]
  for (const n of nice) if (n * ppm <= maxPx) best = n
  return best
}

/**
 * Alignment snapping for a dragged element: compare the moving bbox's edges and
 * center against every other visible element's edges/center; within `tol`
 * meters the nearest match wins. Returns the delta to add and the guide line
 * position (world coords) for rendering.
 */
export function axisAlign(
  moving: BBox,
  others: BBox[],
  tol: number,
): { dx: number; dy: number; gx: number | null; gy: number | null } {
  const mx = [moving.minX, (moving.minX + moving.maxX) / 2, moving.maxX]
  const my = [moving.minY, (moving.minY + moving.maxY) / 2, moving.maxY]
  let dx = 0
  let dy = 0
  let gx: number | null = null
  let gy: number | null = null
  let bestX = tol
  let bestY = tol
  for (const o of others) {
    const tx = [o.minX, (o.minX + o.maxX) / 2, o.maxX]
    const ty = [o.minY, (o.minY + o.maxY) / 2, o.maxY]
    for (const m of mx)
      for (const t of tx)
        if (Math.abs(t - m) < bestX) {
          bestX = Math.abs(t - m)
          dx = t - m
          gx = t
        }
    for (const m of my)
      for (const t of ty)
        if (Math.abs(t - m) < bestY) {
          bestY = Math.abs(t - m)
          dy = t - m
          gy = t
        }
  }
  return { dx, dy, gx, gy }
}

export const fmt = (v: number, digits = 1) =>
  v.toLocaleString('en-US', { maximumFractionDigits: digits })

// Traditional Thai land units: 1 ไร่ = 4 งาน = 400 ตร.วา; 1 ตร.วา = 4 m²
export function formatRai(sqm: number): string {
  const wa = sqm / 4
  const rai = Math.floor(wa / 400)
  const ngan = Math.floor((wa % 400) / 100)
  const sqwa = wa - rai * 400 - ngan * 100
  return `${rai} ไร่ ${ngan} งาน ${fmt(sqwa, 1)} ตร.วา`
}
