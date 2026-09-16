import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { ElementDef, PlacedElement, PlacedPoint, PlacedPolygon, PlacedPolyline, PlacedRect, Vec2 } from '../types'
import { defById } from '../catalog'
import { elementBBox, fmt, polygonArea, polygonCentroid, polylineLength } from '../geometry'
import { BuildingShell } from './BuildingShell'
import { surfaceMap, surfaceMapWorld } from '../materials'

// Model coords are (x, y) meters with y = south; three.js is (x, up, z).
// A shape built with (x, -y) and rotated -90° about X lands at (x, 0, y).
export const toShape = (pts: Vec2[]): THREE.Shape => {
  const s = new THREE.Shape()
  pts.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.y) : s.lineTo(p.x, -p.y)))
  s.closePath()
  return s
}

export const rectEffH = (el: PlacedRect, def: ElementDef | undefined) => el.h ?? def?.h ?? 4

// Low gable roof: a triangular prism across the width, ridge along the depth.
function GableRoof({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const geo = useMemo(() => {
    const rise = Math.min(w * 0.18, 2.2)
    const tri = new THREE.Shape()
    tri.moveTo(-w / 2, 0)
    tri.lineTo(w / 2, 0)
    tri.lineTo(0, rise)
    tri.closePath()
    const g = new THREE.ExtrudeGeometry(tri, { depth: d, bevelEnabled: false })
    g.translate(0, 0, -d / 2)
    return g
  }, [w, d])
  return (
    <mesh geometry={geo} position={[0, h, 0]} castShadow>
      <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.82)} />
    </mesh>
  )
}

/**
 * A building that has been designed inside: its real shell, raised on its own
 * floor slab. Falls back to the plain massing block until a shell design
 * exists, so a freshly dropped building still reads on the site.
 */
function DesignedBuilding({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const iv = el.interior!
  const lvl = iv.floorLevel
  return (
    <group rotation-y={(-el.rot * Math.PI) / 180}>
      {/* the raised slab the building sits on */}
      <mesh position={[0, lvl / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[el.w + 0.4, Math.max(0.12, lvl), el.d + 0.4]} />
        <meshStandardMaterial color={tint ?? '#c8c3b8'} roughness={0.95} />
      </mesh>
      <group position={[0, lvl, 0]}>
        <BuildingShell
          design={iv.design}
          mode={iv.shell.mode}
          width={el.w}
          length={el.d}
          objects={iv.objects}
        />
      </group>
    </group>
  )
}

/* --------------------------------------------------------------- vehicles */

const Wheel = ({ pos, r = 0.34, w = 0.22 }: { pos: [number, number, number]; r?: number; w?: number }) => (
  <mesh position={pos} rotation={[Math.PI / 2, 0, 0]} castShadow>
    <cylinderGeometry args={[r, r, w, 14]} />
    <meshStandardMaterial color="#1c1d20" roughness={0.9} />
  </mesh>
)

/**
 * A car: lower body, a shorter cabin set back on it, glazing, wheels at the
 * corners and lights at each end. Sized from the element, so a pickup and a
 * sedan are the same parts at different proportions.
 */
function Car({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const L = el.w
  const W = el.d
  const H = el.h ?? 1.5
  const c = tint ?? el.color
  const wheelR = Math.min(0.36, H * 0.24)
  const bodyY = wheelR + 0.06
  const bodyH = H * 0.42
  const cabH = H - bodyY - bodyH
  return (
    <group>
      <mesh position={[0, bodyY + bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[L, bodyH, W]} />
        <meshStandardMaterial color={c} roughness={0.35} metalness={0.35} />
      </mesh>
      {/* cabin, set back from the nose */}
      <mesh position={[-L * 0.06, bodyY + bodyH + cabH / 2, 0]} castShadow>
        <boxGeometry args={[L * 0.52, cabH, W * 0.9]} />
        <meshStandardMaterial color={c} roughness={0.35} metalness={0.35} />
      </mesh>
      {/* glazing all round the cabin */}
      <mesh position={[-L * 0.06, bodyY + bodyH + cabH * 0.58, 0]}>
        <boxGeometry args={[L * 0.5, cabH * 0.52, W * 0.92]} />
        <meshStandardMaterial color="#20262e" roughness={0.12} metalness={0.5} />
      </mesh>
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <Wheel pos={[L * 0.31, wheelR, (sz * W) / 2 - 0.09]} r={wheelR} />
          <Wheel pos={[-L * 0.31, wheelR, (sz * W) / 2 - 0.09]} r={wheelR} />
        </group>
      ))}
      {/* head and tail lights */}
      {[-1, 1].map((sz) => (
        <mesh key={`h${sz}`} position={[L / 2 - 0.03, bodyY + bodyH * 0.62, sz * W * 0.32]}>
          <boxGeometry args={[0.06, 0.14, 0.26]} />
          <meshStandardMaterial color="#f6f1de" emissive="#d9d2b6" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {[-1, 1].map((sz) => (
        <mesh key={`t${sz}`} position={[-L / 2 + 0.03, bodyY + bodyH * 0.62, sz * W * 0.32]}>
          <boxGeometry args={[0.06, 0.12, 0.24]} />
          <meshStandardMaterial color="#8c1c1c" />
        </mesh>
      ))}
    </group>
  )
}

/** A motorcycle: two wheels, the frame and tank between them, seat and bars. */
function Motorcycle({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const L = el.w
  const H = el.h ?? 1.2
  const c = tint ?? el.color
  const r = Math.min(0.3, H * 0.26)
  return (
    <group>
      <Wheel pos={[L * 0.36, r, 0]} r={r} w={0.12} />
      <Wheel pos={[-L * 0.36, r, 0]} r={r} w={0.14} />
      {/* engine block and frame spine */}
      <mesh position={[0, r + 0.16, 0]} castShadow>
        <boxGeometry args={[L * 0.34, 0.3, 0.26]} />
        <meshStandardMaterial color="#4b5057" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* tank */}
      <mesh position={[L * 0.05, r + 0.42, 0]} castShadow>
        <boxGeometry args={[L * 0.3, 0.22, 0.3]} />
        <meshStandardMaterial color={c} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* seat */}
      <mesh position={[-L * 0.16, r + 0.42, 0]}>
        <boxGeometry args={[L * 0.34, 0.14, 0.26]} />
        <meshStandardMaterial color="#1f2126" roughness={0.85} />
      </mesh>
      {/* front fork and handlebars */}
      <mesh position={[L * 0.3, r + 0.34, 0]} rotation-z={-0.35} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.75, 8]} />
        <meshStandardMaterial color="#9aa2ab" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[L * 0.22, H - 0.12, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.025, 0.025, 0.62, 8]} />
        <meshStandardMaterial color="#2f3237" />
      </mesh>
    </group>
  )
}

