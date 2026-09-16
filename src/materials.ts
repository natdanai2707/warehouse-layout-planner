import * as THREE from 'three'

/**
 * Procedural surface materials — birch plywood, cast concrete and EPDM rubber
 * granule flooring — drawn once into small canvases and tiled. No external
 * texture files needed, so they work offline and load instantly.
 */

export type SurfaceKind = 'epdm' | 'concrete' | 'birch' | 'metalsheet' | 'grass' | 'gravel' | 'plywood'

export const SURFACE_LABELS: Record<SurfaceKind, string> = {
  epdm: 'EPDM rubber',
  concrete: 'Concrete',
  birch: 'Birch plywood',
  metalsheet: 'Corrugated metal sheet',
  grass: 'Grass lawn',
  gravel: 'Gravel',
  plywood: 'Climbing-wall plywood',
}

// EPDM is drawn near-white so the item's own color tints the rubber;
// concrete and birch carry their real colors in the texture itself.
export const SURFACE_TINTED: Record<SurfaceKind, boolean> = {
  epdm: true,
  concrete: false,
  birch: false,
  metalsheet: false,
  grass: false,
  gravel: false,
  plywood: true,
}

// Route colors as real gyms set them: every hold on one route shares a color.
export const ROUTE_COLORS = ['#d62828', '#f77f00', '#fcbf49', '#2a9d8f', '#3a6ea5', '#7b2cbf', '#16181d', '#f2f1ec', '#4f9d69', '#e5539b']

const rnd = (() => {
  // deterministic so the tiles look identical every session
  let s = 42
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
})()

