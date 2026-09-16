import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { ObjectDef, Placed } from '../interior/types'
import { defById } from '../interior/catalog'
import { fmt } from '../geometry'

/**
 * 3D for the things placed inside a building. Everything is built from three.js
 * primitives by hand — there are no external models and no CAD kernel, exactly
 * as in the gym planner this grew out of.
 *
 * Dispatch order in InteriorMesh:
 *   1. the item's category picks the broad shape
 *   2. inside a category, defId picks the detail set
 *
 * When `tint` is set (an item the building no longer covers) the structural
 * surfaces switch to the warning color; small props keep their own colors so
 * the shape stays readable.
 */

const MAT = { roughness: 0.85, metalness: 0 } as const
const STEEL = '#4b5563'
const DARK = '#2f3237'
const GLASS = '#9ec8d8'

function Box({
  args,
  pos,
  color,
  rot = 0,
  opacity = 1,
  metal = false,
}: {
  args: [number, number, number]
  pos: [number, number, number]
  color: string
  rot?: number
  opacity?: number
  metal?: boolean
}) {
  return (
    <mesh position={pos} rotation-y={rot} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={metal ? 0.35 : MAT.roughness}
        metalness={metal ? 0.7 : 0}
      />
    </mesh>
  )
}

const Cyl = ({
  r,
  h,
  pos,
  color,
  rot,
  seg = 14,
}: {
  r: number
  h: number
  pos: [number, number, number]
  color: string
  rot?: [number, number, number]
  seg?: number
}) => (
  <mesh position={pos} rotation={rot} castShadow>
    <cylinderGeometry args={[r, r, h, seg]} />
    <meshStandardMaterial color={color} {...MAT} />
  </mesh>
)

/* --------------------------------------------------------------- generics */

/** Flat painted patch on the floor: activity/assembly zones. */
function ZonePatch({ o, tint }: { o: Placed; tint: string | null }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[o.w, o.d]} />
        <meshStandardMaterial color={tint ?? o.color} transparent opacity={0.55} />
      </mesh>
      {/* painted edge line, the way a factory bay is marked out */}
      <lineSegments position={[0, 0.03, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(o.w, o.d).rotateX(-Math.PI / 2)]} />
        <lineBasicMaterial color={tint ?? '#f8fafc'} />
      </lineSegments>
    </group>
  )
}

/** A room: four walls, a floor and a flat roof slab, hollow so you see inside. */
function RoomShell({
  o,
  tint,
  wall = '#eae6dd',
  glass = false,
}: {
  o: Placed
  tint: string | null
  wall?: string
  glass?: boolean
}) {
  const t = 0.12
  const c = tint ?? wall
  const side = (args: [number, number, number], pos: [number, number, number]) =>
    glass ? (
      <mesh position={pos} castShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={tint ?? GLASS} transparent opacity={0.34} roughness={0.1} metalness={0.1} />
      </mesh>
    ) : (
      <Box args={args} pos={pos} color={c} />
    )
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[o.w, o.d]} />
        <meshStandardMaterial color={tint ?? '#d9d5cc'} />
      </mesh>
      {side([o.w, o.h, t], [0, o.h / 2, -o.d / 2])}
      {side([o.w, o.h, t], [0, o.h / 2, o.d / 2])}
      {side([t, o.h, o.d], [-o.w / 2, o.h / 2, 0])}
      {side([t, o.h, o.d], [o.w / 2, o.h / 2, 0])}
      <Box args={[o.w, 0.1, o.d]} pos={[0, o.h, 0]} color={tint ?? '#cfcabf'} />
    </group>
  )
}

/* --------------------------------------------------------------- machines */

/**
 * The common shape of a floor-standing machine: a heavy bed on a plinth, a
 * working head over it and a control cabinet beside it. `head` shapes the top
 * so a press brake, a lathe and a saw read differently at a glance.
 */