/** A truck / trailer: cab up front, flat bed or box body behind, wheels under. */
function Truck({ el, tint, box }: { el: PlacedRect; tint: string | null; box: boolean }) {
  const L = el.w
  const W = el.d
  const H = el.h ?? 3
  const c = tint ?? el.color
  const r = Math.min(0.5, H * 0.17)
  const chassis = r * 2 + 0.15
  const cabL = Math.min(2.4, L * 0.3)
  const bodyL = L - cabL - 0.2
  const axles = Math.max(2, Math.round(L / 4))
  return (
    <group>
      {/* chassis rail */}
      <mesh position={[0, chassis, 0]}>
        <boxGeometry args={[L, 0.18, W * 0.8]} />
        <meshStandardMaterial color="#3f434a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* cab */}
      <mesh position={[L / 2 - cabL / 2, chassis + (H - chassis) * 0.42, 0]} castShadow>
        <boxGeometry args={[cabL, (H - chassis) * 0.84, W]} />
        <meshStandardMaterial color={c} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[L / 2 - cabL + 0.02, chassis + (H - chassis) * 0.6, 0]}>
        <boxGeometry args={[0.06, (H - chassis) * 0.34, W * 0.86]} />
        <meshStandardMaterial color="#20262e" roughness={0.12} metalness={0.5} />
      </mesh>
      {/* body: a box van, or a flat bed with side gates */}
      {box ? (
        <mesh position={[-cabL / 2 - 0.1, chassis + (H - chassis) / 2 + 0.1, 0]} castShadow>
          <boxGeometry args={[bodyL, H - chassis, W]} />
          <meshStandardMaterial color="#e8e6e1" roughness={0.6} />
        </mesh>
      ) : (
        <group position={[-cabL / 2 - 0.1, 0, 0]}>
          <mesh position={[0, chassis + 0.14, 0]} castShadow>
            <boxGeometry args={[bodyL, 0.12, W]} />
            <meshStandardMaterial color="#8a8f97" metalness={0.4} roughness={0.6} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, chassis + 0.55, (sz * W) / 2]} castShadow>
              <boxGeometry args={[bodyL, 0.8, 0.07]} />
              <meshStandardMaterial color={c} roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}
      {Array.from({ length: axles }, (_, i) => {
        const x = L / 2 - cabL * 0.6 - (i * (L - cabL)) / Math.max(1, axles - 1) * 0.95
        return [-1, 1].map((sz) => <Wheel key={`${i}${sz}`} pos={[x, r, (sz * W) / 2 - 0.12]} r={r} w={0.26} />)
      })}
    </group>
  )
}

