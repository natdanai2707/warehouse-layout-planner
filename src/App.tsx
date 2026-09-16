import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { Toolbar } from './components/Toolbar'
import { Palette } from './components/Palette'
import { InteriorPalette } from './components/InteriorPalette'
import { Inspector } from './components/Inspector'
import { InteriorInspector } from './components/InteriorInspector'
import { defById } from './catalog'
import { RefImagePanel } from './components/RefImagePanel'
import { LayersPanel } from './components/LayersPanel'
import { StatsPanel } from './components/StatsPanel'
import { useStore } from './store'

export default function App() {
  const panelLeft = useStore((s) => s.panelLeft)
  const panelRight = useStore((s) => s.panelRight)
  const setPanelLeft = useStore((s) => s.setPanelLeft)
  const setPanelRight = useStore((s) => s.setPanelRight)
  const selectedIds = useStore((s) => s.selectedIds)
  const toolType = useStore((s) => s.tool.type)
  const moveArmed = useStore((s) => s.moveArmed)
  const setMoveArmed = useStore((s) => s.setMoveArmed)
  const mode = useStore((s) => s.mode)
  const elements = useStore((s) => s.elements)
  const enterBuilding = useStore((s) => s.enterBuilding)
  const inside = mode === 'building'

  // the selected element, when it is a building you can go inside
  const enterable =
    !inside && selectedIds.length === 1
      ? elements.find((el) => el.id === selectedIds[0] && el.kind === 'rect' && defById(el.defId)?.enterable)
      : undefined

  const rotate = () => (inside ? useStore.getState().rotateInteriorSelected() : useStore.getState().rotateSelected())
  const remove = () => (inside ? useStore.getState().removeInteriorSelected() : useStore.getState().removeSelected())

  // Global shortcuts: R rotate 45°, D duplicate, Delete remove, Esc cancel,
  // Enter finish polyline/polygon, G grid, L labels, F zoom-fit, Ctrl+Z/Y undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      const s = useStore.getState()
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        s.redo()
        return
      }
      const inBuilding = s.mode === 'building'
      switch (e.key) {
        case 'r':
        case 'R':
          if (inBuilding) s.rotateInteriorSelected()
          else s.rotateSelected()
          break
        case 'd':
        case 'D':
          if (inBuilding) s.duplicateInteriorSelected()
          else s.duplicateSelected()
          break
        case 'Delete':
        case 'Backspace':
          if (inBuilding) s.removeInteriorSelected()
          else s.removeSelected()
          break
        case 'Enter':
          if (s.tool.type === 'draw') s.finishDraw()
          break
        case 'Escape':
          if (s.tool.type !== 'select') s.cancelTool()
          else if (s.selectedIds.length > 0) s.select(null)
          else if (inBuilding) s.exitBuilding()
          break
        case 'g':
        case 'G':
          s.toggleGridVisible()
          break
        case 'l':
        case 'L':
          s.toggleLabels()
          break
        case 'f':
        case 'F':
          s.resetView()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        {inside ? <InteriorPalette /> : <Palette />}
        <div className="canvas-col">
          <Scene />
          {/* mobile-only drawer toggles */}
          <div className="fab-row">
            <button onClick={() => setPanelLeft(!panelLeft)}>☰ องค์ประกอบ</button>
            <button onClick={() => setPanelRight(!panelRight)}>📋 แก้ไข / สรุป</button>
          </div>
          {/* quick actions for the selection — move must be armed explicitly so
              orbiting the camera can never drag objects around (gym pattern) */}
          {selectedIds.length > 0 && toolType === 'select' && (
            <div className="quick-actions">
              <button className={moveArmed ? 'on' : ''} onClick={() => setMoveArmed(!moveArmed)}>
                ✥ ย้าย{moveArmed ? ': เปิด' : ''}
              </button>
              <button onClick={rotate}>↻ {inside ? 'หมุน' : '45°'}</button>
              {enterable && (
                <button className="save" onClick={() => enterBuilding(enterable.id)}>
                  ⤓ เข้าไปในอาคาร
                </button>
              )}
              <button onClick={() => setPanelRight(true)}>✎ แก้ไข</button>
              <button className="danger" onClick={remove}>
                🗑 ลบ
              </button>
            </div>
          )}
          {moveArmed && selectedIds.length > 0 && (
            <div className="move-hint">ลากชิ้นที่เลือกเพื่อย้าย (ปิดปุ่มย้ายเพื่อหมุนมุมมอง)</div>
          )}
        </div>
        <div className={`right${panelRight ? ' open' : ''}`}>
          <button className="drawer-close" onClick={() => setPanelRight(false)}>
            ✕ ปิด
          </button>
          {inside ? (
            <InteriorInspector />
          ) : (
            <>
              <Inspector />
              <RefImagePanel />
              <LayersPanel />
              <StatsPanel />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
