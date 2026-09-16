import { useRef } from 'react'
import { exportLayout, useStore } from '../store'
import type { LayoutFile } from '../types'
import { bboxOf, polygonArea, SQM_PER_RAI } from '../geometry'
import { downloadBlob, exportCsvFile, exportPngFile, exportSvgFile } from '../exporters'
import { activeBuildingOf } from './InteriorScene'

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  title,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  title?: string
}) {
  return (
    <label className="tb-field" title={title}>
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
    </label>
  )
}

/** Full screen — a phone's browser chrome eats a third of the viewport. */
function FullScreenButton() {
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }
  return (
    <button onClick={toggle} title="เต็มจอ">
      ⛶ เต็มจอ
    </button>
  )
}

/**
 * Toolbar while inside a building: which storey you are editing, the way back
 * out, and the view switches that still apply. The plot fields make no sense
 * in here, so they are replaced rather than disabled.
 */
function BuildingToolbar() {
  const b = useStore(activeBuildingOf)
  const activeFloorId = useStore((s) => s.activeFloorId)
  const showLabels = useStore((s) => s.showLabels)
  const gridVisible = useStore((s) => s.grid.visible)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const walking = useStore((s) => s.viewMode === 'walk')
  const s = useStore.getState
  const floors = b?.interior?.floors ?? []

  return (
    <header className="toolbar">
      <div className="tb-title">🏭 ในอาคาร · {b?.label ?? ''}</div>

      <div className="tb-group">
        <button className="save" onClick={() => s().exitBuilding()} title="กลับไปดูผังที่ดินทั้งหมด">
          ↩ ออกไปผังที่ดิน
        </button>
      </div>

      <div className="tb-group" title="ชั้นที่กำลังแก้ — ชั้นอื่นจะจางลง">
        <span className="tb-label">ชั้น</span>
        {floors.map((f) => (
          <button
            key={f.id}
            className={f.id === activeFloorId ? 'on' : ''}
            onClick={() => s().setActiveFloor(f.id)}
          >
            {f.name}
          </button>
        ))}
        <button onClick={() => s().addFloor()} title="เพิ่มชั้นบนสุด">
          + ชั้น
        </button>
      </div>

      <div className="tb-group">
        <button className={walking ? 'on' : ''} onClick={() => s().setViewMode(walking ? 'iso' : 'walk')} title="เดินดูภายในอาคารมุมมองบุคคลที่หนึ่ง">
          🚶 เดินชม
        </button>
        <button className={gridVisible ? 'on' : ''} onClick={() => s().toggleGridVisible()} title="G">
          ตาราง
        </button>
        <button className={showLabels ? 'on' : ''} onClick={() => s().toggleLabels()} title="L">
          ป้าย
        </button>
        <button onClick={() => s().resetView()} title="F — กลับมุมมองพอดีอาคาร">
          ⛶ พอดีจอ
        </button>
        <FullScreenButton />
      </div>

      <div className="tb-group">
        <button onClick={() => s().undo()} disabled={!canUndo} title="Ctrl+Z">
          ↶ เลิกทำ
        </button>
        <button onClick={() => s().redo()} disabled={!canRedo} title="Ctrl+Y">
          ↷ ทำซ้ำ
        </button>
      </div>
    </header>
  )
}

export function Toolbar() {
  const mode = useStore((s) => s.mode)
  if (mode === 'building') return <BuildingToolbar />
  return <SiteToolbar />
}

