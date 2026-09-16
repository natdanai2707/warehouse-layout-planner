/**
 * Framing the isometric camera. The bug this pins down: a plot longer than a
 * couple of kilometres put the camera beyond its own far plane and the whole
 * canvas went blank — no plot, no buildings, nothing.
 */
import { describe, expect, it } from 'vitest'
import { framingClips, isoCameraPos, isoFraming } from '../framing'
import type { BBox } from '../geometry'

const box = (w: number, d: number): BBox => ({ minX: 0, minY: 0, maxX: w, maxY: d })

describe('clip range', () => {
  it('always contains the camera, at every site size', () => {
    for (const [w, d] of [
      [20, 20],
      [150, 110],
      [3400, 150], // the strip that went blank
      [12000, 900],
      [40000, 40000],
    ]) {
      const f = isoFraming(box(w, d), 1400, 900)
      expect(framingClips(f), `${w}×${d} clips the camera`).toBe(false)
      const [cx, cy, cz] = isoCameraPos(f)
      expect(Math.hypot(cx - f.center[0], cy, cz - f.center[2])).toBeLessThan(f.depth)
    }
  })

  it('leaves room behind the far corner of the site as well', () => {
    const f = isoFraming(box(3400, 150), 1400, 900)
    // the farthest point of the plot from the camera, plus its stand-off
    expect(f.depth).toBeGreaterThan(f.dist * Math.sqrt(3) + 3400)
  })
})

describe('zoom', () => {
  it('fits a long thin strip across the viewport, not just its longest side', () => {
    const f = isoFraming(box(3400, 150), 1400, 900)
    const screenW = ((3400 + 150) / Math.SQRT2) * f.zoom
    const screenH = ((3400 + 150) / Math.sqrt(6)) * f.zoom
    expect(screenW).toBeLessThanOrEqual(1400)
    expect(screenH).toBeLessThanOrEqual(900)
    // and actually fills one of the two axes, rather than sitting tiny
    expect(Math.max(screenW / 1400, screenH / 900)).toBeGreaterThan(0.8)
  })

  it('fits a square site too', () => {
    const f = isoFraming(box(200, 200), 1000, 800)
    expect(((200 + 200) / Math.SQRT2) * f.zoom).toBeLessThanOrEqual(1000)
    expect(((200 + 200) / Math.sqrt(6)) * f.zoom).toBeLessThanOrEqual(800)
  })

  it('stays positive for a degenerate footprint', () => {
    expect(isoFraming(box(0, 0), 1000, 800).zoom).toBeGreaterThan(0)
  })
})

describe('center', () => {
  it('is the middle of the box, on the ground', () => {
    expect(isoFraming({ minX: -100, minY: 20, maxX: 300, maxY: 120 }, 1000, 800).center).toEqual([100, 0, 70])
  })
})
