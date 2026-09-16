import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../store'
import type { Placed } from '../interior/types'
import { elevationFor, fp, wallOpenings } from '../interior/placement'
import type { Opening } from '../interior/placement'
import { activeBuildingOf } from './InteriorScene'

/**
 * First-person walk-through of the building you are inside, in its own local
 * frame. Ported from the gym planner and cut down to what a factory needs:
 * the perimeter blocks except where a door is placed, machines and racks are
 * solid, rooms and partitions open at their doorways, and stairs, mezzanines
 * and upper storeys are climbed rather than walked into.
 */

// Touch joystick input, written by the on-screen joysticks and read every
// frame. walkInput: left stick, x = strafe, y = forward (-1 = forward).
// walkLook: right stick, turns/tilts continuously while held — far easier than
// swiping over and over on a phone.
export const walkInput = { x: 0, y: 0 }
export const walkLook = { x: 0, y: 0 }

const EYE = 1.65

// Flat or overhead things a walker passes: painted zones, people, anything
// hung from the roof, and the underside of a mezzanine.
const PASSABLE = new Set(['zone', 'door', 'person', 'ceiling', 'hvac', 'tech', 'mezzanine'])

export function WalkRig() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const st = useRef({ yaw: 0, pitch: 0, pos: new THREE.Vector3(0, EYE, 0) })
  const keys = useRef(new Set<string>())

  // spawn just inside the entrance door, or at the near end facing in
  useEffect(() => {
    const b = activeBuildingOf(useStore.getState())
    if (!b?.interior) return
    const door = b.interior.objects.find((o) => o.category === 'door' && o.rule === 'edge')
    if (door) {
      const dx = 0 - door.x
      const dz = 0 - door.z
      const l = Math.hypot(dx, dz) || 1
      st.current.pos.set(door.x + (dx / l) * 2.5, EYE, door.z + (dz / l) * 2.5)
      st.current.yaw = Math.atan2(-dx / l, -dz / l)
    } else {
      st.current.pos.set(0, EYE, b.d / 2 - 2.5)
      st.current.yaw = 0 // facing -z, into the hall
    }
    st.current.pitch = 0
    // test hook: teleport the walker
    ;(window as unknown as Record<string, unknown>).__setWalk = (x: number, z: number, yaw: number) => {
      st.current.pos.set(x, EYE, z)
      st.current.yaw = yaw
    }
  }, [])

  // drag to look; the joystick overlays stop propagation, so a pointer that
  // starts on a stick never turns the view as well
  useEffect(() => {
    const el = gl.domElement
    let pid = -1
    let lx = 0
    let ly = 0
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (pid !== -1) return
      pid = e.pointerId
      lx = e.clientX
      ly = e.clientY
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return
      // fingers swipe short distances on a small screen — boost touch
      const k = e.pointerType === 'touch' ? 0.0085 : 0.005
      st.current.yaw -= (e.clientX - lx) * k
      st.current.pitch = Math.max(-1.35, Math.min(1.35, st.current.pitch - (e.clientY - ly) * k))
      lx = e.clientX
      ly = e.clientY
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId === pid) pid = -1
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      keys.current.add(e.code)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', dn)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.12)
    const b = activeBuildingOf(useStore.getState())
    if (!b?.interior) return
    const iv = b.interior
    const objects = iv.objects
    const floors = iv.floors

    const k = keys.current
    let f = 0
    let r = 0
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1
    if (k.has('KeyD') || k.has('ArrowRight')) r += 1
    if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1
    f += -walkInput.y
    r += walkInput.x
    const len = Math.hypot(f, r)
    if (len > 1) {
      f /= len
      r /= len
    }

    const v = st.current
    if (walkLook.x !== 0 || walkLook.y !== 0) {
      v.yaw -= walkLook.x * 2.4 * dt
      v.pitch = Math.max(-1.35, Math.min(1.35, v.pitch - walkLook.y * 1.7 * dt))
    }

    /** Walkable surface under a point: the slab, a stair ramp, a mezzanine or
     *  an upper storey. Only a step of ~0.55 m can be climbed, so you reach an
     *  upper floor by the stairs rather than by walking at it. */
    const supportAt = (x: number, z: number, foot: number) => {
      let best = 0
      const consider = (cand: number) => {
        if (cand <= foot + 0.55 && cand > best) best = cand
      }
      for (const fl of floors) if (fl.base > 0) {
        // a partial storey only supports you over its own slabs
        if (!fl.slabs || fl.slabs.length === 0) consider(fl.base)
        else
          for (const sl of fl.slabs)
            if (Math.abs(x - sl.x) < sl.w / 2 && Math.abs(z - sl.z) < sl.d / 2) consider(fl.base)
      }
      for (const o of objects) {
        const base = elevationFor(o, floors)
        if (o.category === 'mezzanine') {
          const { fw, fd } = fp(o)
          if (Math.abs(x - o.x) < fw / 2 && Math.abs(z - o.z) < fd / 2) consider(base + o.h)
        } else if (o.category === 'stairs') {
          // stairs climb from local +d/2 (bottom) to -d/2 (top)
          const th = (o.rot * Math.PI) / 4
          const dx = x - o.x
          const dz = z - o.z
          const lx = dx * Math.cos(th) - dz * Math.sin(th)
          const lz = dx * Math.sin(th) + dz * Math.cos(th)
          if (Math.abs(lx) < o.w / 2 + 0.1 && Math.abs(lz) < o.d / 2 + 0.3) {
            const t = Math.max(0, Math.min(1, (o.d / 2 - lz) / o.d))
            consider(base + o.h * t)
          }
        }
      }
      return best
    }

    if (len > 0.001) {
      const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 6 : 3.2
      const sin = Math.sin(v.yaw)
      const cos = Math.cos(v.yaw)
      let nx = v.pos.x + (-sin * f + cos * r) * speed * dt
      let nz = v.pos.z + (-cos * f - sin * r) * speed * dt
      // never leave the building footprint while inside it
      const hw = b.w / 2 - 0.3
      const hl = b.d / 2 - 0.3
      nx = Math.max(-hw, Math.min(hw, nx))
      nz = Math.max(-hl, Math.min(hl, nz))

      const foot = v.pos.y - EYE
      const floorDoors = objects.filter((d) => d.category === 'door' && d.rule === 'floor')
      const edgeDoors = objects.filter((d) => d.category === 'door' && d.rule === 'edge')

      // Only a doorway lets you through: it has to reach the floor and be tall
      // enough to step through. A glazed opening is still a wall.
      const passes = (ops: Opening[], u: number) =>
        ops.some((op) => !op.glass && op.y0 < 0.3 && op.y1 > 1.5 && Math.abs(u - op.c) < op.w / 2 - 0.06)

      const perimeterBlocked = (x: number, z: number) => {
        if (iv.shell.mode === 0) return false
        const wt = 0.32
        for (const sx of [-b.w / 2, b.w / 2]) {
          if (Math.abs(x - sx) < wt) {
            const rotWant = sx < 0 ? 2 : 6
            if (!edgeDoors.some((d) => d.rot === rotWant && Math.abs(z - d.z) < d.w / 2 - 0.05)) return true
          }
        }
        for (const [sz, rotWant] of [
          [-b.d / 2, 0],
          [b.d / 2, 4],
        ] as const) {
          if (Math.abs(z - sz) < wt) {
            if (!edgeDoors.some((d) => d.rot === rotWant && Math.abs(x - d.x) < d.w / 2 - 0.05)) return true
          }
        }
        return false
      }

      const blocked = (x: number, z: number) => {
        if (perimeterBlocked(x, z)) return true
        for (const o of objects) {
          if (o.h < 0.9 || o.category === 'stairs' || PASSABLE.has(o.category)) continue
          // A glazed opening is a hole in a wall, not a block on the floor:
          // measure it from its sill, or a window above a door stops you in
          // the doorway underneath it.
          const elev = elevationFor(o, floors) + (o.category === 'window' ? Math.max(0, o.sill ?? 0.9) : 0)
          if (elev + o.h <= foot + 0.45) continue // entirely below the feet
          if (elev >= foot + 1.55) continue // entirely overhead
          const { fw, fd } = fp(o)
          if (!(Math.abs(x - o.x) < fw / 2 + 0.25 && Math.abs(z - o.z) < fd / 2 + 0.25)) continue

          const th = (o.rot * Math.PI) / 4
          const lx = (x - o.x) * Math.cos(th) - (z - o.z) * Math.sin(th)
          const lz = (x - o.x) * Math.sin(th) + (z - o.z) * Math.cos(th)

          if (o.category === 'partition' && o.defId !== 'rail') {
            const t = Math.max(0.08, o.d)
            if (Math.abs(lz) > t / 2 + 0.18 || Math.abs(lx) > o.w / 2 + 0.18) continue
            if (passes(wallOpenings(floorDoors, o, { cx: 0, cz: 0, along: 'x', len: o.w, t }), lx)) continue
            return true
          }

          if (o.category === 'room') {
            // rooms are wall-aware: only the walls block, and the doorway
            // (a placed door, or the room's own opening) lets you in
            const t = 0.12
            const m = 0.18
            if (Math.abs(lx) > o.w / 2 + m || Math.abs(lz) > o.d / 2 + m) continue
            const nearX = o.w / 2 - Math.abs(lx) < t + m
            const nearZ = o.d / 2 - Math.abs(lz) < t + m
            if (!nearX && !nearZ) continue // room interior — walk freely
            let pass = false
            if (nearZ) {
              const front = lz > 0
              const ops = wallOpenings(floorDoors, o, {
                cx: 0,
                cz: (front ? 1 : -1) * (o.d / 2 - t / 2),
                along: 'x',
                len: o.w,
                t,
              })
              if (front && ops.length === 0) {
                const doorW = Math.min(0.95, o.w * 0.4)
                ops.push({ c: o.w / 2 - 0.35 - doorW / 2, w: doorW, y0: 0, y1: Math.min(2.05, o.h - 0.2) })
              }
              pass = passes(ops, lx)
            }
            if (!pass && nearX) {
              const east = lx > 0
              const ops = wallOpenings(floorDoors, o, {
                cx: (east ? 1 : -1) * (o.w / 2 - t / 2),
                cz: 0,
                along: 'z',
                len: o.d,
                t,
              })
              pass = passes(ops, lz)
            }
            if (pass) continue
            return true
          }

          return true
        }
        return false
      }

      // slide along a wall rather than sticking to it
      if (!blocked(nx, nz)) {
        v.pos.x = nx
        v.pos.z = nz
      } else if (!blocked(nx, v.pos.z)) v.pos.x = nx
      else if (!blocked(v.pos.x, nz)) v.pos.z = nz
    }

    const targetY = EYE + supportAt(v.pos.x, v.pos.z, v.pos.y - EYE)
    v.pos.y += (targetY - v.pos.y) * Math.min(1, dt * 12)
    ;(window as unknown as Record<string, unknown>).__walkPos = [v.pos.x, v.pos.y, v.pos.z, v.yaw]
    camera.position.copy(v.pos)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(v.pitch, v.yaw, 0)
  })

  return <PerspectiveCamera makeDefault fov={60} near={0.08} far={400} />
}

/** Objects worth drawing solid while walking: every storey, not just one. */
export const walkVisible = (objects: Placed[]) => objects
