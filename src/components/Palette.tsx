import { CATALOG, LAYERS, PALETTE_ORDER } from '../catalog'
import type { ElementDef } from '../types'
import { useStore } from '../store'

function geomHint(def: ElementDef): string {
  switch (def.geom) {
    case 'rect':
      return `${def.w} × ${def.d} ม.`
    case 'point':
      return `รัศมี ${def.radius} ม.`
    case 'polyline':
      return `เส้น กว้าง ${def.lineWidth} ม.`
    case 'polygon':
      return 'พื้นที่ (วาดหลายจุด)'
  }
}

function PaletteCard({ def }: { def: ElementDef }) {
  const startPlacing = useStore((s) => s.startPlacing)
  const tool = useStore((s) => s.tool)
  const active = (tool.type === 'place' || tool.type === 'draw') && tool.def.id === def.id
  return (
    <div
      className={`palette-card${active ? ' active' : ''}`}
      onClick={() => startPlacing(def)}
      title={
        def.geom === 'polygon' || def.geom === 'polyline'
          ? 'คลิกบนแผนที่เพื่อเพิ่มจุด ดับเบิลคลิกเพื่อจบ (Esc ยกเลิก)'
          : 'คลิกบนแผนที่เพื่อวาง (Esc ยกเลิก)'
      }
    >
      <span className="swatch" style={{ background: def.color }}>
        {def.icon}
      </span>
      <div className="pc-text">
        <div className="pc-label">{def.labelTh}</div>
        <div className="pc-dims">
          {def.labelEn} · {geomHint(def)}
        </div>
      </div>
    </div>
  )
}

export function Palette() {
  const open = useStore((s) => s.panelLeft)
  const setPanelLeft = useStore((s) => s.setPanelLeft)
  return (
    <aside className={`palette${open ? ' open' : ''}`}>
      <button className="drawer-close" onClick={() => setPanelLeft(false)}>
        ✕ ปิด
      </button>
      <h2>องค์ประกอบ (คลิกเพื่อวาง)</h2>
      {PALETTE_ORDER.map((layerId) => {
        const layer = LAYERS.find((l) => l.id === layerId)!
        const defs = CATALOG.filter((d) => d.layer === layerId)
        if (defs.length === 0) return null
        return (
          <div key={layerId} className="palette-group">
            <h3>
              {layer.labelTh} · {layer.labelEn}
            </h3>
            {defs.map((d) => (
              <PaletteCard key={d.id} def={d} />
            ))}
          </div>
        )
      })}
      <div className="palette-hint">
        <b>คีย์ลัด:</b> R หมุน · D คัดลอก · Delete ลบ · Esc ยกเลิก · G ตาราง · L ป้าย · F มุมมองพอดี · Ctrl+Z เลิกทำ
      </div>
    </aside>
  )
}
