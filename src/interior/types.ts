/**
 * Interior planning model — ported from the climbing-gym planner and adapted
 * so it hangs off a SITE building instead of a single building at the origin.
 *
 * Local frame of a building: origin at the rect's center, +x along its width,
 * +z along its depth, BEFORE the site rotation `rot` is applied. y = 0 is the
 * finished floor of the ground storey. Everything in here is in meters.
 */

export type Category =
  // structure & enclosure
  | 'door'
  | 'window'
  | 'partition'
  | 'column'
  | 'mezzanine'
  | 'stairs'
  | 'ceiling'
  // factory
  | 'machine'
  | 'crane'
  | 'storage'
  | 'weld'
  // office
  | 'workstation'
  | 'room'
  | 'furniture'
  | 'fixture'
  // shared
  | 'zone'
  | 'reception'
  | 'hvac'
  | 'tech'
  | 'person'

/**
 * Where an item may go.
 *  - 'floor' sits on the floor slab of its storey, clamped inside the building
 *  - 'edge'  clings to a perimeter wall and turns to face inward (+z local)
 * Outdoor items are SITE elements in this app, so the gym's 'outdoor' rule is
 * gone: anything outside a building is planned at site level.
 */
export type Rule = 'floor' | 'edge'

export interface ObjectDef {
  id: string
  labelTh: string
  labelEn: string
  category: Category
  w: number // footprint width (m), local x
  d: number // footprint depth (m), local z
  h: number // height (m)
  color: string
  rule: Rule
  /** Fixed module: no resize arrows, no size fields. */
  fixed?: boolean
  /** Short note shown in the palette / inspector. */
  note?: string
}

export interface Placed {
  id: string
  defId: string
  label: string
  category: Category
  w: number
  d: number
  h: number
  x: number // local center x (m)
  z: number // local center z (m)
  rot: number // 0..7, times 45 degrees. 0 = north (-z), 2 = west, 4 = south, 6 = east
  color: string
  rule: Rule
  floorId?: string // which storey it belongs to; undefined = the ground storey
  material?: 'epdm' | 'concrete' | 'birch' | 'glass'
  sill?: number // glazed opening: bottom edge above the floor (m)
  eave?: number // massing block: wall height at the eaves; h is the ridge (m)
  text?: string // signage wording
  thick?: number // signage: letter stand-off (m)
  drop?: number // bulkhead: panel extent below its top edge (m)
  span?: number // crane: runway span (m) — w is the bridge length
  cap?: number // crane: rated capacity (t), printed on the bridge
}

/* ---------------------------------------------------------------- storeys */

/**
 * One storey of a building. `base` is the floor level above the building's own
 * slab, `clear` the height from that floor to the underside of the floor above
 * ("ความสูงโถง"). A partial storey (a mezzanine that covers only part of the
 * plan) lists its slabs; an empty/absent list means the storey is full-plan.
 */
export interface FloorDef {
  id: string
  name: string
  base: number
  clear: number
  slabs?: Array<{ x: number; z: number; w: number; d: number; rot: number }>
}

/* ------------------------------------------------------------------ shell */

export interface ShellConfig {
  mode: number // 0 = off, 1 = transparent, 2 = solid cladding
  eave: number // default side-wall height (m)
}

// 'shed' = one plane between the two eave heights. The legacy gym values
// normalize into 'shed' on load.
export type ShellRoof = 'gable' | 'shed' | 'slopeL' | 'slopeR' | 'flat'

/**
 * One zone of the building along its length. The cross-section is shaped in
 * the other dimension too: left/right wall heights are independent and a
 * gable's ridge can sit anywhere across the width — so a high crane bay can
 * sit next to a low office lean-to.
 */
export interface ShellSegment {
  len: number // meters along the building length (scaled to fit the footprint)
  eave?: number // legacy symmetric wall height (migrated to eaveL/eaveR)
  eaveL?: number // wall height on the -x side
  eaveR?: number // wall height on the +x side
  roof: ShellRoof
  ridgeX?: number // gable ridge across the width, 0..1 (0.5 = centered)
  rise: number // roof rise above the taller eave
  color: string // metal sheet tint
  clear?: boolean // translucent daylight sheeting
}

export type FacadeSide = 'N' | 'S' | 'E' | 'W'

// Free-shape glazing / cladding patch drawn on one facade (u along the wall, y up)
export interface FacadePanel {
  side: FacadeSide
  pts: Array<[number, number]>
  kind: 'glass' | 'clear' | 'solid'
  color?: string
}

// Canopy / awning attached to one side of the building
export interface CanopyDef {
  side: FacadeSide
  u0: number
  len: number
  depth: number
  h: number
  support: 'posts' | 'hung'
  material: 'metal' | 'canvas' | 'clear'
  color: string
}

export interface ShellDesign {
  segments: ShellSegment[]
  panels: FacadePanel[]
  canopies: CanopyDef[]
}

/* --------------------------------------------------------------- building */

/**
 * The interior payload carried by a SITE building element. Its footprint is
 * the site rect's w × d and its position/rotation the rect's x/y/rot, so
 * multiple independent buildings come for free.
 */
export interface BuildingInterior {
  /** Slab height above the surrounding site ground (m). Factory floors sit at
   *  truck-bed height (~1.2 m); an office slab is typically +0.15 m. */
  floorLevel: number
  shell: ShellConfig
  design: ShellDesign | null
  floors: FloorDef[]
  objects: Placed[]
  /** Column grid spacing along the length (m); 0 = don't draw one. */
  bay?: number
}

export const GROUND_FLOOR_ID = 'ground'

export const defaultFloors = (): FloorDef[] => [{ id: GROUND_FLOOR_ID, name: 'พื้นชั้น 1', base: 0, clear: 6 }]

export const defaultInterior = (): BuildingInterior => ({
  floorLevel: 0.15,
  shell: { mode: 2, eave: 6 },
  design: null,
  floors: defaultFloors(),
  objects: [],
})
