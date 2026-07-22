/**
 * THE critical behavior of this planner: editing the land plot boundary
 * (dimensions, area, free-form reshape, rotation) must NEVER move, rescale or
 * delete elements already placed. Elements keep absolute world coordinates;
 * anything left outside the new boundary is only FLAGGED, never touched.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../store'
import { SAMPLE_LAYOUT } from '../sample'
import { isOutsideBoundary } from '../geometry'
import type { PlacedElement } from '../types'

const snapshotElements = (): PlacedElement[] => JSON.parse(JSON.stringify(useStore.getState().elements))

beforeEach(() => {
  const fresh = JSON.parse(JSON.stringify(SAMPLE_LAYOUT))
  useStore.setState({
    plot: fresh.plot,
    grid: fresh.grid,
    elements: fresh.elements,
    hiddenLayers: [],
    refImage: null,
    selectedIds: [],
    past: [],
    future: [],
  })
})

describe('plot editing never disturbs placed elements', () => {
  it('setPlotRect (enter dimensions) leaves every element exactly in place', () => {
    const before = snapshotElements()
    useStore.getState().setPlotRect(300, 200)
    expect(useStore.getState().elements).toEqual(before)
    useStore.getState().setPlotRect(20, 20) // shrink far below the layout
    expect(useStore.getState().elements).toEqual(before)
  })

  it('setPlotAreaSqm (enter area in sqm/rai) leaves elements untouched', () => {
    const before = snapshotElements()
    useStore.getState().setPlotAreaSqm(3 * 1600) // 3 rai
    expect(useStore.getState().elements).toEqual(before)
  })

  it('free-form boundary edits (move/insert/delete vertex) leave elements untouched', () => {
    const before = snapshotElements()
    const s = useStore.getState()
    s.movePlotVertex(0, { x: -40, y: -25 })
    s.insertPlotVertex(1, { x: 80, y: -10 })
    s.deletePlotVertex(2)
    expect(useStore.getState().elements).toEqual(before)
  })

  it('rotating the plot rotates only the boundary polygon', () => {
    const before = snapshotElements()
    const plotBefore = JSON.parse(JSON.stringify(useStore.getState().plot.pts))
    useStore.getState().rotatePlot(45)
    expect(useStore.getState().elements).toEqual(before)
    expect(useStore.getState().plot.pts).not.toEqual(plotBefore)
  })

  it('shrinking the plot flags outside elements but never moves or deletes them', () => {
    const before = snapshotElements()
    useStore.getState().setPlotRect(30, 30)
    const after = useStore.getState()
    expect(after.elements).toEqual(before) // same count, same coordinates
    const flagged = after.elements.filter((el) => isOutsideBoundary(el, after.plot.pts))
    expect(flagged.length).toBeGreaterThan(0) // visual warning fires…
    expect(after.elements.length).toBe(before.length) // …but nothing was auto-deleted
  })

  it('undo restores the boundary without side effects on elements', () => {
    const before = snapshotElements()
    const plotBefore = JSON.parse(JSON.stringify(useStore.getState().plot))
    useStore.getState().setPlotRect(500, 400)
    useStore.getState().undo()
    expect(useStore.getState().plot).toEqual(plotBefore)
    expect(useStore.getState().elements).toEqual(before)
  })
})

describe('element editing sanity', () => {
  it('moving elements does not modify the plot boundary', () => {
    const plotBefore = JSON.parse(JSON.stringify(useStore.getState().plot))
    const first = useStore.getState().elements[0]
    useStore.getState().setSelection([first.id])
    useStore.getState().moveSelectedBy(10, 5)
    expect(useStore.getState().plot).toEqual(plotBefore)
  })
})

describe('aerial photo underlay', () => {
  const img = () => ({
    dataUrl: 'data:image/jpeg;base64,xxxx',
    x: 50, y: 40, width: 100, aspect: 0.75,
    rotation: 0, opacity: 0.7, visible: true, locked: false,
  })

  it('attaching / moving / removing the photo never touches elements or plot', () => {
    const elementsBefore = snapshotElements()
    const plotBefore = JSON.parse(JSON.stringify(useStore.getState().plot))
    const s = useStore.getState()
    s.attachRefImage(img())
    s.updateRefImage({ x: 70, y: 55, opacity: 0.4, rotation: 15, width: 140 })
    s.removeRefImage()
    expect(useStore.getState().elements).toEqual(elementsBefore)
    expect(useStore.getState().plot).toEqual(plotBefore)
  })

  it('two-point calibration rescales about the measured midpoint', () => {
    const s = useStore.getState()
    s.attachRefImage(img())
    // user clicked two photo features 20 m apart on screen, real distance 40 m
    s.calibrateRefImage({ x: 40, y: 40 }, { x: 60, y: 40 }, 40)
    const ri = useStore.getState().refImage!
    expect(ri.width).toBeCloseTo(200) // scaled ×2
    // midpoint (50,40) stays fixed; image center was already at (50,40)
    expect(ri.x).toBeCloseTo(50)
    expect(ri.y).toBeCloseTo(40)
  })

  it('calibration keeps the measured feature in place when off-center', () => {
    const s = useStore.getState()
    s.attachRefImage(img())
    s.calibrateRefImage({ x: 0, y: 0 }, { x: 10, y: 0 }, 20) // ×2 about (5,0)
    const ri = useStore.getState().refImage!
    expect(ri.width).toBeCloseTo(200)
    expect(ri.x).toBeCloseTo(5 + (50 - 5) * 2)
    expect(ri.y).toBeCloseTo(0 + (40 - 0) * 2)
  })

  it('undo restores the photo state', () => {
    const s = useStore.getState()
    s.attachRefImage(img())
    s.editRefImage({ locked: true })
    useStore.getState().undo()
    expect(useStore.getState().refImage!.locked).toBe(false)
    useStore.getState().undo()
    expect(useStore.getState().refImage).toBeNull()
  })
})
