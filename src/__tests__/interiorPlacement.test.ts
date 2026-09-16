/**
 * Interior placement inside one building. The guarantees that matter:
 * every building has its own local frame, so two buildings on the same site
 * never interfere; edge items stay on their wall through a resize; and the
 * local↔world transform round-trips exactly at any rotation.
 */
import { describe, expect, it } from 'vitest'
import {
  clampInside,
  computeDrop,
  elevationFor,
  fp,
  getWarningIds,
  localToWorld,
  resolveAfterResize,
  shellOpenings,
  stackHeight,
  wallPanels,
  worldToLocal,
} from '../interior/placement'
import type { Frame } from '../interior/placement'
import type { FloorDef, Placed } from '../interior/types'
import { CATALOG, CATEGORY_LABELS, CATEGORY_ORDER, defById } from '../interior/catalog'

const frame: Frame = { width: 24, length: 48, cell: 1 }

const item = (over: Partial<Placed> = {}): Placed => ({
  id: 'o1',
  defId: 'press_brake',
  label: 'press',
  category: 'machine',
  w: 4,
  d: 2,
  h: 2.7,
  x: 0,
  z: 0,
  rot: 0,
  color: '#888',
  rule: 'floor',
  ...over,
})

describe('catalog integrity', () => {
  it('every category is in CATEGORY_ORDER and CATEGORY_LABELS', () => {
    for (const def of CATALOG) {
      expect(CATEGORY_ORDER, `${def.id} category missing from CATEGORY_ORDER`).toContain(def.category)
      expect(CATEGORY_LABELS[def.category]).toBeTruthy()
    }
  })

  it('has no duplicate ids and every item has a positive footprint', () => {
    const ids = CATALOG.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of CATALOG) {
      expect(d.w, d.id).toBeGreaterThan(0)
      expect(d.d, d.id).toBeGreaterThan(0)
      expect(d.h, d.id).toBeGreaterThan(0)
    }
  })

  it('looks items up by id', () => {
    expect(defById('laser_cut')?.labelEn).toBe('Fiber Laser Cutter')
    expect(defById('nope')).toBeUndefined()
  })
})

describe('computeDrop', () => {
  it('clamps a floor item fully inside the building', () => {
    const d = computeDrop(item({ w: 9, d: 2.6 }), 900, 900, frame)
    expect(d.x + 4.5).toBeLessThanOrEqual(12.0001)
    expect(d.z + 1.3).toBeLessThanOrEqual(24.0001)
    expect(d.valid).toBe(true)
  })

  it('snaps an edge item onto the nearest wall and turns it inward', () => {
    // near the west wall
    const w = computeDrop(item({ rule: 'edge', w: 2, d: 0.3 }), -11.4, 3, frame)
    expect(w.x).toBe(-12)
    expect(w.rot).toBe(2)
    // near the south wall
    const s = computeDrop(item({ rule: 'edge', w: 2, d: 0.3 }), 1, 23.6, frame)
    expect(s.z).toBe(24)
    expect(s.rot).toBe(4)
  })

  it('keeps typed coordinates exact when snapping is off', () => {
    const d = computeDrop(item(), 3.37, -8.12, frame, false)
    expect(d.x).toBeCloseTo(3.37, 6)
    expect(d.z).toBeCloseTo(-8.12, 6)
  })

  it('accounts for rotation in the footprint', () => {
    const q = fp({ w: 4, d: 2, rot: 2 })
    expect(q.fw).toBeCloseTo(2, 9)
    expect(q.fd).toBeCloseTo(4, 9)
    const r = fp({ w: 4, d: 2, rot: 1 })
    expect(r.fw).toBeCloseTo(Math.SQRT1_2 * 6, 6)
  })

  it('centers an item that cannot fit', () => {
    expect(clampInside(99, 40, -12, 12)).toBe(0)
  })
})

