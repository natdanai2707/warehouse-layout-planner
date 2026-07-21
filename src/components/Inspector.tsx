import { useStore } from '../store'
import { defById } from '../catalog'
import { elementArea, elementLength, fmt } from '../geometry'
import type { PlacedElement } from '../types'

function Num({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
}) {
  return (
    <label className="insp-field">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        step={step ?? 1}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
    </label>
  )
}

function SingleInspector({ el }: { el: PlacedElement }) {
  const editElement = useStore((s) => s.editElement)
  const def = defById(el.defId)
  const edit = (patch: Partial<PlacedElement>) => editElement(el.id, patch)

  return (
    <>
      <div className="insp-type">
        {def?.icon} {def?.labelTh} · {def?.labelEn}
      </div>
      <label className="insp-field">
        <span>ชื่อ / Label</span>
        <input type="text" value={el.label} onChange={(e) => edit({ label: e.target.value })} />
      </label>
      {el.kind === 'rect' && (
        <>
          <div className="insp-grid">
            <Num label="กว้าง (ม.)" value={el.w} min={0.5} step={0.5} onChange={(w) => edit({ w })} />
            <Num label="ลึก (ม.)" value={el.d} min={0.5} step={0.5} onChange={(d) => edit({ d })} />
            <Num label="X (ม.)" value={el.x} onChange={(x) => edit({ x })} />
            <Num label="Y (ม.)" value={el.y} onChange={(y) => edit({ y })} />
            <Num label="หมุน (°)" value={el.rot} step={5} onChange={(rot) => edit({ rot: ((rot % 360) + 360) % 360 })} />
          </div>
          <div className="insp-readout">พื้นที่ {fmt(el.w * el.d)} ตร.ม.</div>
        </>
      )}
      {el.kind === 'point' && (
        <div className="insp-grid">
          <Num label="X (ม.)" value={el.x} onChange={(x) => edit({ x })} />
          <Num label="Y (ม.)" value={el.y} onChange={(y) => edit({ y })} />
          <Num label="รัศมี (ม.)" value={el.radius} min={0.2} step={0.2} onChange={(radius) => edit({ radius })} />
        </div>
      )}
      {el.kind === 'polyline' && (
        <>
          <div className="insp-grid">
            <Num label="กว้าง (ม.)" value={el.width} min={0.1} step={0.5} onChange={(width) => edit({ width })} />
          </div>
          <div className="insp-readout">
            ยาว {fmt(elementLength(el))} ม. · {el.pts.length} จุด — ลากจุดสีน้ำเงินเพื่อแก้แนว ดับเบิลคลิกจุดเพื่อลบ
          </div>
        </>
      )}
      {el.kind === 'polygon' && (
        <div className="insp-readout">
          พื้นที่ {fmt(elementArea(el))} ตร.ม. · {el.pts.length} จุด — ลากจุดสีน้ำเงินเพื่อแก้รูปทรง
        </div>
      )}
    </>
  )
}

export function Inspector() {
  const selectedIds = useStore((s) => s.selectedIds)
  const elements = useStore((s) => s.elements)
  const rotateSelected = useStore((s) => s.rotateSelected)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const removeSelected = useStore((s) => s.removeSelected)

  const selected = elements.filter((el) => selectedIds.includes(el.id))

  return (
    <section className="inspector">
      <h2>แก้ไข / Edit</h2>
      {selected.length === 0 && <p className="insp-empty">คลิกองค์ประกอบบนแผนที่เพื่อแก้ไข (Shift+คลิก เลือกหลายชิ้น)</p>}
      {selected.length === 1 && <SingleInspector el={selected[0]} />}
      {selected.length > 1 && <div className="insp-type">เลือกไว้ {selected.length} ชิ้น — ลากเพื่อย้ายพร้อมกัน</div>}
      {selected.length > 0 && (
        <div className="insp-actions">
          <button onClick={rotateSelected}>↻ หมุน 45°</button>
          <button onClick={duplicateSelected}>⧉ คัดลอก</button>
          <button className="danger" onClick={removeSelected}>
            🗑 ลบ
          </button>
        </div>
      )}
    </section>
  )
}
