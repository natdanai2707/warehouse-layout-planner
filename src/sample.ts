import type { LayoutFile } from './types'
import demo from '../sample/demo-layout.json'

// Demo project: an irregular ~5-rai plot with a row of rental warehouses,
// an office, gate + guard house, internal road, utilities and greenery.
// Loaded on first run (and via the "ตัวอย่าง" button). The JSON file is the
// single source of truth so the same file also documents the schema.
export const SAMPLE_LAYOUT = demo as unknown as LayoutFile
