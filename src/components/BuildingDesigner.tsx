import { useStore } from '../store'
import type { ShellRoof, ShellSegment } from '../interior/types'
import { defaultShellDesign, normalizeSegment, segTop } from './BuildingShell'
import { fmt } from '../geometry'
import { activeBuildingOf } from './InteriorScene'

/**
 * Shape the building along its length. Each zone has its own wall heights on
 * the left and right, its own roof and its own cladding colour, so a tall
 * crane bay can sit next to a low office lean-to inside one building.
 *
 * Zone lengths are relative: they are scaled to fit the building's actual
 * length, so you set proportions here and the footprint on the site decides
 * the metres.
 */
export function BuildingDesigner() {
  const b = useStore(activeBuildingOf)
  const setShellDesign = useStore((s) => s.setShellDesign)
  if (!b || !b.interior) return null
  const iv = b.interior
  const design = iv.design ?? defaultShellDesign(b.d, iv.shell.eave, b.w)
  const total = design.segments.reduce((a, s) => a + Math.max(0.5, s.len), 0) || 1

  const write = (segments: ShellSegment[]) => setShellDesign({ ...design, segments })
  const edit = (i: number, patch: Partial<ShellSegment>) =>
    write(design.segments.map((s, k) => (k === i ? { ...s, ...patch } : s)))

  const add = () => {
    const last = design.segments[design.segments.length - 1]
    write([...design.segments, { ...last, len: Math.max(6, last.len) }])
  }

  const remove = (i: number) => {
    if (design.segments.length <= 1) return
    write(design.segments.filter((_, k) => k !== i))
  }

  return (
    <section className="inspector">
      <h2>เปลือกอาคาร / Shell Design</h2>
      <p className="insp-empty">
        แบ่งอาคารตามความยาวเป็นโซน · ความยาวโซนเป็นสัดส่วน ระบบจะย่อ/ขยายให้พอดีกับอาคาร {fmt(b.d)} ม.
      </p>
      {!iv.design && (
        <div className="insp-actions">
          <button className="save" onClick={() => setShellDesign(design)}>
            ✚ เริ่มออกแบบเปลือกอาคาร
          </button>
        </div>
      )}
      {iv.design &&
        design.segments.map((raw, i) => {
          const n = normalizeSegment(raw)
          const realLen = (n.len / total) * b.d
          return (
            <div key={i} className="seg-row">
              <div className="seg-head">
                โซน {i + 1} · {fmt(realLen)} ม. · สูงสุด {fmt(segTop(n))} ม.
                {design.segments.length > 1 && (
                  <button className="danger" onClick={() => remove(i)}>
                    🗑
                  </button>
                )}
              </div>
              <div className="insp-grid">
                <label className="insp-field">
                  <span>สัดส่วนความยาว</span>
                  <input
                    type="number"
                    value={Math.round(n.len * 10) / 10}
                    min={0.5}
                    step={0.5}
                    onChange={(e) => edit(i, { len: Math.max(0.5, parseFloat(e.target.value) || 0.5) })}
                  />
                </label>
                <label className="insp-field">
                  <span>ผนังซ้าย (ม.)</span>
                  <input
                    type="number"
                    value={Math.round(n.eaveL * 10) / 10}
                    min={2}
                    step={0.1}
                    onChange={(e) => edit(i, { eaveL: parseFloat(e.target.value) || n.eaveL, eave: undefined })}
                  />
                </label>
                <label className="insp-field">
                  <span>ผนังขวา (ม.)</span>
                  <input
                    type="number"
                    value={Math.round(n.eaveR * 10) / 10}
                    min={2}
                    step={0.1}
                    onChange={(e) => edit(i, { eaveR: parseFloat(e.target.value) || n.eaveR, eave: undefined })}
                  />
                </label>
                <label className="insp-field">
                  <span>หลังคา</span>
                  <select value={n.roof} onChange={(e) => edit(i, { roof: e.target.value as ShellRoof })}>
                    <option value="gable">จั่ว</option>
                    <option value="shed">เพิงหมาแหงน</option>
                  </select>
                </label>
                {n.roof === 'gable' && (
                  <>
                    <label className="insp-field">
                      <span>ชันหลังคา (ม.)</span>
                      <input
                        type="number"
                        value={Math.round(n.rise * 10) / 10}
                        min={0}
                        step={0.1}
                        onChange={(e) => edit(i, { rise: Math.max(0, parseFloat(e.target.value) || 0) })}
                      />
                    </label>
                    <label className="insp-field">
                      <span>ตำแหน่งสัน (0–1)</span>
                      <input
                        type="number"
                        value={Math.round(n.ridgeX * 100) / 100}
                        min={0.05}
                        max={0.95}
                        step={0.05}
                        onChange={(e) => edit(i, { ridgeX: parseFloat(e.target.value) || 0.5 })}
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="seg-foot">
                <label className="insp-field">
                  <span>สีเมทัลชีท</span>
                  <input type="color" value={n.color} onChange={(e) => edit(i, { color: e.target.value })} />
                </label>
                <label className="seg-check">
                  <input type="checkbox" checked={!!n.clear} onChange={(e) => edit(i, { clear: e.target.checked })} />
                  แผ่นโปร่งแสง (daylight)
                </label>
              </div>
            </div>
          )
        })}
      {iv.design && (
        <div className="insp-actions">
          <button onClick={add}>+ เพิ่มโซน</button>
          <button className="danger" onClick={() => setShellDesign(null)}>
            ล้างแบบเปลือก
          </button>
        </div>
      )}
    </section>
  )
}