function MachineBody({
  o,
  tint,
  head,
}: {
  o: Placed
  tint: string | null
  head: 'gantry' | 'ram' | 'spindle' | 'arm' | 'open'
}) {
  const c = tint ?? o.color
  const bedH = Math.min(0.9, o.h * 0.45)
  const cabW = Math.min(0.7, o.w * 0.22)
  return (
    <group>
      {/* bed / frame */}
      <Box args={[o.w, bedH, o.d]} pos={[0, bedH / 2, 0]} color={c} />
      <Box args={[o.w * 0.98, 0.1, o.d * 0.9]} pos={[0, bedH + 0.05, 0]} color={DARK} />
      {head === 'gantry' && (
        <>
          <Box args={[o.w * 0.08, o.h - bedH, o.d]} pos={[-o.w * 0.34, bedH + (o.h - bedH) / 2, 0]} color={STEEL} />
          <Box args={[o.w * 0.08, o.h - bedH, o.d]} pos={[o.w * 0.34, bedH + (o.h - bedH) / 2, 0]} color={STEEL} />
          <Box args={[o.w * 0.8, 0.28, o.d * 0.35]} pos={[0, o.h - 0.2, 0]} color={STEEL} metal />
          <Box args={[0.5, 0.6, 0.5]} pos={[0, o.h - 0.75, 0]} color={DARK} />
        </>
      )}
      {head === 'ram' && (
        <>
          <Box args={[o.w, o.h - bedH, o.d * 0.34]} pos={[0, bedH + (o.h - bedH) / 2, -o.d * 0.3]} color={c} />
          {/* the ram itself, hanging over the bed */}
          <Box args={[o.w * 0.92, 0.32, 0.26]} pos={[0, bedH + 0.75, 0]} color={STEEL} metal />
        </>
      )}
      {head === 'spindle' && (
        <>
          <Box args={[o.w * 0.4, o.h - bedH, o.d * 0.7]} pos={[-o.w * 0.28, bedH + (o.h - bedH) / 2, 0]} color={c} />
          <Cyl r={0.12} h={0.55} pos={[o.w * 0.05, o.h - 0.5, 0]} color={STEEL} />
        </>
      )}
      {head === 'arm' && (
        <>
          <Cyl r={0.16} h={o.h - bedH} pos={[-o.w * 0.35, bedH + (o.h - bedH) / 2, 0]} color={STEEL} />
          <Box args={[o.w * 0.8, 0.2, 0.2]} pos={[0, o.h - 0.25, 0]} color={STEEL} metal />
          <Cyl r={0.09} h={0.5} pos={[o.w * 0.28, o.h - 0.6, 0]} color={DARK} />
        </>
      )}
      {/* control cabinet + pendant */}
      <Box args={[cabW, Math.min(1.9, o.h * 0.8), Math.min(0.55, o.d * 0.4)]} pos={[o.w / 2 + cabW / 2 + 0.05, Math.min(1.9, o.h * 0.8) / 2, o.d * 0.25]} color={DARK} />
    </group>
  )
}

function LaserCutter({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  const bedH = 0.85
  return (
    <group>
      {/* two shuttle tables side by side along the length */}
      {[-o.w * 0.24, o.w * 0.24].map((x, i) => (
        <group key={i}>
          <Box args={[o.w * 0.44, bedH, o.d * 0.92]} pos={[x, bedH / 2, 0]} color={c} />
          <Box args={[o.w * 0.42, 0.08, o.d * 0.86]} pos={[x, bedH + 0.04, 0]} color="#3f3f46" />
        </group>
      ))}
      {/* enclosure over the cutting table */}
      <mesh position={[-o.w * 0.24, bedH + (o.h - bedH) / 2, 0]} castShadow>
        <boxGeometry args={[o.w * 0.46, o.h - bedH, o.d * 0.96]} />
        <meshStandardMaterial color={tint ?? '#fbbf24'} transparent opacity={0.45} />
      </mesh>
      <Box args={[o.w * 0.46, 0.12, o.d * 0.96]} pos={[-o.w * 0.24, o.h, 0]} color={c} />
      {/* chiller + control cabinet at the end */}
      <Box args={[0.9, 1.7, 0.9]} pos={[o.w / 2 + 0.5, 0.85, -o.d * 0.2]} color="#94a3b8" />
      <Box args={[0.7, 1.9, 0.6]} pos={[o.w / 2 + 0.5, 0.95, o.d * 0.3]} color={DARK} />
    </group>
  )
}

function PlasmaTable({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  return (
    <group>
      {/* water table */}
      <Box args={[o.w, 0.9, o.d]} pos={[0, 0.45, 0]} color={c} />
      <mesh position={[0, 0.92, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[o.w * 0.94, o.d * 0.9]} />
        <meshStandardMaterial color="#1f3b47" roughness={0.2} metalness={0.3} />
      </mesh>
      {/* side rails and the cutting gantry that rides them */}
      <Box args={[o.w, 0.14, 0.14]} pos={[0, 1.0, -o.d / 2]} color={STEEL} metal />
      <Box args={[o.w, 0.14, 0.14]} pos={[0, 1.0, o.d / 2]} color={STEEL} metal />
      <Box args={[0.3, 0.5, o.d + 0.3]} pos={[-o.w * 0.2, 1.3, 0]} color={STEEL} metal />
      <Box args={[0.28, 0.7, 0.28]} pos={[-o.w * 0.2, 1.2, o.d * 0.1]} color={DARK} />
    </group>
  )
}

function WeldBay({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  return (
    <group>
      {/* heavy table */}
      <Box args={[o.w * 0.75, 0.12, o.d * 0.6]} pos={[0, 0.88, 0]} color="#6b7280" metal />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box
            key={`${sx}${sz}`}
            args={[0.1, 0.88, 0.1]}
            pos={[sx * o.w * 0.33, 0.44, sz * o.d * 0.25]}
            color={STEEL}
          />
        )),
      )}
      {/* welding set on wheels */}
      <Box args={[0.55, 0.85, 0.42]} pos={[o.w * 0.36, 0.45, -o.d * 0.28]} color={c} />
      <Cyl r={0.1} h={0.9} pos={[o.w * 0.28, 0.45, -o.d * 0.28]} color="#16a34a" />
      {/* screens on two sides */}
      <Box args={[o.w, o.h * 0.8, 0.06]} pos={[0, o.h * 0.4, -o.d / 2]} color="#b45309" opacity={0.75} />
      <Box args={[0.06, o.h * 0.8, o.d]} pos={[-o.w / 2, o.h * 0.4, 0]} color="#b45309" opacity={0.75} />
    </group>
  )
}

