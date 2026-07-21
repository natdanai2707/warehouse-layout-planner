# Warehouse Site Planner · ผังโครงการโกดังให้เช่า

Macro-scale 3D site layout planner for warehouse/industrial rental projects on a plot of land — arrange building footprints, roads, utilities and landscaping across the whole parcel, in real-world meters. Sister project of [climbing-gym-layout-planner](https://github.com/natdanai2707/climbing-gym-layout-planner) with the same stack and the same isometric dollhouse look: Vite · React · TypeScript · three.js (@react-three/fiber, @react-three/drei) · zustand.

## Features

- **Isometric 3D scene**: orbit/pan/zoom camera, warehouses with gable roofs, trees, tanks, poles as simple 3D massing models; drag-resize arrows (W/D/H) like the gym planner.
- **Free-form land plot**: enter width × depth in meters, enter area in ไร่, or reshape the boundary polygon by hand (drag vertices, white midpoints to add, double-click to delete). Rotate the plot, set the north bearing (3D north arrow on the ground). Live plot area in ตร.ม. and ไร่-งาน-ตร.วา.
- **Plot independence (the core guarantee)**: resizing or reshaping the plot NEVER moves, rescales or deletes placed objects — they keep absolute world coordinates. Anything left outside the new boundary is tinted red, only as a flag. Proven by `src/__tests__/plotIndependence.test.ts`.
- **Data-driven palette** (Thai/English): warehouses, office, guard house, coverway, pump house · roads/walkways with adjustable width, gates · poles, transformer, tanks, retention pond, drainage with flow arrows · lawns, gardens, trees, fences.
- **Editing**: click-to-place with ghost preview (point markers repeat for pole/tree runs), polyline/polygon drawing on the ground (click vertices, double-click/Enter to finish), armed move with grid + edge-alignment snapping, resize gizmo, 45° rotation, multi-select (Shift+click) group move, duplicate, undo/redo.
- **Layers**: show/hide buildings / circulation / utilities / landscape.
- **Live summary**: plot area (sqm + rai), total building footprint, coverage %, per-type counts.
- **Save/load/export**: debounced autosave to localStorage, versioned JSON save/load, PNG snapshot of the 3D view, generated top-down 2D plan SVG (north arrow, scale bar, area caption), CSV bill of quantities.

## Controls

Drag = orbit · right-drag / two-finger = pan · scroll = zoom · click = select (Shift adds) · **✥ ย้าย** arms drag-move for the selection

`R` rotate 45° · `D` duplicate · `Delete` remove · `Esc` cancel/deselect · `Enter` finish line/area · `G` grid · `L` labels · `F` reset view · `Ctrl+Z` / `Ctrl+Y` undo/redo

## Development

```bash
npm install
npm run dev    # dev server
npm test       # plot-independence tests (vitest)
npm run build  # type-check + production build
```

## JSON schema (`version: 1`)

A layout file (see [`sample/demo-layout.json`](sample/demo-layout.json) for a full example):

```jsonc
{
  "version": 1,
  "plot": {
    "pts": [{ "x": 0, "y": 0 }, ...],   // boundary polygon, world meters
    "northAngle": 0                      // north bearing, degrees clockwise
  },
  "grid": { "cell": 5, "visible": true }, // grid spacing in meters
  "hiddenLayers": [],                     // e.g. ["landscape"]
  "elements": [
    // rect: buildings, gates, transformers… (h = 3D height, optional)
    { "kind": "rect", "id": "…", "defId": "warehouse", "label": "โกดัง A",
      "layer": "buildings", "color": "#64748b",
      "x": 24, "y": 28, "w": 18, "d": 30, "h": 8, "rot": 0 },
    // polyline: roads, walkways, drains, fences (width in meters)
    { "kind": "polyline", "id": "…", "defId": "road", "label": "ถนนภายใน",
      "layer": "circulation", "color": "#57534e", "width": 8,
      "pts": [{ "x": 18, "y": 89 }, ...] },
    // polygon: ponds, lawns, gardens
    { "kind": "polygon", "id": "…", "defId": "pond", "label": "บ่อหน่วงน้ำ",
      "layer": "utilities", "color": "#38bdf8", "pts": [ ... ] },
    // point: poles, tanks, trees (radius = size in meters)
    { "kind": "point", "id": "…", "defId": "tree_big", "label": "ต้นไม้ใหญ่",
      "layer": "landscape", "color": "#16a34a", "x": 35, "y": 62, "radius": 3 }
  ]
}
```

All coordinates are absolute world meters (x → east, y → south; rendered in three.js as x/z with height on y). Element coordinates are **not** relative to the plot — that is what makes plot edits safe.

## Adding a new element type

One entry in `src/catalog.ts` — no renderer changes needed:

```ts
{ id: 'carpark', labelTh: 'ลานจอดรถ', labelEn: 'Car Park',
  layer: 'circulation', geom: 'rect', color: '#64748b', icon: '🅿️',
  w: 15, d: 10, h: 0.1, showArea: true },
```

Fields: `geom` is one of `rect` / `polygon` / `polyline` / `point`; defaults per geometry (`w`/`d`/`h`, `polySize`, `lineWidth`/`lineHeight`, `radius`); optional flags `roof` (gable roof), `pointStyle` (`tree` | `pole` | `tank` | `elevated` 3D shapes), `showArea`, `flowArrows` (drains), `dashed`/`centerline` (2D plan export styling), `fillOpacity`. The palette, 3D renderer, 2D plan export, stats and CSV all read from the catalog.

## Architecture notes

- `src/store.ts` — zustand store: document state (plot, elements), tools, selection, undo/redo snapshots, localStorage autosave, JSON import/export. Mirrors the gym planner's store; plot actions touch only `plot`.
- `src/geometry.ts` — pure helpers: shoelace area, point-in-polygon (with on-boundary tolerance), snapping, alignment, rai formatting.
- `src/components/Scene.tsx` — the r3f scene: isometric camera rig, drag controller (window-level raycasts, gym pattern), ground/plot/grid, gizmos, vertex handles, ghost previews.
- `src/components/elements3d.tsx` — data-driven 3D meshes per geometry kind (boxes + gable roofs, flat polygons, ribbon polylines, styled point markers).
- `src/exporters.ts` — PNG (WebGL snapshot), generated 2D plan SVG, CSV BoQ.
