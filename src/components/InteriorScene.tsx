import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useStore } from '../store'
import type { Placed } from '../interior/types'
import { GROUND_FLOOR_ID } from '../interior/types'
import { computeDrop, floorIdOf, getWarningIds, shellOpenings, stackHeight, wallPanels } from '../interior/placement'
import type { Frame } from '../interior/placement'
import type { PlacedRect, Vec2 } from '../types'
import { InteriorMesh } from './interior3d'
import { BuildingShell, normalizeSegment } from './BuildingShell'
import { ArrowHandle } from './gizmo'
import { beginGesture, gestureRef } from './gestures'

/**
 * Inside one building. The building is drawn in its OWN local frame, centered
 * on the origin — exactly the world the gym planner worked in — so every
 * interaction (snap, clamp, drag, gizmo) is free of the site rotation. Going
 * back to the site view is what puts it back in place on the parcel.
 */

export const activeBuildingOf = (s: ReturnType<typeof useStore.getState>): PlacedRect | null => {
  const el = s.elements.find((e) => e.id === s.activeBuildingId)
  return el && el.kind === 'rect' && el.interior ? el : null
}

/** The box the camera frames and the zoom bounds derive from, in either mode. */
export function interiorFrameBox(): Vec2[] {
  const s = useStore.getState()
  if (s.mode === 'building') {
    const b = activeBuildingOf(s)
    if (b)
      return [
        { x: -b.w / 2, y: -b.d / 2 },
        { x: b.w / 2, y: b.d / 2 },
      ]
  }
  return s.plot.pts
}

export function InteriorOverlayHint(): string | null {
  const s = useStore.getState()
  if (s.mode !== 'building') return null
  if (s.tool.type === 'placeInterior') return `คลิกพื้นเพื่อวาง ${s.tool.def.labelTh} · Esc ยกเลิก`
  return null
}

/* ------------------------------------------------------------------ floor */