function drawCanvas(kind: SurfaceKind): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  if (kind === 'birch') {
    g.fillStyle = '#ead9b4'
    g.fillRect(0, 0, 256, 256)
    // vertical grain streaks with a gentle wiggle
    for (let i = 0; i < 46; i++) {
      const x0 = rnd() * 256
      const warm = 0.5 + rnd() * 0.5
      g.strokeStyle = `rgba(${170 + warm * 40}, ${130 + warm * 35}, ${80 + warm * 25}, ${0.10 + rnd() * 0.15})`
      g.lineWidth = 0.6 + rnd() * 2.2
      g.beginPath()
      g.moveTo(x0, -4)
      for (let y = 0; y <= 260; y += 16) g.lineTo(x0 + Math.sin(y * 0.02 + i) * 3.5, y)
      g.stroke()
    }
    // faint elliptical knots
    for (let i = 0; i < 4; i++) {
      const x = rnd() * 256
      const y = rnd() * 256
      g.strokeStyle = 'rgba(150, 110, 60, 0.22)'
      g.lineWidth = 1
      for (let r = 2; r < 9; r += 2.4) {
        g.beginPath()
        g.ellipse(x, y, r * 0.65, r * 1.6, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
  } else if (kind === 'concrete') {
    g.fillStyle = '#c9c8c3'
    g.fillRect(0, 0, 256, 256)
    // large soft blotches
    for (let i = 0; i < 18; i++) {
      const v = 185 + rnd() * 30
      g.fillStyle = `rgba(${v}, ${v}, ${v - 4}, 0.16)`
      g.beginPath()
      g.ellipse(rnd() * 256, rnd() * 256, 18 + rnd() * 44, 14 + rnd() * 36, rnd() * 3, 0, Math.PI * 2)
      g.fill()
    }
    // fine aggregate speckle
    for (let i = 0; i < 1600; i++) {
      const v = 120 + rnd() * 110
      g.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.12 + rnd() * 0.2})`
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd(), 1 + rnd())
    }
    // a couple of hairline cracks
    for (let i = 0; i < 2; i++) {
      g.strokeStyle = 'rgba(90, 90, 88, 0.25)'
      g.lineWidth = 0.7
      g.beginPath()
      let x = rnd() * 256
      let y = 0
      g.moveTo(x, y)
      while (y < 256) {
        x += (rnd() - 0.5) * 22
        y += 12 + rnd() * 18
        g.lineTo(x, y)
      }
      g.stroke()
    }
  } else if (kind === 'metalsheet') {
    // corrugated wall cladding: vertical ribs shaded left-to-right so each
    // rib reads as a rounded flute, with faint panel seams
    g.fillStyle = '#dfe3e7'
    g.fillRect(0, 0, 256, 256)
    const rib = 32 // 8 ribs per tile
    for (let x = 0; x < 256; x += rib) {
      const gr = g.createLinearGradient(x, 0, x + rib, 0)
      gr.addColorStop(0, '#c4cad1')
      gr.addColorStop(0.28, '#eef1f4')
      gr.addColorStop(0.55, '#d7dce1')
      gr.addColorStop(0.8, '#b9c0c7')
      gr.addColorStop(1, '#c4cad1')
      g.fillStyle = gr
      g.fillRect(x, 0, rib, 256)
    }
    // subtle horizontal panel seam
    g.fillStyle = 'rgba(90, 98, 106, 0.35)'
    g.fillRect(0, 126, 256, 3)
    // faint weathering streaks
    for (let i = 0; i < 60; i++) {
      const v = 150 + rnd() * 80
      g.fillStyle = `rgba(${v}, ${v + 4}, ${v + 8}, 0.05)`
      g.fillRect(rnd() * 256, rnd() * 256, 2, 20 + rnd() * 60)
    }
  } else if (kind === 'plywood') {
    // near-white painted climbing plywood (item color multiplies in): faint
    // grain, PANEL SEAMS and countersunk screw heads on a T-nut-like grid
    g.fillStyle = '#f2efe9'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = `rgba(190, 178, 158, ${0.05 + rnd() * 0.08})`
      g.lineWidth = 0.8 + rnd() * 2
      const x0 = rnd() * 256
      g.beginPath()
      g.moveTo(x0, -4)
      for (let y = 0; y <= 260; y += 20) g.lineTo(x0 + Math.sin(y * 0.02 + i) * 3, y)
      g.stroke()
    }
    // panel seams (one per tile edge → 1.5 m panel rhythm)
    g.strokeStyle = 'rgba(80, 74, 64, 0.4)'
    g.lineWidth = 1.6
    g.strokeRect(0.8, 0.8, 254.4, 254.4)
    // screw heads
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const x = 32 + sx * 64 + (rnd() - 0.5) * 6
        const y = 32 + sy * 64 + (rnd() - 0.5) * 6
        g.fillStyle = 'rgba(70, 66, 58, 0.55)'
        g.beginPath()
        g.arc(x, y, 1.8, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = 'rgba(255, 255, 255, 0.35)'
        g.beginPath()
        g.arc(x - 0.6, y - 0.6, 0.6, 0, Math.PI * 2)
        g.fill()
      }
    }
  } else if (kind === 'grass') {
    // lawn: layered green base with thousands of short blade strokes
    g.fillStyle = '#4e7a3c'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 26; i++) {
      const gr = 100 + rnd() * 45
      g.fillStyle = `rgba(${52 + rnd() * 30}, ${gr}, ${44 + rnd() * 20}, 0.18)`
      g.beginPath()
      g.ellipse(rnd() * 256, rnd() * 256, 22 + rnd() * 50, 16 + rnd() * 40, rnd() * 3, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 3200; i++) {
      const gr = 95 + rnd() * 85
      g.strokeStyle = `rgba(${40 + rnd() * 35}, ${gr}, ${35 + rnd() * 30}, ${0.25 + rnd() * 0.35})`
      g.lineWidth = 0.7
      const x = rnd() * 256
      const y = rnd() * 256
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3.5)
      g.stroke()
    }
  } else if (kind === 'gravel') {
    // crushed stone: tightly packed rounded pebbles in warm greys
    g.fillStyle = '#9d968b'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 1500; i++) {
      const v = 120 + rnd() * 110
      const warm = rnd() * 14
      g.fillStyle = `rgb(${v + warm}, ${v + warm * 0.6}, ${v})`
      g.beginPath()
      g.ellipse(rnd() * 256, rnd() * 256, 1.6 + rnd() * 3.4, 1.2 + rnd() * 2.8, rnd() * 3, 0, Math.PI * 2)
      g.fill()
      // shadow crescent under each pebble for depth
      g.fillStyle = `rgba(40, 38, 34, ${0.10 + rnd() * 0.12})`
      g.beginPath()
      g.ellipse(rnd() * 256, rnd() * 256, 1.4 + rnd() * 2.6, 1 + rnd() * 2, rnd() * 3, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    // epdm: near-white base + dark/light granules (item color multiplies in)
    g.fillStyle = '#f3f3f3'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2600; i++) {
      const dark = rnd() < 0.62
      const v = dark ? 30 + rnd() * 70 : 215 + rnd() * 40
      g.fillStyle = `rgba(${v}, ${v}, ${v}, ${dark ? 0.28 + rnd() * 0.3 : 0.5})`
      g.beginPath()
      g.arc(rnd() * 256, rnd() * 256, 0.7 + rnd() * 1.4, 0, Math.PI * 2)
      g.fill()
    }
  }
  return c
}

const canvases = new Map<SurfaceKind, HTMLCanvasElement>()
const texCache = new Map<string, THREE.CanvasTexture>()

// World-locked variant for geometries whose UVs are in meters (shapeGeometry):
// one tile every 1.5 world units on both axes.
export function surfaceMapWorld(kind: SurfaceKind): THREE.CanvasTexture {
  const key = `${kind}:world`
  let t = texCache.get(key)
  if (!t) {
    let c = canvases.get(kind)
    if (!c) {
      c = drawCanvas(kind)
      canvases.set(kind, c)
    }
    t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / 1.5, 1 / 1.5)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    texCache.set(key, t)
  }
  return t
}

// A tiled texture sized for a w × d surface (one tile ≈ 1.5 m).
export function surfaceMap(kind: SurfaceKind, w: number, d: number): THREE.CanvasTexture {
  const rw = Math.max(1, Math.round(w / 1.5))
  const rd = Math.max(1, Math.round(d / 1.5))
  const key = `${kind}:${rw}x${rd}`
  let t = texCache.get(key)
  if (!t) {
    let c = canvases.get(kind)
    if (!c) {
      c = drawCanvas(kind)
      canvases.set(kind, c)
    }
    t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rw, rd)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    texCache.set(key, t)
  }
  return t
}


/* ---- procedural normal + roughness detail ---- */

// per-kind bump strength for the derived normal map
const NORMAL_STRENGTH: Record<SurfaceKind, number> = {
  epdm: 1.2,
  concrete: 0.7,
  birch: 0.5,
  metalsheet: 2.4,
  grass: 1.5,
  gravel: 2.2,
  plywood: 0.6,
}

const normalCanvases = new Map<SurfaceKind, HTMLCanvasElement>()

// Sobel over the color canvas's luminance → tangent-space normal map, so
// every procedural surface gets real relief without downloading textures.
function drawNormalCanvas(kind: SurfaceKind): HTMLCanvasElement {
  let src = canvases.get(kind)
  if (!src) {
    src = drawCanvas(kind)
    canvases.set(kind, src)
  }
  const N = 256
  const sg = src.getContext('2d')!.getImageData(0, 0, N, N)
  const lum = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) {
    lum[i] = (sg.data[i * 4] * 0.299 + sg.data[i * 4 + 1] * 0.587 + sg.data[i * 4 + 2] * 0.114) / 255
  }
  const out = document.createElement('canvas')
  out.width = out.height = N
  const og = out.getContext('2d')!
  const img = og.createImageData(N, N)
  const k = NORMAL_STRENGTH[kind]
  const at = (x: number, y: number) => lum[((y + N) % N) * N + ((x + N) % N)]
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k
      const dy = (at(x, y + 1) - at(x, y - 1)) * k
      const inv = 1 / Math.hypot(dx, dy, 1)
      const i = (y * N + x) * 4
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255
      img.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  og.putImageData(img, 0, 0)
  return out
}

// normal map tiled to match surfaceMap(kind, w, d)
export function surfaceNormal(kind: SurfaceKind, w: number, d: number): THREE.CanvasTexture {
  const rw = Math.max(1, Math.round(w / 1.5))
  const rd = Math.max(1, Math.round(d / 1.5))
  const key = `n:${kind}:${rw}x${rd}`
  let t = texCache.get(key)
  if (!t) {
    let c = normalCanvases.get(kind)
    if (!c) {
      c = drawNormalCanvas(kind)
      normalCanvases.set(kind, c)
    }
    t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rw, rd)
    t.anisotropy = 4
    texCache.set(key, t)
  }
  return t
}

// world-locked variant matching surfaceMapWorld
export function surfaceNormalWorld(kind: SurfaceKind): THREE.CanvasTexture {
  const key = `n:${kind}:world`
  let t = texCache.get(key)
  if (!t) {
    let c = normalCanvases.get(kind)
    if (!c) {
      c = drawNormalCanvas(kind)
      normalCanvases.set(kind, c)
    }
    t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / 1.5, 1 / 1.5)
    t.anisotropy = 4
    texCache.set(key, t)
  }
  return t
}

/* ---- foliage: alpha-mapped leaf cards ---- */

let leafTexCache: THREE.CanvasTexture | null = null

/**
 * A cluster of individual leaves drawn with transparency, used on small
 * cards scattered through a tree's branches. This is how real-time foliage
 * is done: hundreds of thin cards read as thousands of separate leaves,
 * where a solid blob would only ever read as a lump of clay.
 */
export function leafTexture(): THREE.CanvasTexture {
  if (leafTexCache) return leafTexCache
  const N = 256
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  g.clearRect(0, 0, N, N)

  // one leaf: pointed ellipse with a midrib and a short stem
  const leaf = (x: number, y: number, len: number, ang: number, hue: number, light: number) => {
    g.save()
    g.translate(x, y)
    g.rotate(ang)
    const w = len * (0.5 + rnd() * 0.16)
    const grad = g.createLinearGradient(0, -len / 2, 0, len / 2)
    grad.addColorStop(0, `hsl(${hue} ${38 + rnd() * 14}% ${light + 6}%)`)
    grad.addColorStop(1, `hsl(${hue} ${40 + rnd() * 14}% ${light - 7}%)`)
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(0, -len / 2) // tip
    g.bezierCurveTo(w / 2, -len * 0.22, w / 2, len * 0.24, 0, len / 2)
    g.bezierCurveTo(-w / 2, len * 0.24, -w / 2, -len * 0.22, 0, -len / 2)
    g.fill()
    // midrib + a couple of veins
    g.strokeStyle = `hsla(${hue} 30% ${light - 16}% / 0.5)`
    g.lineWidth = Math.max(0.6, len * 0.025)
    g.beginPath()
    g.moveTo(0, -len / 2)
    g.lineTo(0, len / 2)
    g.stroke()
    g.lineWidth = Math.max(0.4, len * 0.016)
    for (const t of [-0.16, 0.06, 0.26]) {
      g.beginPath()
      g.moveTo(0, len * t)
      g.lineTo(w * 0.36, len * (t + 0.13))
      g.moveTo(0, len * t)
      g.lineTo(-w * 0.36, len * (t + 0.13))
      g.stroke()
    }
    // stem
    g.strokeStyle = `hsla(${hue - 8} 26% ${light - 20}% / 0.75)`
    g.lineWidth = Math.max(0.7, len * 0.03)
    g.beginPath()
    g.moveTo(0, len / 2)
    g.lineTo(0, len / 2 + len * 0.13)
    g.stroke()
    g.restore()
  }

  // a spray of leaves filling the card, denser in the middle
  for (let i = 0; i < 54; i++) {
    const a = rnd() * Math.PI * 2
    const r = Math.pow(rnd(), 0.62) * N * 0.44
    leaf(
      N / 2 + Math.cos(a) * r,
      N / 2 + Math.sin(a) * r * 0.86,
      N * (0.13 + rnd() * 0.1),
      rnd() * Math.PI * 2,
      88 + rnd() * 26, // yellow-green .. green
      30 + rnd() * 22,
    )
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  leafTexCache = t
  return t
}
