import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls, OrthographicCamera } from '@react-three/drei'
import { useStore } from '../store'
import { defById, LAYERS } from '../catalog'
import type { BBox } from '../geometry'
import {
  axisAlign,
  bboxOf,
  elementBBox,
  fmt,
  formatRai,
  isOutsideBoundary,
  niceScaleLength,
  polygonArea,
  snap,
} from '../geometry'
import type { PlacedElement, PlacedRect, Vec2 } from '../types'
import { ArrowHandle } from './gizmo'
import { ElementMesh, rectEffH, toShape } from './elements3d'

// Exposed so the toolbar can grab a PNG of the WebGL canvas (gym pattern)
export const canvasCapture: { el: HTMLCanvasElement | null } = { el: null }

function CaptureBinder() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    canvasCapture.el = gl.domElement
    return () => {
      canvasCapture.el = null
    }
  }, [gl])
  return null
}

type Gesture =
  | { mode: 'move'; start: Vec2; applied: Vec2; bbox0: BBox; others: BBox[]; pushed: boolean }
  | { mode: 'resize'; id: string; axis: 'x' | 'y'; sign: 1 | -1; start: PlacedRect; pushed: boolean }
  | { mode: 'height'; id: string; pushed: boolean }
  | { mode: 'plotVertex'; i: number; pushed: boolean }
  | { mode: 'vertex'; id: string; i: number; pushed: boolean }
  | { mode: 'imageMove'; start: Vec2; imgStart: Vec2; pushed: boolean }

const gestureRef: { current: Gesture | null } = { current: null }