function Rack({ o, tint, kind }: { o: Placed; tint: string | null; kind: 'pallet' | 'cantilever' | 'sheet' }) {
  const c = tint ?? o.color
  const levels = Math.max(2, Math.round(o.h / (kind === 'pallet' ? 1.6 : 0.8)))
  return (
    <group>
      {/* uprights */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} args={[0.1, o.h, 0.1]} pos={[sx * (o.w / 2 - 0.08), o.h / 2, sz * (o.d / 2 - 0.08)]} color={c} />
        )),
      )}
      {/* beams / arms per level */}
      {Array.from({ length: levels }, (_, i) => {
        const y = ((i + 1) / levels) * o.h
        if (kind === 'cantilever') {
          return (
            <group key={i}>
              <Box args={[o.w, 0.08, o.d * 0.9]} pos={[0, y, 0]} color={c} />
              {/* what the arms hold: bundles of bar and tube */}
              <Cyl r={0.09} h={o.w * 0.9} pos={[0, y + 0.13, -o.d * 0.15]} color="#8a8f97" rot={[0, 0, Math.PI / 2]} />
              <Cyl r={0.09} h={o.w * 0.9} pos={[0, y + 0.13, o.d * 0.15]} color="#9aa0a8" rot={[0, 0, Math.PI / 2]} />
            </group>
          )
        }
        return (
          <group key={i}>
            <Box args={[o.w, 0.09, 0.09]} pos={[0, y, -o.d / 2 + 0.08]} color={c} />
            <Box args={[o.w, 0.09, 0.09]} pos={[0, y, o.d / 2 - 0.08]} color={c} />
            {kind === 'pallet' && i < levels - 1 && (
              <Box args={[o.w * 0.4, 0.55, o.d * 0.8]} pos={[o.w * 0.22, y + 0.32, 0]} color="#a3773f" />
            )}
            {kind === 'sheet' && (
              <Box args={[o.w * 0.92, 0.06, o.d * 0.8]} pos={[0, y + 0.06, 0]} color="#8a9099" metal />
            )}
          </group>
        )
      })}
    </group>
  )
}

/* ----------------------------------------------------------------- cranes */

/**
 * Overhead travelling crane. `w` is the span between the runway beams and `h`
 * the rail level, matching how a crane is actually specified — so the runway
 * is drawn along the building, with the bridge, crab and hook under it.
 */
