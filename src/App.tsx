import { useEffect, useRef, useState } from 'react'
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
import { screenRight, viewAxis } from './viewAxis'
import { walkInput, walkLook } from './components/WalkRig'

/**
 * Touch-only extras. The keyboard has had arrow nudging and WASD walking all
 * along, but the phone this is actually used on has neither arrow keys, nor a
 * Shift, nor a hover state — so everything here has an on-screen equivalent.
 */
const TOUCH = (() => {
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
})()

/** Arrow pad for nudging the selection, with the step size in the middle.
 *  Steps follow the SCREEN: ↑ pushes away from the camera whichever way the
 *  view is orbited. */
function NudgePad({ step, fine, onToggle }: { step: number; fine: boolean; onToggle: () => void }) {
  const go = (sx: number, sz: number) => () => {
    const r = screenRight()
    useStore.getState().nudge((viewAxis.fx * sz + r.x * sx) * step, (viewAxis.fz * sz + r.z * sx) * step)
  }
  return (
    <div className="nudge-pad" role="group" aria-label="ขยับชิ้นที่เลือก">
      <button className="np-up" onClick={go(0, 1)} aria-label="ขยับออกจากกล้อง">
        ↑
      </button>
      <button className="np-left" onClick={go(-1, 0)} aria-label="ขยับซ้าย">
        ←
      </button>
      <button className={`np-step${fine ? ' on' : ''}`} onClick={onToggle} title="ระยะต่อการกด — แตะเพื่อสลับ">
        {fine ? '10 ซม.' : `${step} ม.`}
      </button>
      <button className="np-right" onClick={go(1, 0)} aria-label="ขยับขวา">
        →
      </button>
      <button className="np-down" onClick={go(0, -1)} aria-label="ขยับเข้าหากล้อง">
        ↓
      </button>
    </div>
  )
}

/** On-screen joystick for walking: writes into a shared target the walk rig
 *  reads every frame. Used twice — left stick walks, right stick turns. */
function WalkJoystick({ target, look = false }: { target: { x: number; y: number }; look?: boolean }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const base = baseRef.current
    const knob = knobRef.current
    if (!base || !knob) return
    let pid = -1
    const R = 44
    const apply = (e: PointerEvent) => {
      const r = base.getBoundingClientRect()
      let dx = e.clientX - (r.left + r.width / 2)
      let dy = e.clientY - (r.top + r.height / 2)
      const l = Math.hypot(dx, dy)
      if (l > R) {
        dx = (dx / l) * R
        dy = (dy / l) * R
      }
      target.x = dx / R
      target.y = dy / R
      knob.style.transform = `translate(${dx}px, ${dy}px)`
    }
    const down = (e: PointerEvent) => {
      pid = e.pointerId
      base.setPointerCapture(pid)
      apply(e) // react at once, even to a tap-and-hold at the rim
      e.stopPropagation()
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return
      apply(e)
      e.stopPropagation()
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return
      pid = -1
      target.x = 0
      target.y = 0
      knob.style.transform = 'translate(0px, 0px)'
    }
    base.addEventListener('pointerdown', down)
    base.addEventListener('pointermove', move)
    base.addEventListener('pointerup', up)
    base.addEventListener('pointercancel', up)
    return () => {
      target.x = 0
      target.y = 0
      base.removeEventListener('pointerdown', down)
      base.removeEventListener('pointermove', move)
      base.removeEventListener('pointerup', up)
      base.removeEventListener('pointercancel', up)
    }
  }, [target])
  return (
    <div ref={baseRef} className={`walk-joystick${look ? ' look' : ''}`}>
      <div ref={knobRef} className="walk-knob">
        {look ? '⟲' : '✥'}
      </div>
    </div>
  )
}

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
  const gridCell = useStore((s) => s.grid.cell)
  const interiorCell = useStore((s) => s.interiorCell)
  const walking = useStore((s) => s.mode === 'building' && s.viewMode === 'walk')
  const setViewMode = useStore((s) => s.setViewMode)
  const inside = mode === 'building'
  // fine nudge is the touch stand-in for holding Shift with the arrow keys
  const [fineNudge, setFineNudge] = useState(false)
  const nudgeStep = fineNudge ? 0.1 : inside ? Math.max(0.1, interiorCell) : gridCell

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
      if (inBuilding && s.viewMode === 'walk') {
        // walking uses WASD / arrows to move; Esc steps back out
        if (e.key === 'Escape') s.setViewMode('iso')
        return
      }
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
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (s.selectedIds.length === 0) break
          e.preventDefault()
          const step = e.shiftKey ? 0.1 : inBuilding ? Math.max(0.1, s.interiorCell) : s.grid.cell
          const r = screenRight()
          const sz = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
          const sx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
          s.nudge((viewAxis.fx * sz + r.x * sx) * step, (viewAxis.fz * sz + r.z * sx) * step)
          break
        }
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
          {moveArmed && selectedIds.length > 0 && !walking && (
            <div className="move-hint">ลากชิ้นที่เลือกเพื่อย้าย (ปิดปุ่มย้ายเพื่อหมุนมุมมอง)</div>
          )}
          {/* nudge pad: the only way to move something by less than a drag on
              a phone, which has no arrow keys and no Shift */}
          {TOUCH && !walking && selectedIds.length > 0 && toolType === 'select' && (
            <NudgePad step={nudgeStep} fine={fineNudge} onToggle={() => setFineNudge(!fineNudge)} />
          )}
          {walking && (
            <>
              <button className="walk-exit" onClick={() => setViewMode('iso')}>
                ✕ ออกจากโหมดเดิน
              </button>
              {TOUCH && (
                <>
                  <WalkJoystick target={walkInput} />
                  <WalkJoystick target={walkLook} look />
                </>
              )}
            </>
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
