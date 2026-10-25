// Lead fall model, SI units. Shared by the build checks and the page.
export const DRAWS = [2.6, 3.6, 4.6, 5.6, 6.6, 7.6, 8.6]; // bolt heights; the last is the top anchor
export const ROPE = { EA: 20000, mu: 0.17, zig: 0.3 }; // EA set so the UIAA test (80 kg, factor 1.77, 2.8 m) peaks near 8.3 kN
export const PEOPLE = { mc: 75, mb: 70 };
export const DEVICE_H = 1.0, DEVICE_OUT = 0.75, FEET_BELOW = 0.95;

// Rope geometry for a climber tied in at h with `clipped` draws: rope out, the free-fall distance and the
// tension ratios down the rope (climber strand first).
export function setup(h, clipped, slack) {
  const top = clipped > 0 ? DRAWS[clipped - 1] : DEVICE_H;
  const above = Math.max(0, h - top);
  const segs = [above + slack];
  const ratios = [1];
  const rTop = Math.exp(ROPE.mu * Math.PI), rZig = Math.exp(ROPE.mu * ROPE.zig);
  let a = 1 / rTop;
  for (let i = clipped - 1; i > 0; i--) { segs.push(DRAWS[i] - DRAWS[i - 1]); ratios.push(a); a /= rZig; }
  if (clipped > 0) { segs.push(Math.hypot(DRAWS[0] - DEVICE_H, DEVICE_OUT)); ratios.push(a); }
  const out = segs.reduce((s, x) => s + x, 0);
  const compliance = segs.reduce((s, L, i) => s + L * ratios[i], 0) / ROPE.EA;
  return { top, above, free: 2 * above + slack, out, k: 1 / compliance, belayRatio: clipped > 0 ? a : 1, topLoad: clipped > 0 ? 1 + 1 / rTop : 0, factor: (2 * above + slack) / Math.max(0.1, out) };
}

// Integrates one fall. Returns peak loads and the drop, or a ground fall.
export function fall(h, clipped, slack, { zeta = 0.2, dt = 1 / 4000 } = {}) {
  const g = 9.81, { mc, mb } = PEOPLE;
  const S = setup(h, clipped, slack);
  const c = 2 * zeta * Math.sqrt(S.k * mc);
  let d = 0, vd = 0, yb = 0, vb = 0, peak = 0, maxD = 0, maxYb = 0, t = 0;
  for (; t < 6; t += dt) {
    const E = d - S.free - yb, Ed = vd - vb;
    const Tc = clipped > 0 && E > 0 ? Math.max(0, S.k * E + c * Ed) : 0;
    const Tb = Tc * S.belayRatio;
    vd += (g - Tc / mc) * dt; d += vd * dt;
    if (yb > 0 || Tb > mb * g) { vb += (Tb / mb - g) * dt; yb += vb * dt; if (yb < 0) { yb = 0; vb = 0; } }
    peak = Math.max(peak, Tc); maxD = Math.max(maxD, d); maxYb = Math.max(maxYb, yb);
    if (h - d - FEET_BELOW < 0) return { ...S, ground: true, drop: h - FEET_BELOW, peak, maxYb };
  }
  return { ...S, ground: false, drop: maxD, peak, drawLoad: peak * S.topLoad, maxYb };
}