// Isometric camera framed on the plot; remounted via viewKey to reset the view
function CameraRig() {
  const size = useThree((s) => s.size)
  const plotPts = useStore((s) => s.plot.pts)
  const { center, zoom, dist } = useMemo(() => {
    const bb = bboxOf(plotPts.length >= 3 ? plotPts : [{ x: 0, y: 0 }, { x: 100, y: 80 }])
    const w = Math.max(20, bb.maxX - bb.minX)
    const d = Math.max(20, bb.maxY - bb.minY)
    return {
      center: [(bb.minX + bb.maxX) / 2, 0, (bb.minY + bb.maxY) / 2] as [number, number, number],
      zoom: Math.max(2, Math.min(size.width, size.height) / (Math.max(w, d) * 1.45)),
      dist: Math.max(w, d) * 1.2 + 40,
    }
    // framed once per mount — remount (viewKey) re-frames
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[center[0] + dist, dist, center[2] + dist]}
        zoom={zoom}
        near={-2000}
        far={4000}
      />
      <OrbitControls makeDefault target={center} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

// Publishes the ortho zoom (≈ px per meter) for the scale-bar overlay
function ZoomTracker() {
  const camera = useThree((s) => s.camera)
  const last = useRef(0)
  useFrame(() => {
    const z = (camera as THREE.OrthographicCamera).zoom
    if (Math.abs(z - last.current) / Math.max(z, 1e-3) > 0.03) {
      last.current = z
      useStore.getState().setCamZoom(z)
    }
  })
  return null
}

/**
 * Window-level pointer handling for drag gestures (move / resize / height /
 * vertex edits), raycast against the ground plane — the gym planner's
 * DragController adapted to the site model (y-down meters → three x/z).
 */
function DragController() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null
  const toolType = useStore((s) => s.tool.type)
  const gestureTick = useStore((s) => s.selectedIds) // re-run effect when selection changes

  useEffect(() => {
    const el = gl.domElement
    const placing = toolType === 'place' || toolType === 'draw'
    if (placing && controls) controls.enabled = false
    else if (controls && !gestureRef.current) controls.enabled = true

    const raycaster = new THREE.Raycaster()
    const pt = new THREE.Vector3()
    const setRay = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      )
    }
    const ground = (e: PointerEvent): Vec2 | null => {
      setRay(e)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      return raycaster.ray.intersectPlane(plane, pt) ? { x: pt.x, y: pt.z } : null
    }

    const pushOnce = (g: { pushed: boolean }) => {
      if (!g.pushed) {
        g.pushed = true
        useStore.getState().pushHistory()
      }
    }

    const onMove = (e: PointerEvent) => {
      const s = useStore.getState()
      const g = gestureRef.current
      if (!g) return
      if (controls) controls.enabled = false

      if (g.mode === 'height') {
        // camera-facing vertical plane through the object's center (gym pattern)
        const o = s.elements.find((v) => v.id === g.id)
        if (!o || o.kind !== 'rect') return
        setRay(e)
        const dir = new THREE.Vector3()
        camera.getWorldDirection(dir)
        dir.y = 0
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
        dir.normalize()
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(dir, new THREE.Vector3(o.x, 0, o.y))
        if (!raycaster.ray.intersectPlane(plane, pt)) return
        pushOnce(g)
        s.updateElement(o.id, { h: Math.max(1, Math.round(pt.y / 0.5) * 0.5) })
        return
      }

      const p = ground(e)
      if (!p) return

      if (g.mode === 'move') {
        pushOnce(g)
        const tot = { x: p.x - g.start.x, y: p.y - g.start.y }
        let tdx = snap(g.bbox0.minX + tot.x, s.grid.cell) - g.bbox0.minX
        let tdy = snap(g.bbox0.minY + tot.y, s.grid.cell) - g.bbox0.minY
        const moved = {
          minX: g.bbox0.minX + tdx,
          minY: g.bbox0.minY + tdy,
          maxX: g.bbox0.maxX + tdx,
          maxY: g.bbox0.maxY + tdy,
        }
        const al = axisAlign(moved, g.others, 0.75)
        tdx += al.dx
        tdy += al.dy
        s.setGuides(al.gx, al.gy)
        s.moveSelectedBy(tdx - g.applied.x, tdy - g.applied.y)
        g.applied = { x: tdx, y: tdy }
        return
      }

      if (g.mode === 'resize') {
        pushOnce(g)
        const r = g.start
        const th = (r.rot * Math.PI) / 180
        const dir = g.axis === 'x' ? { x: Math.cos(th), y: Math.sin(th) } : { x: -Math.sin(th), y: Math.cos(th) }
        const u = (p.x - r.x) * dir.x + (p.y - r.y) * dir.y
        const startDim = g.axis === 'x' ? r.w : r.d
        const newDim = Math.max(0.5, snap(g.sign * u + startDim / 2, 0.5))
        const shift = (g.sign * (newDim - startDim)) / 2
        s.updateElement(g.id, {
          ...(g.axis === 'x' ? { w: newDim } : { d: newDim }),
          x: r.x + dir.x * shift,
          y: r.y + dir.y * shift,
        })
        return
      }

      if (g.mode === 'plotVertex') {
        pushOnce(g)
        s.movePlotVertex(g.i, { x: snap(p.x, s.grid.cell), y: snap(p.y, s.grid.cell) })
        return
      }

      if (g.mode === 'vertex') {
        pushOnce(g)
        const o = s.elements.find((v) => v.id === g.id)
        if (!o || (o.kind !== 'polygon' && o.kind !== 'polyline')) return
        const pts = o.pts.map((v, idx) => (idx === g.i ? { x: snap(p.x, s.grid.cell), y: snap(p.y, s.grid.cell) } : v))
        s.updateElement(g.id, { pts } as Partial<PlacedElement>)
        return
      }

      if (g.mode === 'imageMove') {
        pushOnce(g)
        // free (unsnapped) move — aerial photos rarely align to the grid
        s.updateRefImage({ x: g.imgStart.x + (p.x - g.start.x), y: g.imgStart.y + (p.y - g.start.y) })
        return
      }
    }

    const onUp = () => {
      if (gestureRef.current) {
        gestureRef.current = null
        useStore.getState().setGuides(null, null)
        if (controls && !(toolType === 'place' || toolType === 'draw')) controls.enabled = true
      }
    }

    const onDblClick = () => {
      const s = useStore.getState()
      if (s.tool.type === 'draw') s.finishDraw()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('dblclick', onDblClick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('dblclick', onDblClick)
      if (controls) controls.enabled = true
    }
  }, [gl, camera, controls, toolType, gestureTick])

  return null
}

const beginGesture = (g: Gesture, controls: { enabled?: boolean } | null) => {
  gestureRef.current = g
  if (controls) controls.enabled = false
}

