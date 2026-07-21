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
  pointStyle?: 'tree' | 'pole' | 'tank' | 'elevated' // point: 3D shape variant
  lineWidth?: number // polyline: default width (m)
  lineHeight?: number // polyline: extrusion height (m); fences are tall, roads flat
  polySize?: Vec2 // polygon: default bounding size of the seeded shape (m)
  fillOpacity?: number // override the default fill opacity
  showArea?: boolean // print the footprint area on the element
  flowArrows?: boolean // polyline: draw flow-direction arrows (drains)
  dashed?: boolean // polyline: dashed stroke in the 2D plan export (fences)
  centerline?: boolean // polyline: dashed white centerline in the 2D plan export (roads)
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
}

export interface PlacedPolygon extends PlacedBase {
  kind: 'polygon'
  pts: Vec2[] // absolute world coordinates
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

export interface LayoutFile {
  version: number
  plot: Plot
  grid: GridConfig
  hiddenLayers: LayerId[]
  elements: PlacedElement[]
}
