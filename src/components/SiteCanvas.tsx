import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import type { View } from '../store'
import { defById, LAYERS } from '../catalog'
import type { PlacedElement, PlacedRect, Vec2 } from '../types'
import {
  axisAlign,
  bboxOf,
  clamp,
  elementBBox,
  fmt,
  formatRai,
  isOutsideBoundary,
  niceScaleLength,
  polygonArea,
  polygonCentroid,
  polylineLength,
  snap,
} from '../geometry'

// Exposed so the toolbar can serialize the live SVG for PNG/SVG export
export const svgCapture: { el: SVGSVGElement | null } = { el: null }

const ptsToPath = (pts: Vec2[], close: boolean) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') + (close ? ' Z' : '')

type Gesture =
  | { mode: 'pan'; sx: number; sy: number; view0: View; moved: boolean }
  | {
      mode: 'move'
      start: Vec2
      applied: Vec2
      bbox0: { minX: number; minY: number; maxX: number; maxY: number }
      others: { minX: number; minY: number; maxX: number; maxY: number }[]
      pushed: boolean
    }
  | { mode: 'resize'; id: string; axis: 'x' | 'y'; sign: 1 | -1; start: PlacedRect; pushed: boolean }
  | { mode: 'rotate'; id: string; center: Vec2; pushed: boolean }
  | { mode: 'plotVertex'; i: number; pushed: boolean }
  | { mode: 'vertex'; id: string; i: number; pushed: boolean }

// ---------- individual element renderer ----------

