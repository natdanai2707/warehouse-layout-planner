import { CATALOG, CATEGORY_LABELS, CATEGORY_ORDER } from '../interior/catalog'
import type { ObjectDef } from '../interior/types'
import { useStore } from '../store'

const CATEGORY_ICON: Record<string, string> = {
  machine: '⚙️',
  weld: '🔥',
  crane: '🏗️',
  storage: '🗄️',
  workstation: '🖥️',
  room: '🚪',
  zone: '🟩',
  reception: '🛎️',
  furniture: '🪑',
  fixture: '🧯',
  partition: '🧱',
  column: '⬛',
  mezzanine: '🪜',
  stairs: '🪜',
  ceiling: '⬜',
  hvac: '🌬️',
  tech: '💡',
  door: '🚪',
  window: '🪟',
  person: '🧍',
}

function Card({ def }: { def: ObjectDef }) {
  const startPlacingInterior = useStore((s) => s.startPlacingInterior)
  const tool = useStore((s) => s.tool)
  const active = tool.type === 'placeInterior' && tool.def.id === def.id
  return (
    <div
      className={`palette-card${active ? ' active' : ''}`}
      onClick={() => startPlacingInterior(def)}
      title={def.rule === 'edge' ? 'ติดผนังอาคาร — คลิกใกล้ผนังที่ต้องการ' : 'คลิกบนพื้นเพื่อวาง (Esc ยกเลิก)'}
    >
      <span className="swatch" style={{ background: def.color }}>
        {CATEGORY_ICON[def.category] ?? '▫️'}
      </span>
      <div className="pc-text">
        <div className="pc-label">{def.labelTh}</div>
        <div className="pc-dims">
          {def.w} × {def.d} × {def.h} ม.
          {def.rule === 'edge' ? ' · ติดผนัง' : ''}
        </div>
        {def.note && <div className="pc-dims">{def.note}</div>}
      </div>
    </div>
  )
}

export function InteriorPalette() {
  const open = useStore((s) => s.panelLeft)
  const setPanelLeft = useStore((s) => s.setPanelLeft)
  return (
    <aside className={`palette${open ? ' open' : ''}`}>
      <button className="drawer-close" onClick={() => setPanelLeft(false)}>
        ✕ ปิด
      </button>
      <h2>ของในอาคาร (คลิกเพื่อวาง)</h2>
      {CATEGORY_ORDER.map((cat) => {
        const defs = CATALOG.filter((d) => d.category === cat)
        if (defs.length === 0) return null
        return (
          <div key={cat} className="palette-group">
            <h3>
              {CATEGORY_ICON[cat] ?? ''} {CATEGORY_LABELS[cat]}
            </h3>
            {defs.map((d) => (
              <Card key={d.id} def={d} />
            ))}
          </div>
        )
      })}
      <div className="palette-hint">
        <b>คีย์ลัด:</b> R หมุน 45° · D คัดลอก · Delete ลบ · Esc ยกเลิก · G ตาราง · L ป้าย · F มุมมองพอดี
      </div>
    </aside>
  )
}
