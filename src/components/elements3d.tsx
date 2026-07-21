import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { ElementDef, PlacedElement, PlacedPoint, PlacedPolygon, PlacedPolyline, PlacedRect, Vec2 } from '../types'
import { defById } from '../catalog'
import { elementBBox, fmt, polygonArea, polygonCentroid, polylineLength } from '../geometry'

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

function RectMesh({ el, def, tint }: { el: PlacedRect; def?: ElementDef; tint: string | null }) {
  const h = rectEffH(el, def)
  const color = tint ?? el.color
  const opacity = def?.fillOpacity ?? 1
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

function PolygonMesh({ el, tint }: { el: PlacedPolygon; tint: string | null }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(toShape(el.pts)), [el.pts])
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} receiveShadow>
      <meshStandardMaterial color={tint ?? el.color} side={THREE.DoubleSide} />
    </mesh>
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
          <meshStandardMaterial color={color} />
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

function PointMesh({ el, def, tint }: { el: PlacedPoint; def?: ElementDef; tint: string | null }) {
  const c = tint ?? el.color
  const r = el.radius
  switch (def?.pointStyle) {
    case 'tree':
      return (
        <group>
          <mesh position={[0, r * 0.45, 0]} castShadow>
            <cylinderGeometry args={[r * 0.09 + 0.04, r * 0.12 + 0.05, r * 0.9, 8]} />
            <meshStandardMaterial color="#7c5a3a" />
          </mesh>
          <mesh position={[0, r * 0.9 + r * 0.55, 0]} scale={[1, 0.85, 1]} castShadow>
            <sphereGeometry args={[r * 0.75, 14, 12]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      )
    case 'pole':
      return (
        <group>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.13, 6, 8]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[0, 5.7, 0]}>
            <boxGeometry args={[1.4, 0.12, 0.12]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      )
    case 'tank':
      return (
        <mesh position={[0, r * 0.55, 0]} castShadow>
          <cylinderGeometry args={[r, r, r * 1.1, 20]} />
          <meshStandardMaterial color={c} />
        </mesh>
      )
    case 'elevated':
      return (
        <group>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[r * 0.18, r * 0.25, 6, 10]} />
            <meshStandardMaterial color="#9aa2ad" />
          </mesh>
          <mesh position={[0, 6 + r * 0.8, 0]} castShadow>
            <sphereGeometry args={[r, 16, 14]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      )
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
    case 'point':
      return [el.x, def?.pointStyle === 'pole' ? 6.6 : def?.pointStyle === 'elevated' ? 8 : el.radius * 2 + 0.8, el.y]
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
      <PolygonMesh el={el} tint={tint} />
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
