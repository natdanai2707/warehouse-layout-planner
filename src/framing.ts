import type { BBox } from './geometry'

/**
 * How the isometric camera is set up to frame a footprint.
 *
 * Under this projection a point (x, z) lands at ((x - z)/√2, (x + z)/√6) on
 * screen, so a w × d footprint spans (w + d)/√2 across and (w + d)/√6 up.
 * Fitting BOTH is what makes a long thin strip fill the view instead of being
 * framed on its longest side alone.
 *
 * `depth` is the orthographic clip half-range. It has to follow the site: the
 * camera stands off by 1.2 × the longest side and then again by √3 because it
 * sits at the corner, so a fixed far plane (it used to be 4000) put anything
 * bigger than about a 2 km site entirely behind it — and the screen went blank.
 */
export interface Framing {
  center: [number, number, number]
  zoom: number
  dist: number
  depth: number
}

export function isoFraming(bb: BBox, viewW: number, viewH: number): Framing {
  const w = Math.max(6, bb.maxX - bb.minX)
  const d = Math.max(6, bb.maxY - bb.minY)
  const sx = (w + d) / Math.SQRT2
  const sy = (w + d) / Math.sqrt(6)
  const span = Math.max(w, d)
  return {
    center: [(bb.minX + bb.maxX) / 2, 0, (bb.minY + bb.maxY) / 2],
    zoom: Math.max(0.02, 0.86 * Math.min(viewW / sx, viewH / sy)),
    dist: span * 1.2 + 40,
    depth: span * 12 + 4000,
  }
}

/** Camera position for a framing: the standard corner view. */
export const isoCameraPos = (f: Framing): [number, number, number] => [
  f.center[0] + f.dist,
  f.dist,
  f.center[2] + f.dist,
]

/** True when the camera would sit outside its own clip range — the blank-screen bug. */
export const framingClips = (f: Framing): boolean => f.dist * Math.sqrt(3) >= f.depth