/** A shipping container: corrugated sides, corner castings, doors at one end. */
function Container({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const L = el.w
  const W = el.d
  const H = el.h ?? 2.59
  const c = tint ?? el.color
  const ribs = Math.max(6, Math.round(L / 0.35))
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial color={c} roughness={0.7} metalness={0.3} />
      </mesh>
      {Array.from({ length: ribs }, (_, i) => {
        const x = -L / 2 + (L / ribs) * (i + 0.5)
        return [-1, 1].map((sz) => (
          <mesh key={`${i}${sz}`} position={[x, H / 2, (sz * W) / 2 + sz * 0.015]}>
            <boxGeometry args={[L / ribs / 2.4, H * 0.86, 0.03]} />
            <meshStandardMaterial color={new THREE.Color(c).multiplyScalar(0.86).getStyle()} />
          </mesh>
        ))
      })}
      {/* doors on the near end */}
      <mesh position={[-L / 2 - 0.02, H / 2, 0]}>
        <boxGeometry args={[0.03, H * 0.9, W * 0.94]} />
        <meshStandardMaterial color={new THREE.Color(c).multiplyScalar(0.9).getStyle()} />
      </mesh>
      {/* corner castings */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) =>
          [0.1, H - 0.1].map((y, i) => (
            <mesh key={`${sx}${sz}${i}`} position={[(sx * L) / 2, y, (sz * W) / 2]}>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshStandardMaterial color="#2f3237" metalness={0.6} roughness={0.4} />
            </mesh>
          )),
        ),
      )}
    </group>
  )
}

/**
 * A covered walkway: a pitched roof on a row of posts, open on both sides.
 * The old solid block read as a wall you could not walk under.
 */
