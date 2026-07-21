import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ElementDef, GridConfig, LayerId, LayoutFile, PlacedElement, Plot, Vec2 } from './types'
import { bboxOf, makeSeedPolygon, polygonCentroid, rotateDeg, snap } from './geometry'
import { SAMPLE_LAYOUT } from './sample'

const STORAGE_KEY = 'warehouse-site-planner-v1'
export const FILE_VERSION = 1
const HISTORY_LIMIT = 100

let seq = 1
const uid = () => `el-${Date.now().toString(36)}-${seq++}`

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
}

export type Tool =
  | { type: 'select' }
  | { type: 'place'; def: ElementDef } // rect & point: ghost follows the cursor
  | { type: 'draw'; def: ElementDef; pts: Vec2[] } // polygon & polyline: click to add vertices
  | { type: 'editPlot' } // drag plot boundary vertices

export interface View {
  cx: number // world x at viewport center (m)
  cy: number
  ppm: number // pixels per meter (zoom)
}

interface SiteState {
  plot: Plot
  grid: GridConfig
  elements: PlacedElement[]
  hiddenLayers: LayerId[]

  selectedIds: string[]
  tool: Tool
  ghost: Vec2 | null // cursor position in world coords while placing/drawing
  guides: { gx: number | null; gy: number | null } // alignment guide lines while dragging
  view: View
  viewport: { w: number; h: number } // canvas size in px (for zoom-to-fit)
  showLabels: boolean

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

  // plot — these rewrite ONLY the boundary polygon; element coordinates are
  // absolute world meters and MUST stay untouched (see plotIndependence test)
  setPlotRect: (w: number, d: number) => void
  setPlotAreaSqm: (sqm: number) => void
  rotatePlot: (deg: number) => void
  setNorthAngle: (deg: number) => void
  movePlotVertex: (i: number, p: Vec2) => void
  insertPlotVertex: (i: number, p: Vec2) => void
  deletePlotVertex: (i: number) => void

  // view
  setView: (patch: Partial<View>) => void
  setViewport: (w: number, h: number) => void
  zoomFit: () => void

  // files
  importLayout: (file: LayoutFile) => void
  clearAll: () => void
  loadSample: () => void
}

function normalizeFile(file: LayoutFile): Pick<SiteState, 'plot' | 'grid' | 'elements' | 'hiddenLayers'> {
  return {
    plot: { ...DEFAULT_PLOT, ...file.plot },
    grid: { ...DEFAULT_GRID, ...file.grid },
    elements: file.elements ?? [],
    hiddenLayers: file.hiddenLayers ?? [],
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

export const useStore = create<SiteState>()(
  subscribeWithSelector((set, get) => ({
    ...loadSaved(),
    selectedIds: [],
    tool: { type: 'select' },
    ghost: null,
    guides: { gx: null, gy: null },
    view: { cx: 50, cy: 40, ppm: 6 },
    viewport: { w: 800, h: 600 },
    showLabels: true,
    past: [],
    future: [],

    panelLeft: false,
    panelRight: false,
    setPanelLeft: (v) => set({ panelLeft: v }),
    setPanelRight: (v) => set({ panelRight: v }),

    pushHistory: () => {
      const { plot, elements, past } = get()
      set({
        past: [...past.slice(-(HISTORY_LIMIT - 1)), cloneSnap({ plot, elements })],
        future: [],
      })
    },

    undo: () => {
      const { past, future, plot, elements } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      set({
        past: past.slice(0, -1),
        future: [...future, cloneSnap({ plot, elements })],
        plot: prev.plot,
        elements: prev.elements,
        selectedIds: [],
      })
    },

    redo: () => {
      const { past, future, plot, elements } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      set({
        future: future.slice(0, -1),
        past: [...past, cloneSnap({ plot, elements })],
        plot: next.plot,
        elements: next.elements,
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
          x: pos.x, y: pos.y, w: def.w ?? 10, d: def.d ?? 10, rot: 0,
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

    updateElement: (id, patch) =>
      set({
        elements: get().elements.map((el) => (el.id === id ? ({ ...el, ...patch } as PlacedElement) : el)),
      }),

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

    // ---- view ----

    setView: (patch) => set({ view: { ...get().view, ...patch } }),
    setViewport: (w, h) => set({ viewport: { w, h } }),

    zoomFit: () => {
      const { plot, viewport } = get()
      if (plot.pts.length === 0) return
      const bb = bboxOf(plot.pts)
      const w = Math.max(10, bb.maxX - bb.minX)
      const h = Math.max(10, bb.maxY - bb.minY)
      const ppm = Math.min((viewport.w * 0.85) / w, (viewport.h * 0.85) / h)
      set({ view: { cx: (bb.minX + bb.maxX) / 2, cy: (bb.minY + bb.maxY) / 2, ppm } })
    },

    // ---- files ----

    importLayout: (file) => {
      if (!file || !file.plot || !Array.isArray(file.elements)) throw new Error('Invalid layout file')
      get().pushHistory()
      set({ ...normalizeFile(file), selectedIds: [], tool: { type: 'select' }, ghost: null })
      get().zoomFit()
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
  (s) => [s.plot, s.grid, s.elements, s.hiddenLayers] as const,
  ([plot, grid, elements, hiddenLayers]) => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const file: LayoutFile = { version: FILE_VERSION, plot, grid, hiddenLayers, elements }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(file))
      } catch {
        // storage full / unavailable — ignore
      }
    }, 300)
  },
)

export function exportLayout(): LayoutFile {
  const { plot, grid, elements, hiddenLayers } = useStore.getState()
  return { version: FILE_VERSION, plot, grid, hiddenLayers, elements }
}

// handy for debugging / automated UI tests
declare global {
  interface Window {
    __siteStore?: typeof useStore
  }
}
if (typeof window !== 'undefined') window.__siteStore = useStore