function EotCrane({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  const run = Math.max(o.d, 6) // how far the runway is drawn along the bay
  return (
    <group>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box args={[0.35, 0.6, run]} pos={[(sx * o.w) / 2, o.h, 0]} color={STEEL} metal />
          {/* corbel brackets */}
          {[-run / 2 + 1, 0, run / 2 - 1].map((z, i) => (
            <Box key={i} args={[0.3, 0.8, 0.3]} pos={[(sx * o.w) / 2, o.h - 0.7, z]} color={STEEL} />
          ))}
        </group>
      ))}
      {/* bridge girder + crab + hook */}
      <Box args={[o.w + 0.8, 0.75, 1.1]} pos={[0, o.h + 0.65, 0]} color={c} metal />
      <Box args={[1.6, 0.9, 1.5]} pos={[o.w * 0.12, o.h + 0.35, 0]} color={DARK} />
      <Cyl r={0.04} h={Math.max(1, o.h - 1.6)} pos={[o.w * 0.12, (o.h - 0.6) / 2 + 0.3, 0]} color="#64748b" />
      <Box args={[0.3, 0.45, 0.3]} pos={[o.w * 0.12, 0.9, 0]} color="#facc15" />
    </group>
  )
}

function JibCrane({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  const reach = o.w / 2
  return (
    <group>
      <Cyl r={0.22} h={o.h} pos={[0, o.h / 2, 0]} color={STEEL} />
      <Box args={[reach, 0.3, 0.3]} pos={[reach / 2, o.h - 0.2, 0]} color={c} metal />
      <Box args={[0.45, 0.5, 0.45]} pos={[reach * 0.8, o.h - 0.55, 0]} color={DARK} />
      <Cyl r={0.035} h={o.h - 1.6} pos={[reach * 0.8, (o.h - 1.6) / 2, 0]} color="#64748b" />
      {/* swing arc on the floor, so the clearance it needs is visible */}
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[reach - 0.08, reach, 48]} />
        <meshBasicMaterial color={tint ?? '#ca8a04'} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Forklift({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  return (
    <group>
      <Box args={[o.w * 0.66, 0.6, o.d]} pos={[-o.w * 0.1, 0.55, 0]} color={c} />
      {/* mast and forks at the front (+x) */}
      <Box args={[0.12, o.h, 0.12]} pos={[o.w * 0.4, o.h / 2, -o.d * 0.3]} color={STEEL} />
      <Box args={[0.12, o.h, 0.12]} pos={[o.w * 0.4, o.h / 2, o.d * 0.3]} color={STEEL} />
      <Box args={[0.7, 0.07, 0.14]} pos={[o.w * 0.62, 0.12, -o.d * 0.22]} color="#d4d4d8" metal />
      <Box args={[0.7, 0.07, 0.14]} pos={[o.w * 0.62, 0.12, o.d * 0.22]} color="#d4d4d8" metal />
      {/* overhead guard + seat */}
      <Box args={[o.w * 0.5, 0.08, o.d]} pos={[-o.w * 0.15, o.h - 0.05, 0]} color={DARK} />
      {[-1, 1].map((sz) =>
        [-1, 1].map((sx) => (
          <Cyl key={`${sx}${sz}`} r={0.28} h={0.22} pos={[sx * o.w * 0.3, 0.28, sz * o.d * 0.42]} color="#27272a" rot={[Math.PI / 2, 0, 0]} />
        )),
      )}
    </group>
  )
}

/* ---------------------------------------------------------------- office */

function Chair({ pos, facing = 0, color = '#5f6b7a' }: { pos: [number, number, number]; facing?: number; color?: string }) {
  return (
    <group position={pos} rotation-y={facing}>
      <Box args={[0.45, 0.06, 0.45]} pos={[0, 0.44, 0]} color={color} />
      <Box args={[0.45, 0.5, 0.06]} pos={[0, 0.72, -0.2]} color={color} />
      <Cyl r={0.05} h={0.44} pos={[0, 0.22, 0]} color="#3f3f46" seg={8} />
      <Cyl r={0.24} h={0.05} pos={[0, 0.03, 0]} color="#3f3f46" seg={10} />
    </group>
  )
}

function DeskTop({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <group>
      <Box args={[w, 0.05, d]} pos={[0, h, 0]} color={color} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} args={[0.06, h, 0.06]} pos={[sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08)]} color="#71717a" />
        )),
      )}
    </group>
  )
}

function Monitor({ pos, facing = 0 }: { pos: [number, number, number]; facing?: number }) {
  return (
    <group position={pos} rotation-y={facing}>
      <Box args={[0.52, 0.32, 0.03]} pos={[0, 0.28, 0]} color="#18181b" />
      <Cyl r={0.03} h={0.14} pos={[0, 0.07, 0]} color="#3f3f46" seg={8} />
      <Box args={[0.22, 0.02, 0.14]} pos={[0, 0.01, 0]} color="#3f3f46" />
    </group>
  )
}

