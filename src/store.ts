import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ElementDef, GridConfig, LayerId, LayoutFile, PlacedElement, Plot, RefImage, Vec2 } from './types'
import { dist, makeSeedPolygon, polygonCentroid, rotateDeg, snap } from './geometry'
import { SAMPLE_LAYOUT } from './sample'
import type { BuildingInterior, FloorDef, ObjectDef as IObjectDef, Placed, ShellConfig, ShellDesign } from './interior/types'
import { GROUND_FLOOR_ID, defaultInterior } from './interior/types'
import { computeDrop, resolveAfterResize } from './interior/placement'
import type { Frame } from './interior/placement'

const STORAGE_KEY = 'warehouse-site-planner-v1'
export const FILE_VERSION = 1
const HISTORY_LIMIT = 100

let seq = 1
const uid = () => `el-${Date.now().toString(36)}-${seq++}`
const oid = () => `io-${Date.now().toString(36)}-${seq++}`

export const DEFAULT_PLOT: Plot = {
  pts: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 80 },
    { x: 0, y: 80 },
  ],
  northAngle: 0,
}

const DEFAULT_GRID: GridConfig = { cell: 5, visible: true }

// Undoable document state. View/tool/selection are deliberately NOT part of it.
interface Snapshot {
  plot: Plot
  elements: PlacedElement[]
  refImage: RefImage | null
}

export type Tool =
  | { type: 'select' }
  | { type: 'place'; def: ElementDef } // rect & point: ghost follows the cursor
  | { type: 'draw'; def: ElementDef; pts: Vec2[] } // polygon & polyline: click to add vertices
  | { type: 'editPlot' } // drag plot boundary vertices
  | { type: 'calibrate'; pts: Vec2[] } // ref image: click two points, enter real distance
  | { type: 'placeInterior'; def: IObjectDef } // inside a building: drop an item on the floor

/** Site view = the whole parcel. Building view = inside one building. */
export type Mode = 'site' | 'building'

interface SiteState {
  plot: Plot
  grid: GridConfig
  elements: PlacedElement[]
  hiddenLayers: LayerId[]
  refImage: RefImage | null

  selectedIds: string[]
  tool: Tool
  ghost: Vec2 | null // cursor position in world coords while placing/drawing
  guides: { gx: number | null; gy: number | null } // alignment guide lines while dragging
  showLabels: boolean

  // elements only drag when move mode is armed (prevents accidental touch-moves)
  moveArmed: boolean
  setMoveArmed: (v: boolean) => void

  // current orthographic camera zoom in px/m (for the scale bar overlay)
  camZoom: number
  setCamZoom: (v: number) => void

  past: Snapshot[]
  future: Snapshot[]

  // mobile drawers
  panelLeft: boolean
  panelRight: boolean
  setPanelLeft: (v: boolean) => void
  setPanelRight: (v: boolean) => void

  // history
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // settings
  setGridCell: (v: number) => void
  toggleGridVisible: () => void
  toggleLabels: () => void
  toggleLayer: (id: LayerId) => void

  // tools & placement
  setTool: (t: Tool) => void
  cancelTool: () => void
  startPlacing: (def: ElementDef) => void
  setGhost: (p: Vec2 | null) => void
  commitPlace: (p: Vec2) => void
  addDrawPoint: (p: Vec2) => void
  finishDraw: () => void

  // selection & editing
  select: (id: string | null, additive?: boolean) => void
  setSelection: (ids: string[]) => void
  updateElement: (id: string, patch: Partial<PlacedElement>) => void // gesture updates: NO history push
  editElement: (id: string, patch: Partial<PlacedElement>) => void // one-off edits: pushes history
  moveSelectedBy: (dx: number, dy: number) => void
  removeSelected: () => void
  duplicateSelected: () => void
  rotateSelected: () => void
  setGuides: (gx: number | null, gy: number | null) => void

  // reference aerial photo underlay
  attachRefImage: (img: RefImage) => void
  updateRefImage: (patch: Partial<RefImage>) => void // continuous edits (sliders/drag): no history push
  editRefImage: (patch: Partial<RefImage>) => void // discrete edits: pushes history
  removeRefImage: () => void
  calibrateRefImage: (p1: Vec2, p2: Vec2, realDist: number) => void