function ElementNode({
  el,
  selected,
  warning,
  showLabels,
  ppm,
  onDown,
  onVertexDown,
  onVertexDblClick,
  onMidDown,
}: {
  el: PlacedElement
  selected: boolean
  warning: boolean
  showLabels: boolean
  ppm: number
  onDown: (e: React.PointerEvent, el: PlacedElement) => void
  onVertexDown: (e: React.PointerEvent, el: PlacedElement, i: number) => void
  onVertexDblClick: (el: PlacedElement, i: number) => void
  onMidDown: (e: React.PointerEvent, el: PlacedElement, i: number) => void
}) {
  const def = defById(el.defId)
  const hs = 5 / ppm // handle radius (constant screen size)
  const sel = selected ? (
    <VertexHandles
      pts={el.kind === 'polygon' || el.kind === 'polyline' ? el.pts : []}
      close={el.kind === 'polygon'}
      hs={hs}
      onDown={(e, i) => onVertexDown(e, el, i)}
      onDbl={(i) => onVertexDblClick(el, i)}
      onMid={(e, i) => onMidDown(e, el, i)}
    />
  ) : null

  const labelFs = 2.2
  const dimFs = 1.6
  const stroke = warning ? '#dc2626' : selected ? '#2563eb' : el.color
  const strokeW = warning || selected ? 3 / ppm : 1.5 / ppm

  if (el.kind === 'rect') {
    const area = el.w * el.d
    return (
      <g onPointerDown={(e) => onDown(e, el)} style={{ cursor: 'move' }}>
        <g transform={`translate(${el.x} ${el.y}) rotate(${el.rot})`}>
          <rect
            x={-el.w / 2}
            y={-el.d / 2}
            width={el.w}
            height={el.d}
            fill={el.color}
            fillOpacity={def?.fillOpacity ?? 0.55}
            stroke={stroke}
            strokeWidth={strokeW}
          />
        </g>
        {showLabels && (
          <g pointerEvents="none">
            <text x={el.x} y={el.y - 0.3} textAnchor="middle" fontSize={labelFs} fontWeight={700} fill="#1f2937">
              {el.label}
            </text>
            <text x={el.x} y={el.y + dimFs + 0.4} textAnchor="middle" fontSize={dimFs} fill="#374151">
              {fmt(el.w)}×{fmt(el.d)} ม.{def?.showArea ? ` · ${fmt(area)} ตร.ม.` : ''}
            </text>
          </g>
        )}
      </g>
    )
  }

  if (el.kind === 'polygon') {
    const c = polygonCentroid(el.pts)
    const area = polygonArea(el.pts)
    return (
      <g onPointerDown={(e) => onDown(e, el)} style={{ cursor: 'move' }}>
        <path
          d={ptsToPath(el.pts, true)}
          fill={el.color}
          fillOpacity={def?.fillOpacity ?? 0.45}
          stroke={stroke}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
        {showLabels && (
          <g pointerEvents="none">
            <text x={c.x} y={c.y - 0.3} textAnchor="middle" fontSize={labelFs} fontWeight={700} fill="#1f2937">
              {el.label}
            </text>
            {def?.showArea && (
              <text x={c.x} y={c.y + dimFs + 0.4} textAnchor="middle" fontSize={dimFs} fill="#374151">
                {fmt(area)} ตร.ม.
              </text>
            )}
          </g>
        )}
        {sel}
      </g>
    )
  }

  if (el.kind === 'polyline') {
    const len = polylineLength(el.pts)
    const mid = el.pts[Math.floor((el.pts.length - 1) / 2)]
    const d = ptsToPath(el.pts, false)
    return (
      <g onPointerDown={(e) => onDown(e, el)} style={{ cursor: 'move' }}>
        {/* generous invisible hit area */}
        <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(el.width, 12 / ppm)} />
        <path
          d={d}
          fill="none"
          stroke={el.color}
          strokeOpacity={0.8}
          strokeWidth={Math.max(el.width, 2 / ppm)}
          strokeLinejoin="round"
          strokeLinecap="butt"
          strokeDasharray={def?.dashed ? '1.5 1' : undefined}
        />
        {def?.centerline && el.width >= 3 && (
          <path d={d} fill="none" stroke="#ffffff" strokeWidth={0.25} strokeDasharray="3 2" pointerEvents="none" />
        )}
        {def?.flowArrows && (
          <path
            d={d}
            fill="none"
            stroke="none"
            markerMid="url(#flow-arrow)"
            markerEnd="url(#flow-arrow)"
            pointerEvents="none"
          />
        )}
        {(warning || selected) && (
          <path
            data-ui="1"
            d={d}
            fill="none"
            stroke={warning ? '#dc2626' : '#2563eb'}
            strokeWidth={2 / ppm}
            strokeDasharray={`${6 / ppm} ${4 / ppm}`}
            pointerEvents="none"
          />
        )}
        {showLabels && mid && (
          <text
            x={mid.x}
            y={mid.y - el.width / 2 - 0.6}
            textAnchor="middle"
            fontSize={dimFs}
            fontWeight={600}
            fill="#374151"
            pointerEvents="none"
          >
            {el.label} · {fmt(len)} ม. (กว้าง {fmt(el.width)} ม.)
          </text>
        )}
        {sel}
      </g>
    )
  }

  // point marker
  return (
    <g onPointerDown={(e) => onDown(e, el)} style={{ cursor: 'move' }}>
      <circle
        cx={el.x}
        cy={el.y}
        r={el.radius}
        fill={el.color}
        fillOpacity={0.3}
        stroke={stroke}
        strokeWidth={strokeW}
      />
      <text
        x={el.x}
        y={el.y + el.radius * 0.55}
        textAnchor="middle"
        fontSize={el.radius * 1.5}
        pointerEvents="none"
      >
        {def?.icon ?? '•'}
      </text>
      {selected && showLabels && (
        <text
          data-ui="1"
          x={el.x}
          y={el.y + el.radius + 1.8}
          textAnchor="middle"
          fontSize={1.6}
          fill="#374151"
          pointerEvents="none"
        >
          {el.label}
        </text>
      )}
    </g>
  )
}