// Ground: outside terrain, plot fill, boundary outline, snapping grid
function PlotGround() {
  const plot = useStore((s) => s.plot)
  const grid = useStore((s) => s.grid)
  const toolType = useStore((s) => s.tool.type)

  const shapeGeo = useMemo(
    () => (plot.pts.length >= 3 ? new THREE.ShapeGeometry(toShape(plot.pts)) : null),
    [plot.pts],
  )
  const outline = useMemo(
    () => plot.pts.map((p) => new THREE.Vector3(p.x, 0.06, p.y)).concat(plot.pts.length ? [new THREE.Vector3(plot.pts[0].x, 0.06, plot.pts[0].y)] : []),
    [plot.pts],
  )
  const gridGeo = useMemo(() => {
    const bb = bboxOf(plot.pts)
    const m = 20
    const x0 = Math.floor((bb.minX - m) / grid.cell) * grid.cell
    const x1 = bb.maxX + m
    const y0 = Math.floor((bb.minY - m) / grid.cell) * grid.cell
    const y1 = bb.maxY + m
    const pts: number[] = []
    for (let x = x0; x <= x1; x += grid.cell) pts.push(x, 0, y0, x, 0, y1)
    for (let y = y0; y <= y1; y += grid.cell) pts.push(x0, 0, y, x1, 0, y)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [plot.pts, grid.cell])

  return (
    <group>
      {/* surrounding terrain */}
      <mesh position={[0, -0.06, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#d6d2c6" />
      </mesh>
      {/* the land plot */}
      {shapeGeo && (
        <mesh geometry={shapeGeo} rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
          <meshStandardMaterial color="#efe9d8" />
        </mesh>
      )}
      {outline.length > 1 && (
        <Line points={outline} color={toolType === 'editPlot' ? '#ea580c' : '#8a8474'} lineWidth={toolType === 'editPlot' ? 3 : 2} dashed dashSize={2} gapSize={1.2} />
      )}
      {grid.visible && (
        <lineSegments geometry={gridGeo} position={[0, 0.03, 0]}>
          <lineBasicMaterial color="#aaa294" transparent opacity={0.35} />
        </lineSegments>
      )}
    </group>
  )
}

// The aerial-photo underlay: a textured plane flat on the ground, movable when
// unlocked, with adjustable opacity/size/rotation (AutoCAD attach-image style)
function RefImagePlane() {
  const refImage = useStore((s) => s.refImage)
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null
  const texture = useMemo(() => {
    if (!refImage?.dataUrl) return null
    const t = new THREE.TextureLoader().load(refImage.dataUrl)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
    // reload only when the image itself changes, not on move/resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refImage?.dataUrl])

  if (!refImage || !refImage.visible || !texture) return null
  const w = refImage.width
  const h = refImage.width * refImage.aspect

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (s.tool.type !== 'select' || e.button !== 0 || refImage.locked) return
    e.stopPropagation()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const p = new THREE.Vector3()
    const start = e.ray.intersectPlane(plane, p) ? { x: p.x, y: p.z } : { x: e.point.x, y: e.point.z }
    gestureRef.current = { mode: 'imageMove', start, imgStart: { x: refImage.x, y: refImage.y }, pushed: false }
    if (controls) controls.enabled = false
  }

  return (
    <group position={[refImage.x, 0.02, refImage.y]} rotation-y={(-refImage.rotation * Math.PI) / 180}>
      <mesh rotation-x={-Math.PI / 2} onPointerDown={onDown}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} transparent opacity={refImage.opacity} depthWrite={false} />
      </mesh>
      {!refImage.locked && (
        <Line
          points={[
            new THREE.Vector3(-w / 2, 0.05, -h / 2),
            new THREE.Vector3(w / 2, 0.05, -h / 2),
            new THREE.Vector3(w / 2, 0.05, h / 2),
            new THREE.Vector3(-w / 2, 0.05, h / 2),
            new THREE.Vector3(-w / 2, 0.05, -h / 2),
          ]}
          color="#f59e0b"
          lineWidth={2}
          dashed
          dashSize={2}
          gapSize={1.2}
        />
      )}
    </group>
  )
}

// Markers + rubber line while measuring a known distance on the photo
function CalibratePreview() {
  const tool = useStore((s) => s.tool)
  const ghost = useStore((s) => s.ghost)
  if (tool.type !== 'calibrate') return null
  const pts = [...tool.pts]
  if (ghost && pts.length === 1) pts.push(ghost)
  return (
    <group>
      {tool.pts.map((p, i) => (
        <mesh key={i} position={[p.x, 0.4, p.y]}>
          <sphereGeometry args={[0.7, 12, 10]} />
          <meshBasicMaterial color="#f59e0b" depthTest={false} />
        </mesh>
      ))}
      {pts.length === 2 && (
        <Line
          points={pts.map((p) => new THREE.Vector3(p.x, 0.4, p.y))}
          color="#f59e0b"
          lineWidth={3}
          dashed
          dashSize={1.5}
          gapSize={1}
        />
      )}
    </group>
  )
}

// Flat arrow on the ground pointing to true north (rotates with the scene)
function NorthArrow() {
  const plot = useStore((s) => s.plot)
  const bb = useMemo(() => bboxOf(plot.pts), [plot.pts])
  const na = (plot.northAngle * Math.PI) / 180
  const pos: [number, number, number] = [bb.maxX + 10, 0.05, bb.minY]
  return (
    <group position={pos} rotation-y={Math.PI / 2 - na}>
      {/* cone laid flat pointing along +x of this group */}
      <mesh rotation-z={-Math.PI / 2} position={[1.2, 0, 0]}>
        <coneGeometry args={[1.1, 2.6, 4]} />
        <meshStandardMaterial color="#b42318" />
      </mesh>
      <mesh rotation-z={-Math.PI / 2} position={[-1, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 2.4, 8]} />
        <meshStandardMaterial color="#b42318" />
      </mesh>
      <Html position={[-3.2, 0, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div className="north-label">N</div>
      </Html>
    </group>
  )
}

// Draggable vertex spheres + midpoint insert dots, used for the plot boundary
// (orange) and the selected polygon/polyline (blue)
function VertexHandles({
  pts,
  close,
  color,
  onVertexDown,
  onMidDown,
  onVertexDbl,
}: {
  pts: Vec2[]
  close: boolean
  color: string
  onVertexDown: (e: ThreeEvent<PointerEvent>, i: number) => void
  onMidDown: (e: ThreeEvent<PointerEvent>, i: number) => void
  onVertexDbl: (i: number) => void
}) {
  const zoom = useStore((s) => s.camZoom)
  const r = Math.min(2.2, Math.max(0.5, 9 / zoom))
  const n = close ? pts.length : pts.length - 1
  const mids: { p: Vec2; i: number }[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    mids.push({ p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, i })
  }
  return (
    <group>
      {mids.map(({ p, i }) => (
        <mesh key={`m${i}`} position={[p.x, 0.4, p.y]} onPointerDown={(e) => onMidDown(e, i)}>
          <sphereGeometry args={[r * 0.62, 10, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthTest={false} />
        </mesh>
      ))}
      {pts.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, 0.4, p.y]}
          onPointerDown={(e) => onVertexDown(e, i)}
          onDoubleClick={() => onVertexDbl(i)}
        >
          <sphereGeometry args={[r, 12, 10]} />
          <meshBasicMaterial color={color} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}

// Five arrows for the selected rect: W sides (red), D sides (blue), height (green)
function ResizeGizmo({ o }: { o: PlacedRect }) {
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null
  const def = defById(o.defId)
  const h = rectEffH(o, def)
  const start = (axis: 'x' | 'y', sign: 1 | -1) => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    beginGesture({ mode: 'resize', id: o.id, axis, sign, start: { ...o }, pushed: false }, controls)
  }
  const startH = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    beginGesture({ mode: 'height', id: o.id, pushed: false }, controls)
  }
  const yMid = Math.min(Math.max(h * 0.5, 0.4), 1.4)
  const zoom = useStore((s) => s.camZoom)
  const gs = Math.min(3, Math.max(0.8, 14 / zoom))
  return (
    <group position={[o.x, 0, o.y]} rotation-y={(-o.rot * Math.PI) / 180}>
      <ArrowHandle size={gs} color="#dc2626" pos={[o.w / 2 + 0.4, yMid, 0]} rot={[0, 0, -Math.PI / 2]} onDown={start('x', 1)} />
      <ArrowHandle size={gs} color="#dc2626" pos={[-o.w / 2 - 0.4, yMid, 0]} rot={[0, 0, Math.PI / 2]} onDown={start('x', -1)} />
      <ArrowHandle size={gs} color="#2563eb" pos={[0, yMid, o.d / 2 + 0.4]} rot={[Math.PI / 2, 0, 0]} onDown={start('y', 1)} />
      <ArrowHandle size={gs} color="#2563eb" pos={[0, yMid, -o.d / 2 - 0.4]} rot={[-Math.PI / 2, 0, 0]} onDown={start('y', -1)} />
      <ArrowHandle size={gs} color="#16a34a" pos={[0, h + 0.3, 0]} rot={[0, 0, 0]} onDown={startH} />
    </group>
  )
}

// Translucent preview of the element being placed
function Ghost() {
  const tool = useStore((s) => s.tool)
  const ghost = useStore((s) => s.ghost)
  const cell = useStore((s) => s.grid.cell)
  if (tool.type !== 'place' || !ghost) return null
  const def = tool.def
  const g = { x: snap(ghost.x, cell), y: snap(ghost.y, cell) }
  return (
    <group position={[g.x, 0, g.y]}>
      {def.geom === 'rect' ? (
        <mesh position={[0, (def.h ?? 4) / 2, 0]}>
          <boxGeometry args={[def.w ?? 10, def.h ?? 4, def.d ?? 10]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ) : (
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[def.radius ?? 1, def.radius ?? 1, 2, 14]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[def.w ?? (def.radius ?? 1) * 2, def.d ?? (def.radius ?? 1) * 2]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

// In-progress polygon / polyline: line through clicked points + rubber line to the cursor
function DrawPreview() {
  const tool = useStore((s) => s.tool)
  const ghost = useStore((s) => s.ghost)
  const cell = useStore((s) => s.grid.cell)
  if (tool.type !== 'draw') return null
  const pts = [...tool.pts]
  if (ghost) pts.push({ x: snap(ghost.x, cell), y: snap(ghost.y, cell) })
  if (tool.def.geom === 'polygon' && pts.length > 2) pts.push(pts[0])
  if (pts.length < 2) {
    return ghost ? (
      <mesh position={[snap(ghost.x, cell), 0.3, snap(ghost.y, cell)]}>
        <sphereGeometry args={[0.6, 10, 8]} />
        <meshBasicMaterial color={tool.def.color} />
      </mesh>
    ) : null
  }
  return (
    <group>
      <Line points={pts.map((p) => new THREE.Vector3(p.x, 0.35, p.y))} color={tool.def.color} lineWidth={3} />
      {tool.pts.map((p, i) => (
        <mesh key={i} position={[p.x, 0.35, p.y]}>
          <sphereGeometry args={[0.55, 10, 8]} />
          <meshBasicMaterial color={tool.def.color} />
        </mesh>
      ))}
    </group>
  )
}

// Pink alignment guide lines while dragging
function Guides() {
  const guides = useStore((s) => s.guides)
  const plotPts = useStore((s) => s.plot.pts)
  const bb = useMemo(() => bboxOf(plotPts), [plotPts])
  return (
    <group>
      {guides.gx !== null && (
        <Line
          points={[new THREE.Vector3(guides.gx, 0.1, bb.minY - 30), new THREE.Vector3(guides.gx, 0.1, bb.maxY + 30)]}
          color="#ec4899"
          lineWidth={2}
          dashed
          dashSize={1.2}
          gapSize={0.8}
        />
      )}
      {guides.gy !== null && (
        <Line
          points={[new THREE.Vector3(bb.minX - 30, 0.1, guides.gy), new THREE.Vector3(bb.maxX + 30, 0.1, guides.gy)]}
          color="#ec4899"
          lineWidth={2}
          dashed
          dashSize={1.2}
          gapSize={0.8}
        />
      )}
    </group>
  )
}

function SceneContent() {
  const plot = useStore((s) => s.plot)
  const elements = useStore((s) => s.elements)
  const hiddenLayers = useStore((s) => s.hiddenLayers)
  const selectedIds = useStore((s) => s.selectedIds)
  const tool = useStore((s) => s.tool)
  const showLabels = useStore((s) => s.showLabels)
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null

  const warnings = useMemo(() => {
    const set = new Set<string>()
    for (const el of elements) if (isOutsideBoundary(el, plot.pts)) set.add(el.id)
    return set
  }, [elements, plot.pts])

  const groundRay = (e: ThreeEvent<PointerEvent>): Vec2 => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const p = new THREE.Vector3()
    if (e.ray.intersectPlane(plane, p)) return { x: p.x, y: p.z }
    return { x: e.point.x, y: e.point.z }
  }

  const onElementDown = (e: ThreeEvent<PointerEvent>, el: PlacedElement) => {
    const s = useStore.getState()
    if (s.tool.type !== 'select' || e.button !== 0) return
    e.stopPropagation()
    const canDrag = s.moveArmed && s.selectedIds.includes(el.id)
    if (!canDrag) {
      s.select(el.id, (e as unknown as { shiftKey?: boolean }).shiftKey ?? e.nativeEvent?.shiftKey)
      return
    }
    const sel = s.selectedIds
    const selEls = s.elements.filter((v) => sel.includes(v.id))
    const bbox0 = bboxOf(
      selEls
        .map(elementBBox)
        .flatMap((b) => [
          { x: b.minX, y: b.minY },
          { x: b.maxX, y: b.maxY },
        ]),
    )
    const others = s.elements
      .filter((v) => !sel.includes(v.id) && !s.hiddenLayers.includes(v.layer))
      .map(elementBBox)
    beginGesture({ mode: 'move', start: groundRay(e), applied: { x: 0, y: 0 }, bbox0, others, pushed: false }, controls)
  }

  const onCatcherDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    const s = useStore.getState()
    const p = groundRay(e)
    if (s.tool.type === 'place') {
      s.commitPlace(p)
      return
    }
    if (s.tool.type === 'draw') {
      s.addDrawPoint(p)
      return
    }
    if (s.tool.type === 'calibrate') {
      const pts = [...s.tool.pts, p]
      if (pts.length < 2) {
        s.setTool({ type: 'calibrate', pts })
        return
      }
      // second click: ask for the real distance and rescale the photo
      const answer = window.prompt('ระยะจริงระหว่างสองจุดนี้ (เมตร) / Real distance between the two points (m):')
      const realDist = answer ? parseFloat(answer) : NaN
      if (!Number.isNaN(realDist) && realDist > 0) {
        s.calibrateRefImage(pts[0], pts[1], realDist)
      } else {
        s.setTool({ type: 'select' })
      }
      return
    }
    if (s.tool.type === 'select' && !gestureRef.current) s.select(null)
  }

  const onCatcherMove = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (s.tool.type === 'place' || s.tool.type === 'draw' || s.tool.type === 'calibrate') s.setGhost(groundRay(e))
  }

  const selectedRect =
    selectedIds.length === 1
      ? (elements.find((el) => el.id === selectedIds[0] && el.kind === 'rect') as PlacedRect | undefined)
      : undefined
  const selectedPoly =
    selectedIds.length === 1
      ? elements.find(
          (el) => el.id === selectedIds[0] && (el.kind === 'polygon' || el.kind === 'polyline'),
        )
      : undefined

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[80, 130, 50]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
        shadow-camera-near={1}
        shadow-camera-far={500}
        shadow-bias={-0.0004}
      />
      <hemisphereLight intensity={0.35} groundColor="#c8bfae" />

      <PlotGround />
      <RefImagePlane />
      <CalibratePreview />
      <NorthArrow />

      {LAYERS.filter((l) => !hiddenLayers.includes(l.id)).map((layer) => (
        <group key={layer.id}>
          {elements
            .filter((el) => el.layer === layer.id)
            .map((el) => (
              <ElementMesh
                key={el.id}
                el={el}
                selected={selectedIds.includes(el.id)}
                warning={warnings.has(el.id)}
                showLabels={showLabels}
                onDown={onElementDown}
              />
            ))}
        </group>
      ))}

      {selectedRect && tool.type === 'select' && <ResizeGizmo o={selectedRect} />}

      {selectedPoly && tool.type === 'select' && (selectedPoly.kind === 'polygon' || selectedPoly.kind === 'polyline') && (
        <VertexHandles
          pts={selectedPoly.pts}
          close={selectedPoly.kind === 'polygon'}
          color="#2563eb"
          onVertexDown={(e, i) => {
            if (e.button !== 0) return
            e.stopPropagation()
            beginGesture({ mode: 'vertex', id: selectedPoly.id, i, pushed: false }, controls)
          }}
          onMidDown={(e, i) => {
            if (e.button !== 0) return
            e.stopPropagation()
            const s = useStore.getState()
            const a = selectedPoly.pts[i]
            const b = selectedPoly.pts[(i + 1) % selectedPoly.pts.length]
            s.pushHistory()
            const pts = [...selectedPoly.pts]
            pts.splice(i + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
            s.updateElement(selectedPoly.id, { pts } as Partial<PlacedElement>)
            beginGesture({ mode: 'vertex', id: selectedPoly.id, i: i + 1, pushed: true }, controls)
          }}
          onVertexDbl={(i) => {
            const min = selectedPoly.kind === 'polygon' ? 3 : 2
            if (selectedPoly.pts.length <= min) return
            useStore
              .getState()
              .editElement(selectedPoly.id, { pts: selectedPoly.pts.filter((_, idx) => idx !== i) } as Partial<PlacedElement>)
          }}
        />
      )}

      {tool.type === 'editPlot' && (
        <VertexHandles
          pts={plot.pts}
          close
          color="#ea580c"
          onVertexDown={(e, i) => {
            if (e.button !== 0) return
            e.stopPropagation()
            beginGesture({ mode: 'plotVertex', i, pushed: false }, controls)
          }}
          onMidDown={(e, i) => {
            if (e.button !== 0) return
            e.stopPropagation()
            const s = useStore.getState()
            const a = s.plot.pts[i]
            const b = s.plot.pts[(i + 1) % s.plot.pts.length]
            s.insertPlotVertex(i, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
            beginGesture({ mode: 'plotVertex', i: i + 1, pushed: true }, controls)
          }}
          onVertexDbl={(i) => useStore.getState().deletePlotVertex(i)}
        />
      )}

      <Ghost />
      <DrawPreview />
      <Guides />

      {/* invisible catcher: clicks on empty ground place/draw/deselect */}
      <mesh
        position={[0, -0.02, 0]}
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

export function Scene() {
  const viewKey = useStore((s) => s.viewKey)
  const plot = useStore((s) => s.plot)
  const camZoom = useStore((s) => s.camZoom)
  const tool = useStore((s) => s.tool)
  const plotAreaSqm = useMemo(() => polygonArea(plot.pts), [plot.pts])
  const scaleLen = niceScaleLength(camZoom)

  const hint =
    tool.type === 'place'
      ? `คลิกพื้นเพื่อวาง ${tool.def.labelTh} · Esc ยกเลิก`
      : tool.type === 'draw'
        ? `คลิกเพิ่มจุด ${tool.def.labelTh} (${tool.pts.length} จุด) · ดับเบิลคลิก/Enter จบ · Esc ยกเลิก`
        : tool.type === 'editPlot'
          ? 'ลากจุดสีส้มแก้ขอบเขตแปลง · จุดขาวเพิ่มจุด · ดับเบิลคลิกลบจุด'
          : tool.type === 'calibrate'
            ? tool.pts.length === 0
              ? '📏 ปรับสเกลภาพ: คลิกจุดที่ 1 บนสิ่งที่รู้ระยะจริง (เช่น มุมรั้ว) · Esc ยกเลิก'
              : '📏 คลิกจุดที่ 2 แล้วกรอกระยะจริงเป็นเมตร'
            : null

  return (
    <div className="canvas-wrap">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        style={{ background: '#eceae4' }}
      >
        <CaptureBinder />
        <group key={`rig-${viewKey}`}>
          <CameraRig />
        </group>
        <ZoomTracker />
        <DragController />
        <SceneContent />
      </Canvas>

      <div className="scale-bar">
        <div className="sb-line" style={{ width: scaleLen * camZoom }} />
        <span>≈ {scaleLen} ม.</span>
      </div>
      <div className="area-chip">
        พื้นที่แปลง {fmt(plotAreaSqm)} ตร.ม. · {fmt(plotAreaSqm / 1600, 2)} ไร่ ({formatRai(plotAreaSqm)})
      </div>
      {hint && <div className="tool-hint">{hint}</div>}
    </div>
  )
}
