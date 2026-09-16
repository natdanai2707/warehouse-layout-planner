/**
 * The building shell's geometry: zones scaled along the length, cross-sections
 * shaped across the width, and the roof height a crane runway or a high-bay
 * light hangs from.
 */
import { describe, expect, it } from 'vitest'
import {
  ROOF_PITCH,
  defaultShellDesign,
  designMaxHeight,
  designVolume,
  normalizeSegment,
  roofHeightAt,
  roofProfile,
  segTop,
  segmentSpans,
} from '../components/BuildingShell'
import type { ShellDesign, ShellSegment } from '../interior/types'

const seg = (over: Partial<ShellSegment> = {}): ShellSegment => ({
  len: 10,
  eaveL: 6,
  eaveR: 6,
  roof: 'gable',
  ridgeX: 0.5,
  rise: 2,
  color: '#dfe3e7',
  ...over,
})

const design = (segments: ShellSegment[]): ShellDesign => ({ segments, panels: [], canopies: [] })

describe('normalizing a zone', () => {
  it('migrates the legacy symmetric eave', () => {
    const n = normalizeSegment({ len: 8, eave: 5, roof: 'gable', rise: 1.5, color: '#fff' })
    expect(n.eaveL).toBe(5)
    expect(n.eaveR).toBe(5)
  })

  it('turns a legacy one-sided slope into independent eaves', () => {
    const l = normalizeSegment({ len: 8, eave: 5, roof: 'slopeL', rise: 2, color: '#fff' })
    expect(l.eaveL).toBe(7)
    expect(l.eaveR).toBe(5)
    expect(l.roof).toBe('shed')
    const r = normalizeSegment({ len: 8, eave: 5, roof: 'slopeR', rise: 2, color: '#fff' })
    expect(r.eaveL).toBe(5)
    expect(r.eaveR).toBe(7)
  })

  it('keeps the ridge inside the width', () => {
    expect(normalizeSegment(seg({ ridgeX: 5 })).ridgeX).toBe(0.95)
    expect(normalizeSegment(seg({ ridgeX: -1 })).ridgeX).toBe(0.05)
  })
})

describe('zones along the length', () => {
  it('scales the zones to fill the building exactly', () => {
    const spans = segmentSpans(design([seg({ len: 1 }), seg({ len: 3 })]), 48)
    expect(spans[0].z0).toBe(-24)
    expect(spans[1].z1).toBe(24)
    expect(spans[0].z1 - spans[0].z0).toBe(12) // a quarter of the length
    expect(spans[1].z1 - spans[1].z0).toBe(36)
  })

  it('survives a design whose lengths add to nothing', () => {
    const spans = segmentSpans({ segments: [], panels: [], canopies: [] }, 30)
    expect(spans).toEqual([])
  })
})

describe('cross-section', () => {
  it('puts a gable ridge where it is asked for', () => {
    const prof = roofProfile(normalizeSegment(seg({ eaveL: 6, eaveR: 10, rise: 2, ridgeX: 0.25 })), 24)
    expect(prof).toHaveLength(3)
    expect(prof[1][0]).toBeCloseTo(0.25 * 24 - 12, 6)
    expect(prof[1][1]).toBe(12) // the taller eave plus the rise
  })

  it('a shed is a single plane between the two eaves', () => {
    const prof = roofProfile(normalizeSegment(seg({ roof: 'shed', eaveL: 4, eaveR: 9 })), 20)
    expect(prof).toEqual([
      [-10, 4],
      [10, 9],
    ])
    expect(segTop(normalizeSegment(seg({ roof: 'shed', eaveL: 4, eaveR: 9 })))).toBe(9)
  })
})

describe('roof height overhead', () => {
  const size = { width: 24, length: 48 }

  it('follows the zone you are standing in', () => {
    const d = design([seg({ len: 1, eaveL: 12, eaveR: 12, rise: 3 }), seg({ len: 1, eaveL: 5, eaveR: 5, rise: 1 })])
    expect(roofHeightAt(0, -20, size, 6, d)).toBeCloseTo(15, 6) // tall zone, at the ridge
    expect(roofHeightAt(0, 20, size, 6, d)).toBeCloseTo(6, 6) // low zone
  })

  it('falls back to a plain 15° gable with no design', () => {
    expect(roofHeightAt(0, 0, size, 6, null)).toBeCloseTo(6 + 12 * ROOF_PITCH, 6)
    expect(roofHeightAt(12, 0, size, 6, null)).toBeCloseTo(6, 6) // at the eave
  })

  it('clamps a point outside the width to the wall', () => {
    const d = design([seg({ eaveL: 8, eaveR: 8, rise: 0 })])
    expect(roofHeightAt(999, 0, size, 6, d)).toBeCloseTo(8, 6)
  })
})

describe('enclosed volume', () => {
  it('measures a plain box with a flat-topped shed', () => {
    const d = design([seg({ roof: 'shed', eaveL: 6, eaveR: 6, len: 1 })])
    expect(designVolume(d, 20, 40)).toBeCloseTo(20 * 40 * 6, 6)
  })

  it('adds the gable triangle on top of the walls', () => {
    const d = design([seg({ roof: 'gable', eaveL: 6, eaveR: 6, rise: 3, ridgeX: 0.5, len: 1 })])
    // box 20×40×6 plus a 3 m triangle over the full 20 m width
    expect(designVolume(d, 20, 40)).toBeCloseTo(20 * 40 * 6 + 0.5 * 20 * 3 * 40, 6)
  })

  it('reports the tallest point of the whole building', () => {
    expect(designMaxHeight(design([seg({ eaveL: 6, eaveR: 6, rise: 2 }), seg({ eaveL: 11, eaveR: 11, rise: 1 })]))).toBe(12)
  })
})

describe('the starting design', () => {
  it('is one gabled zone pitched at 15°', () => {
    const d = defaultShellDesign(40, 7, 24)
    expect(d.segments).toHaveLength(1)
    expect(d.segments[0].eaveL).toBe(7)
    expect(d.segments[0].roof).toBe('gable')
    expect(d.segments[0].rise).toBeCloseTo(Math.round(12 * ROOF_PITCH * 10) / 10, 6)
  })
})