  // plot — these rewrite ONLY the boundary polygon; element coordinates are
  // absolute world meters and MUST stay untouched (see plotIndependence test)
  setPlotRect: (w: number, d: number) => void
  setPlotAreaSqm: (sqm: number) => void
  rotatePlot: (deg: number) => void
  setNorthAngle: (deg: number) => void
  movePlotVertex: (i: number, p: Vec2) => void
  insertPlotVertex: (i: number, p: Vec2) => void
  deletePlotVertex: (i: number) => void

  /* ---- inside a building ---- */
  mode: Mode
  activeBuildingId: string | null
  activeFloorId: string
  interiorCell: number // snapping grid inside a building (m) — finer than the site grid
  setInteriorCell: (v: number) => void
  enterBuilding: (id: string) => void
  exitBuilding: () => void
  setActiveFloor: (id: string) => void

  startPlacingInterior: (def: IObjectDef) => void
  commitPlaceInterior: (local: { x: number; z: number }) => void
  updateInteriorObject: (id: string, patch: Partial<Placed>) => void // gesture updates: no history
  editInteriorObject: (id: string, patch: Partial<Placed>) => void // one-off edits: pushes history
  moveInteriorSelectedBy: (dx: number, dz: number) => void
  removeInteriorSelected: () => void
  duplicateInteriorSelected: () => void
  rotateInteriorSelected: () => void

  setFloorLevel: (v: number) => void
  setBuildingBay: (v: number) => void
  setShell: (patch: Partial<ShellConfig>) => void
  setShellDesign: (design: ShellDesign | null) => void
  addFloor: () => void
  editFloor: (id: string, patch: Partial<FloorDef>) => void
  removeFloor: (id: string) => void

  // view: bumping viewKey remounts the camera rig, which re-frames the plot
  viewKey: number
  resetView: () => void

  // files
  importLayout: (file: LayoutFile) => void
  clearAll: () => void
  loadSample: () => void
}

function normalizeFile(file: LayoutFile): Pick<SiteState, 'plot' | 'grid' | 'elements' | 'hiddenLayers' | 'refImage'> {
  return {
    plot: { ...DEFAULT_PLOT, ...file.plot },
    grid: { ...DEFAULT_GRID, ...file.grid },
    elements: file.elements ?? [],
    hiddenLayers: file.hiddenLayers ?? [],
    refImage: file.refImage ?? null,
  }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as LayoutFile
      if (data && data.plot && Array.isArray(data.elements)) return normalizeFile(data)
    }
  } catch {
    // corrupt save — fall through to the sample
  }
  return normalizeFile(SAMPLE_LAYOUT)
}

const cloneSnap = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s))

/* ---------------------------------------------------- interior helpers ---- */

type Get = () => SiteState

/** The building currently being worked on, guaranteed to carry an interior. */
function activeBuilding(s: SiteState): (PlacedElement & { kind: 'rect'; interior: BuildingInterior }) | null {
  const el = s.elements.find((e) => e.id === s.activeBuildingId)
  if (!el || el.kind !== 'rect' || !el.interior) return null
  return el as PlacedElement & { kind: 'rect'; interior: BuildingInterior }
}

/** The placement frame of a building: its own footprint plus the interior grid. */
function frameOf(s: SiteState, b: { w: number; d: number }): Frame {
  return { width: b.w, length: b.d, cell: s.interiorCell }
}

/** Rewrite one building's interior in place, optionally pushing history first. */
function writeInterior(
  get: Get,
  id: string,
  fn: (iv: BuildingInterior) => BuildingInterior,
  history: boolean,
) {
  const s = get()
  if (history) s.pushHistory()
  s.updateElement(id, {
    interior: fn(
      (s.elements.find((e) => e.id === id) as { interior?: BuildingInterior } | undefined)?.interior ??
        defaultInterior(),
    ),
  } as Partial<PlacedElement>)
}

/**
 * A building's footprint changed on the site. Doors, windows and anything else
 * fitted to a perimeter wall travel with that wall; everything else keeps its
 * coordinates and is flagged instead of being shoved around.
 */
