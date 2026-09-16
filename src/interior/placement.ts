import type { FloorDef, Placed } from './types'
import { GROUND_FLOOR_ID } from './types'

/**
 * Placement rules inside one building, ported from the gym planner.
 *
 * Differences from the gym original, all deliberate:
 *  - the frame is the host building's own footprint, always centered on its
 *    local origin, so several independent buildings just work;
 *  - there is no 'outdoor' rule — outdoor things are site elements here;
 *  - storey height comes from the building's FloorDef list rather than from
 *    whichever mezzanine happened to overlap.
 */

const EPS = 1e-4

export interface Frame {
  width: number // local x extent (m)
  length: number // local z extent (m)
  cell: number // grid cell (m)
}

// Effective axis-aligned footprint after rotation (rot is in 45° steps, 0..7)
export function fp(o: { w: number; d: number; rot: number }): { fw: number; fd: number } {
  const th = (o.rot * Math.PI) / 4
  const c = Math.abs(Math.cos(th))
  const s = Math.abs(Math.sin(th))
  return { fw: o.w * c + o.d * s, fd: o.w * s + o.d * c }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// Snap the footprint's min-corner to the grid (grid origin = minEdge), return new center
function snapCenter(center: number, size: number, minEdge: number, cell: number) {
  const corner = center - size / 2 - minEdge
  return minEdge + Math.round(corner / cell) * cell + size / 2
}

// Clamp the footprint fully inside [min, max] (centered if it doesn't fit)
export function clampInside(center: number, size: number, min: number, max: number) {
  if (size >= max - min) return (min + max) / 2
  const corner = clamp(center - size / 2, min, max - size)
  return corner + size / 2
}

export interface DropResult {
  x: number
  z: number
  rot: number
  valid: boolean
}

/**
 * Where an item actually lands for a desired local position:
 *  - floor: grid-snapped, clamped fully inside the building rectangle
 *  - edge:  snapped onto the nearest perimeter wall, rotation forced to match
 *           that wall (local +z of an edge item always points indoors)
 * `snap` is off for typed coordinates, which keep their exact value.
 */
export function computeDrop(
  o: { w: number; d: number; rot: number; rule: Placed['rule'] },
  rawX: number,
  rawZ: number,
  f: Frame,
  snap = true,
): DropResult {
  const hw = f.width / 2
  const hl = f.length / 2
  const cell = Math.max(0.1, f.cell)

  if (o.rule === 'edge') {
    const dN = Math.abs(rawZ + hl)
    const dS = Math.abs(rawZ - hl)
    const dW = Math.abs(rawX + hw)
    const dE = Math.abs(rawX - hw)
    const m = Math.min(dN, dS, dW, dE)
    if (m === dN || m === dS) {
      const z = m === dN ? -hl : hl
      let x = snap ? snapCenter(rawX, o.w, -hw, cell) : rawX
      x = clampInside(x, o.w, -hw, hw)
      return { x, z, rot: m === dN ? 0 : 4, valid: true }
    }
    const x = m === dW ? -hw : hw
    let z = snap ? snapCenter(rawZ, o.w, -hl, cell) : rawZ
    z = clampInside(z, o.w, -hl, hl)
    return { x, z, rot: m === dW ? 2 : 6, valid: true }
  }

  const { fw, fd } = fp(o)
  let x = snap ? snapCenter(rawX, fw, -hw, cell) : rawX
  let z = snap ? snapCenter(rawZ, fd, -hl, cell) : rawZ
  x = clampInside(x, fw, -hw, hw)
  z = clampInside(z, fd, -hl, hl)
  return { x, z, rot: o.rot, valid: true }
}

/**
 * Where an item sits after the building has been resized. A door or a window
 * stays on the wall it was fitted to and travels with it, sliding along only
 * as far as it must. Everything else keeps its coordinates and gets flagged
 * instead (see getWarningIds) — teleporting a machine across the hall is not
 * a decision the app should make.
 */
export function resolveAfterResize(o: Placed, f: Frame): { x: number; z: number; rot: number } {
  if (o.rule !== 'edge') return { x: o.x, z: o.z, rot: o.rot }
  const hw = f.width / 2
  const hl = f.length / 2
  if (o.rot === 0 || o.rot === 4) {
    return { x: clampInside(o.x, o.w, -hw, hw), z: o.rot === 0 ? -hl : hl, rot: o.rot }
  }
  return { x: o.rot === 2 ? -hw : hw, z: clampInside(o.z, o.w, -hl, hl), rot: o.rot }
}

/** Items tinted red: floor items the building no longer covers. */
export function getWarningIds(objects: Placed[], f: Frame): Set<string> {
  const warn = new Set<string>()
  const hw = f.width / 2
  const hl = f.length / 2
  for (const o of objects) {
    if (o.rule !== 'floor') continue
    const { fw, fd } = fp(o)
    if (o.x - fw / 2 < -hw - EPS || o.x + fw / 2 > hw + EPS || o.z - fd / 2 < -hl - EPS || o.z + fd / 2 > hl + EPS)
      warn.add(o.id)
  }
  return warn
}

/* ------------------------------------------------------------------ floors */

export const floorIdOf = (o: Pick<Placed, 'floorId'>) => o.floorId ?? GROUND_FLOOR_ID

export const floorById = (floors: FloorDef[], id: string | undefined): FloorDef | undefined =>
  floors.find((fl) => fl.id === (id ?? GROUND_FLOOR_ID)) ?? floors[0]

/** Height of an item's floor above the building slab. */
export function elevationFor(o: Pick<Placed, 'floorId'>, floors: FloorDef[]): number {
  return floorById(floors, o.floorId)?.base ?? 0
}

/** Total height of the storey stack: the top floor's base plus its clear height. */
export function stackHeight(floors: FloorDef[]): number {
  return floors.reduce((m, fl) => Math.max(m, fl.base + fl.clear), 0)
}

/* ---------------------------------------------------------------- openings */

export interface Opening {
  c: number // center along the wall (wall-local u)
  w: number
  y0: number // bottom of the hole above the host's floor (0 for a door)
  y1: number
  glass?: boolean // a glazed opening, not a walk-through doorway
}

/**
 * Doors and glass openings placed on a wall cut a hole automatically. A door
 * is a hole down to the floor; a window is a band starting at its sill, so the
 * wall keeps a spandrel below and a head above. The wall is described in the
 * HOST's local frame.
 */
export function wallOpenings(
  doors: Placed[],
  host: Placed,
  wall: { cx: number; cz: number; along: 'x' | 'z'; len: number; t: number },
): Opening[] {
  const a = (host.rot * Math.PI) / 4
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const res: Opening[] = []
  for (const d of doors) {
    if (floorIdOf(d) !== floorIdOf(host)) continue
    const rel = (((d.rot - host.rot) % 8) + 8) % 8
    if (wall.along === 'x' ? rel % 4 !== 0 : rel % 4 !== 2) continue
    const wx = d.x - host.x
    const wz = d.z - host.z
    const lx = wx * cos - wz * sin
    const lz = wx * sin + wz * cos
    const u = wall.along === 'x' ? lx - wall.cx : lz - wall.cz
    const v = wall.along === 'x' ? lz - wall.cz : lx - wall.cx
    if (Math.abs(v) > wall.t / 2 + d.d / 2 + 0.15) continue
    if (Math.abs(u) > wall.len / 2 + d.w / 2 - 0.08) continue
    const glass = d.category === 'window'
    const y0 = glass ? clamp(d.sill ?? 0.9, 0, Math.max(0, host.h - 0.2)) : 0
    res.push({ c: u, w: d.w + 0.02, y0, y1: Math.min(y0 + d.h, host.h - 0.02), glass })
  }
  return res
}

/**
 * Split a wall (length `len`, height `h`) into the solid rectangles left after
 * cutting `openings` out of it — an exact rectangle subtraction, so a door with
 * a window above it keeps the transom between them and the wall either side.
 */
export function wallPanels(
  len: number,
  h: number,
  openings: Opening[],
): Array<{ u0: number; u1: number; y0: number; y1: number }> {
  const holes = openings
    .map((o) => ({
      x0: Math.max(-len / 2, o.c - o.w / 2),
      x1: Math.min(len / 2, o.c + o.w / 2),
      y0: Math.max(0, o.y0),
      y1: Math.min(o.y1, h),
    }))
    .filter((o) => o.x1 - o.x0 > 0.02 && o.y1 - o.y0 > 0.05)
  if (holes.length === 0) return len > 0.04 && h > 0.04 ? [{ u0: -len / 2, u1: len / 2, y0: 0, y1: h }] : []

  const xs = [...new Set([-len / 2, len / 2, ...holes.flatMap((o) => [o.x0, o.x1])])].sort((a, b) => a - b)
  const res: Array<{ u0: number; u1: number; y0: number; y1: number }> = []
  for (let i = 0; i < xs.length - 1; i++) {
    const u0 = xs[i]
    const u1 = xs[i + 1]
    if (u1 - u0 <= 0.02) continue
    const mid = (u0 + u1) / 2
    const bands = holes
      .filter((o) => o.x0 <= mid && o.x1 >= mid)
      .map((o) => [o.y0, o.y1] as [number, number])
      .sort((a, b) => a[0] - b[0])
    let y = 0
    for (const [b0, b1] of bands) {
      if (b0 - y > 0.04) res.push({ u0, u1, y0: y, y1: b0 })
      y = Math.max(y, b1)
    }
    if (h - y > 0.04) res.push({ u0, u1, y0: y, y1: h })
  }
  return res
}

/**
 * Doors and glass openings placed on the building perimeter, resolved onto one
 * shell wall. `rotWant` is the rotation an edge item takes on that wall
 * (0 = north/-z, 4 = south/+z, 2 = west/-x, 6 = east/+x).
 */
export function shellOpenings(objects: Placed[], rotWant: number, wallH: number): Opening[] {
  const res: Opening[] = []
  for (const o of objects) {
    const glass = o.category === 'window'
    if ((!glass && o.category !== 'door') || o.rule !== 'edge' || o.rot !== rotWant) continue
    const c = rotWant === 0 || rotWant === 4 ? o.x : o.z
    const y0 = glass ? clamp(o.sill ?? 0.9, 0, Math.max(0, wallH - 0.2)) : 0
    res.push({ c, w: o.w + (glass ? 0 : 0.12), y0, y1: Math.min(y0 + o.h, wallH - 0.02), glass })
  }
  return res
}

/**
 * Entrance steps and ramps end on a level landing at the door, not on the last
 * tread. This is how much of their depth that landing takes.
 */
export function landingDepth(d: number): number {
  return clamp(Math.min(1.4, d * 0.4), 0.6, Math.max(0.3, d - 0.6))
}

/* --------------------------------------------------------- local ↔ world */

/**
 * A building's local frame → world site meters. The site rect stores its
 * rotation in DEGREES clockwise, matching the rest of this app; local +z maps
 * onto world +y (south) at rot 0.
 */
export function localToWorld(
  p: { x: number; z: number },
  b: { x: number; y: number; rot: number },
): { x: number; y: number } {
  const a = (b.rot * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: b.x + p.x * c - p.z * s, y: b.y + p.x * s + p.z * c }
}

export function worldToLocal(
  p: { x: number; y: number },
  b: { x: number; y: number; rot: number },
): { x: number; z: number } {
  const a = (b.rot * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dx = p.x - b.x
  const dy = p.y - b.y
  return { x: dx * c + dy * s, z: -dx * s + dy * c }
}
