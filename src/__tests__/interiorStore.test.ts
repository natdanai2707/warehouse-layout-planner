/**
 * Going inside a building and laying it out. What must hold: a building keeps
 * its own interior, editing one never touches another, a storey can be added
 * and removed without losing what was on it, and resizing the building on the
 * site carries its doors along instead of stranding them in mid-air.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../store'
import { defById } from '../interior/catalog'
import { GROUND_FLOOR_ID } from '../interior/types'
import type { BuildingInterior } from '../interior/types'
import type { PlacedRect } from '../types'

const rect = (id: string, x: number, w: number, d: number): PlacedRect => ({
  kind: 'rect',
  id,
  defId: 'warehouse',
  label: id,
  layer: 'buildings',
  color: '#64748b',
  x,
  y: 0,
  w,
  d,
  h: 8,
  rot: 0,
})

const interiorOf = (id: string): BuildingInterior | undefined => {
  const el = useStore.getState().elements.find((e) => e.id === id)
  return el && el.kind === 'rect' ? el.interior : undefined
}

const place = (defId: string) => {
  const def = defById(defId)!
  useStore.getState().startPlacingInterior(def)
  useStore.getState().commitPlaceInterior({ x: 0, z: 0 })
  return useStore.getState().selectedIds[0]
}

beforeEach(() => {
  useStore.setState({
    elements: [rect('a', 0, 24, 48), rect('b', 100, 12, 20)],
    selectedIds: [],
    tool: { type: 'select' },
    mode: 'site',
    activeBuildingId: null,
    activeFloorId: GROUND_FLOOR_ID,
    interiorCell: 0.5,
    past: [],
    future: [],
  })
})

describe('entering a building', () => {
  it('seeds an interior from the massing already drawn on the site', () => {
    useStore.getState().enterBuilding('a')
    const iv = interiorOf('a')!
    expect(useStore.getState().mode).toBe('building')
    expect(iv.floors).toHaveLength(1)
    expect(iv.shell.eave).toBeCloseTo(6.5, 6) // h 8 less 1.5
    expect(iv.floorLevel).toBe(1.2) // a warehouse floor sits at truck-bed height
  })

  it('keeps an interior that already exists', () => {
    useStore.getState().enterBuilding('a')
    useStore.getState().setFloorLevel(0.4)
    useStore.getState().exitBuilding()
    useStore.getState().enterBuilding('a')
    expect(interiorOf('a')!.floorLevel).toBe(0.4)
  })

  it('leaves the site view with nothing selected and no tool armed', () => {
    useStore.getState().enterBuilding('a')
    place('press_brake')
    useStore.getState().exitBuilding()
    const s = useStore.getState()
    expect(s.mode).toBe('site')
    expect(s.activeBuildingId).toBeNull()
    expect(s.selectedIds).toEqual([])
    expect(s.tool.type).toBe('select')
  })
})

describe('placing and editing inside', () => {
  beforeEach(() => useStore.getState().enterBuilding('a'))

  it('drops an item on the storey being edited, clamped inside', () => {
    const def = defById('laser_cut')!
    useStore.getState().startPlacingInterior(def)
    useStore.getState().commitPlaceInterior({ x: 500, z: 500 })
    const o = interiorOf('a')!.objects[0]
    expect(o.x + o.w / 2).toBeLessThanOrEqual(12.0001)
    expect(o.z + o.d / 2).toBeLessThanOrEqual(24.0001)
    expect(o.floorId).toBe(GROUND_FLOOR_ID)
  })

  it('duplicates, rotates and removes the selection', () => {
    place('press_brake')
    useStore.getState().duplicateInteriorSelected()
    expect(interiorOf('a')!.objects).toHaveLength(2)
    const before = interiorOf('a')!.objects[1].rot
    useStore.getState().rotateInteriorSelected()
    expect(interiorOf('a')!.objects[1].rot).not.toBe(before)
    useStore.getState().removeInteriorSelected()
    expect(interiorOf('a')!.objects).toHaveLength(1)
  })

  it('never touches another building', () => {
    place('press_brake')
    expect(interiorOf('b')).toBeUndefined()
    useStore.getState().exitBuilding()
    useStore.getState().enterBuilding('b')
    expect(interiorOf('b')!.objects).toHaveLength(0)
    expect(interiorOf('a')!.objects).toHaveLength(1)
  })

  it('undoes a placement', () => {
    place('press_brake')
    useStore.getState().undo()
    expect(interiorOf('a')?.objects ?? []).toHaveLength(0)
  })
})

describe('storeys', () => {
  beforeEach(() => useStore.getState().enterBuilding('a'))

  it('adds a storey above the last one and switches to it', () => {
    useStore.getState().addFloor()
    const iv = interiorOf('a')!
    expect(iv.floors).toHaveLength(2)
    expect(iv.floors[1].base).toBeGreaterThan(iv.floors[0].clear)
    expect(useStore.getState().activeFloorId).toBe(iv.floors[1].id)
  })

  it('brings items down to the ground floor when their storey is deleted', () => {
    useStore.getState().addFloor()
    const upper = interiorOf('a')!.floors[1].id
    const id = place('desk_single')
    expect(interiorOf('a')!.objects[0].floorId).toBe(upper)
    useStore.getState().removeFloor(upper)
    const o = interiorOf('a')!.objects.find((v) => v.id === id)!
    expect(o.floorId).toBe(GROUND_FLOOR_ID)
    expect(useStore.getState().activeFloorId).toBe(GROUND_FLOOR_ID)
  })

  it('refuses to delete the ground floor', () => {
    useStore.getState().removeFloor(GROUND_FLOOR_ID)
    expect(interiorOf('a')!.floors).toHaveLength(1)
  })
})

describe('resizing the building on the site', () => {
  it('carries a door along with the wall it was fitted to', () => {
    useStore.getState().enterBuilding('a')
    const def = defById('door_roller')!
    useStore.getState().startPlacingInterior(def)
    useStore.getState().commitPlaceInterior({ x: 0, z: 23 }) // nearest wall is the south one
    const door = interiorOf('a')!.objects[0]
    expect(door.z).toBe(24)
    expect(door.rot).toBe(4)

    useStore.getState().exitBuilding()
    useStore.getState().editElement('a', { d: 60 })
    const moved = interiorOf('a')!.objects[0]
    expect(moved.z).toBe(30) // rode the wall out
    expect(moved.rot).toBe(4)
  })

  it('leaves floor items exactly where they were', () => {
    useStore.getState().enterBuilding('a')
    place('press_brake')
    const before = { ...interiorOf('a')!.objects[0] }
    useStore.getState().exitBuilding()
    useStore.getState().editElement('a', { w: 40, d: 80 })
    expect(interiorOf('a')!.objects[0].x).toBe(before.x)
    expect(interiorOf('a')!.objects[0].z).toBe(before.z)
  })
})
