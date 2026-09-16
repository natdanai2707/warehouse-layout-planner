import { useStore } from '../store'
import { defById } from '../interior/catalog'
import { GROUND_FLOOR_ID } from '../interior/types'
import type { Placed } from '../interior/types'
import { fmt } from '../geometry'
import { activeBuildingOf } from './InteriorScene'
import { BuildingDesigner } from './BuildingDesigner'

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
        step={step ?? 0.1}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
    </label>
  )
}

const ROT_LABEL = ['เหนือ ↑', '45°', 'ตะวันตก ←', '135°', 'ใต้ ↓', '225°', 'ตะวันออก →', '315°']

function One({ o }: { o: Placed }) {
  const editInteriorObject = useStore((s) => s.editInteriorObject)
  const floors = useStore((s) => activeBuildingOf(s)?.interior?.floors ?? [])
  const def = defById(o.defId)
  const edit = (patch: Partial<Placed>) => editInteriorObject(o.id, patch)

  return (
    <>
      <div className="insp-type">
        {def?.labelTh} · {def?.labelEn}
      </div>
      <label className="insp-field">
        <span>ชื่อ / Label</span>
        <input type="text" value={o.label} onChange={(e) => edit({ label: e.target.value })} />
      </label>
      <div className="insp-grid">
        <Num label="กว้าง (ม.)" value={o.w} min={0.1} step={0.1} onChange={(w) => edit({ w })} />
        <Num label="ลึก (ม.)" value={o.d} min={0.1} step={0.1} onChange={(d) => edit({ d })} />
        <Num label={def?.note?.startsWith('H =') ? def.note : 'สูง (ม.)'} value={o.h} min={0.1} step={0.1} onChange={(h) => edit({ h })} />
        <Num label="X ในอาคาร (ม.)" value={o.x} step={0.1} onChange={(x) => edit({ x })} />
        <Num label="Z ในอาคาร (ม.)" value={o.z} step={0.1} onChange={(z) => edit({ z })} />
      </div>
      <label className="insp-field">
        <span>หัน / Facing</span>
        <select value={o.rot} onChange={(e) => edit({ rot: parseInt(e.target.value, 10) })}>
          {ROT_LABEL.map((l, i) => (
            <option key={i} value={i}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {floors.length > 1 && (
        <label className="insp-field">
          <span>ชั้น / Storey</span>
          <select value={o.floorId ?? GROUND_FLOOR_ID} onChange={(e) => edit({ floorId: e.target.value })}>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {o.category === 'window' && (
        <Num label="ระดับขอบล่าง / Sill (ม.)" value={o.sill ?? 0.9} min={0} step={0.1} onChange={(sill) => edit({ sill })} />
      )}
      {o.category === 'partition' && (
        <label className="insp-field">
          <span>ผิว / Finish</span>
          <select value={o.material ?? 'solid'} onChange={(e) => edit({ material: e.target.value === 'solid' ? undefined : 'glass' })}>
            <option value="solid">ทึบ</option>
            <option value="glass">กระจก</option>
          </select>
        </label>
      )}
      {o.defId === 'crane_eot' && (
        <div className="insp-readout">span {fmt(o.w)} ม. · ระดับราง +{fmt(o.h)} ม. — ลากลูกศรแดงปรับ span ลูกศรเขียวปรับระดับราง</div>
      )}
      <div className="insp-readout">พื้นที่ครอบครอง {fmt(o.w * o.d)} ตร.ม.</div>
    </>
  )
}

/** Storeys, slab level and shell settings for the building being worked on. */
function BuildingPanel() {
  const b = useStore(activeBuildingOf)
  const activeFloorId = useStore((s) => s.activeFloorId)
  const setActiveFloor = useStore((s) => s.setActiveFloor)
  const setFloorLevel = useStore((s) => s.setFloorLevel)
  const setBuildingBay = useStore((s) => s.setBuildingBay)
  const setShell = useStore((s) => s.setShell)
  const addFloor = useStore((s) => s.addFloor)
  const editFloor = useStore((s) => s.editFloor)
  const removeFloor = useStore((s) => s.removeFloor)
  const interiorCell = useStore((s) => s.interiorCell)
  const setInteriorCell = useStore((s) => s.setInteriorCell)
  if (!b || !b.interior) return null
  const iv = b.interior

  return (
    <section className="inspector">
      <h2>อาคาร / Building</h2>
      <div className="insp-type">
        {b.label} · {fmt(b.w)} × {fmt(b.d)} ม. · {fmt(b.w * b.d)} ตร.ม.
      </div>
      <div className="insp-grid">
        <Num label="ระดับพื้น +จากดิน (ม.)" value={iv.floorLevel} min={0} step={0.05} onChange={setFloorLevel} />
        <Num label="ความสูงผนัง (ม.)" value={iv.shell.eave} min={2} step={0.1} onChange={(eave) => setShell({ eave })} />
        <Num label="ระยะห่างเสา (ม.)" value={iv.bay ?? 0} min={0} step={0.5} onChange={setBuildingBay} />
        <Num label="ตารางสแนป (ม.)" value={interiorCell} min={0.1} step={0.1} onChange={setInteriorCell} />
      </div>
      <label className="insp-field">
        <span>เปลือกอาคาร / Shell</span>
        <select value={iv.shell.mode} onChange={(e) => setShell({ mode: parseInt(e.target.value, 10) })}>
          <option value={0}>ปิด (เห็นผังอย่างเดียว)</option>
          <option value={1}>โปร่ง</option>
          <option value={2}>ทึบ</option>
        </select>
      </label>

      <h3 className="insp-sub">ชั้น / Storeys</h3>
      {iv.floors.map((f) => (
        <div key={f.id} className={`floor-row${f.id === activeFloorId ? ' on' : ''}`}>
          <button className="floor-pick" onClick={() => setActiveFloor(f.id)}>
            {f.id === activeFloorId ? '●' : '○'} {f.name}
          </button>
          <Num label="ระดับพื้น (ม.)" value={f.base} min={0} step={0.1} onChange={(base) => editFloor(f.id, { base })} />
          <Num label="ความสูงโถง (ม.)" value={f.clear} min={1.8} step={0.1} onChange={(clear) => editFloor(f.id, { clear })} />
          {f.id !== GROUND_FLOOR_ID && (
            <button className="danger" onClick={() => removeFloor(f.id)}>
              🗑
            </button>
          )}
        </div>
      ))}
      <div className="insp-actions">
        <button onClick={addFloor}>+ เพิ่มชั้น</button>
      </div>
    </section>
  )
}

export function InteriorInspector() {
  const selectedIds = useStore((s) => s.selectedIds)
  const objects = useStore((s) => activeBuildingOf(s)?.interior?.objects ?? [])
  const rotateInteriorSelected = useStore((s) => s.rotateInteriorSelected)
  const duplicateInteriorSelected = useStore((s) => s.duplicateInteriorSelected)
  const removeInteriorSelected = useStore((s) => s.removeInteriorSelected)

  const selected = objects.filter((o) => selectedIds.includes(o.id))

  return (
    <>
      <section className="inspector">
        <h2>แก้ไข / Edit</h2>
        {selected.length === 0 && <p className="insp-empty">คลิกของในอาคารเพื่อแก้ไข</p>}
        {selected.length === 1 && <One o={selected[0]} />}
        {selected.length > 1 && <div className="insp-type">เลือกไว้ {selected.length} ชิ้น</div>}
        {selected.length > 0 && (
          <div className="insp-actions">
            <button onClick={rotateInteriorSelected}>↻ หมุน</button>
            <button onClick={duplicateInteriorSelected}>⧉ คัดลอก</button>
            <button className="danger" onClick={removeInteriorSelected}>
              🗑 ลบ
            </button>
          </div>
        )}
      </section>
      <BuildingPanel />
      <BuildingDesigner />
    </>
  )
}
