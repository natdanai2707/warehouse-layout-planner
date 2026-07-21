import type { ElementDef, LayerId } from './types'

// Data-driven palette of site elements. Everything the renderer needs to know
// about a type lives in its entry — adding a new element type is ONE new row.
export const CATALOG: ElementDef[] = [
  // ---- buildings & structures ----
  { id: 'warehouse', labelTh: 'โกดัง', labelEn: 'Warehouse', layer: 'buildings', geom: 'rect', color: '#64748b', icon: '🏭', w: 18, d: 30, h: 8, roof: true, showArea: true },
  { id: 'office', labelTh: 'สำนักงาน', labelEn: 'Office', layer: 'buildings', geom: 'rect', color: '#0ea5e9', icon: '🏢', w: 8, d: 12, h: 7, showArea: true },
  { id: 'guardhouse', labelTh: 'ป้อมยาม', labelEn: 'Guard House', layer: 'buildings', geom: 'rect', color: '#f59e0b', icon: '💂', w: 3, d: 3, h: 3, roof: true },
  { id: 'coverway', labelTh: 'หลังคาทางเดิน', labelEn: 'Coverway / Canopy', layer: 'buildings', geom: 'rect', color: '#94a3b8', icon: '⛱️', w: 3, d: 12, h: 3.5, fillOpacity: 0.45 },
  { id: 'pumphouse', labelTh: 'โรงปั๊มน้ำ', labelEn: 'Pump House', layer: 'buildings', geom: 'rect', color: '#8b5cf6', icon: '⚙️', w: 4, d: 4, h: 3, roof: true },

  // ---- circulation ----
  { id: 'road', labelTh: 'ทางเดินรถ', labelEn: 'Vehicle Road', layer: 'circulation', geom: 'polyline', color: '#57534e', icon: '🛣️', lineWidth: 6, lineHeight: 0.08, centerline: true },
  { id: 'walkway', labelTh: 'ทางเดินเท้า', labelEn: 'Walkway', layer: 'circulation', geom: 'polyline', color: '#a8a29e', icon: '🚶', lineWidth: 1.5, lineHeight: 0.1 },
  { id: 'gate', labelTh: 'ประตูทางเข้า', labelEn: 'Gate / Entrance', layer: 'circulation', geom: 'rect', color: '#dc2626', icon: '🚧', w: 8, d: 0.5, h: 1.8, fillOpacity: 0.8 },

  // ---- utilities & infrastructure ----
  { id: 'pole', labelTh: 'เสาไฟฟ้า', labelEn: 'Electric Pole', layer: 'utilities', geom: 'point', color: '#78716c', icon: '⚡', radius: 0.5, pointStyle: 'pole' },
  { id: 'transformer', labelTh: 'หม้อแปลง', labelEn: 'Transformer', layer: 'utilities', geom: 'rect', color: '#eab308', icon: '🔌', w: 3, d: 2, h: 2.2 },
  { id: 'watertank', labelTh: 'ถังน้ำ', labelEn: 'Water Tank', layer: 'utilities', geom: 'point', color: '#0891b2', icon: '💧', radius: 3, pointStyle: 'tank' },
  { id: 'champagnetank', labelTh: 'ถังแชมเปญ', labelEn: 'Elevated Tank', layer: 'utilities', geom: 'point', color: '#06b6d4', icon: '🍾', radius: 1.5, pointStyle: 'elevated' },
  { id: 'pond', labelTh: 'บ่อหน่วงน้ำ', labelEn: 'Retention Pond', layer: 'utilities', geom: 'polygon', color: '#38bdf8', icon: '🌊', polySize: { x: 20, y: 15 }, showArea: true },
  { id: 'drain', labelTh: 'ท่อระบายน้ำ', labelEn: 'Drainage', layer: 'utilities', geom: 'polyline', color: '#6366f1', icon: '🕳️', lineWidth: 0.6, lineHeight: 0.12, flowArrows: true },

  // ---- landscape ----
  { id: 'lawn', labelTh: 'สนามหญ้า', labelEn: 'Lawn', layer: 'landscape', geom: 'polygon', color: '#4ade80', icon: '🌱', polySize: { x: 15, y: 10 }, showArea: true },
  { id: 'garden', labelTh: 'สวน', labelEn: 'Garden', layer: 'landscape', geom: 'polygon', color: '#22c55e', icon: '🌺', polySize: { x: 8, y: 6 }, showArea: true },
  { id: 'tree_big', labelTh: 'ต้นไม้ใหญ่', labelEn: 'Large Tree', layer: 'landscape', geom: 'point', color: '#16a34a', icon: '🌳', radius: 3, pointStyle: 'tree' },
  { id: 'tree_small', labelTh: 'ต้นไม้เล็ก', labelEn: 'Small Tree', layer: 'landscape', geom: 'point', color: '#65a30d', icon: '🌿', radius: 1.2, pointStyle: 'tree' },
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
