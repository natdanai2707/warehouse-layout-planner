/**
 * Nudging follows the screen, not the world: ↑ pushes an item away from the
 * camera whichever way the view is orbited. The tie at the default isometric
 * angle has to resolve the same way every frame, or the pad's arrows mean
 * something different from one press to the next.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screenRight, setViewAxis, viewAxis } from '../viewAxis'

beforeEach(() => {
  viewAxis.fx = 0
  viewAxis.fz = -1
})

describe('quantizing the camera facing', () => {
  it('snaps to whichever world axis the camera mostly looks along', () => {
    setViewAxis(-0.9, -0.1)
    expect(viewAxis).toEqual({ fx: -1, fz: 0 })
    setViewAxis(0.1, 0.9)
    expect(viewAxis).toEqual({ fx: 0, fz: 1 })
  })

  it('resolves the 45° isometric tie to z, every time', () => {
    const k = Math.sqrt(1 / 3)
    for (const jitter of [0, 1e-12, -1e-12, 5e-9, -5e-9]) {
      setViewAxis(-k + jitter, -k)
      expect(viewAxis, `jitter ${jitter}`).toEqual({ fx: 0, fz: -1 })
    }
  })

  it('never leaves the forward axis at zero', () => {
    setViewAxis(0, 0)
    expect(Math.abs(viewAxis.fx) + Math.abs(viewAxis.fz)).toBe(1)
  })
})

describe('screen right', () => {
  it('is the forward axis turned a quarter turn', () => {
    setViewAxis(0, -1) // looking north: right is east
    expect(screenRight()).toEqual({ x: 1, z: 0 })
    setViewAxis(1, 0) // looking east: right is south
    expect(screenRight()).toEqual({ x: 0, z: 1 })
  })

  it('stays perpendicular to forward', () => {
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      setViewAxis(dx, dz)
      const r = screenRight()
      expect(r.x * viewAxis.fx + r.z * viewAxis.fz).toBeCloseTo(0, 12)
    }
  })
})
