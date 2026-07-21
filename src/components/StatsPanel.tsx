import { useMemo } from 'react'
import { useStore } from '../store'
import { CATALOG } from '../catalog'
import { elementArea, elementLength, fmt, formatRai, polygonArea } from '../geometry'

export function StatsPanel() {
  const plot = useStore((s) => s.plot)
  const elements = useStore((s) => s.elements)

  const stats = useMemo(() => {
    const plotArea = polygonArea(plot.pts)
    let buildingArea = 0
    const byDef = new Map<string, { count: number; area: number; length: number }>()
    for (const el of elements) {
      const area = elementArea(el)
      if (el.layer === 'buildings') buildingArea += area
      const e = byDef.get(el.defId) ?? { count: 0, area: 0, length: 0 }
      e.count++
      e.area += area
      e.length += elementLength(el)
      byDef.set(el.defId, e)
    }
    return {
      plotArea,
      buildingArea,
      coverage: plotArea > 0 ? (buildingArea / plotArea) * 100 : 0,
      byDef,
    }
  }, [plot.pts, elements])

  return (
    <section className="stats">
      <h2>สรุปพื้นที่ / Summary</h2>
      <div className="stat-row">
        <span>พื้นที่แปลง</span>
        <b>{fmt(stats.plotArea)} ตร.ม.</b>
      </div>
      <div className="stat-row">
        <span>คิดเป็นไร่</span>
        <b>{formatRai(stats.plotArea)}</b>
      </div>
      <div className="stat-row">
        <span>พื้นที่อาคารรวม</span>
        <b>{fmt(stats.buildingArea)} ตร.ม.</b>
      </div>
      <div className="stat-row">
        <span>อัตราส่วนปกคลุม (Coverage)</span>
        <b>{stats.coverage.toFixed(1)} %</b>
      </div>
      {stats.byDef.size > 0 && (
        <>
          <h3>รายการองค์ประกอบ</h3>
          {CATALOG.filter((d) => stats.byDef.has(d.id)).map((d) => {
            const e = stats.byDef.get(d.id)!
            return (
              <div className="stat-row small" key={d.id}>
                <span>
                  {d.icon} {d.labelTh} × {e.count}
                </span>
                <b>
                  {e.area > 0 && `${fmt(e.area)} ตร.ม.`}
                  {e.length > 0 && `${fmt(e.length)} ม.`}
                </b>
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}
