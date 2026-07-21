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
