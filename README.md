# Warehouse Site Planner · ผังโครงการโกดังให้เช่า

Macro-scale site layout planner for warehouse/industrial rental projects on a plot of land — arrange building footprints, roads, utilities and landscaping across the whole parcel, in real-world meters. Sister project of [climbing-gym-layout-planner](https://github.com/natdanai2707/climbing-gym-layout-planner): same stack (Vite · React · TypeScript · zustand), same store/persistence patterns, but rendered as a 2D SVG plan instead of the gym tool's 3D scene — a site plan needs polygon boundaries, polylines with widths, a north arrow, a scale bar and crisp SVG/PNG export, which a top-down SVG does natively.

## Features

- **Free-form land plot**: enter width × depth in meters, enter area in ไร่, or reshape the boundary polygon by hand (drag vertices, click edge midpoints to add, double-click to delete). Rotate the plot, set the north-arrow bearing. Live plot area in ตร.ม. and ไร่-งาน-ตร.วา.
- **Plot independence (the core guarantee)**: resizing or reshaping the plot NEVER moves, rescales or deletes placed objects — they keep absolute world coordinates. Anything left outside the new boundary is outlined red, only as a flag. Proven by `src/__tests__/plotIndependence.test.ts`.
- **Data-driven palette** (Thai/English): warehouses, office, guard house, coverway, pump house · roads/walkways with adjustable width, gates · poles, transformer, tanks, retention pond, drainage with flow arrows · lawns, gardens, trees, fences.
- **Editing**: click-to-place (point markers repeat for pole/tree runs), polyline/polygon drawing (click vertices, double-click/Enter to finish), move with grid + edge-alignment snapping, edge-anchored resize, free rotation, multi-select (Shift+click) group move, duplicate, undo/redo.
- **Layers**: show/hide buildings / circulation / utilities / landscape; layer order is z-order.
- **Live summary**: plot area (sqm + rai), total building footprint, coverage %, per-type counts.
- **Save/load/export**: debounced autosave to localStorage, versioned JSON save/load, PNG + SVG plan export (with north arrow, scale bar, area caption), CSV bill of quantities.

## Keyboard

`R` rotate 45° · `D` duplicate · `Delete` remove · `Esc` cancel/deselect · `Enter` finish line/area · `G` grid · `L` labels · `F` zoom to fit · `Ctrl+Z` / `Ctrl+Y` undo/redo · scroll to zoom, drag empty space to pan

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
    "northAngle": 0                      // north arrow bearing, degrees clockwise
  },
  "grid": { "cell": 5, "visible": true }, // grid spacing in meters
  "hiddenLayers": [],                     // e.g. ["landscape"]
  "elements": [
    // rect: buildings, gates, transformers…
    { "kind": "rect", "id": "…", "defId": "warehouse", "label": "โกดัง A",
      "layer": "buildings", "color": "#64748b",
      "x": 24, "y": 28, "w": 18, "d": 30, "rot": 0 },
    // polyline: roads, walkways, drains, fences (width in meters)
    { "kind": "polyline", "id": "…", "defId": "road", "label": "ถนนภายใน",
      "layer": "circulation", "color": "#57534e", "width": 8,
      "pts": [{ "x": 18, "y": 89 }, ...] },
    // polygon: ponds, lawns, gardens
    { "kind": "polygon", "id": "…", "defId": "pond", "label": "บ่อหน่วงน้ำ",
      "layer": "utilities", "color": "#38bdf8", "pts": [ ... ] },
    // point: poles, tanks, trees (radius = display size in meters)
    { "kind": "point", "id": "…", "defId": "tree_big", "label": "ต้นไม้ใหญ่",
      "layer": "landscape", "color": "#16a34a", "x": 35, "y": 62, "radius": 3 }
  ]
}
```

All coordinates are absolute world meters (x → east, y → south). Element coordinates are **not** relative to the plot — that is what makes plot edits safe.

## Adding a new element type

One entry in `src/catalog.ts` — no renderer changes needed:

```ts
{ id: 'carpark', labelTh: 'ลานจอดรถ', labelEn: 'Car Park',
  layer: 'circulation', geom: 'rect', color: '#64748b', icon: '🅿️',
  w: 15, d: 10, showArea: true },
```

Fields: `geom` is one of `rect` / `polygon` / `polyline` / `point`; defaults per geometry (`w`/`d`, `polySize`, `lineWidth`, `radius`); optional flags `showArea`, `flowArrows` (drains), `dashed` (fences), `centerline` (roads), `fillOpacity`. The palette, renderer, stats and CSV export all read from the catalog.

## Architecture notes

- `src/store.ts` — zustand store: document state (plot, elements), tools, selection, undo/redo snapshots, localStorage autosave, JSON import/export. Mirrors the gym planner's store; plot actions touch only `plot`.
- `src/geometry.ts` — pure helpers: shoelace area, point-in-polygon, snapping, alignment, rai formatting.
- `src/components/SiteCanvas.tsx` — SVG scene + all pointer interactions (pan/zoom, place, draw, move, resize, rotate, vertex/boundary editing). World group `#world` is in meters; exports reuse it directly.
- `src/exporters.ts` — SVG/PNG/CSV export built from the live SVG world group.
