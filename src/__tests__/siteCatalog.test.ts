/**
 * The site palette. The expensive mistake carried over from the gym planner is
 * an item whose group is missing from the palette order — it simply never
 * appears — so that is pinned here along with the fields each geometry needs
 * to render and to be edited after placing.
 */
import { describe, expect, it } from 'vitest'
import { CATALOG, LAYERS, PALETTE_ORDER, defById } from '../catalog'

describe('integrity', () => {
  it('shows every item in the palette', () => {
    for (const d of CATALOG) {
      expect(PALETTE_ORDER, `${d.id} would never appear`).toContain(d.layer)
      expect(LAYERS.some((l) => l.id === d.layer)).toBe(true)
    }
  })

  it('has unique ids and both labels', () => {
    const ids = CATALOG.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of CATALOG) {
      expect(d.labelTh, d.id).toBeTruthy()
      expect(d.labelEn, d.id).toBeTruthy()
      expect(d.icon, d.id).toBeTruthy()
    }
  })

  it('gives every geometry what it needs to be placed', () => {
    for (const d of CATALOG) {
      if (d.geom === 'rect') {
        expect(d.w, d.id).toBeGreaterThan(0)
        expect(d.d, d.id).toBeGreaterThan(0)
      }
      if (d.geom === 'polygon') expect(d.polySize, d.id).toBeTruthy()
      if (d.geom === 'polyline') expect(d.lineWidth, d.id).toBeGreaterThan(0)
      if (d.geom === 'point') expect(d.radius, d.id).toBeGreaterThan(0)
    }
  })
})

describe('the items added for the steel yard', () => {
  it('draws the yards and the concrete road as multi-point shapes', () => {
    expect(defById('yard_concrete')?.geom).toBe('polygon')
    expect(defById('yard_rock')?.geom).toBe('polygon')
    expect(defById('road_concrete')?.geom).toBe('polyline')
    // and each carries the surface finish that tells them apart on the ground
    expect(defById('yard_concrete')?.surface).toBe('concrete')
    expect(defById('yard_rock')?.surface).toBe('gravel')
    expect(defById('road_concrete')?.surface).toBe('concrete')
  })

  it('makes the carport and yard canopies raised roofs on posts', () => {
    for (const id of ['carport_roof', 'canopy_shape']) {
      const d = defById(id)!
      expect(d.geom, id).toBe('polygon')
      expect(d.polyHeight, id).toBeGreaterThan(2)
      expect(d.posts, id).toBe(true)
    }
  })

  it('gives every point marker a height to edit, not just a radius', () => {
    for (const d of CATALOG) {
      if (d.geom !== 'point' || !d.pointStyle) continue
      expect(d.pointHeight, `${d.id} has no editable height`).toBeGreaterThan(0)
    }
  })

  it('offers both an upright and a horizontal water tank', () => {
    expect(defById('watertank')?.pointStyle).toBe('tank')
    expect(defById('watertank_h')?.pointStyle).toBe('tank_h')
    // the horizontal one's `h` is its length, so it should be the longer figure
    expect(defById('watertank_h')!.pointHeight!).toBeGreaterThan(defById('watertank_h')!.radius! * 2)
  })

  it('lets the elevated tank stand as tall as one really does', () => {
    const d = defById('champagnetank')!
    expect(d.pointStyle).toBe('elevated')
    expect(d.pointHeight).toBeGreaterThanOrEqual(10)
  })

  it('has the outdoor steel sculptures, all resizable after placing', () => {
    for (const id of ['sculpt_beams', 'sculpt_tree', 'sculpt_figure', 'sculpt_cubes']) {
      const d = defById(id)!
      expect(d, id).toBeTruthy()
      // rect geometry is what gives them the resize arrows and the w/d/h fields
      expect(d.geom, id).toBe('rect')
      expect(d.h, id).toBeGreaterThan(0)
    }
  })
})
