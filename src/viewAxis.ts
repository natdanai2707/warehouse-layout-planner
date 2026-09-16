/**
 * The camera's ground-plane facing, quantized to a world axis, so a nudge
 * follows what you SEE: ↑ pushes an item away from the camera and → pushes it
 * to the right of the screen, whichever way the view is orbited. Written every
 * frame from inside the canvas and read by the nudge pad and the key handler.
 */
export const viewAxis = {
  fx: 0, // "screen up" in world x
  fz: -1, // "screen up" in world z
}

/** Screen right = the forward axis turned -90° about Y. (`|| 0` keeps a
 *  negated zero out of the result, which compares badly everywhere.) */
export function screenRight(): { x: number; z: number } {
  return { x: -viewAxis.fz || 0, z: viewAxis.fx || 0 }
}

/**
 * Quantize a camera forward vector onto the nearest world axis.
 *
 * The default isometric view looks along (-1, -1): both components are equal,
 * so without the bias below the axis flips between x and z on rounding noise
 * and the pad's ↑ means something different from one frame to the next. The
 * tie is resolved to z, which is "up the screen" in the standard view.
 */
export function setViewAxis(dx: number, dz: number) {
  if (Math.abs(dx) > Math.abs(dz) + 1e-6) {
    viewAxis.fx = Math.sign(dx)
    viewAxis.fz = 0
  } else {
    viewAxis.fx = 0
    viewAxis.fz = Math.sign(dz) || -1
  }
}
