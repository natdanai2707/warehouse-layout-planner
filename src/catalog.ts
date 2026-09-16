import type { ElementDef, LayerId } from './types'

// Data-driven palette of site elements. Everything the renderer needs to know
// about a type lives in its entry — adding a new element type is ONE new row.
export const CATALOG: ElementDef[] = [
  // ---- buildings & structures ----
  { id: 'warehouse', labelTh: 'โกดัง', labelEn: 'Warehouse', layer: 'buildings', geom: 'rect', color: '#64748b', icon: '🏭', w: 18, d: 30, h: 8, roof: true, showArea: true, enterable: true },
  { id: 'factory', labelTh: 'โรงงาน', labelEn: 'Factory', layer: 'buildings', geom: 'rect', color: '#7c8794', icon: '🏗️', w: 24, d: 48, h: 10, roof: true, showArea: true, enterable: true },
  { id: 'office', labelTh: 'สำนักงาน', labelEn: 'Office', layer: 'buildings', geom: 'rect', color: '#0ea5e9', icon: '🏢', w: 8, d: 12, h: 7, showArea: true, enterable: true },
  { id: 'guardhouse', labelTh: 'ป้อมยาม', labelEn: 'Guard House', layer: 'buildings', geom: 'rect', color: '#f59e0b', icon: '💂', w: 3, d: 3, h: 3, roof: true },
  { id: 'coverway', labelTh: 'หลังคาทางเดิน', labelEn: 'Coverway / Canopy', layer: 'buildings', geom: 'rect', color: '#94a3b8', icon: '⛱️', w: 3, d: 12, h: 3.5, fillOpacity: 0.45 },
  { id: 'pumphouse', labelTh: 'โรงปั๊มน้ำ', labelEn: 'Pump House', layer: 'buildings', geom: 'rect', color: '#8b5cf6', icon: '⚙️', w: 4, d: 4, h: 3, roof: true },

  // A building that already exists on site: massing only, no interior. `h` is
  // the ridge, `eave` the side wall.
  { id: 'existing_factory', labelTh: 'โรงงานเดิม (ก้อนมวล)', labelEn: 'Existing Building', layer: 'buildings', geom: 'rect', color: '#e2e5e9', icon: '🏚️', w: 30, d: 18, h: 9, eave: 6, roof: true, showArea: true },
  { id: 'canopy_link', labelTh: 'หลังคาทางเชื่อมอาคาร', labelEn: 'Link Canopy', layer: 'buildings', geom: 'rect', color: '#9aa3ad', icon: '🌂', w: 12, d: 4, h: 3.5, fillOpacity: 0.45 },
  { id: 'smoking', labelTh: 'ศาลาสูบบุหรี่', labelEn: 'Smoking Shelter', layer: 'buildings', geom: 'rect', color: '#a8a29e', icon: '🚬', w: 3, d: 3, h: 2.6, roof: true },
  { id: 'waste_area', labelTh: 'จุดทิ้งขยะ / คัดแยก', labelEn: 'Waste Area', layer: 'buildings', geom: 'rect', color: '#84cc16', icon: '♻️', w: 4, d: 3, h: 2 },

  // ---- circulation ----
  { id: 'road', labelTh: 'ทางเดินรถ', labelEn: 'Vehicle Road', layer: 'circulation', geom: 'polyline', color: '#57534e', icon: '🛣️', lineWidth: 6, lineHeight: 0.08, centerline: true },
  { id: 'walkway', labelTh: 'ทางเดินเท้า', labelEn: 'Walkway', layer: 'circulation', geom: 'polyline', color: '#a8a29e', icon: '🚶', lineWidth: 1.5, lineHeight: 0.1 },
  { id: 'gate', labelTh: 'ประตูทางเข้า', labelEn: 'Gate / Entrance', layer: 'circulation', geom: 'rect', color: '#dc2626', icon: '🚧', w: 8, d: 0.5, h: 1.8, fillOpacity: 0.8 },
  { id: 'carpark', labelTh: 'ลานจอดรถ', labelEn: 'Car Park', layer: 'circulation', geom: 'rect', color: '#78716c', icon: '🅿️', w: 15, d: 10, h: 0.1, showArea: true },
  // drawn shapes: click the corners, double-click to finish
  { id: 'yard_concrete', labelTh: 'ลานคอนกรีต', labelEn: 'Concrete Apron', layer: 'circulation', geom: 'polygon', color: '#c9c5bc', icon: '⬜', polySize: { x: 20, y: 14 }, surface: 'concrete', showArea: true },
  { id: 'yard_rock', labelTh: 'ลานหินคลุก', labelEn: 'Crushed Rock Yard', layer: 'circulation', geom: 'polygon', color: '#a49d92', icon: '🪨', polySize: { x: 20, y: 14 }, surface: 'gravel', showArea: true },
  { id: 'road_concrete', labelTh: 'ถนนคอนกรีต', labelEn: 'Concrete Road', layer: 'circulation', geom: 'polyline', color: '#c4c0b7', icon: '🛤️', lineWidth: 6, lineHeight: 0.12, surface: 'concrete', centerline: true },
  { id: 'carport_roof', labelTh: 'หลังคาโรงจอดรถ', labelEn: 'Carport Roof', layer: 'buildings', geom: 'polygon', color: '#9aa3ad', icon: '🚙', polySize: { x: 15, y: 6 }, polyHeight: 3.0, posts: true, showArea: true },
  { id: 'canopy_shape', labelTh: 'หลังคาคลุมลาน (ลากรูป)', labelEn: 'Yard Canopy', layer: 'buildings', geom: 'polygon', color: '#b6bec7', icon: '⛱️', polySize: { x: 24, y: 12 }, polyHeight: 5.0, posts: true, showArea: true },
  { id: 'yard_steel', labelTh: 'ลานกองเหล็ก', labelEn: 'Steel Yard', layer: 'circulation', geom: 'polygon', color: '#8d8378', icon: '🧱', polySize: { x: 20, y: 10 }, showArea: true },
  { id: 'weighbridge', labelTh: 'เครื่องชั่งรถบรรทุก', labelEn: 'Weighbridge', layer: 'circulation', geom: 'rect', color: '#57534e', icon: '⚖️', w: 18, d: 3, h: 0.3 },
  { id: 'truck', labelTh: 'รถบรรทุก 6 ล้อ', labelEn: '6-Wheel Truck', layer: 'circulation', geom: 'rect', color: '#1d4ed8', icon: '🚚', w: 7.0, d: 2.4, h: 3.0 },
  { id: 'trailer', labelTh: 'รถเทรลเลอร์', labelEn: 'Trailer', layer: 'circulation', geom: 'rect', color: '#1e40af', icon: '🚛', w: 16, d: 2.5, h: 4.0 },
  { id: 'container', labelTh: 'ตู้คอนเทนเนอร์ 20 ฟุต', labelEn: '20 ft Container', layer: 'circulation', geom: 'rect', color: '#b45309', icon: '📦', w: 6.06, d: 2.44, h: 2.59 },
  { id: 'car', labelTh: 'รถยนต์', labelEn: 'Car', layer: 'circulation', geom: 'rect', color: '#5b7fb4', icon: '🚗', w: 4.6, d: 1.8, h: 1.5 },
  { id: 'moto', labelTh: 'รถจักรยานยนต์', labelEn: 'Motorcycle', layer: 'circulation', geom: 'rect', color: '#c2452f', icon: '🏍️', w: 2.1, d: 0.8, h: 1.2 },

  // ---- utilities & infrastructure ----
  { id: 'pole', labelTh: 'เสาไฟฟ้า', labelEn: 'Electric Pole', layer: 'utilities', geom: 'point', color: '#78716c', icon: '⚡', radius: 0.22, pointStyle: 'pole', pointHeight: 9 },
  { id: 'transformer', labelTh: 'หม้อแปลง', labelEn: 'Transformer', layer: 'utilities', geom: 'rect', color: '#eab308', icon: '🔌', w: 3, d: 2, h: 2.2 },
  { id: 'watertank', labelTh: 'ถังน้ำ (แนวตั้ง)', labelEn: 'Water Tank (vertical)', layer: 'utilities', geom: 'point', color: '#0891b2', icon: '💧', radius: 1.5, pointStyle: 'tank', pointHeight: 3.5 },
  { id: 'watertank_h', labelTh: 'ถังน้ำ (แนวนอน)', labelEn: 'Water Tank (horizontal)', layer: 'utilities', geom: 'point', color: '#0e7490', icon: '🛢️', radius: 1.2, pointStyle: 'tank_h', pointHeight: 5.0 },
  { id: 'champagnetank', labelTh: 'ถังแชมเปญ', labelEn: 'Elevated Tank', layer: 'utilities', geom: 'point', color: '#06b6d4', icon: '🍾', radius: 1.8, pointStyle: 'elevated', pointHeight: 12 },
  { id: 'pond', labelTh: 'บ่อหน่วงน้ำ', labelEn: 'Retention Pond', layer: 'utilities', geom: 'polygon', color: '#38bdf8', icon: '🌊', polySize: { x: 20, y: 15 }, showArea: true },
  { id: 'drain', labelTh: 'ท่อระบายน้ำ', labelEn: 'Drainage', layer: 'utilities', geom: 'polyline', color: '#6366f1', icon: '🕳️', lineWidth: 0.6, lineHeight: 0.12, flowArrows: true },

  // ---- landscape ----
  { id: 'lawn', labelTh: 'สนามหญ้า', labelEn: 'Lawn', layer: 'landscape', geom: 'polygon', color: '#4ade80', icon: '🌱', polySize: { x: 15, y: 10 }, showArea: true },
  { id: 'garden', labelTh: 'สวน', labelEn: 'Garden', layer: 'landscape', geom: 'polygon', color: '#22c55e', icon: '🌺', polySize: { x: 8, y: 6 }, showArea: true },
  { id: 'tree_big', labelTh: 'ต้นไม้ใหญ่', labelEn: 'Large Tree', layer: 'landscape', geom: 'point', color: '#16a34a', icon: '🌳', radius: 3, pointStyle: 'tree', pointHeight: 8 },
  { id: 'tree_small', labelTh: 'ต้นไม้เล็ก', labelEn: 'Small Tree', layer: 'landscape', geom: 'point', color: '#65a30d', icon: '🌿', radius: 1.2, pointStyle: 'tree', pointHeight: 3.2 },
  // outdoor steel sculpture — the kind a fabricator puts on show at the gate.
  // Every one is sized from w × d × h, so it can be dialled in after placing.
  { id: 'sculpt_beams', labelTh: 'ประติมากรรมเหล็ก — คานไขว้', labelEn: 'Steel Sculpture · Crossing Beams', layer: 'landscape', geom: 'rect', color: '#d92b1c', icon: '🗿', w: 9, d: 7, h: 7 },
  { id: 'sculpt_tree', labelTh: 'ประติมากรรมเหล็ก — ต้นไม้', labelEn: 'Steel Sculpture · Tree', layer: 'landscape', geom: 'rect', color: '#b9bfc6', icon: '🌴', w: 4, d: 4, h: 6 },
  { id: 'sculpt_figure', labelTh: 'ประติมากรรมเหล็ก — รูปคน', labelEn: 'Steel Sculpture · Figure', layer: 'landscape', geom: 'rect', color: '#aeb4ba', icon: '🧍', w: 1.6, d: 1.0, h: 4 },
  { id: 'sculpt_cubes', labelTh: 'ประติมากรรมเหล็ก — กล่องลอย', labelEn: 'Steel Sculpture · Cubes', layer: 'landscape', geom: 'rect', color: '#9aa2ad', icon: '🧊', w: 3, d: 3, h: 5 },
  { id: 'tree_cone', labelTh: 'ต้นสน', labelEn: 'Conifer', layer: 'landscape', geom: 'point', color: '#3f6d3a', icon: '🌲', radius: 1.4, pointStyle: 'tree_cone', pointHeight: 6 },
  { id: 'fence', labelTh: 'รั้ว', labelEn: 'Fence', layer: 'landscape', geom: 'polyline', color: '#854d0e', icon: '🚧', lineWidth: 0.15, lineHeight: 1.8, dashed: true },
]

export const defById = (id: string): ElementDef | undefined => CATALOG.find((d) => d.id === id)

export interface LayerInfo {
  id: LayerId
  labelTh: string
  labelEn: string
}

// Palette groups double as show/hide layers.
export const LAYERS: LayerInfo[] = [
  { id: 'landscape', labelTh: 'ภูมิทัศน์', labelEn: 'Landscape' },
  { id: 'circulation', labelTh: 'ถนน / ทางเดิน', labelEn: 'Circulation' },
  { id: 'buildings', labelTh: 'อาคาร', labelEn: 'Buildings' },
  { id: 'utilities', labelTh: 'สาธารณูปโภค', labelEn: 'Utilities' },
]

// Order layers appear in the palette (buildings first — the main objects).
export const PALETTE_ORDER: LayerId[] = ['buildings', 'circulation', 'utilities', 'landscape']

// handy for debugging / automated UI tests, mirroring window.__siteStore
declare global {
  interface Window {
    __siteCatalog?: typeof CATALOG
  }
}
if (typeof window !== 'undefined') window.__siteCatalog = CATALOG