function SiteToolbar() {
  const plot = useStore((s) => s.plot)
  const grid = useStore((s) => s.grid)
  const tool = useStore((s) => s.tool)
  const showLabels = useStore((s) => s.showLabels)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const fileRef = useRef<HTMLInputElement>(null)

  const s = useStore.getState
  const bb = bboxOf(plot.pts)
  const plotW = bb.maxX - bb.minX
  const plotD = bb.maxY - bb.minY
  const areaSqm = polygonArea(plot.pts)

  const exportJson = () => {
    downloadBlob('site-layout.json', new Blob([JSON.stringify(exportLayout(), null, 2)], { type: 'application/json' }))
  }

  const onImportFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as LayoutFile
      s().importLayout(data)
    } catch {
      alert('ไฟล์ layout ไม่ถูกต้อง / Invalid layout JSON file')
    }
  }

  return (
    <header className="toolbar">
      <div className="tb-title">🏭 ผังโครงการโกดัง</div>

      <div className="tb-group" title="ปรับขนาดที่ดิน — วัตถุที่วางไว้จะไม่ขยับตาม">
        <NumberField
          label="กว้าง (ม.)"
          value={plotW}
          min={10}
          onChange={(v) => s().setPlotRect(v, plotD)}
          title="กำหนดขอบเขตเป็นสี่เหลี่ยมขนาดนี้ (วัตถุที่วางไว้ไม่ขยับ)"
        />
        <NumberField
          label="ลึก (ม.)"
          value={plotD}
          min={10}
          onChange={(v) => s().setPlotRect(plotW, v)}
          title="กำหนดขอบเขตเป็นสี่เหลี่ยมขนาดนี้ (วัตถุที่วางไว้ไม่ขยับ)"
        />
        <NumberField
          label="ไร่"
          value={areaSqm / SQM_PER_RAI}
          min={0.1}
          step={0.25}
          onChange={(v) => s().setPlotAreaSqm(v * SQM_PER_RAI)}
          title="กำหนดพื้นที่เป็นไร่ (สร้างแปลงจัตุรัส แล้วแก้รูปทรงต่อได้)"
        />
        <button
          className={tool.type === 'editPlot' ? 'on' : ''}
          onClick={() => s().setTool(tool.type === 'editPlot' ? { type: 'select' } : { type: 'editPlot' })}
          title="แก้ไขขอบเขตแปลงแบบอิสระ (ลาก/เพิ่ม/ลบจุด)"
        >
          ✏️ ขอบเขตแปลง
        </button>
        <button onClick={() => s().rotatePlot(15)} title="หมุนแปลง 15° (วัตถุไม่ขยับ)">
          ⟳ 15°
        </button>
      </div>

      <div className="tb-group">
        <label className="tb-field">
          <span>ตาราง (ม.)</span>
          <select value={grid.cell} onChange={(e) => s().setGridCell(parseFloat(e.target.value))}>
            <option value={1}>1</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </label>
        <NumberField label="ทิศเหนือ (°)" value={plot.northAngle} step={15} onChange={(v) => s().setNorthAngle(v)} />
        <button className={grid.visible ? 'on' : ''} onClick={() => s().toggleGridVisible()} title="G">
          ตาราง
        </button>
        <button className={showLabels ? 'on' : ''} onClick={() => s().toggleLabels()} title="L">
          ป้าย
        </button>
        <button onClick={() => s().resetView()} title="F — กลับมุมมองมาตรฐานเห็นทั้งแปลง">
          ⛶ พอดีจอ
        </button>
        <FullScreenButton />
      </div>

      <div className="tb-group">
        <button onClick={() => s().undo()} disabled={!canUndo} title="Ctrl+Z">
          ↶ เลิกทำ
        </button>
        <button onClick={() => s().redo()} disabled={!canRedo} title="Ctrl+Y">
          ↷ ทำซ้ำ
        </button>
      </div>

      <div className="tb-group">
        <button className="save" onClick={exportJson}>
          💾 บันทึก JSON
        </button>
        <button onClick={() => fileRef.current?.click()}>เปิดไฟล์</button>
        <button onClick={exportPngFile}>PNG</button>
        <button onClick={exportSvgFile}>SVG</button>
        <button onClick={exportCsvFile} title="ส่งออกรายการองค์ประกอบ (BoQ)">
          CSV
        </button>
        <button onClick={() => s().loadSample()} title="โหลดผังตัวอย่าง">
          ตัวอย่าง
        </button>
        <button
          className="danger"
          onClick={() => {
            if (confirm('ล้างผังทั้งหมด? / Clear the entire layout?')) s().clearAll()
          }}
        >
          ล้างผัง
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportFile(f)
            e.target.value = ''
          }}
        />
      </div>
    </header>
  )
}