function VertexHandles({
  pts,
  close,
  hs,
  onDown,
  onDbl,
  onMid,
}: {
  pts: Vec2[]
  close: boolean
  hs: number
  onDown: (e: React.PointerEvent, i: number) => void
  onDbl: (i: number) => void
  onMid: (e: React.PointerEvent, i: number) => void
}) {
  if (pts.length === 0) return null
  const mids: { p: Vec2; i: number }[] = []
  const n = close ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    mids.push({ p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, i })
  }
  return (
    <g data-ui="1">
      {mids.map(({ p, i }) => (
        <circle
          key={`m${i}`}
          cx={p.x}
          cy={p.y}
          r={hs * 0.7}
          fill="#ffffff"
          stroke="#2563eb"
          strokeWidth={hs / 4}
          opacity={0.7}
          style={{ cursor: 'copy' }}
          onPointerDown={(e) => onMid(e, i)}
        />
      ))}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={hs}
          fill="#2563eb"
          stroke="#ffffff"
          strokeWidth={hs / 3}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => onDown(e, i)}
          onDoubleClick={() => onDbl(i)}
        />
      ))}
    </g>
  )
}

// ---------- main canvas ----------

export function SiteCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const didFit = useRef(false)

  const plot = useStore((s) => s.plot)
  const grid = useStore((s) => s.grid)
  const elements = useStore((s) => s.elements)
  const hiddenLayers = useStore((s) => s.hiddenLayers)
  const selectedIds = useStore((s) => s.selectedIds)
  const tool = useStore((s) => s.tool)
  const ghost = useStore((s) => s.ghost)
  const guides = useStore((s) => s.guides)
  const view = useStore((s) => s.view)
  const viewport = useStore((s) => s.viewport)
  const showLabels = useStore((s) => s.showLabels)

  // viewport tracking + first-load zoom-to-fit
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      useStore.getState().setViewport(r.width, r.height)
      if (!didFit.current && r.width > 0) {
        didFit.current = true
        useStore.getState().zoomFit()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    svgCapture.el = svgRef.current
    return () => {
      svgCapture.el = null
    }
  }, [])

  // wheel zoom (non-passive listener so preventDefault works)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useStore.getState()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      const { cx, cy, ppm } = s.view
      const wx = (px - s.viewport.w / 2) / ppm + cx
      const wy = (py - s.viewport.h / 2) / ppm + cy
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const nppm = clamp(ppm * factor, 0.4, 300)
      s.setView({
        ppm: nppm,
        cx: wx - (px - s.viewport.w / 2) / nppm,
        cy: wy - (py - s.viewport.h / 2) / nppm,
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const toWorld = (clientX: number, clientY: number): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect()
    const s = useStore.getState()
    return {
      x: (clientX - r.left - s.viewport.w / 2) / s.view.ppm + s.view.cx,
      y: (clientY - r.top - s.viewport.h / 2) / s.view.ppm + s.view.cy,
    }
  }

  const capture = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const pushOnce = (g: { pushed: boolean }) => {
    if (!g.pushed) {
      g.pushed = true
      useStore.getState().pushHistory()
    }
  }

  // ---- gesture starts ----

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const s = useStore.getState()
    const p = toWorld(e.clientX, e.clientY)
    if (s.tool.type === 'place') {
      s.commitPlace(p)
      return
    }
    if (s.tool.type === 'draw') {
      s.addDrawPoint(p)
      return
    }
    capture(e)
    gestureRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, view0: { ...s.view }, moved: false }
  }

  const onElementDown = (e: React.PointerEvent, el: PlacedElement) => {
    const s = useStore.getState()
    if (s.tool.type !== 'select' || e.button !== 0) return
    e.stopPropagation()
    capture(e)
    s.select(el.id, e.shiftKey)
    const sel = useStore.getState().selectedIds
    const selEls = useStore.getState().elements.filter((v) => sel.includes(v.id))
    if (selEls.length === 0) return
    const bbox0 = bboxOf(selEls.flatMap((v) => [elementBBox(v)]).flatMap((b) => [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.maxY },
    ]))
    const others = useStore
      .getState()
      .elements.filter((v) => !sel.includes(v.id) && !useStore.getState().hiddenLayers.includes(v.layer))
      .map(elementBBox)
    const start = toWorld(e.clientX, e.clientY)
    gestureRef.current = { mode: 'move', start, applied: { x: 0, y: 0 }, bbox0, others, pushed: false }
  }

  const onResizeDown = (e: React.PointerEvent, r: PlacedRect, axis: 'x' | 'y', sign: 1 | -1) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    gestureRef.current = { mode: 'resize', id: r.id, axis, sign, start: { ...r }, pushed: false }
  }

  const onRotateDown = (e: React.PointerEvent, r: PlacedRect) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    gestureRef.current = { mode: 'rotate', id: r.id, center: { x: r.x, y: r.y }, pushed: false }
  }

  const onPlotVertexDown = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    gestureRef.current = { mode: 'plotVertex', i, pushed: false }
  }

  const onPlotMidDown = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    const s = useStore.getState()
    const a = s.plot.pts[i]
    const b = s.plot.pts[(i + 1) % s.plot.pts.length]
    s.insertPlotVertex(i, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    gestureRef.current = { mode: 'plotVertex', i: i + 1, pushed: true }
  }

  const onVertexDown = (e: React.PointerEvent, el: PlacedElement, i: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    gestureRef.current = { mode: 'vertex', id: el.id, i, pushed: false }
  }

  const onMidDown = (e: React.PointerEvent, el: PlacedElement, i: number) => {
    if (e.button !== 0 || (el.kind !== 'polygon' && el.kind !== 'polyline')) return
    e.stopPropagation()
    capture(e)
    const s = useStore.getState()
    const a = el.pts[i]
    const b = el.pts[(i + 1) % el.pts.length]
    s.pushHistory()
    const pts = [...el.pts]
    pts.splice(i + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    s.updateElement(el.id, { pts } as Partial<PlacedElement>)
    gestureRef.current = { mode: 'vertex', id: el.id, i: i + 1, pushed: true }
  }

  const onVertexDblClick = (el: PlacedElement, i: number) => {
    if (el.kind !== 'polygon' && el.kind !== 'polyline') return
    const min = el.kind === 'polygon' ? 3 : 2
    if (el.pts.length <= min) return
    useStore.getState().editElement(el.id, { pts: el.pts.filter((_, idx) => idx !== i) } as Partial<PlacedElement>)
  }

  // ---- gesture updates ----

  const onPointerMove = (e: React.PointerEvent) => {
    const s = useStore.getState()
    const g = gestureRef.current
    if (!g) {
      if (s.tool.type === 'place' || s.tool.type === 'draw') s.setGhost(toWorld(e.clientX, e.clientY))
      return
    }
    const p = toWorld(e.clientX, e.clientY)

    if (g.mode === 'pan') {
      const dx = e.clientX - g.sx
      const dy = e.clientY - g.sy
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true
      s.setView({ cx: g.view0.cx - dx / g.view0.ppm, cy: g.view0.cy - dy / g.view0.ppm })
      return
    }

    if (g.mode === 'move') {
      pushOnce(g)
      const tot = { x: p.x - g.start.x, y: p.y - g.start.y }
      // grid snap: keep the selection bbox corner on the grid
      let tdx = snap(g.bbox0.minX + tot.x, s.grid.cell) - g.bbox0.minX
      let tdy = snap(g.bbox0.minY + tot.y, s.grid.cell) - g.bbox0.minY
      // alignment snap against other elements' edges/centers overrides the grid
      const moved = {
        minX: g.bbox0.minX + tdx,
        minY: g.bbox0.minY + tdy,
        maxX: g.bbox0.maxX + tdx,
        maxY: g.bbox0.maxY + tdy,
      }
      const al = axisAlign(moved, g.others, 0.75)
      tdx += al.dx
      tdy += al.dy
      s.setGuides(al.gx, al.gy)
      s.moveSelectedBy(tdx - g.applied.x, tdy - g.applied.y)
      g.applied = { x: tdx, y: tdy }
      return
    }

    if (g.mode === 'resize') {
      pushOnce(g)
      const r = g.start
      const th = (r.rot * Math.PI) / 180
      const dir = g.axis === 'x' ? { x: Math.cos(th), y: Math.sin(th) } : { x: -Math.sin(th), y: Math.cos(th) }
      const u = (p.x - r.x) * dir.x + (p.y - r.y) * dir.y
      const startDim = g.axis === 'x' ? r.w : r.d
      const newDim = Math.max(0.5, snap(g.sign * u + startDim / 2, 0.5))
      const shift = (g.sign * (newDim - startDim)) / 2
      const patch =
        g.axis === 'x'
          ? { w: newDim, x: r.x + dir.x * shift, y: r.y + dir.y * shift }
          : { d: newDim, x: r.x + dir.x * shift, y: r.y + dir.y * shift }
      s.updateElement(g.id, patch)
      return
    }

    if (g.mode === 'rotate') {
      pushOnce(g)
      const ang = (Math.atan2(p.y - g.center.y, p.x - g.center.x) * 180) / Math.PI + 90
      s.updateElement(g.id, { rot: ((Math.round(ang / 5) * 5) % 360 + 360) % 360 })
      return
    }

    if (g.mode === 'plotVertex') {
      pushOnce(g)
      s.movePlotVertex(g.i, { x: snap(p.x, s.grid.cell), y: snap(p.y, s.grid.cell) })
      return
    }

    if (g.mode === 'vertex') {
      pushOnce(g)
      const el = s.elements.find((v) => v.id === g.id)
      if (!el || (el.kind !== 'polygon' && el.kind !== 'polyline')) return
      const pts = el.pts.map((v, idx) => (idx === g.i ? { x: snap(p.x, s.grid.cell), y: snap(p.y, s.grid.cell) } : v))
      s.updateElement(g.id, { pts } as Partial<PlacedElement>)
      return
    }
  }

  const onPointerUp = () => {
    const s = useStore.getState()
    const g = gestureRef.current
    if (g?.mode === 'pan' && !g.moved && s.tool.type === 'select') s.select(null)
    if (g?.mode === 'move') s.setGuides(null, null)
    gestureRef.current = null
  }

  const onDoubleClick = () => {
    const s = useStore.getState()
    if (s.tool.type === 'draw') s.finishDraw()
  }

  // ---- derived render data ----

  const warnings = useMemo(() => {
    const set = new Set<string>()
    for (const el of elements) if (isOutsideBoundary(el, plot.pts)) set.add(el.id)
    return set
  }, [elements, plot.pts])

  const plotBBox = useMemo(() => bboxOf(plot.pts), [plot.pts])
  const plotAreaSqm = useMemo(() => polygonArea(plot.pts), [plot.pts])

  const tx = viewport.w / 2 - view.cx * view.ppm
  const ty = viewport.h / 2 - view.cy * view.ppm
  const ppm = view.ppm

  // grid lines (skipped when too dense to read)
  const gridLines = useMemo(() => {
    if (!grid.visible || grid.cell * ppm < 4.5) return null
    const m = 20
    const x0 = Math.floor((plotBBox.minX - m) / grid.cell) * grid.cell
    const x1 = plotBBox.maxX + m
    const y0 = Math.floor((plotBBox.minY - m) / grid.cell) * grid.cell
    const y1 = plotBBox.maxY + m
    const lines: React.ReactNode[] = []
    for (let x = x0; x <= x1; x += grid.cell)
      lines.push(<line key={`v${x}`} x1={x} y1={y0} x2={x} y2={y1} />)
    for (let y = y0; y <= y1; y += grid.cell)
      lines.push(<line key={`h${y}`} x1={x0} y1={y} x2={x1} y2={y} />)
    return (
      <g stroke="#b6b0a4" strokeOpacity={0.35} strokeWidth={1 / ppm}>
        {lines}
      </g>
    )
  }, [grid.visible, grid.cell, ppm, plotBBox])

  const selectedRect =
    selectedIds.length === 1 ? (elements.find((el) => el.id === selectedIds[0] && el.kind === 'rect') as PlacedRect | undefined) : undefined

  const scaleLen = niceScaleLength(ppm)
  const ghostDef = tool.type === 'place' ? tool.def : null
  const snappedGhost = ghost ? { x: snap(ghost.x, grid.cell), y: snap(ghost.y, grid.cell) } : null

  const hint =
    tool.type === 'place'
      ? `คลิกเพื่อวาง ${tool.def.labelTh} · Esc ยกเลิก`
      : tool.type === 'draw'
        ? `คลิกเพิ่มจุด ${tool.def.labelTh} (${tool.pts.length} จุด) · ดับเบิลคลิก/Enter จบ · Esc ยกเลิก`
        : tool.type === 'editPlot'
          ? 'ลากจุดสีส้มเพื่อแก้ขอบเขตแปลง · คลิกจุดกลางเส้นเพื่อเพิ่มจุด · ดับเบิลคลิกจุดเพื่อลบ'
          : null

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <svg
        id="site-svg"
        ref={svgRef}
        width={viewport.w}
        height={viewport.h}
        onPointerDown={onBackgroundDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{ display: 'block', background: '#e7e5df', touchAction: 'none' }}
      >
        <defs>
          <marker
            id="flow-arrow"
            markerUnits="userSpaceOnUse"
            markerWidth={4}
            markerHeight={4}
            refX={2}
            refY={2}
            orient="auto"
          >
            <path d="M0.5 0.5 L3.5 2 L0.5 3.5 Z" fill="#6366f1" />
          </marker>
        </defs>
        <g id="world" transform={`translate(${tx} ${ty}) scale(${ppm})`}>
          {/* land plot */}
          {plot.pts.length >= 3 && (
            <path
              d={ptsToPath(plot.pts, true)}
              fill="#f3efe4"
              stroke={tool.type === 'editPlot' ? '#ea580c' : '#8a8474'}
              strokeWidth={tool.type === 'editPlot' ? 3 / ppm : 2 / ppm}
              strokeDasharray={`${8 / ppm} ${5 / ppm}`}
            />
          )}
          {gridLines}

          {/* elements grouped by layer (LAYERS order = z-order) */}
          {LAYERS.filter((l) => !hiddenLayers.includes(l.id)).map((layer) => (
            <g key={layer.id}>
              {elements
                .filter((el) => el.layer === layer.id)
                .map((el) => (
                  <ElementNode
                    key={el.id}
                    el={el}
                    selected={selectedIds.includes(el.id)}
                    warning={warnings.has(el.id)}
                    showLabels={showLabels}
                    ppm={ppm}
                    onDown={onElementDown}
                    onVertexDown={onVertexDown}
                    onVertexDblClick={onVertexDblClick}
                    onMidDown={onMidDown}
                  />
                ))}
            </g>
          ))}

          {/* alignment guides while dragging */}
          <g data-ui="1" stroke="#ec4899" strokeWidth={1.5 / ppm} strokeDasharray={`${5 / ppm} ${4 / ppm}`}>
            {guides.gx !== null && <line x1={guides.gx} y1={plotBBox.minY - 30} x2={guides.gx} y2={plotBBox.maxY + 30} />}
            {guides.gy !== null && <line x1={plotBBox.minX - 30} y1={guides.gy} x2={plotBBox.maxX + 30} y2={guides.gy} />}
          </g>

          {/* resize + rotate handles for a single selected rect */}
          {selectedRect && tool.type === 'select' && (
            <g data-ui="1" transform={`translate(${selectedRect.x} ${selectedRect.y}) rotate(${selectedRect.rot})`}>
              {(
                [
                  { axis: 'x', sign: 1, x: selectedRect.w / 2, y: 0 },
                  { axis: 'x', sign: -1, x: -selectedRect.w / 2, y: 0 },
                  { axis: 'y', sign: 1, x: 0, y: selectedRect.d / 2 },
                  { axis: 'y', sign: -1, x: 0, y: -selectedRect.d / 2 },
                ] as const
              ).map((h, i) => (
                <rect
                  key={i}
                  x={h.x - 5 / ppm}
                  y={h.y - 5 / ppm}
                  width={10 / ppm}
                  height={10 / ppm}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={2 / ppm}
                  style={{ cursor: h.axis === 'x' ? 'ew-resize' : 'ns-resize' }}
                  onPointerDown={(e) => onResizeDown(e, selectedRect, h.axis, h.sign)}
                />
              ))}
              <line
                x1={0}
                y1={-selectedRect.d / 2}
                x2={0}
                y2={-selectedRect.d / 2 - 18 / ppm}
                stroke="#2563eb"
                strokeWidth={1.5 / ppm}
              />
              <circle
                cx={0}
                cy={-selectedRect.d / 2 - 22 / ppm}
                r={6 / ppm}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth={2 / ppm}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => onRotateDown(e, selectedRect)}
              />
            </g>
          )}

          {/* plot boundary editing handles */}
          {tool.type === 'editPlot' && (
            <g data-ui="1">
              {plot.pts.map((p, i) => {
                const b = plot.pts[(i + 1) % plot.pts.length]
                const mid = { x: (p.x + b.x) / 2, y: (p.y + b.y) / 2 }
                return (
                  <g key={i}>
                    <circle
                      cx={mid.x}
                      cy={mid.y}
                      r={4.5 / ppm}
                      fill="#ffffff"
                      stroke="#ea580c"
                      strokeWidth={1.5 / ppm}
                      opacity={0.8}
                      style={{ cursor: 'copy' }}
                      onPointerDown={(e) => onPlotMidDown(e, i)}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={6 / ppm}
                      fill="#ea580c"
                      stroke="#ffffff"
                      strokeWidth={2 / ppm}
                      style={{ cursor: 'grab' }}
                      onPointerDown={(e) => onPlotVertexDown(e, i)}
                      onDoubleClick={() => useStore.getState().deletePlotVertex(i)}
                    />
                  </g>
                )
              })}
            </g>
          )}

          {/* ghost preview while placing */}
          {ghostDef && snappedGhost && (
            <g data-ui="1" pointerEvents="none" opacity={0.6}>
              {ghostDef.geom === 'rect' && (
                <rect
                  x={snappedGhost.x - (ghostDef.w ?? 10) / 2}
                  y={snappedGhost.y - (ghostDef.d ?? 10) / 2}
                  width={ghostDef.w ?? 10}
                  height={ghostDef.d ?? 10}
                  fill="#22c55e"
                  fillOpacity={0.35}
                  stroke="#16a34a"
                  strokeWidth={2 / ppm}
                />
              )}
              {ghostDef.geom === 'point' && (
                <circle
                  cx={snappedGhost.x}
                  cy={snappedGhost.y}
                  r={ghostDef.radius ?? 1}
                  fill="#22c55e"
                  fillOpacity={0.35}
                  stroke="#16a34a"
                  strokeWidth={2 / ppm}
                />
              )}
            </g>
          )}

          {/* in-progress polygon / polyline drawing */}
          {tool.type === 'draw' && tool.pts.length > 0 && (
            <g data-ui="1" pointerEvents="none">
              <path
                d={ptsToPath(snappedGhost ? [...tool.pts, snappedGhost] : tool.pts, tool.def.geom === 'polygon')}
                fill={tool.def.geom === 'polygon' ? tool.def.color : 'none'}
                fillOpacity={0.25}
                stroke={tool.def.color}
                strokeWidth={Math.max(tool.def.lineWidth ?? 0, 2 / ppm)}
                strokeOpacity={0.75}
                strokeLinejoin="round"
              />
              {tool.pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4 / ppm} fill={tool.def.color} />
              ))}
            </g>
          )}
        </g>
      </svg>

      {/* overlays */}
      <div className="north-arrow" title="ทิศเหนือ / North">
        <svg width="44" height="44" viewBox="0 0 44 44">
          <g transform={`rotate(${plot.northAngle} 22 22)`}>
            <path d="M22 6 L28 30 L22 25 L16 30 Z" fill="#b42318" />
            <text x="22" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2b2926">
              N
            </text>
          </g>
        </svg>
      </div>
      <div className="scale-bar">
        <div className="sb-line" style={{ width: scaleLen * ppm }} />
        <span>{scaleLen} ม.</span>
      </div>
      <div className="area-chip">
        พื้นที่แปลง {fmt(plotAreaSqm)} ตร.ม. · {fmt(plotAreaSqm / 1600, 2)} ไร่ ({formatRai(plotAreaSqm)})
      </div>
      {hint && <div className="tool-hint">{hint}</div>}
    </div>
  )
}
