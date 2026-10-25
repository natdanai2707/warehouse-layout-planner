// Shared by the build (static art) and the page (live poses). Every function takes `lib = { k, G, P }`
// so the same source runs in Node with the kit modules and in the browser with the inlined kit.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Two-bone reach: the middle joint, bent toward `hint`.
export function ik(a, b, l1, l2, hint) {
  const ab = sub(b, a);
  const d = Math.min(len(ab), l1 + l2 - 0.05);
  const u = unit(ab);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const n = unit(sub(hint, mul(u, dot(hint, u))));
  return { joint: add(add(a, mul(u, along)), mul(n, h)), end: add(a, mul(u, d)) };
}

// Segment lengths of a 1.75 m person, in 25 mm units.
export const BODY = { torso: 22, neck: 5, head: 4.2, shoulder: 7.4, upper: 12, fore: 11.5, hip: 4.4, thigh: 17.5, shin: 17, foot: 5.5 };

// A person facing the wall (−y). `pelvis` is the tie-in point's height; `lean` tilts the torso (0 into the wall, 1 hanging back).
export function pose({ pelvis, lean, hands, feet, side = 1 }) {
  const B = BODY;
  const up = unit([0, -0.12 + lean * 0.42, 1]);
  const neck = add(pelvis, mul(up, B.torso));
  const head = add(neck, mul(up, B.neck + B.head * 0.8));
  const across = [1, 0, 0];
  const shL = add(neck, add(mul(across, -B.shoulder), mul(up, -2.2)));
  const shR = add(neck, add(mul(across, B.shoulder), mul(up, -2.2)));
  const hipL = add(pelvis, mul(across, -B.hip));
  const hipR = add(pelvis, mul(across, B.hip));
  const armL = ik(shL, hands[0], B.upper, B.fore, [-0.6, 0.5, -0.6]);
  const armR = ik(shR, hands[1], B.upper, B.fore, [0.6, 0.5, -0.6]);
  const legL = ik(hipL, feet[0], B.thigh, B.shin, [-0.9, 0.35, 0.2]);
  const legR = ik(hipR, feet[1], B.thigh, B.shin, [0.9, 0.35, 0.2]);
  const toe = (ankle) => add(ankle, [0, -B.foot, -0.6]);
  return {
    pelvis, neck, head, shL, shR, hipL, hipR,
    elL: armL.joint, hL: armL.end, elR: armR.joint, hR: armR.end,
    knL: legL.joint, ftL: legL.end, knR: legR.joint, ftR: legR.end,
    toeL: toe(legL.end), toeR: toe(legR.end), up,
  };
}

function bar(lib, a, b, w, h, tone, extra = {}) {
  const { G, P, k } = lib;
  const axis = unit(sub(b, a));
  let side = cross(axis, [0, 0, 1]);
  if (len(side) < 0.2) side = [1, 0, 0];
  const v = unit(cross(axis, unit(side)));
  const u = cross(v, axis);
  const F = G.frameOf(a, axis, u, v);
  const r = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  return k.solidSvg(G.prismOf(F, r, 0, len(sub(b, a)), P), { tone, crease: "none", ...extra });
}
const ball = (lib, c, r, tone) => lib.k.solidSvg(lib.G.sphereOf(c, r, lib.P, { steps: 20 }), { tone });

// The person as depth-sorted solids. `harness` adds a sit harness and belay loop.
export function personSvg(lib, J, { tone = "hi", harness = false } = {}) {
  const { k, P } = lib;
  const items = [];
  const put = (mid, svg) => items.push({ d: k.depthOf(mid, P), svg });
  const seg = (a, b, w, h, t = tone) => put(lerp(a, b, 0.5), bar(lib, a, b, w, h, t));
  const hipMid = lerp(J.hipL, J.hipR, 0.5);
  seg(J.pelvis, J.neck, 8.6, 5.2);
  seg(J.shL, J.shR, 3.4, 3.4);
  seg(J.hipL, J.hipR, 4.2, 4.2);
  seg(J.neck, add(J.neck, mul(J.up, 3.4)), 2.6, 2.6);
  put(J.head, ball(lib, J.head, BODY.head, tone));
  seg(J.shL, J.elL, 2.8, 2.8); seg(J.elL, J.hL, 2.4, 2.4);
  seg(J.shR, J.elR, 2.8, 2.8); seg(J.elR, J.hR, 2.4, 2.4);
  seg(J.hipL, J.knL, 4, 4); seg(J.knL, J.ftL, 3.2, 3.2);
  seg(J.hipR, J.knR, 4, 4); seg(J.knR, J.ftR, 3.2, 3.2);
  seg(J.ftL, J.toeL, 2.8, 2.2, "lo"); seg(J.ftR, J.toeR, 2.8, 2.2, "lo");
  for (const c of [J.elL, J.elR]) put(c, ball(lib, c, 1.45, tone));
  for (const c of [J.knL, J.knR]) put(c, ball(lib, c, 2.05, tone));
  for (const c of [J.hL, J.hR]) put(add(c, [0, -0.5, 0]), ball(lib, c, 1.6, tone));
  if (harness) {
    const a = add(J.pelvis, mul(J.up, 1)), b = add(J.pelvis, mul(J.up, 4.6));
    put(add(lerp(a, b, 0.5), [0, 0.2, 0]), bar(lib, a, b, 9.6, 6, "lo"));
    for (const s of [-1, 1]) put(lerp(hipMid, J.knL, 0.12), bar(lib, add(J.pelvis, [s * 3.2, 0, -1.2]), add(J.pelvis, [s * 3.2, 0, 1.2]), 3.2, 5.6, "lo"));
  }
  items.sort((p, q) => p.d - q.d);
  return items.map((i) => i.svg).join("");
}