/** One desk, a pod of 4 (back to back) or a pod of 6, from the same parts. */
function Desks({ o, tint, seats }: { o: Placed; tint: string | null; seats: 1 | 4 | 6 }) {
  const c = tint ?? o.color
  if (seats === 1) {
    return (
      <group>
        <DeskTop w={o.w} d={o.d} h={o.h} color={c} />
        <Monitor pos={[0, o.h, -o.d * 0.25]} />
        <Chair pos={[0, 0, o.d * 0.75]} facing={Math.PI} />
      </group>
    )
  }
  const cols = seats / 2
  const cw = o.w / cols
  return (
    <group>
      <DeskTop w={o.w} d={o.d} h={o.h} color={c} />
      {/* back-to-back: a low screen along the spine */}
      <Box args={[o.w, 0.35, 0.05]} pos={[0, o.h + 0.2, 0]} color="#94a3b8" />
      {Array.from({ length: cols }, (_, i) => {
        const x = -o.w / 2 + cw * (i + 0.5)
        return (
          <group key={i}>
            <Monitor pos={[x, o.h, -0.14]} />
            <Monitor pos={[x, o.h, 0.14]} facing={Math.PI} />
            <Chair pos={[x, 0, -o.d * 0.72]} />
            <Chair pos={[x, 0, o.d * 0.72]} facing={Math.PI} />
          </group>
        )
      })}
    </group>
  )
}

function MeetingTable({ o, tint }: { o: Placed; tint: string | null }) {
  const perSide = Math.max(1, Math.round(o.w / 0.75))
  return (
    <group>
      <DeskTop w={o.w} d={o.d} h={o.h} color={tint ?? o.color} />
      {Array.from({ length: perSide }, (_, i) => {
        const x = -o.w / 2 + (o.w / perSide) * (i + 0.5)
        return (
          <group key={i}>
            <Chair pos={[x, 0, -o.d * 0.72]} />
            <Chair pos={[x, 0, o.d * 0.72]} facing={Math.PI} />
          </group>
        )
      })}
    </group>
  )
}

/** A very simple stand-in person — enough to read scale at a glance. */
function PersonFigure({ o, tint }: { o: Placed; tint: string | null }) {
  const s = o.h / 1.7
  const c = tint ?? o.color
  return (
    <group scale={s}>
      <Cyl r={0.11} h={0.78} pos={[0, 0.39, 0]} color="#3f4652" seg={8} />
      <Box args={[0.38, 0.55, 0.22]} pos={[0, 1.05, 0]} color={c} />
      <mesh position={[0, 1.47, 0]} castShadow>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial color="#c2926b" {...MAT} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------- structure */

function PartitionWall({ o, tint }: { o: Placed; tint: string | null }) {
  const isGlass = o.material === 'glass'
  return (
    <mesh position={[0, o.h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[o.w, o.h, o.d]} />
      <meshStandardMaterial
        color={tint ?? (isGlass ? GLASS : o.color)}
        transparent={isGlass}
        opacity={isGlass ? 0.34 : 1}
        {...MAT}
      />
    </mesh>
  )
}

function Railing({ o, tint }: { o: Placed; tint: string | null }) {
  const n = Math.max(2, Math.round(o.w / 1.2) + 1)
  const c = tint ?? o.color
  return (
    <group>
      <Box args={[o.w, 0.05, 0.05]} pos={[0, o.h, 0]} color={c} />
      <Box args={[o.w, 0.04, 0.04]} pos={[0, o.h * 0.55, 0]} color={c} />
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} args={[0.05, o.h, 0.05]} pos={[-o.w / 2 + (o.w / (n - 1)) * i, o.h / 2, 0]} color={c} />
      ))}
    </group>
  )
}

