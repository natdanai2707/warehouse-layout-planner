import type { BuildingInterior } from './interior/types'

export type { BuildingInterior } from './interior/types'

// All coordinates and dimensions are real-world METERS.
// World axes: x → east (right), y → south (down on screen). North is -y at northAngle 0.

export interface Vec2 {
  x: number
  y: number
}

export type GeomKind = 'rect' | 'polygon' | 'polyline' | 'point'

export type LayerId = 'buildings' | 'circulation' | 'utilities' | 'landscape'

// One palette entry. Adding a new element type = adding one entry to CATALOG.
export interface ElementDef {
  id: string
  labelTh: string
  labelEn: string
  layer: LayerId
  geom: GeomKind
  color: string
  icon: string // emoji shown in the palette and on point markers
  w?: number // rect: default width (m)
  d?: number // rect: default depth (m)
  h?: number // rect: default height (m) for the 3D block
  roof?: boolean // rect: draw a low gable roof on top (warehouses)
  radius?: number // point: marker radius (m)
  /** point: 3D shape variant. 'tank' stands upright, 'tank_h' lies on saddles,
   *  'elevated' is a ball on a tower — both use `h` for the second dimension. */
  pointStyle?: 'tree' | 'tree_cone' | 'pole' | 'tank' | 'tank_h' | 'elevated'
  pointHeight?: number // point: default `h` — tower height, tank length, …
  lineWidth?: number // polyline: default width (m)
  lineHeight?: number // polyline: extrusion height (m); fences are tall, roads flat
  polySize?: Vec2 // polygon: default bounding size of the seeded shape (m)
  /** polygon: lift it into a canopy roof at this height (m) instead of lying flat. */
  polyHeight?: number
  /** polygon: stand a post under each corner (carports, walkway roofs). */
  posts?: boolean
  /** Ground finish drawn on the surface — a procedural texture, no image files. */
  surface?: 'concrete' | 'gravel' | 'grass'
  fillOpacity?: number // override the default fill opacity
  showArea?: boolean // print the footprint area on the element
  flowArrows?: boolean // polyline: draw flow-direction arrows (drains)
  dashed?: boolean // polyline: dashed stroke in the 2D plan export (fences)
  centerline?: boolean // polyline: dashed white centerline in the 2D plan export (roads)
  /** rect: a real building you can go inside and lay out (see BuildingInterior). */
  enterable?: boolean
  /** rect: eave height (m) for a massing block whose `h` is the ridge. */
  eave?: number
}

interface PlacedBase {
  id: string
  defId: string
  label: string
  layer: LayerId
  color: string
}

export interface PlacedRect extends PlacedBase {
  kind: 'rect'
  x: number // world center x (m)
  y: number // world center y (m)
  w: number
  d: number
  h?: number // building height (m); falls back to the catalog default
  rot: number // degrees, clockwise
  /**
   * Buildings only: the storeys, shell design and everything placed inside.
   * Interior coordinates are LOCAL to this rect (origin at its center, +x
   * along w, +z along d, before `rot`), so each building is independent.
   */
  interior?: BuildingInterior
}

export interface PlacedPolygon extends PlacedBase {
  kind: 'polygon'
  pts: Vec2[] // absolute world coordinates
  h?: number // canopy roofs: height of the underside (m); flat areas ignore it
}

export interface PlacedPolyline extends PlacedBase {
  kind: 'polyline'
  pts: Vec2[]
  width: number // stroke width (m)
}

export interface PlacedPoint extends PlacedBase {
  kind: 'point'
  x: number
  y: number
  radius: number // display radius (m)
  /** The second dimension: tower height for an elevated tank, body length for
   *  a horizontal one, overall height for a tree or a pole. */
  h?: number
}

export type PlacedElement = PlacedRect | PlacedPolygon | PlacedPolyline | PlacedPoint

/**
 * The land plot boundary — an INDEPENDENT layer. Elements never store
 * plot-relative coordinates: editing/resizing/rotating the plot only rewrites
 * `pts` (and the viewport framing) and must never touch element coordinates.
 */
export interface Plot {
  pts: Vec2[] // boundary polygon, world meters
  northAngle: number // degrees the north arrow is rotated clockwise from "up"
}

export interface GridConfig {
  cell: number // grid spacing (m)
  visible: boolean
}

/**
 * Reference underlay image (aerial photo of the real site), like AutoCAD's
 * attached image / Fusion 360's canvas: lies flat on the ground under the
 * layout, freely movable/scalable/rotatable, with adjustable transparency,
 * and re-calibratable against a known real-world distance at any time.
 */
export interface RefImage {
  dataUrl: string // the image itself (downscaled JPEG data URL, persisted)
  x: number // world center x (m)
  y: number // world center y (m)
  width: number // world width (m); height = width * aspect
  aspect: number // source image height / width
  rotation: number // degrees, clockwise
  opacity: number // 0..1
  visible: boolean
  locked: boolean // locked = clicks pass through, image cannot be dragged
}

export interface LayoutFile {
  version: number
  plot: Plot
  grid: GridConfig
  hiddenLayers: LayerId[]
  elements: PlacedElement[]
  refImage?: RefImage | null
}