function reseatInterior(el: PlacedElement, cell: number): PlacedElement {
  if (el.kind !== 'rect' || !el.interior) return el
  const f: Frame = { width: el.w, length: el.d, cell }
  return {
    ...el,
    interior: {
      ...el.interior,
      objects: el.interior.objects.map((o) => (o.rule === 'edge' ? { ...o, ...resolveAfterResize(o, f) } : o)),
    },
  }
}

export const useStore = create<SiteState>()(
  subscribeWithSelector((set, get) => ({
    ...loadSaved(),
    selectedIds: [],
    tool: { type: 'select' },
    ghost: null,
    guides: { gx: null, gy: null },
    showLabels: true,
    moveArmed: false,
    setMoveArmed: (v) => set({ moveArmed: v }),
    camZoom: 6,
    setCamZoom: (v) => set({ camZoom: v }),
    past: [],
    future: [],

    panelLeft: false,
    panelRight: false,
    setPanelLeft: (v) => set({ panelLeft: v }),
    setPanelRight: (v) => set({ panelRight: v }),

    pushHistory: () => {
      const { plot, elements, refImage, past } = get()
      set({
        past: [...past.slice(-(HISTORY_LIMIT - 1)), cloneSnap({ plot, elements, refImage })],
        future: [],
      })
    },

    undo: () => {
      const { past, future, plot, elements, refImage } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      set({
        past: past.slice(0, -1),
        future: [...future, cloneSnap({ plot, elements, refImage })],
        plot: prev.plot,
        elements: prev.elements,
        refImage: prev.refImage ?? null,
        selectedIds: [],
      })
    },

    redo: () => {
      const { past, future, plot, elements, refImage } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      set({
        future: future.slice(0, -1),
        past: [...past, cloneSnap({ plot, elements, refImage })],
        plot: next.plot,
        elements: next.elements,
        refImage: next.refImage ?? null,
        selectedIds: [],
      })
    },

    setGridCell: (v) => set({ grid: { ...get().grid, cell: Math.max(0.5, v) } }),
    toggleGridVisible: () => set({ grid: { ...get().grid, visible: !get().grid.visible } }),
    toggleLabels: () => set({ showLabels: !get().showLabels }),
    toggleLayer: (id) => {
      const { hiddenLayers } = get()
      set({
        hiddenLayers: hiddenLayers.includes(id) ? hiddenLayers.filter((l) => l !== id) : [...hiddenLayers, id],
      })
    },

    setTool: (t) => set({ tool: t, ghost: null, selectedIds: [] }),
    cancelTool: () => set({ tool: { type: 'select' }, ghost: null }),

    startPlacing: (def) => {
      if (def.geom === 'polygon' || def.geom === 'polyline') {
        set({ tool: { type: 'draw', def, pts: [] }, ghost: null, selectedIds: [] })
      } else {
        set({ tool: { type: 'place', def }, ghost: null, selectedIds: [] })
      }
    },

    setGhost: (p) => set({ ghost: p }),

    commitPlace: (p) => {
      const { tool, grid } = get()
      if (tool.type !== 'place') return
      const def = tool.def
      const pos = { x: snap(p.x, grid.cell), y: snap(p.y, grid.cell) }
      get().pushHistory()
      let el: PlacedElement
      if (def.geom === 'rect') {
        el = {
          kind: 'rect', id: uid(), defId: def.id, label: def.labelTh, layer: def.layer, color: def.color,
          x: pos.x, y: pos.y, w: def.w ?? 10, d: def.d ?? 10, h: def.h ?? 4, rot: 0,
        }
      } else if (def.geom === 'point') {
        el = {
          kind: 'point', id: uid(), defId: def.id, label: def.labelTh, layer: def.layer, color: def.color,
          x: pos.x, y: pos.y, radius: def.radius ?? 1,
        }
      } else if (def.geom === 'polygon') {
        el = {
          kind: 'polygon', id: uid(), defId: def.id, label: def.labelTh, layer: def.layer, color: def.color,
          pts: makeSeedPolygon(pos, def.polySize ?? { x: 10, y: 10 }),
        }
      } else {
        return
      }
      // point markers stay in place mode so poles/trees can be dropped in a run
      const sticky = def.geom === 'point'
      set({
        elements: [...get().elements, el],
        selectedIds: sticky ? [] : [el.id],
        tool: sticky ? tool : { type: 'select' },
        ghost: sticky ? get().ghost : null,
      })
    },

    addDrawPoint: (p) => {
      const { tool, grid } = get()
      if (tool.type !== 'draw') return
      const pt = { x: snap(p.x, grid.cell), y: snap(p.y, grid.cell) }
      const last = tool.pts[tool.pts.length - 1]
      if (last && last.x === pt.x && last.y === pt.y) return
      set({ tool: { ...tool, pts: [...tool.pts, pt] } })
    },

    finishDraw: () => {
      const { tool } = get()
      if (tool.type !== 'draw') return
      const def = tool.def
      const minPts = def.geom === 'polygon' ? 3 : 2
      if (tool.pts.length < minPts) {
        set({ tool: { type: 'select' }, ghost: null })
        return
      }
      get().pushHistory()
      const base = { id: uid(), defId: def.id, label: def.labelTh, layer: def.layer, color: def.color }
      const el: PlacedElement =
        def.geom === 'polygon'
          ? { ...base, kind: 'polygon', pts: tool.pts }
          : { ...base, kind: 'polyline', pts: tool.pts, width: def.lineWidth ?? 1 }
      set({ elements: [...get().elements, el], tool: { type: 'select' }, ghost: null, selectedIds: [el.id] })
    },

    select: (id, additive) => {
      if (id === null) {
        set({ selectedIds: [] })
        return
      }
      const { selectedIds } = get()
      if (additive) {
        set({
          selectedIds: selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id],
        })
      } else {
        set({ selectedIds: selectedIds.includes(id) ? selectedIds : [id] })
      }
    },

    setSelection: (ids) => set({ selectedIds: ids }),

    updateElement: (id, patch) => {
      const cell = get().interiorCell
      const resizes = 'w' in patch || 'd' in patch
      set({
        elements: get().elements.map((el) => {
          if (el.id !== id) return el
          const next = { ...el, ...patch } as PlacedElement
          return resizes ? reseatInterior(next, cell) : next
        }),
      })
    },

    editElement: (id, patch) => {
      get().pushHistory()
      get().updateElement(id, patch)
    },

    moveSelectedBy: (dx, dy) => {
      const { selectedIds } = get()
      set({
        elements: get().elements.map((el) => {
          if (!selectedIds.includes(el.id)) return el
          if (el.kind === 'rect' || el.kind === 'point') return { ...el, x: el.x + dx, y: el.y + dy }
          return { ...el, pts: el.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
        }),
      })
    },

    removeSelected: () => {
      const { selectedIds } = get()
      if (selectedIds.length === 0) return
      get().pushHistory()
      set({ elements: get().elements.filter((el) => !selectedIds.includes(el.id)), selectedIds: [] })
    },

    duplicateSelected: () => {
      const { selectedIds, elements, grid } = get()
      if (selectedIds.length === 0) return
      get().pushHistory()
      const off = Math.max(grid.cell, 2)
      const copies = elements
        .filter((el) => selectedIds.includes(el.id))
        .map((el) => {
          const copy = JSON.parse(JSON.stringify(el)) as PlacedElement
          copy.id = uid()
          if (copy.kind === 'rect' || copy.kind === 'point') {
            copy.x += off
            copy.y += off
          } else {
            copy.pts = copy.pts.map((p) => ({ x: p.x + off, y: p.y + off }))
          }
          return copy
        })
      set({ elements: [...elements, ...copies], selectedIds: copies.map((c) => c.id) })
    },

    rotateSelected: () => {
      const { selectedIds } = get()
      if (selectedIds.length === 0) return
      get().pushHistory()
      set({
        elements: get().elements.map((el) => {
          if (!selectedIds.includes(el.id)) return el
          if (el.kind === 'rect') return { ...el, rot: (el.rot + 45) % 360 }
          if (el.kind === 'polygon' || el.kind === 'polyline') {
            const c = polygonCentroid(el.pts)
            return { ...el, pts: el.pts.map((p) => rotateDeg(p, c, 45)) }
          }
          return el
        }),
      })
    },

    setGuides: (gx, gy) => set({ guides: { gx, gy } }),

    // ---- reference aerial photo ----

    attachRefImage: (img) => {
      get().pushHistory()
      set({ refImage: img, tool: { type: 'select' } })
    },

    updateRefImage: (patch) => {
      const { refImage } = get()
      if (!refImage) return
      set({ refImage: { ...refImage, ...patch } })
    },

    editRefImage: (patch) => {
      if (!get().refImage) return
      get().pushHistory()
      get().updateRefImage(patch)
    },

    removeRefImage: () => {
      if (!get().refImage) return
      get().pushHistory()
      set({ refImage: null, tool: get().tool.type === 'calibrate' ? { type: 'select' } : get().tool })
    },

    // Two-point calibration (AutoCAD-style): the user clicked p1 and p2 on the
    // photo and told us the real distance between them. Rescale the image so
    // that distance is true, keeping the measured midpoint fixed in place.
    calibrateRefImage: (p1, p2, realDist) => {
      const { refImage } = get()
      if (!refImage) return
      const cur = dist(p1, p2)
      if (cur < 0.01 || realDist <= 0) return
      const factor = realDist / cur
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      get().pushHistory()
      set({
        refImage: {
          ...refImage,
          width: refImage.width * factor,
          x: mid.x + (refImage.x - mid.x) * factor,
          y: mid.y + (refImage.y - mid.y) * factor,
        },
        tool: { type: 'select' },
      })
    },

    // ---- plot actions: ONLY the boundary changes, elements are never touched ----

    setPlotRect: (w, d) => {
      const { plot } = get()
      const c = polygonCentroid(plot.pts)
      get().pushHistory()
      set({
        plot: {
          ...plot,
          pts: [
            { x: c.x - w / 2, y: c.y - d / 2 },
            { x: c.x + w / 2, y: c.y - d / 2 },
            { x: c.x + w / 2, y: c.y + d / 2 },
            { x: c.x - w / 2, y: c.y + d / 2 },
          ],
        },
      })
    },

    setPlotAreaSqm: (sqm) => {
      const side = Math.sqrt(Math.max(1, sqm))
      get().setPlotRect(side, side)
    },

    rotatePlot: (deg) => {
      const { plot } = get()
      const c = polygonCentroid(plot.pts)
      get().pushHistory()
      set({ plot: { ...plot, pts: plot.pts.map((p) => rotateDeg(p, c, deg)) } })
    },

    setNorthAngle: (deg) => set({ plot: { ...get().plot, northAngle: ((deg % 360) + 360) % 360 } }),

    movePlotVertex: (i, p) => {
      const { plot } = get()
      set({ plot: { ...plot, pts: plot.pts.map((v, idx) => (idx === i ? p : v)) } })
    },

    insertPlotVertex: (i, p) => {
      const { plot } = get()
      get().pushHistory()
      const pts = [...plot.pts]
      pts.splice(i + 1, 0, p)
      set({ plot: { ...plot, pts } })
    },

    deletePlotVertex: (i) => {
      const { plot } = get()
      if (plot.pts.length <= 3) return
      get().pushHistory()
      set({ plot: { ...plot, pts: plot.pts.filter((_, idx) => idx !== i) } })
    },

    /* -------------------------------------------------- inside a building */

    mode: 'site',
    activeBuildingId: null,
    activeFloorId: GROUND_FLOOR_ID,
    interiorCell: 0.5,
    setInteriorCell: (v) => set({ interiorCell: Math.max(0.1, v) }),

    enterBuilding: (id) => {
      const b = get().elements.find((el) => el.id === id)
      if (!b || b.kind !== 'rect') return
      if (!b.interior) {
        // seed from the massing already drawn on the site: eave and clear
        // height follow the block's height so the shell starts life right
        const seed = defaultInterior()
        const h = b.h ?? 8
        seed.shell.eave = Math.max(2.5, h - 1.5)
        seed.floors = [{ id: GROUND_FLOOR_ID, name: 'พื้นชั้น 1', base: 0, clear: Math.max(2.4, h - 1.5) }]
        seed.floorLevel = b.defId === 'office' ? 0.15 : 1.2
        get().pushHistory()
        get().updateElement(id, { interior: seed } as Partial<PlacedElement>)
      }
      set({
        mode: 'building',
        activeBuildingId: id,
        activeFloorId: GROUND_FLOOR_ID,
        selectedIds: [],
        tool: { type: 'select' },
        ghost: null,
        moveArmed: false,
        viewKey: get().viewKey + 1,
      })
    },

    exitBuilding: () =>
      set({
        mode: 'site',
        activeBuildingId: null,
        selectedIds: [],
        tool: { type: 'select' },
        ghost: null,
        moveArmed: false,
        viewKey: get().viewKey + 1,
      }),

    setActiveFloor: (id) => set({ activeFloorId: id, selectedIds: [] }),

    startPlacingInterior: (def) => set({ tool: { type: 'placeInterior', def }, ghost: null, selectedIds: [] }),

    commitPlaceInterior: (local) => {
      const { tool } = get()
      if (tool.type !== 'placeInterior') return
      const b = activeBuilding(get())
      if (!b) return
      const def = tool.def
      const drop = computeDrop({ w: def.w, d: def.d, rot: 0, rule: def.rule }, local.x, local.z, frameOf(get(), b))
      const o: Placed = {
        id: oid(),
        defId: def.id,
        label: def.labelTh,
        category: def.category,
        w: def.w,
        d: def.d,
        h: def.h,
        x: drop.x,
        z: drop.z,
        rot: drop.rot,
        color: def.color,
        rule: def.rule,
        floorId: get().activeFloorId,
      }
      if (def.category === 'window') o.sill = 0.9
      writeInterior(get, b.id, (iv) => ({ ...iv, objects: [...iv.objects, o] }), true)
      set({ selectedIds: [o.id], tool: { type: 'select' }, ghost: null })
    },

    updateInteriorObject: (id, patch) => {
      const b = activeBuilding(get())
      if (!b) return
      writeInterior(
        get,
        b.id,
        (iv) => ({ ...iv, objects: iv.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
        false,
      )
    },

    editInteriorObject: (id, patch) => {
      get().pushHistory()
      get().updateInteriorObject(id, patch)
    },

    moveInteriorSelectedBy: (dx, dz) => {
      const b = activeBuilding(get())
      if (!b) return
      const sel = get().selectedIds
      const f = frameOf(get(), b)
      writeInterior(
        get,
        b.id,
        (iv) => ({
          ...iv,
          objects: iv.objects.map((o) => {
            if (!sel.includes(o.id)) return o
            const drop = computeDrop(o, o.x + dx, o.z + dz, f, false)
            return { ...o, x: drop.x, z: drop.z, rot: drop.rot }
          }),
        }),
        false,
      )
    },

    removeInteriorSelected: () => {
      const b = activeBuilding(get())
      const sel = get().selectedIds
      if (!b || sel.length === 0) return
      writeInterior(get, b.id, (iv) => ({ ...iv, objects: iv.objects.filter((o) => !sel.includes(o.id)) }), true)
      set({ selectedIds: [] })
    },

    duplicateInteriorSelected: () => {
      const b = activeBuilding(get())
      const sel = get().selectedIds
      if (!b || sel.length === 0) return
      const f = frameOf(get(), b)
      const off = Math.max(f.cell, 1)
      const copies = b.interior!.objects
        .filter((o) => sel.includes(o.id))
        .map((o) => {
          const c: Placed = { ...JSON.parse(JSON.stringify(o)), id: oid() }
          const drop = computeDrop(c, c.x + off, c.z + off, f, false)
          c.x = drop.x
          c.z = drop.z
          return c
        })
      writeInterior(get, b.id, (iv) => ({ ...iv, objects: [...iv.objects, ...copies] }), true)
      set({ selectedIds: copies.map((c) => c.id) })
    },

    rotateInteriorSelected: () => {
      const b = activeBuilding(get())
      const sel = get().selectedIds
      if (!b || sel.length === 0) return
      const f = frameOf(get(), b)
      writeInterior(
        get,
        b.id,
        (iv) => ({
          ...iv,
          objects: iv.objects.map((o) => {
            if (!sel.includes(o.id)) return o
            // an edge item turns by staying on its wall: step it to the next one
            const rot = ((o.rot + (o.rule === 'edge' ? 2 : 1)) % 8) as number
            const turned = { ...o, rot }
            if (o.rule !== 'edge') {
              const drop = computeDrop(turned, o.x, o.z, f, false)
              return { ...turned, x: drop.x, z: drop.z }
            }
            const r = resolveAfterResize(turned, f)
            return { ...turned, ...r }
          }),
        }),
        true,
      )
    },

    setFloorLevel: (v) => {
      const b = activeBuilding(get())
      if (!b) return
      writeInterior(get, b.id, (iv) => ({ ...iv, floorLevel: Math.max(0, v) }), true)
    },

    setBuildingBay: (v) => {
      const b = activeBuilding(get())
      if (!b) return
      writeInterior(get, b.id, (iv) => ({ ...iv, bay: Math.max(0, v) }), true)
    },

    setShell: (patch) => {
      const b = activeBuilding(get())
      if (!b) return
      writeInterior(get, b.id, (iv) => ({ ...iv, shell: { ...iv.shell, ...patch } }), true)
    },

    setShellDesign: (design) => {
      const b = activeBuilding(get())
      if (!b) return
      writeInterior(get, b.id, (iv) => ({ ...iv, design }), true)
    },

    addFloor: () => {
      const b = activeBuilding(get())
      if (!b) return
      const floors = b.interior!.floors
      const top = floors[floors.length - 1]
      const fl: FloorDef = {
        id: `fl-${Date.now().toString(36)}-${seq++}`,
        name: `พื้นชั้น ${floors.length + 1}`,
        base: top.base + top.clear + 0.2,
        clear: Math.max(2.4, top.clear),
      }
      writeInterior(get, b.id, (iv) => ({ ...iv, floors: [...iv.floors, fl] }), true)
      set({ activeFloorId: fl.id, selectedIds: [] })
    },

    editFloor: (id, patch) => {
      const b = activeBuilding(get())
      if (!b) return
      writeInterior(
        get,
        b.id,
        (iv) => ({ ...iv, floors: iv.floors.map((fl) => (fl.id === id ? { ...fl, ...patch } : fl)) }),
        true,
      )
    },

    removeFloor: (id) => {
      const b = activeBuilding(get())
      if (!b || id === GROUND_FLOOR_ID || b.interior!.floors.length <= 1) return
      writeInterior(
        get,
        b.id,
        (iv) => ({
          ...iv,
          floors: iv.floors.filter((fl) => fl.id !== id),
          // things on the deleted storey come down to the ground floor rather
          // than vanishing with it
          objects: iv.objects.map((o) => (o.floorId === id ? { ...o, floorId: GROUND_FLOOR_ID } : o)),
        }),
        true,
      )
      if (get().activeFloorId === id) set({ activeFloorId: GROUND_FLOOR_ID, selectedIds: [] })
    },

    // ---- view ----

    viewKey: 0,
    resetView: () => set({ viewKey: get().viewKey + 1 }),

    // ---- files ----

    importLayout: (file) => {
      if (!file || !file.plot || !Array.isArray(file.elements)) throw new Error('Invalid layout file')
      get().pushHistory()
      set({ ...normalizeFile(file), selectedIds: [], tool: { type: 'select' }, ghost: null })
      get().resetView()
    },

    clearAll: () => {
      get().pushHistory()
      set({ elements: [], selectedIds: [], tool: { type: 'select' }, ghost: null })
    },

    loadSample: () => {
      get().importLayout(SAMPLE_LAYOUT)
    },
  })),
)

// ---- auto-save to localStorage (debounced), mirroring the gym planner ----
let saveTimer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe(
  (s) => [s.plot, s.grid, s.elements, s.hiddenLayers, s.refImage] as const,
  ([plot, grid, elements, hiddenLayers, refImage]) => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const file: LayoutFile = { version: FILE_VERSION, plot, grid, hiddenLayers, elements, refImage }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(file))
      } catch {
        // storage full (large photo) — save the layout without the image so
        // the user's actual work is never lost
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...file, refImage: null }))
        } catch {
          // storage unavailable — ignore
        }
      }
    }, 300)
  },
)

export function exportLayout(): LayoutFile {
  const { plot, grid, elements, hiddenLayers, refImage } = useStore.getState()
  return { version: FILE_VERSION, plot, grid, hiddenLayers, elements, refImage }
}

// handy for debugging / automated UI tests
declare global {
  interface Window {
    __siteStore?: typeof useStore
  }
}
if (typeof window !== 'undefined') window.__siteStore = useStore
