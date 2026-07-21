import type { ThreeEvent } from '@react-three/fiber'

// One draggable dimension arrow (shaft + head + a fat invisible touch target).
// Same widget as the gym planner's resize gizmo.
export function ArrowHandle({
  color,
  pos,
  rot,
  onDown,
  size = 1,
}: {
  color: string
  pos: [number, number, number]
  rot: [number, number, number]
  onDown: (e: ThreeEvent<PointerEvent>) => void
  size?: number
}) {
  return (
    <group position={pos} rotation={rot} scale={size} onPointerDown={onDown}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.9, 8]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <coneGeometry args={[0.18, 0.45, 10]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </mesh>
      {/* generous invisible hit area for touch */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.55, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