function MezzanineSlab({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  const cols = Math.max(2, Math.round(o.w / 4) + 1)
  const rows = Math.max(2, Math.round(o.d / 4) + 1)
  return (
    <group>
      <Box args={[o.w, 0.22, o.d]} pos={[0, o.h - 0.11, 0]} color={c} />
      {Array.from({ length: cols }, (_, i) =>
        Array.from({ length: rows }, (_, j) => (
          <Box
            key={`${i}${j}`}
            args={[0.16, o.h - 0.22, 0.16]}
            pos={[-o.w / 2 + (o.w / (cols - 1)) * i, (o.h - 0.22) / 2, -o.d / 2 + (o.d / (rows - 1)) * j]}
            color={STEEL}
          />
        )),
      )}
      {/* edge rail so it reads as a floor you can stand on */}
      <Box args={[o.w, 0.05, 0.05]} pos={[0, o.h + 1.0, -o.d / 2]} color="#3e434a" />
      <Box args={[o.w, 0.05, 0.05]} pos={[0, o.h + 1.0, o.d / 2]} color="#3e434a" />
    </group>
  )
}

function Stairs({ o, tint }: { o: Placed; tint: string | null }) {
  const steps = Math.max(3, Math.round(o.h / 0.18))
  const rise = o.h / steps
  const run = o.d / steps
  const c = tint ?? o.color
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => (
        <Box
          key={i}
          args={[o.w, rise, run]}
          pos={[0, rise / 2 + i * rise, o.d / 2 - run / 2 - i * run]}
          color={c}
        />
      ))}
      {[-1, 1].map((sx) => (
        <Box key={sx} args={[0.05, 0.05, o.d * 1.02]} pos={[(sx * o.w) / 2, o.h * 0.5 + 0.95, 0]} color="#3e434a" rot={0} />
      ))}
    </group>
  )
}