function Coverway({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const W = el.w
  const D = el.d
  const H = el.h ?? 3.5
  const c = tint ?? el.color
  const rise = Math.min(0.5, W * 0.12)
  const bays = Math.max(2, Math.round(D / 3) + 1)
  return (
    <group>
      {/* two roof planes meeting at the ridge along the length */}
      {[-1, 1].map((sx) => (
        <mesh
          key={sx}
          position={[(sx * W) / 4, H + rise / 2, 0]}
          rotation-z={-sx * Math.atan(rise / (W / 2))}
          castShadow
        >
          <boxGeometry args={[Math.hypot(W / 2, rise) + 0.2, 0.08, D]} />
          <meshStandardMaterial color={c} roughness={0.5} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, H + rise + 0.05, 0]}>
        <boxGeometry args={[0.16, 0.1, D]} />
        <meshStandardMaterial color="#aab3bc" metalness={0.4} />
      </mesh>
      {/* posts down both sides, with a beam tying them together */}
      {[-1, 1].map((sx) => (
        <group key={`p${sx}`}>
          <mesh position={[(sx * (W - 0.3)) / 2, H - 0.06, 0]}>
            <boxGeometry args={[0.1, 0.16, D]} />
            <meshStandardMaterial color="#6b7280" metalness={0.45} roughness={0.45} />
          </mesh>
          {Array.from({ length: bays }, (_, i) => (
            <mesh
              key={i}
              position={[(sx * (W - 0.3)) / 2, H / 2, -D / 2 + (D / (bays - 1)) * i]}
              castShadow
            >
              <cylinderGeometry args={[0.07, 0.09, H, 10]} />
              <meshStandardMaterial color="#5b6169" metalness={0.5} roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------- steel sculpture */

/** Deterministic 0..1 from a string, so an instance always looks the same. */
function seeded(id: string): () => number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/**
 * A rolled I-beam: two flanges and a web, running along local x. Every steel
 * sculpture here is built from these rather than from plain bars — it is what
 * the pieces in the photographs actually are, and the section reads at a
 * glance even at site scale.
 */
function IBeam({
  len,
  sec,
  color,
  pos = [0, 0, 0],
  rot = [0, 0, 0],
  quat,
  plate = false,
}: {
  len: number
  sec: number // section depth (m); flange width follows at 0.62 of it
  color: string
  pos?: [number, number, number]
  rot?: [number, number, number]
  /** Aim the member directly. Takes precedence over `rot`, which cannot
   *  express "point from here to there" without fighting Euler order. */
  quat?: THREE.Quaternion
  plate?: boolean // add an end plate, the way a real member is capped
}) {
  const fw = sec * 0.62
  const t = Math.max(0.012, sec * 0.09)
  return (
    <group position={pos} rotation={quat ? undefined : rot} quaternion={quat}>
      <mesh position={[0, sec / 2 - t / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, t, fw]} />
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.45} />
      </mesh>
      <mesh position={[0, -sec / 2 + t / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, t, fw]} />
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.45} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[len, sec - t * 2, t * 0.8]} />
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.45} />
      </mesh>
      {plate &&
        [-1, 1].map((sx) => (
          <mesh key={sx} position={[(sx * len) / 2, 0, 0]} castShadow>
            <boxGeometry args={[t * 1.4, sec * 1.06, fw * 1.06]} />
            <meshStandardMaterial color={color} roughness={0.42} metalness={0.45} />
          </mesh>
        ))}
    </group>
  )
}

/** The concrete or steel pad a piece is bolted down to. */
const BasePad = ({ x, z, r, color }: { x: number; z: number; r: number; color: string }) => (
  <mesh position={[x, 0.04, z]} receiveShadow>
    <boxGeometry args={[r, 0.08, r]} />
    <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
  </mesh>
)

/**
 * Crossing beams, in the di Suvero manner: long members that land on the
 * ground at one end, pass through a shared crossing point well above head
 * height and overshoot past it. Each is oriented straight from its own two
 * endpoints — Euler angles for this read as a fan rather than a thicket.
 */
function SculptBeams({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const c = tint ?? el.color
  const H = el.h ?? 7
  const W = el.w
  const D = el.d
  const sec = Math.max(0.18, Math.min(W, D) * 0.085)

  const members = useMemo(() => {
    const r = seeded(el.id)
    const n = 5
    return Array.from({ length: n }, (_, i) => {
      const az = (i / n) * Math.PI * 2 + r() * 0.8
      // Each member passes through its OWN point near the middle rather than
      // all through one node: the originals are a thicket of near-misses, and
      // a single crossing point reads as a parasol.
      const cross = new THREE.Vector3(
        (r() - 0.5) * W * 0.3,
        H * (0.45 + r() * 0.35),
        (r() - 0.5) * D * 0.3,
      )
      // where it meets the ground, and how far it carries on past the crossing
      const foot = new THREE.Vector3(
        (Math.cos(az) * W) / 2 * (0.55 + r() * 0.45),
        0,
        (Math.sin(az) * D) / 2 * (0.55 + r() * 0.45),
      )
      const dir = cross.clone().sub(foot).normalize()
      const over = H * (0.25 + r() * 0.5)
      const tip = cross.clone().add(dir.clone().multiplyScalar(over))
      return { foot, tip, dir, len: tip.distanceTo(foot) }
    })
  }, [el.id, H, W, D])

  return (
    <group>
      {members.map((m, i) => (
        <group key={i}>
          <IBeam
            len={m.len}
            sec={sec}
            color={c}
            pos={m.foot.clone().add(m.tip).multiplyScalar(0.5).toArray() as [number, number, number]}
            quat={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), m.dir)}
            plate
          />
          <BasePad x={m.foot.x} z={m.foot.z} r={sec * 3.2} color="#cfd4d9" />
        </group>
      ))}
      {/* the upright mast the cluster leans on */}
      <IBeam len={H} sec={sec * 1.15} color={c} pos={[0, H / 2, 0]} rot={[0, 0, Math.PI / 2]} plate />
      <BasePad x={0} z={0} r={sec * 4} color="#cfd4d9" />
      {/* a tension cable from the mast head out to the longest member */}
      {(() => {
        const top = new THREE.Vector3(0, H, 0)
        const far = members.reduce((a, b) => (a.len > b.len ? a : b)).tip
        const d = far.clone().sub(top)
        return (
          <mesh
            position={top.clone().add(far).multiplyScalar(0.5)}
            quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())}
          >
            <cylinderGeometry args={[0.014, 0.014, d.length(), 6]} />
            <meshStandardMaterial color="#8a9099" metalness={0.8} roughness={0.25} />
          </mesh>
        )
      })()}
    </group>
  )
}

/**
 * A steel tree: a trunk of box section that forks, and forks again, into
 * faceted branches. Depth of branching follows the height, so a small one
 * stays legible.
 */
function SculptTree({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const c = tint ?? el.color
  const H = el.h ?? 6
  const spread = Math.max(el.w, el.d) / 2
  const branches = useMemo(() => {
    const r = seeded(el.id)
    type Seg = { a: THREE.Vector3; b: THREE.Vector3; w: number }
    const segs: Seg[] = []
    const trunkTop = new THREE.Vector3(0, H * 0.42, 0)
    segs.push({ a: new THREE.Vector3(0, 0, 0), b: trunkTop, w: Math.max(0.14, spread * 0.24) })
    const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, w: number, depth: number) => {
      if (depth === 0 || len < 0.18) return
      const forks = depth > 2 ? 3 : 2
      for (let i = 0; i < forks; i++) {
        const az = (i / forks) * Math.PI * 2 + r() * 1.4
        const out = new THREE.Vector3(Math.cos(az), 0.75 + r() * 0.8, Math.sin(az)).normalize()
        const d = dir.clone().multiplyScalar(0.45).add(out.multiplyScalar(0.8)).normalize()
        const to = from.clone().add(d.multiplyScalar(len))
        segs.push({ a: from.clone(), b: to, w })
        grow(to, d, len * (0.6 + r() * 0.16), w * 0.62, depth - 1)
      }
    }
    grow(trunkTop, new THREE.Vector3(0, 1, 0), H * 0.3, spread * 0.17, H > 4 ? 4 : 3)
    return segs
  }, [el.id, H, spread])

  return (
    <group>
      <BasePad x={0} z={0} r={Math.max(0.8, spread * 0.7)} color="#b9b3a8" />
      {branches.map((sg, i) => {
        const d = sg.b.clone().sub(sg.a)
        const mid = sg.a.clone().add(sg.b).multiplyScalar(0.5)
        return (
          <mesh
            key={i}
            position={mid}
            quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())}
            castShadow
          >
            <boxGeometry args={[sg.w, d.length(), sg.w * 0.72]} />
            <meshStandardMaterial color={c} roughness={0.32} metalness={0.62} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

/** A standing figure built from stacked box sections, arms out. */
function SculptFigure({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const c = tint ?? el.color
  const H = el.h ?? 4
  const t = Math.max(0.08, H * 0.05) // member thickness
  const legH = H * 0.42
  const torsoH = H * 0.3
  const headY = H - t * 1.6
  const span = el.w
  const bar = (
    args: [number, number, number],
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
  ) => (
    <mesh position={pos} rotation={rot} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={c} roughness={0.3} metalness={0.68} flatShading />
    </mesh>
  )
  const rings = Math.max(3, Math.round(torsoH / (t * 1.6)))
  return (
    <group>
      <BasePad x={0} z={0} r={Math.max(0.7, span * 0.8)} color="#b9b3a8" />
      {/* legs */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          {bar([t, legH, t * 0.8], [sx * span * 0.16, legH / 2, 0])}
          {bar([t * 1.7, t * 0.5, t * 1.5], [sx * span * 0.2, t * 0.3, t * 0.4])}
        </group>
      ))}
      {/* torso: a stack of horizontal plates on a spine */}
      {bar([t * 0.7, torsoH, t * 0.7], [0, legH + torsoH / 2, 0])}
      {Array.from({ length: rings }, (_, i) =>
        bar(
          [t * 2.6, t * 0.45, t * 1.6],
          [0, legH + (torsoH / rings) * (i + 0.5), 0],
          [0, (i % 2 ? 1 : -1) * 0.12, 0],
        ),
      )}
      {/* arms, one raised */}
      {bar([span * 0.5, t * 0.8, t * 0.8], [-span * 0.22, legH + torsoH * 0.86, 0], [0, 0, 0.5])}
      {bar([span * 0.5, t * 0.8, t * 0.8], [span * 0.24, legH + torsoH * 0.78, 0], [0, 0, -0.9])}
      {/* head */}
      {bar([t * 1.7, t * 1.7, t * 1.5], [0, headY, 0], [0, 0.5, 0])}
    </group>
  )
}

/** Open wireframe cubes lifted on a slender column — light, and a good gate piece. */
function SculptCubes({ el, tint }: { el: PlacedRect; tint: string | null }) {
  const c = tint ?? el.color
  const H = el.h ?? 5
  const size = Math.max(0.5, Math.min(el.w, el.d) * 0.42)
  const t = Math.max(0.035, size * 0.075)
  const colY = H - size * 1.5
  const cubes = useMemo(() => {
    const r = seeded(el.id)
    return [0, 1, 2].map((i) => ({
      pos: [(r() - 0.5) * size * 1.5, colY + size * (0.6 + i * 0.75), (r() - 0.5) * size * 1.5] as [number, number, number],
      rot: [r() * 0.9, r() * 1.4, r() * 0.7] as [number, number, number],
      s: size * (0.8 + r() * 0.5),
    }))
  }, [el.id, size, colY])

  const edges = (s: number) => {
    const out: Array<{ pos: [number, number, number]; args: [number, number, number] }> = []
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) out.push({ pos: [0, (sy * s) / 2, (sz * s) / 2], args: [s, t, t] })
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) out.push({ pos: [(sx * s) / 2, 0, (sz * s) / 2], args: [t, s, t] })
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) out.push({ pos: [(sx * s) / 2, (sy * s) / 2, 0], args: [t, t, s] })
    return out
  }

  return (
    <group>
      <BasePad x={0} z={0} r={Math.max(0.6, size * 1.6)} color="#b9b3a8" />
      <IBeam len={colY} sec={size * 0.38} color={c} pos={[0, colY / 2, 0]} rot={[0, 0, Math.PI / 2]} plate />
      {cubes.map((cu, i) => (
        <group key={i} position={cu.pos} rotation={cu.rot}>
          {edges(cu.s).map((e, k) => (
            <mesh key={k} position={e.pos} castShadow>
              <boxGeometry args={e.args} />
              <meshStandardMaterial color={c} roughness={0.28} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function RectMesh({ el, def, tint }: { el: PlacedRect; def?: ElementDef; tint: string | null }) {
  const h = rectEffH(el, def)
  const color = tint ?? el.color
  const opacity = def?.fillOpacity ?? 1
  if (el.interior?.design && el.interior.shell.mode > 0) return <DesignedBuilding el={el} tint={tint} />
  // items worth drawing properly rather than as a block
  const detailed =
    el.defId === 'car' ? (
      <Car el={el} tint={tint} />
    ) : el.defId === 'moto' ? (
      <Motorcycle el={el} tint={tint} />
    ) : el.defId === 'truck' ? (
      <Truck el={el} tint={tint} box={false} />
    ) : el.defId === 'trailer' ? (
      <Truck el={el} tint={tint} box />
    ) : el.defId === 'container' ? (
      <Container el={el} tint={tint} />
    ) : el.defId === 'coverway' || el.defId === 'canopy_link' ? (
      <Coverway el={el} tint={tint} />
    ) : el.defId === 'sculpt_beams' ? (
      <SculptBeams el={el} tint={tint} />
    ) : el.defId === 'sculpt_tree' ? (
      <SculptTree el={el} tint={tint} />
    ) : el.defId === 'sculpt_figure' ? (
      <SculptFigure el={el} tint={tint} />
    ) : el.defId === 'sculpt_cubes' ? (
      <SculptCubes el={el} tint={tint} />
    ) : null
  if (detailed) return <group rotation-y={(-el.rot * Math.PI) / 180}>{detailed}</group>
  return (
    <group rotation-y={(-el.rot * Math.PI) / 180}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[el.w, h, el.d]} />
        <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      {def?.roof && !tint && <GableRoof w={el.w} d={el.d} h={h} color={el.color} />}
      {def?.roof && tint && <GableRoof w={el.w} d={el.d} h={h} color={tint} />}
    </group>
  )
}

function PolygonMesh({ el, def, tint }: { el: PlacedPolygon; def?: ElementDef; tint: string | null }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(toShape(el.pts)), [el.pts])
  const h = el.h ?? def?.polyHeight ?? 0
  const color = tint ?? el.color
  // ShapeGeometry's UVs are already in metres, so the world-locked tiling of
  // the procedural surfaces lines up with the real size of the area
  const map = def?.surface && !tint ? surfaceMapWorld(def.surface) : undefined

  if (h <= 0) {
    return (
      <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} receiveShadow>
        <meshStandardMaterial color={color} map={map} side={THREE.DoubleSide} roughness={0.92} />
      </mesh>
    )
  }

  // A canopy: the same outline lifted into a roof, with a fascia around the
  // edge and a post under every corner. Drawn from the shape the user traced,
  // so a carport can follow the parking bays rather than being a rectangle.
  return (
    <group>
      <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, h + 0.18, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, h, 0]}>
        <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.82).getStyle()} side={THREE.DoubleSide} />
      </mesh>
      {/* fascia: a beam along every edge of the outline */}
      {el.pts.map((a, i) => {
        const b = el.pts[(i + 1) % el.pts.length]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len < 0.05) return null
        return (
          <mesh
            key={`f${i}`}
            position={[(a.x + b.x) / 2, h + 0.06, (a.y + b.y) / 2]}
            rotation-y={-Math.atan2(b.y - a.y, b.x - a.x)}
          >
            <boxGeometry args={[len, 0.24, 0.1]} />
            <meshStandardMaterial color="#7c828a" metalness={0.5} roughness={0.4} />
          </mesh>
        )
      })}
      {def?.posts &&
        el.pts.map((pt, i) => (
          <mesh key={`p${i}`} position={[pt.x, h / 2, pt.y]} castShadow>
            <cylinderGeometry args={[0.09, 0.11, h, 10]} />
            <meshStandardMaterial color="#5b6169" metalness={0.5} roughness={0.45} />
          </mesh>
        ))}
    </group>
  )
}

// Flat ribbon (roads/drains) or thin wall (fences): one box per segment plus a
// cylinder at each interior joint so corners look mitred.
function PolylineMesh({ el, def, tint }: { el: PlacedPolyline; def?: ElementDef; tint: string | null }) {
  const h = def?.lineHeight ?? 0.08
  const color = tint ?? el.color
  const segs = useMemo(() => {
    const out: { mid: Vec2; len: number; ang: number }[] = []
    for (let i = 1; i < el.pts.length; i++) {
      const a = el.pts[i - 1]
      const b = el.pts[i]
      out.push({
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        len: Math.hypot(b.x - a.x, b.y - a.y),
        ang: Math.atan2(b.y - a.y, b.x - a.x),
      })
    }
    return out
  }, [el.pts])
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.mid.x, h / 2, s.mid.y]} rotation-y={-s.ang} castShadow={h > 0.5} receiveShadow>
          <boxGeometry args={[s.len, h, el.width]} />
          <meshStandardMaterial
            color={color}
            map={def?.surface && !tint ? surfaceMap(def.surface, s.len, el.width) : undefined}
            roughness={0.9}
          />
        </mesh>
      ))}
      {el.pts.slice(1, -1).map((p, i) => (
        <mesh key={`j${i}`} position={[p.x, h / 2, p.y]}>
          <cylinderGeometry args={[el.width / 2, el.width / 2, h, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {def?.flowArrows &&
        segs.map((s, i) => (
          <mesh key={`a${i}`} position={[s.mid.x, h + 0.35, s.mid.y]} rotation={[0, -s.ang, -Math.PI / 2]}>
            <coneGeometry args={[0.35, 1.1, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        ))}
    </group>
  )
}

/**
 * Point markers. `radius` is the plan size and `h` the second dimension —
 * overall height for a tree or a pole, tower height for an elevated tank,
 * body length for a horizontal one — so each can be dialled in per instance.
 */
function PointMesh({ el, def, tint }: { el: PlacedPoint; def?: ElementDef; tint: string | null }) {
  const c = tint ?? el.color
  const r = el.radius
  const h = el.h ?? def?.pointHeight ?? r * 2.4

  switch (def?.pointStyle) {
    case 'tree': {
      // trunk tapering into three offset canopy masses, so it reads as
      // foliage rather than as a ball on a stick
      const trunk = h * 0.42
      const crown = h - trunk
      const blobs: Array<[number, number, number, number]> = [
        [0, trunk + crown * 0.42, 0, r * 0.95],
        [r * 0.34, trunk + crown * 0.66, -r * 0.22, r * 0.66],
        [-r * 0.3, trunk + crown * 0.6, r * 0.28, r * 0.6],
      ]
      const dark = new THREE.Color(c).multiplyScalar(0.82).getStyle()
      return (
        <group>
          <mesh position={[0, trunk / 2, 0]} castShadow>
            <cylinderGeometry args={[r * 0.08, r * 0.15, trunk, 8]} />
            <meshStandardMaterial color="#7c5a3a" roughness={0.95} />
          </mesh>
          {/* a couple of limbs into the crown */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * r * 0.16, trunk * 0.95, 0]} rotation-z={-sx * 0.5} castShadow>
              <cylinderGeometry args={[r * 0.04, r * 0.06, crown * 0.42, 6]} />
              <meshStandardMaterial color="#6f5133" roughness={0.95} />
            </mesh>
          ))}
          {blobs.map(([bx, by, bz, br], i) => (
            <mesh key={i} position={[bx, by, bz]} scale={[1, 0.88, 1]} castShadow>
              <sphereGeometry args={[br, 12, 10]} />
              <meshStandardMaterial color={i === 0 ? c : dark} roughness={0.9} flatShading />
            </mesh>
          ))}
        </group>
      )
    }
    case 'tree_cone': {
      // a conifer: stacked skirts, widest at the bottom
      const trunk = h * 0.16
      const tiers = 3
      return (
        <group>
          <mesh position={[0, trunk / 2, 0]} castShadow>
            <cylinderGeometry args={[r * 0.12, r * 0.18, trunk, 8]} />
            <meshStandardMaterial color="#6f5133" roughness={0.95} />
          </mesh>
          {Array.from({ length: tiers }, (_, i) => {
            const t = i / tiers
            const base = trunk + (h - trunk) * t * 0.72
            const seg = (h - trunk) * (1 - t * 0.55) * 0.55
            return (
              <mesh key={i} position={[0, base + seg / 2, 0]} castShadow>
                <coneGeometry args={[r * (1 - t * 0.3), seg, 10]} />
                <meshStandardMaterial color={c} roughness={0.9} flatShading />
              </mesh>
            )
          })}
        </group>
      )
    }
    case 'pole': {
      const armY = h - 0.4
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <cylinderGeometry args={[r * 0.6, r * 0.9, h, 8]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
          <mesh position={[0.5, armY, 0]}>
            <boxGeometry args={[1.2, 0.1, 0.1]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[1.0, armY - 0.14, 0]}>
            <boxGeometry args={[0.42, 0.16, 0.24]} />
            <meshStandardMaterial color="#e8e6df" emissive="#d8d2bb" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )
    }
    case 'tank': {
      // upright cylinder on a plinth, with a domed top and a ladder
      const body = Math.max(0.6, h - r * 0.35)
      return (
        <group>
          <mesh position={[0, 0.09, 0]} receiveShadow>
            <cylinderGeometry args={[r * 1.12, r * 1.12, 0.18, 20]} />
            <meshStandardMaterial color="#b9b3a8" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.18 + body / 2, 0]} castShadow>
            <cylinderGeometry args={[r, r, body, 20]} />
            <meshStandardMaterial color={c} roughness={0.5} metalness={0.25} />
          </mesh>
          <mesh position={[0, 0.18 + body, 0]} castShadow>
            <sphereGeometry args={[r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={c} roughness={0.5} metalness={0.25} />
          </mesh>
          {/* ladder up one side */}
          {Array.from({ length: Math.max(3, Math.round(body / 0.35)) }, (_, i) => (
            <mesh key={i} position={[r + 0.06, 0.3 + i * 0.35, 0]}>
              <boxGeometry args={[0.22, 0.03, 0.03]} />
              <meshStandardMaterial color="#8a9099" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )
    }
    case 'tank_h': {
      // lying on saddles, the way a buried-style or pressure tank sits
      const len = Math.max(1, h)
      return (
        <group>
          <mesh position={[0, r + 0.35, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[r, r, len, 20]} />
            <meshStandardMaterial color={c} roughness={0.45} metalness={0.3} />
          </mesh>
          {/* dished ends */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[(sx * len) / 2, r + 0.35, 0]} scale={[0.45, 1, 1]} castShadow>
              <sphereGeometry args={[r, 18, 12]} />
              <meshStandardMaterial color={c} roughness={0.45} metalness={0.3} />
            </mesh>
          ))}
          {/* concrete saddles */}
          {[-1, 1].map((sx) => (
            <mesh key={`s${sx}`} position={[sx * len * 0.3, 0.175, 0]} receiveShadow>
              <boxGeometry args={[0.35, 0.35, r * 2.1]} />
              <meshStandardMaterial color="#b9b3a8" roughness={0.95} />
            </mesh>
          ))}
        </group>
      )
    }
    case 'elevated': {
      // the champagne tank: legs, a balloon body and a conical bottom. `h` is
      // the height to the underside of the ball, which is how one is specified
      const legs = 4
      const ballR = r
      return (
        <group>
          {Array.from({ length: legs }, (_, i) => {
            const a = (i / legs) * Math.PI * 2 + Math.PI / 4
            const sp = ballR * 0.62
            return (
              <mesh key={i} position={[Math.cos(a) * sp, h / 2, Math.sin(a) * sp]} rotation-z={-Math.cos(a) * 0.05} castShadow>
                <cylinderGeometry args={[0.09, 0.13, h, 8]} />
                <meshStandardMaterial color="#9aa2ad" metalness={0.5} roughness={0.5} />
              </mesh>
            )
          })}
          {/* bracing ring */}
          <mesh position={[0, h * 0.55, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[ballR * 0.62, 0.035, 6, 18]} />
            <meshStandardMaterial color="#8a9099" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* conical bottom and the ball */}
          <mesh position={[0, h + ballR * 0.35, 0]} castShadow>
            <coneGeometry args={[ballR, ballR * 0.9, 18]} />
            <meshStandardMaterial color={c} roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh position={[0, h + ballR * 1.05, 0]} castShadow>
            <sphereGeometry args={[ballR, 20, 16]} />
            <meshStandardMaterial color={c} roughness={0.45} metalness={0.3} />
          </mesh>
          {/* ladder */}
          {Array.from({ length: Math.max(4, Math.round(h / 0.6)) }, (_, i) => (
            <mesh key={`l${i}`} position={[ballR * 0.62 + 0.1, 0.4 + i * 0.6, 0]}>
              <boxGeometry args={[0.2, 0.03, 0.03]} />
              <meshStandardMaterial color="#8a9099" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )
    }
    default:
      return (
        <mesh position={[0, r / 2, 0]} castShadow>
          <cylinderGeometry args={[r, r, r, 16]} />
          <meshStandardMaterial color={c} />
        </mesh>
      )
  }
}

function labelPos(el: PlacedElement, def?: ElementDef): [number, number, number] {
  switch (el.kind) {
    case 'rect':
      return [el.x, rectEffH(el, def) + 1.6, el.y]
    case 'polygon': {
      const c = polygonCentroid(el.pts)
      return [c.x, 1.4, c.y]
    }
    case 'polyline': {
      const m = el.pts[Math.floor((el.pts.length - 1) / 2)]
      return [m.x, 1.2, m.y]
    }
    case 'point': {
      const h = el.h ?? def?.pointHeight ?? el.radius * 2.4
      const top = def?.pointStyle === 'elevated' ? h + el.radius * 2.2 : def?.pointStyle === 'tank_h' ? el.radius * 2.4 : h
      return [el.x, top + 0.9, el.y]
    }
  }
}

function labelText(el: PlacedElement, def?: ElementDef): string {
  if (el.kind === 'rect') {
    const dims = `${fmt(el.w)}×${fmt(el.d)} ม.`
    return def?.showArea ? `${el.label} · ${dims} · ${fmt(el.w * el.d)} ตร.ม.` : `${el.label} · ${dims}`
  }
  if (el.kind === 'polygon') {
    return def?.showArea ? `${el.label} · ${fmt(polygonArea(el.pts))} ตร.ม.` : el.label
  }
  if (el.kind === 'polyline') return `${el.label} · ${fmt(polylineLength(el.pts))} ม. (กว้าง ${fmt(el.width)} ม.)`
  return el.label
}

export function ElementMesh({
  el,
  selected,
  warning,
  showLabels,
  onDown,
}: {
  el: PlacedElement
  selected: boolean
  warning: boolean
  showLabels: boolean
  onDown: (e: ThreeEvent<PointerEvent>, el: PlacedElement) => void
}) {
  const def = defById(el.defId)
  const tint = warning ? '#e05252' : null

  // selection highlight: translucent pad under the element's footprint bbox
  const bb = elementBBox(el)
  const pad = selected ? (
    <mesh
      position={[(bb.minX + bb.maxX) / 2, 0.14, (bb.minY + bb.maxY) / 2]}
      rotation-x={-Math.PI / 2}
    >
      <planeGeometry args={[bb.maxX - bb.minX + 1.4, bb.maxY - bb.minY + 1.4]} />
      <meshBasicMaterial color="#2563eb" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  ) : null

  const inner =
    el.kind === 'rect' ? (
      <group position={[el.x, 0, el.y]}>
        <RectMesh el={el} def={def} tint={tint} />
      </group>
    ) : el.kind === 'polygon' ? (
      <PolygonMesh el={el} def={def} tint={tint} />
    ) : el.kind === 'polyline' ? (
      <PolylineMesh el={el} def={def} tint={tint} />
    ) : (
      <group position={[el.x, 0, el.y]}>
        <PointMesh el={el} def={def} tint={tint} />
      </group>
    )

  return (
    <group>
      <group onPointerDown={(e) => onDown(e, el)}>{inner}</group>
      {pad}
      {showLabels && (el.kind !== 'point' || selected) && (
        <Html position={labelPos(el, def)} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`obj-label${selected ? ' sel' : ''}${warning ? ' warn' : ''}`}>{labelText(el, def)}</div>
        </Html>
      )}
    </group>
  )
}