function FloorSlab({ b, frame }: { b: PlacedRect; frame: Frame }) {
  const activeFloorId = useStore((s) => s.activeFloorId)
  const gridVisible = useStore((s) => s.grid.visible)
  const floors = b.interior!.floors
  const active = floors.find((f) => f.id === activeFloorId) ?? floors[0]

  const gridGeo = useMemo(() => {
    const pts: number[] = []
    const cell = Math.max(0.5, frame.cell >= 1 ? frame.cell : 1)
    for (let x = -b.w / 2; x <= b.w / 2 + 1e-6; x += cell) pts.push(x, 0, -b.d / 2, x, 0, b.d / 2)
    for (let z = -b.d / 2; z <= b.d / 2 + 1e-6; z += cell) pts.push(-b.w / 2, 0, z, b.w / 2, 0, z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [b.w, b.d, frame.cell])

  return (
    <group position={[0, active.base, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[b.w, b.d]} />
        <meshStandardMaterial color="#d8d4cc" roughness={0.95} />
      </mesh>
      {gridVisible && (
        <lineSegments geometry={gridGeo} position={[0, 0.012, 0]}>
          <lineBasicMaterial color="#b9b3a8" transparent opacity={0.75} />
        </lineSegments>
      )}
      {/* edge of the slab, so the building outline always reads */}
      <lineSegments position={[0, 0.02, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(b.w, b.d).rotateX(-Math.PI / 2)]} />
        <lineBasicMaterial color="#5b5348" />
      </lineSegments>
    </group>
  )
}

/**
 * Perimeter walls with the doors and glazed openings placed on them cut out.
 *
 * Each wall is a single plane whose normal points INTO the building, so the
 * walls between you and the room are back-facing and get culled while the ones
 * behind it stay up. That is what makes this a dollhouse you can lay out rather
 * than a sealed box — orbit freely and the near walls always open up.
 */
function Perimeter({ b }: { b: PlacedRect }) {
  const iv = b.interior!
  // a designed building's walls follow its zones; the tallest wall on each
  // side sets the height of the enclosure you edit against
  const eave = iv.design
    ? Math.max(...iv.design.segments.map((sg) => {
        const n = normalizeSegment(sg)
        return Math.max(n.eaveL, n.eaveR)
      }))
    : iv.shell.eave
  if (iv.shell.mode === 0) return null
  const solid = iv.shell.mode === 2

  // rot: which wall an edge item takes (0 N, 4 S, 2 W, 6 E)
  // ry:  turns the plane so its +z normal points indoors
  // flip: the opening's coordinate along the wall, in the plane's local x
  const walls: Array<{ rot: number; len: number; pos: [number, number, number]; ry: number; flip: 1 | -1 }> = [
    { rot: 0, len: b.w, pos: [0, 0, -b.d / 2], ry: 0, flip: 1 },
    { rot: 4, len: b.w, pos: [0, 0, b.d / 2], ry: Math.PI, flip: -1 },
    { rot: 2, len: b.d, pos: [-b.w / 2, 0, 0], ry: Math.PI / 2, flip: -1 },
    { rot: 6, len: b.d, pos: [b.w / 2, 0, 0], ry: -Math.PI / 2, flip: 1 },
  ]

  return (
    <group>
      {walls.map((w) => {
        const openings = shellOpenings(iv.objects, w.rot, eave).map((o) => ({ ...o, c: o.c * w.flip }))
        const panels = wallPanels(w.len, eave, openings)
        return (
          <group key={w.rot} position={w.pos} rotation-y={w.ry}>
            {panels.map((p, i) => (
              <mesh key={i} position={[(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0]} receiveShadow={solid}>
                <planeGeometry args={[p.u1 - p.u0, p.y1 - p.y0]} />
                <meshStandardMaterial
                  color="#e7e5e0"
                  transparent={!solid}
                  opacity={solid ? 1 : 0.25}
                  roughness={0.85}
                />
              </mesh>
            ))}
            {/* a line along the top of the wall keeps the outline readable even
                where the wall itself is culled */}
            <lineSegments position={[0, eave, 0]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([-w.len / 2, 0, 0, w.len / 2, 0, 0]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#8a8275" />
            </lineSegments>
          </group>
        )
      })}
    </group>
  )
}

/** Structural column grid along the length, when the building declares a bay. */
function BayColumns({ b }: { b: PlacedRect }) {
  const bay = b.interior!.bay ?? 0
  const h = b.interior!.shell.eave
  if (bay < 1) return null
  const n = Math.max(2, Math.round(b.d / bay) + 1)
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const z = -b.d / 2 + (b.d / (n - 1)) * i
        return [-1, 1].map((sx) => (
          <mesh key={`${i}${sx}`} position={[(sx * (b.w - 0.4)) / 2, h / 2, z]} castShadow>
            <boxGeometry args={[0.3, h, 0.3]} />
            <meshStandardMaterial color="#9aa2ad" roughness={0.7} />
          </mesh>
        ))
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ ghost */

function InteriorGhost({ frame }: { frame: Frame }) {
  const tool = useStore((s) => s.tool)
  const ghost = useStore((s) => s.ghost)
  const floors = useStore((s) => activeBuildingOf(s)?.interior?.floors)
  const activeFloorId = useStore((s) => s.activeFloorId)
  if (tool.type !== 'placeInterior' || !ghost || !floors) return null
  const def = tool.def
  const drop = computeDrop({ w: def.w, d: def.d, rot: 0, rule: def.rule }, ghost.x, ghost.y, frame)
  const base = (floors.find((f) => f.id === activeFloorId) ?? floors[0]).base
  return (
    <group position={[drop.x, base, drop.z]} rotation-y={(drop.rot * Math.PI) / 4}>
      <mesh position={[0, def.h / 2, 0]}>
        <boxGeometry args={[def.w, def.h, def.d]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[def.w, def.d]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ----------------------------------------------------------------- gizmo */

function InteriorGizmo({ o, base }: { o: Placed; base: number }) {
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null
  const zoom = useStore((s) => s.camZoom)
  const gs = Math.min(3, Math.max(0.8, 14 / zoom))
  const start = (axis: 'x' | 'z', sign: 1 | -1) => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    beginGesture({ mode: 'iresize', id: o.id, axis, sign, start: { ...o }, pushed: false }, controls)
  }
  const startH = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    beginGesture({ mode: 'iheight', id: o.id, pushed: false }, controls)
  }
  const yMid = Math.min(Math.max(o.h * 0.5, 0.4), 1.4)
  return (
    <group position={[o.x, base, o.z]} rotation-y={(o.rot * Math.PI) / 4}>
      <ArrowHandle size={gs} color="#e7e5e0" pos={[o.w / 2 + 0.4, yMid, 0]} rot={[0, 0, -Math.PI / 2]} onDown={start('x', 1)} />
      <ArrowHandle size={gs} color="#e7e5e0" pos={[-o.w / 2 - 0.4, yMid, 0]} rot={[0, 0, Math.PI / 2]} onDown={start('x', -1)} />
      <ArrowHandle size={gs} color="#2563eb" pos={[0, yMid, o.d / 2 + 0.4]} rot={[Math.PI / 2, 0, 0]} onDown={start('z', 1)} />
      <ArrowHandle size={gs} color="#2563eb" pos={[0, yMid, -o.d / 2 - 0.4]} rot={[-Math.PI / 2, 0, 0]} onDown={start('z', -1)} />
      <ArrowHandle size={gs} color="#16a34a" pos={[0, o.h + 0.3, 0]} rot={[0, 0, 0]} onDown={startH} />
    </group>
  )
}

/* --------------------------------------------------------------- content */

export function InteriorContent() {
  const b = useStore(activeBuildingOf)
  const selectedIds = useStore((s) => s.selectedIds)
  const activeFloorId = useStore((s) => s.activeFloorId)
  const showLabels = useStore((s) => s.showLabels)
  const interiorCell = useStore((s) => s.interiorCell)
  const tool = useStore((s) => s.tool)
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null

  const frame: Frame = useMemo(
    () => ({ width: b?.w ?? 10, length: b?.d ?? 10, cell: interiorCell }),
    [b?.w, b?.d, interiorCell],
  )
  const warnings = useMemo(() => getWarningIds(b?.interior?.objects ?? [], frame), [b?.interior?.objects, frame])

  if (!b || !b.interior) return null
  const iv = b.interior
  const floors = iv.floors
  const active = floors.find((f) => f.id === activeFloorId) ?? floors[0]
  const top = stackHeight(floors)

  const localOf = (e: ThreeEvent<PointerEvent>): Vec2 => {
    // raycast onto the plane of the storey being edited, not the ground, so
    // dropping something on an upper floor lands where the cursor points
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -active.base)
    const p = new THREE.Vector3()
    if (e.ray.intersectPlane(plane, p)) return { x: p.x, y: p.z }
    return { x: e.point.x, y: e.point.z }
  }

  const onObjectDown = (e: ThreeEvent<PointerEvent>, o: Placed) => {
    const s = useStore.getState()
    if (s.tool.type !== 'select' || e.button !== 0) return
    e.stopPropagation()
    if (!(s.moveArmed && s.selectedIds.includes(o.id))) {
      s.select(o.id, (e as unknown as { shiftKey?: boolean }).shiftKey ?? e.nativeEvent?.shiftKey)
      return
    }
    const p = localOf(e)
    beginGesture({ mode: 'imove', start: { x: p.x, z: p.y }, applied: { x: 0, z: 0 }, pushed: false }, controls)
  }

  const onCatcherDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    const s = useStore.getState()
    const p = localOf(e)
    if (s.tool.type === 'placeInterior') {
      s.commitPlaceInterior({ x: p.x, z: p.y })
      return
    }
    if (s.tool.type === 'select' && !gestureRef.current) s.select(null)
  }

  const onCatcherMove = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (s.tool.type === 'placeInterior') s.setGhost(localOf(e))
  }

  const selected = selectedIds.length === 1 ? iv.objects.find((o) => o.id === selectedIds[0]) : undefined

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[Math.max(40, b.w), Math.max(60, top * 4 + 30), Math.max(40, b.d)]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-near={1}
        shadow-camera-far={600}
        shadow-bias={-0.0004}
      />
      <hemisphereLight intensity={0.4} groundColor="#c8bfae" />

      <FloorSlab b={b} frame={frame} />
      <Perimeter b={b} />
      {/* the designed shell as a ghost on top: you see the real roof shape and
          zone heights without it ever getting between you and the floor */}
      <BuildingShell design={iv.design} mode={1} width={b.w} length={b.d} objects={iv.objects} />
      <BayColumns b={b} />

      {/* the other storeys, faded right back so the active one reads clearly */}
      {floors
        .filter((f) => f.id !== active.id)
        .map((f) => (
          <group key={f.id}>
            {f.base > 0 && (
              <mesh position={[0, f.base - 0.1, 0]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[b.w, b.d]} />
                <meshStandardMaterial color="#cfcabf" transparent opacity={0.22} side={THREE.DoubleSide} />
              </mesh>
            )}
            <group>
              {iv.objects
                .filter((o) => floorIdOf(o) === f.id)
                .map((o) => (
                  <group key={o.id} position={[o.x, f.base, o.z]} rotation-y={(o.rot * Math.PI) / 4}>
                    <mesh position={[0, o.h / 2, 0]}>
                      <boxGeometry args={[o.w, o.h, o.d]} />
                      <meshStandardMaterial color={o.color} transparent opacity={0.16} depthWrite={false} />
                    </mesh>
                  </group>
                ))}
            </group>
          </group>
        ))}

      {/* the storey being edited */}
      {iv.objects
        .filter((o) => floorIdOf(o) === active.id)
        .map((o) => (
          <InteriorMesh
            key={o.id}
            o={o}
            y={active.base}
            selected={selectedIds.includes(o.id)}
            warning={warnings.has(o.id)}
            showLabels={showLabels}
            onDown={onObjectDown}
          />
        ))}

      <InteriorGhost frame={frame} />
      {selected && tool.type === 'select' && <InteriorGizmo o={selected} base={active.base} />}

      {/* name plate at the far corner, so you always know which building this is */}
      <Html position={[-b.w / 2, iv.shell.eave + 1.2, -b.d / 2]} center style={{ pointerEvents: 'none' }}>
        <div className="obj-label sel">
          {b.label} · {b.w}×{b.d} ม. · {active.name}
        </div>
      </Html>

      {/* invisible catcher on the active storey's plane */}
      <mesh
        position={[0, active.base - 0.02, 0]}
        rotation-x={-Math.PI / 2}
        onPointerDown={onCatcherDown}
        onPointerMove={onCatcherMove}
      >
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  )
}

export { GROUND_FLOOR_ID }