function Door({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  if (o.defId === 'door_roller' || o.defId === 'door_slide') {
    return (
      <group>
        <Box args={[o.w, o.h, 0.1]} pos={[0, o.h / 2, 0]} color={c} metal />
        {/* shutter ribs */}
        {Array.from({ length: Math.max(3, Math.round(o.h / 0.5)) }, (_, i) => (
          <Box key={i} args={[o.w, 0.03, 0.14]} pos={[0, (o.h / Math.round(o.h / 0.5)) * (i + 0.5), 0]} color="#7c8794" />
        ))}
      </group>
    )
  }
  return (
    <group>
      <Box args={[o.w, o.h, 0.06]} pos={[0, o.h / 2, 0]} color={c} />
      <Cyl r={0.03} h={0.12} pos={[o.w * 0.36, o.h * 0.48, 0.08]} color="#d4d4d8" rot={[Math.PI / 2, 0, 0]} seg={8} />
    </group>
  )
}

function GlassPane({ o, tint }: { o: Placed; tint: string | null }) {
  return (
    <group position={[0, (o.sill ?? 0.9) + o.h / 2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[o.w, o.h, 0.04]} />
        <meshStandardMaterial color={tint ?? GLASS} transparent opacity={0.36} roughness={0.08} metalness={0.15} />
      </mesh>
      {/* frame */}
      <Box args={[o.w, 0.06, 0.07]} pos={[0, o.h / 2, 0]} color="#71717a" />
      <Box args={[o.w, 0.06, 0.07]} pos={[0, -o.h / 2, 0]} color="#71717a" />
      <Box args={[0.06, o.h, 0.07]} pos={[-o.w / 2, 0, 0]} color="#71717a" />
      <Box args={[0.06, o.h, 0.07]} pos={[o.w / 2, 0, 0]} color="#71717a" />
    </group>
  )
}

/* ------------------------------------------------------ services & light */

function HighBay({ o, tint }: { o: Placed; tint: string | null }) {
  return (
    <group position={[0, o.h, 0]}>
      <Cyl r={0.02} h={0.4} pos={[0, 0.2, 0]} color="#71717a" seg={6} />
      <mesh castShadow>
        <cylinderGeometry args={[o.w / 2, o.w / 2.6, 0.16, 16]} />
        <meshStandardMaterial color={tint ?? o.color} {...MAT} />
      </mesh>
      <mesh position={[0, -0.09, 0]}>
        <cylinderGeometry args={[o.w / 2.3, o.w / 2.3, 0.03, 16]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fff3c4" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function BigFan({ o, tint }: { o: Placed; tint: string | null }) {
  const r = o.w / 2
  return (
    <group position={[0, o.h, 0]}>
      <Cyl r={0.05} h={0.8} pos={[0, 0.4, 0]} color="#71717a" seg={8} />
      <Cyl r={0.26} h={0.3} pos={[0, -0.1, 0]} color={tint ?? o.color} />
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, -0.18, 0]} rotation-y={(i * Math.PI * 2) / 5} castShadow>
          <boxGeometry args={[r, 0.04, 0.35]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function Duct({ o, tint }: { o: Placed; tint: string | null }) {
  return <Box args={[o.w, o.d, o.d]} pos={[0, o.h, 0]} color={tint ?? o.color} metal />
}

function Compressor({ o, tint }: { o: Placed; tint: string | null }) {
  const c = tint ?? o.color
  return (
    <group>
      <Box args={[o.w * 0.55, o.h * 0.55, o.d]} pos={[-o.w * 0.22, (o.h * 0.55) / 2, 0]} color={c} />
      <Cyl r={o.d * 0.38} h={o.h * 0.92} pos={[o.w * 0.28, (o.h * 0.92) / 2, 0]} color="#0ea5e9" />
      <Cyl r={0.04} h={o.w * 0.5} pos={[0, o.h * 0.55, 0]} color="#94a3b8" rot={[0, 0, Math.PI / 2]} seg={8} />
    </group>
  )
}

function Cabinet({ o, tint, drawers }: { o: Placed; tint: string | null; drawers: number }) {
  const c = tint ?? o.color
  return (
    <group>
      <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={c} />
      {Array.from({ length: drawers }, (_, i) => (
        <Box
          key={i}
          args={[o.w * 0.84, o.h / drawers - 0.06, 0.03]}
          pos={[0, (o.h / drawers) * (i + 0.5), o.d / 2 + 0.01]}
          color="#e4e4e7"
        />
      ))}
    </group>
  )
}

function Plant({ o, tint }: { o: Placed; tint: string | null }) {
  const r = Math.min(o.w, o.d) / 2
  return (
    <group>
      <mesh position={[0, o.h * 0.16, 0]} castShadow>
        <cylinderGeometry args={[r * 0.75, r * 0.55, o.h * 0.32, 12]} />
        <meshStandardMaterial color="#a8a29e" {...MAT} />
      </mesh>
      <mesh position={[0, o.h * 0.68, 0]} scale={[1, 1.15, 1]} castShadow>
        <sphereGeometry args={[r * 1.25, 12, 10]} />
        <meshStandardMaterial color={tint ?? o.color} {...MAT} />
      </mesh>
    </group>
  )
}

/* --------------------------------------------------------------- dispatch */

export function ObjectMesh({ o, tint }: { o: Placed; tint: string | null }) {
  switch (o.category) {
    case 'machine':
      if (o.defId === 'laser_cut') return <LaserCutter o={o} tint={tint} />
      if (o.defId === 'plasma_cut') return <PlasmaTable o={o} tint={tint} />
      if (o.defId === 'press_brake') return <MachineBody o={o} tint={tint} head="ram" />
      if (o.defId === 'shear') return <MachineBody o={o} tint={tint} head="ram" />
      if (o.defId === 'mill_cnc' || o.defId === 'lathe_cnc') return <MachineBody o={o} tint={tint} head="gantry" />
      if (o.defId === 'drill_radial' || o.defId === 'tapping') return <MachineBody o={o} tint={tint} head="arm" />
      return <MachineBody o={o} tint={tint} head="spindle" />
    case 'weld':
      if (o.defId === 'weld_bay') return <WeldBay o={o} tint={tint} />
      if (o.defId === 'fit_table' || o.defId === 'qc_table')
        return <DeskTop w={o.w} d={o.d} h={o.h} color={tint ?? o.color} />
      return <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
    case 'crane':
      if (o.defId === 'crane_eot') return <EotCrane o={o} tint={tint} />
      if (o.defId === 'crane_jib') return <JibCrane o={o} tint={tint} />
      if (o.defId === 'forklift') return <Forklift o={o} tint={tint} />
      return <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
    case 'storage':
      if (o.defId === 'rack_pallet') return <Rack o={o} tint={tint} kind="pallet" />
      if (o.defId === 'rack_cantilever') return <Rack o={o} tint={tint} kind="cantilever" />
      if (o.defId === 'sheet_rack') return <Rack o={o} tint={tint} kind="sheet" />
      return <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
    case 'workstation':
      if (o.defId === 'desk_pod4') return <Desks o={o} tint={tint} seats={4} />
      if (o.defId === 'desk_pod6') return <Desks o={o} tint={tint} seats={6} />
      if (o.defId === 'table_meet') return <MeetingTable o={o} tint={tint} />
      return <Desks o={o} tint={tint} seats={1} />
    case 'room':
      return (
        <RoomShell
          o={o}
          tint={tint}
          glass={o.defId === 'shop_office' || o.defId === 'room_meeting' || o.defId === 'room_huddle'}
          wall={o.color}
        />
      )
    case 'zone':
      return <ZonePatch o={o} tint={tint} />
    case 'reception':
      return (
        <group>
          <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
          <Box args={[o.w + 0.16, 0.06, o.d + 0.16]} pos={[0, o.h, 0]} color="#f4f1e8" />
        </group>
      )
    case 'furniture':
      if (o.defId === 'plant') return <Plant o={o} tint={tint} />
      if (o.defId === 'cab_file') return <Cabinet o={o} tint={tint} drawers={4} />
      if (o.defId === 'lockers') return <Cabinet o={o} tint={tint} drawers={3} />
      if (o.defId === 'table_canteen') return <MeetingTable o={o} tint={tint} />
      return <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
    case 'partition':
      return o.defId === 'rail' ? <Railing o={o} tint={tint} /> : <PartitionWall o={o} tint={tint} />
    case 'column':
      return <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
    case 'mezzanine':
      return <MezzanineSlab o={o} tint={tint} />
    case 'stairs':
      return <Stairs o={o} tint={tint} />
    case 'ceiling':
      return o.defId === 'bulkhead' ? (
        <Box args={[o.w, o.drop ?? 0.6, o.d]} pos={[0, o.h + (o.drop ?? 0.6) / 2, 0]} color={tint ?? o.color} />
      ) : (
        <Box args={[o.w, 0.08, o.d]} pos={[0, o.h, 0]} color={tint ?? o.color} />
      )
    case 'hvac':
      if (o.defId === 'bigfan') return <BigFan o={o} tint={tint} />
      if (o.defId === 'duct') return <Duct o={o} tint={tint} />
      if (o.defId === 'compressor') return <Compressor o={o} tint={tint} />
      if (o.defId === 'fcu') return <Box args={[o.w, 0.45, o.d]} pos={[0, o.h, 0]} color={tint ?? o.color} />
      return <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
    case 'tech':
      if (o.defId === 'highbay') return <HighBay o={o} tint={tint} />
      if (o.defId === 'light_floor')
        return (
          <group>
            <Cyl r={0.05} h={o.h} pos={[0, o.h / 2, 0]} color="#71717a" seg={8} />
            <Box args={[o.w, 0.2, 0.2]} pos={[0, o.h, 0]} color={tint ?? o.color} />
          </group>
        )
      return <Box args={[o.w, 0.18, o.d]} pos={[0, o.h, 0]} color={tint ?? o.color} />
    case 'door':
      return <Door o={o} tint={tint} />
    case 'window':
      return <GlassPane o={o} tint={tint} />
    case 'person':
      return <PersonFigure o={o} tint={tint} />
    case 'fixture':
    default:
      return <Box args={[o.w, o.h, o.d]} pos={[0, o.h / 2, 0]} color={tint ?? o.color} />
  }
}

/* ----------------------------------------------------------------- label */

function labelText(o: Placed, def?: ObjectDef): string {
  const dims = `${fmt(o.w)}×${fmt(o.d)} ม.`
  if (o.category === 'crane' && o.defId === 'crane_eot') return `${o.label} · span ${fmt(o.w)} ม. · ราง +${fmt(o.h)} ม.`
  return def?.note ? `${o.label} · ${dims}` : `${o.label} · ${dims}`
}

export function InteriorMesh({
  o,
  y,
  selected,
  warning,
  showLabels,
  onDown,
}: {
  o: Placed
  y: number // the storey's floor level above the building slab (m)
  selected: boolean
  warning: boolean
  showLabels: boolean
  onDown: (e: ThreeEvent<PointerEvent>, o: Placed) => void
}) {
  const def = defById(o.defId)
  const tint = warning ? '#e05252' : null
  const pad = useMemo(() => Math.max(o.w, o.d), [o.w, o.d])

  return (
    <group position={[o.x, y, o.z]}>
      <group rotation-y={(o.rot * Math.PI) / 4} onPointerDown={(e) => onDown(e, o)}>
        <ObjectMesh o={o} tint={tint} />
      </group>
      {selected && (
        <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[pad + 0.9, pad + 0.9]} />
          <meshBasicMaterial color="#2563eb" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}
      {showLabels && (
        <Html position={[0, o.h + 0.7, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`obj-label${selected ? ' sel' : ''}${warning ? ' warn' : ''}`}>{labelText(o, def)}</div>
        </Html>
      )}
    </group>
  )
}