describe('resize behaviour', () => {
  it('carries an edge item along with its wall', () => {
    const door = item({ rule: 'edge', rot: 4, x: 3, z: 24, w: 2 })
    const grown: Frame = { ...frame, length: 60 }
    expect(resolveAfterResize(door, grown)).toEqual({ x: 3, z: 30, rot: 4 })
  })

  it('leaves floor items where they are and only flags the ones left outside', () => {
    const inside = item({ id: 'in', x: 0, z: 0 })
    const outside = item({ id: 'out', x: 0, z: 40 })
    const warn = getWarningIds([inside, outside], frame)
    expect(warn.has('out')).toBe(true)
    expect(warn.has('in')).toBe(false)
    expect(outside.z).toBe(40) // never moved
  })
})

describe('storeys', () => {
  const floors: FloorDef[] = [
    { id: 'ground', name: '1F', base: 0, clear: 4 },
    { id: 'f2', name: '2F', base: 4.2, clear: 3 },
  ]

  it('puts an item at its own storey level', () => {
    expect(elevationFor({ floorId: 'f2' }, floors)).toBe(4.2)
    expect(elevationFor({ floorId: undefined }, floors)).toBe(0)
  })

  it('measures the whole stack', () => {
    expect(stackHeight(floors)).toBe(7.2)
  })
})

describe('wall openings', () => {
  it('keeps the transom between a door and the window above it', () => {
    const panels = wallPanels(10, 4, [
      { c: 0, w: 2, y0: 0, y1: 2.1 },
      { c: 0, w: 1.4, y0: 2.6, y1: 3.4, glass: true },
    ])
    // the band between 2.1 and 2.6 over the door survives
    expect(panels.some((p) => p.y0 === 2.1 && p.y1 === 2.6)).toBe(true)
    // and so does the wall either side
    expect(panels.some((p) => p.u0 === -5)).toBe(true)
    expect(panels.some((p) => p.u1 === 5)).toBe(true)
  })

  it('cuts a door to the floor and a window from its sill', () => {
    const objs = [
      item({ id: 'd', defId: 'door_main', category: 'door', rule: 'edge', rot: 0, x: 2, w: 2, h: 2.4 }),
      item({ id: 'w', defId: 'window_wall', category: 'window', rule: 'edge', rot: 0, x: -3, w: 4, h: 2, sill: 1.2 }),
    ]
    const ops = shellOpenings(objs, 0, 6)
    expect(ops).toHaveLength(2)
    expect(ops.find((o) => !o.glass)?.y0).toBe(0)
    expect(ops.find((o) => o.glass)?.y0).toBe(1.2)
  })

  it('ignores openings placed on a different wall', () => {
    const objs = [item({ category: 'door', rule: 'edge', rot: 4 })]
    expect(shellOpenings(objs, 0, 6)).toHaveLength(0)
  })
})

describe('local ↔ world', () => {
  it('round-trips at every 15° of building rotation', () => {
    for (let rot = 0; rot < 360; rot += 15) {
      const b = { x: 37.5, y: -12.25, rot }
      for (const p of [
        { x: 0, z: 0 },
        { x: 8.5, z: -3.25 },
        { x: -11, z: 22 },
      ]) {
        const back = worldToLocal(localToWorld(p, b), b)
        expect(back.x).toBeCloseTo(p.x, 9)
        expect(back.z).toBeCloseTo(p.z, 9)
      }
    }
  })

  it('maps local +z onto world +y (south) for an unrotated building', () => {
    const w = localToWorld({ x: 0, z: 5 }, { x: 10, y: 20, rot: 0 })
    expect(w).toEqual({ x: 10, y: 25 })
  })

  it('maps local +z onto world -x when the building is turned 90°', () => {
    const w = localToWorld({ x: 0, z: 5 }, { x: 0, y: 0, rot: 90 })
    expect(w.x).toBeCloseTo(-5, 9)
    expect(w.y).toBeCloseTo(0, 9)
  })

  it('keeps two buildings independent: the same local point maps somewhere else', () => {
    const a = localToWorld({ x: 2, z: 2 }, { x: 0, y: 0, rot: 0 })
    const b = localToWorld({ x: 2, z: 2 }, { x: 80, y: 40, rot: 30 })
    expect(a).not.toEqual(b)
  })
})
