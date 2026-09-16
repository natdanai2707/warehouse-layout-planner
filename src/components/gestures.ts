import type { BBox } from '../geometry'
import type { PlacedRect, Vec2 } from '../types'
import type { Placed } from '../interior/types'

/**
 * The drag gesture in flight, shared by the site scene and the building
 * interior. Kept in a module of its own so both scenes can start a gesture
 * without importing each other.
 *
 * Site gestures work in world meters (x, y = south); the ones prefixed with
 * `i` work in the active building's LOCAL frame (x, z).
 */
export type Gesture =
  | { mode: 'move'; start: Vec2; applied: Vec2; bbox0: BBox; others: BBox[]; pushed: boolean }
  | { mode: 'resize'; id: string; axis: 'x' | 'y'; sign: 1 | -1; start: PlacedRect; pushed: boolean }
  | { mode: 'height'; id: string; pushed: boolean }
  | { mode: 'plotVertex'; i: number; pushed: boolean }
  | { mode: 'vertex'; id: string; i: number; pushed: boolean }
  | { mode: 'imageMove'; start: Vec2; imgStart: Vec2; pushed: boolean }
  | { mode: 'imove'; start: { x: number; z: number }; applied: { x: number; z: number }; pushed: boolean }
  | { mode: 'iresize'; id: string; axis: 'x' | 'z'; sign: 1 | -1; start: Placed; pushed: boolean }
  | { mode: 'iheight'; id: string; pushed: boolean }

export const gestureRef: { current: Gesture | null } = { current: null }

export const beginGesture = (g: Gesture, controls: { enabled?: boolean } | null) => {
  gestureRef.current = g
  if (controls) controls.enabled = false
}
