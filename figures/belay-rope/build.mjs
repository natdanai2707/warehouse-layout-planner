// Fig: a top-rope belay. A climber on a 6 m gym wall, the rope over a two-carabiner anchor,
// a belayer with an assisted-braking device. World units are 25 mm; x along the wall, y out from it, z up.
// node build.mjs [--light]   writes belay-rope.html (or -light.html) next to this script.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as M from "./man.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const src = (file) => readFileSync(join(HERE, file), "utf8");
const kitScript = () => src("kit/iso-kit.mjs").replace(/^export /gm, "");
const latheScript = () =>
  "const G = (() => {" + src("kit/lathe.mjs").replace(/^import .*$/m, "").replace(/^export /gm, "") +
  "\nreturn { frameOf, frameAlong, prismOf, sphereOf, disc, ringBand, solidOf, circleOf, arcOf };\n})();\n";
const manScript = () => src("man.mjs").replace(/^export /gm, "");

const U = 40; // units per metre
const WIDTH = 620;
const HEIGHT = 640;

// ---------- the truth ----------
const WALL = { x0: -60, x1: 60, t: 10, h: 240 }; // 3 m lane, 6 m wall
const MAT_T = 3; // 75 mm rubber safety floor
const CX = -4; // climber's line under the left carabiner
const BINER = [-3.5, 3.5]; // the two anchor carabiners
const BINER_Z = 218, BINER_R = 3, BINER_Y = 3;
const ROPE_TOP = BINER_Z - BINER_R + 0.75 + 0.5; // rope's centre where it bends over the carabiners' bottom bars
const BELAYER = [26, 45]; // feet centre of the belayer, 1.1 m out from the wall
const DEVICE = [26, 40.6, 40.5]; // assisted-braking device on the belay loop
const BAG = [47, 66];
const PHYS = { mc: 75, mb: 70, EA: 9810, r: 1.7, zeta: 0.3 }; // kg, kg, N (8% static elongation at 80 kg), friction e^(μπ), damping
const HOLD_STEP = 18;
const handHold = (side, i) => [CX + (side ? 10 : -12), 40 + HOLD_STEP * i + (side ? 9 : 0)];
const footHold = (side, i) => [CX + (side ? 7 : -8), 6 + HOLD_STEP * i + (side ? 9 : 0)];

const P = k.fitProjection(
  [
    ...k.boxCorners({ x: -92, y: -22, w: 196, d: 140 }, -5, 0),
    ...k.boxCorners({ x: WALL.x0, y: -WALL.t, w: WALL.x1 - WALL.x0, d: WALL.t }, 0, WALL.h + 2),
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 56 },
);
const lib = { k, G, P };
const at = (p) => k.iso(p, P);
const S = (paths, style = {}) => k.solidSvg(paths, style);
const L = (d, style = {}) => k.lineSvg(d, style);
const D = (pts, style = {}) => k.dotsSvg(pts, style);
const box = (x0, x1, y0, y1, z0, z1, style = {}, r = 0.4, steps = 2, bevel = 0) =>
  S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style });
const seg = (a, b) => k.segment(a, b, P);
const poly = (pts) => k.pathOf(pts.map(at), true);

// ---------- floor and wall ----------
function floor() {
  const slab = { x: -92, y: -22, w: 196, d: 140, r: 5 };
  const mat = { x: -84, y: 0, w: 180, d: 112, r: 2 };
  const out = [`<path class="iso-halo" d="${k.haloOf(slab, -5, 5, P)}"/>`];
  out.push(S(k.slabOf(slab, -5, 5, P, 6, 1.2), { tone: "lo" }));
  const seams = [36, 74].map((y) => k.lineOnTop([mat.x + 0.4, y], [mat.x + mat.w - 0.4, y], MAT_T, P));
  seams.push(...[-24, 36].map((x) => k.lineOnTop([x, mat.y + 0.4], [x, mat.y + mat.d - 0.4], MAT_T, P)));
  out.push(S(k.slabOf(mat, 0, MAT_T, P, 3, 0.6), { tone: "lo", inner: L(seams.join(""), { tone: "faint" }) }));
  // belay zone markings on the mat: a box where the belayer stands
  out.push(L(k.planOutline({ x: 12, y: 30, w: 30, d: 30, r: 1 }, MAT_T, P, 2), { tone: "mid" }));
  // a floor plate: the lane number, three rule lines and two screws
  const plate = { x: -78, y: 80, w: 24, d: 14, r: 1 };
  out.push(S(k.slabOf(plate, MAT_T, 0.6, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), MAT_T + 0.6, P, 3), { tone: "faint" }));
  [[4, 15], [7, 11], [10, 13]].forEach(([dy, w]) => out.push(L(k.lineOnTop([plate.x + 4, plate.y + dy], [plate.x + 4 + w, plate.y + dy], MAT_T + 0.6, P), { tone: "lo", free: true })));
  return out.join("");
}
function wall() {
  const { x0, x1, t, h } = WALL;
  const out = [];
  // frame posts behind the plywood, seen past the side edge
  out.push(box(x1 - 4, x1, -t - 6, -t, 0, h - 2, { tone: "lo" }, 0.3));
  // plywood seams (1.22 × 2.44 m sheets) and the T-nut grid, 200 mm pitch
  const seams = [];
  for (const x of [x0 + 48.8, x0 + 97.6]) seams.push(seg([x, 0, MAT_T], [x, 0, h]));
  for (const z of [97.6, 195.2]) seams.push(seg([x0, 0, z], [x1, 0, z]));
  const sideSeams = [97.6, 195.2].map((z) => seg([x1, -t, z], [x1, 0, z])).join("");
  out.push(S(k.slabOf({ x: x0, y: -t, w: x1 - x0, d: t, r: 0.4 }, 0, h, P, 2, 0.6), {
    tone: "mid",
    inner: L(seams.join("") + sideSeams, { tone: "faint" }),
  }));
  const nuts = [];
  for (let x = x0 + 4; x < x1; x += 8) for (let z = 10; z < h - 2; z += 8) nuts.push(at([x, 0, z]));
  out.push(D(nuts, { size: 0.32, tone: "lo" }));
  // capping and kickboard
  out.push(box(x0 - 0.6, x1 + 0.6, -t - 0.6, 0.8, h, h + 2, { tone: "mid" }, 0.4, 2, 0.4));
  out.push(box(x0, x1, 0, 1, MAT_T, MAT_T + 8, { tone: "mid" }, 0.3));
  out.push(D([-50, -10, 30].map((x) => at([x, 1, MAT_T + 4])), { size: 0.45 }));
  return out.join("");
}
function hold(x, z, r, tone = "mid") {
  const F = G.frameAlong([x, 0, z], [0, 1, 0]);
  const prof = [[0, r], [0.5, r * 0.97, 1], [1.2, r * 0.8, 1], [1.8, r * 0.55, 1], [2.2, r * 0.25, 1], [2.35, 0]];
  return S(G.solidOf(prof, F, P, { steps: 28 }), { tone }) + L(G.circleOf(F, 2.25, 0.45, P, 12), { tone: "lo" });
}
function holds() {
  const items = [];
  const put = (x, z, svg) => items.push({ d: k.depthOf([x, 0, z], P), svg });
  for (let i = 0; i < 11; i++) for (const s of [0, 1]) {
    const [hx, hz] = handHold(s, i);
    if (hz < 210) put(hx, hz, hold(hx, hz, 2.8, "hi"));
    const [fx, fz] = footHold(s, i);
    if (fz < 200 && fz > 8) put(fx, fz, hold(fx, fz, 1.5, "hi"));
  }
  // other routes on the lane, quieter
  const others = [[-44, 30], [-36, 66], [-48, 102], [-30, 140], [-46, 176], [-38, 206], [28, 20], [40, 56], [22, 150], [44, 188], [34, 120], [-52, 156]];
  others.forEach(([x, z], i) => put(x, z, hold(x, z, 2 + (i % 3) * 0.6, "lo")));
  items.sort((a, b) => a.d - b.d);
  // a volume bolted to the lane
  const F = G.frameOf([30, 0, 72], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const vol = S(G.prismOf(F, [[-14, -10], [14, -10], [0, 18]], 0, 9, P), { tone: "mid" });
  return vol + items.map((i) => i.svg).join("");
}
function anchor() {
  const out = [];
  out.push(box(-8, 8, 0, 0.8, 224, 238, { tone: "mid" }, 0.4, 2, 0.3));
  for (const x of BINER) {
    out.push(S(G.disc(0.8, 1.8, 1.3, G.frameAlong([x, 0, 232], [0, 1, 0]), P), { tone: "mid" }));
    out.push(box(x - 1.1, x + 1.1, 0.8, 1.8, 221, 232, { tone: "mid" }, 0.4));
    out.push(L(G.circleOf(G.frameAlong([x, 1.8, 223.4], [0, 1, 0]), 0, 0.7, P, 10), { tone: "lo" }));
  }
  return out.join("");
}
function carabiners() {
  return BINER.map((x) => S(G.ringBand(-0.75, 0.75, BINER_R - 0.75, BINER_R, G.frameOf([x, BINER_Y, BINER_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P), { tone: "hi" })).join("");
}
function ropeBag() {
  const [x, y] = BAG;
  const out = [];
  out.push(S(k.cylinder(x, y, 9, MAT_T, 7, P, 36, 0.6), { tone: "lo", inner: L(k.sideArc(x, y, 9, MAT_T + 2.4, P, 24), { tone: "faint" }) }));
  out.push(L([7, 5.6, 4.2].map((r) => k.ring(x, y, r, MAT_T + 7, P, 28)).join(""), { tone: "mid" }));
  return out.join("");
}
function device() {
  const [x, y, z] = DEVICE;
  const out = [];
  out.push(S(k.cylinder(x, y + 1.6, 1.1, z - 3.4, 2.2, P, 14), { tone: "mid" })); // locking carabiner on the belay loop
  out.push(box(x - 1.4, x + 1.4, y - 0.8, y + 0.8, z - 2.2, z + 2.2, { tone: "hi" }, 0.6, 3, 0.2));
  out.push(D([at([x + 1.4, y, z + 1])], { size: 0.5, tone: "lo" }));
  return out.join("");
}

// ---------- people ----------
const belayerJ = (() => {
  const [bx, by] = BELAYER;
  const pelvis = [bx, by - 0.6, 38];
  const guide = [bx - 5.5, by - 9, 58]; // provisional, refined in the page from the strand
  return M.pose({ pelvis, lean: 0.25, hands: [[bx - 4.5, by - 8.5, 33], [bx + 6, by - 7, 56]], feet: [[bx - 6, by + 3, MAT_T + 2.2], [bx + 6, by - 4, MAT_T + 2.2]] });
})();

// ---------- assemble ----------
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A top-rope climbing lane: a 6 m plywood wall with holds, a two-bolt anchor with two carabiners at the top, a climber tied into the rope, and a belayer on the mat with an assisted-braking device. The rope runs from the climber up over the carabiners and down to the device; marks every 0.5 m spread apart when the rope stretches in a fall.",
  body: [
    floor(),
    wall(),
    holds(),
    anchor(),
    `<g data-part="climb-rope"></g>`,
    carabiners(),
    `<g data-part="climber"></g>`,
    `<g data-part="belay-rope"></g>`,
    `<g data-part="belayer"><g data-part="belayer-body">${M.personSvg(lib, belayerJ, { tone: "mid", harness: true })}</g>${device()}</g>`,
    `<g data-part="brake-rope"></g>`,
    ropeBag(),
  ],
});

// ---------- live ----------
const live = `
${latheScript()}
${manScript()}
const P = ${JSON.stringify(P)};
const k = { solidSvg, lineSvg, dotsSvg, depthOf, iso, pathOf };
const lib = { k, G, P };
const U = ${U}, MAT_T = ${MAT_T}, CX = ${CX}, BINER = ${JSON.stringify(BINER)}, BINER_Y = ${BINER_Y}, ROPE_TOP = ${ROPE_TOP};
const DEVICE = ${JSON.stringify(DEVICE)}, BAG = ${JSON.stringify(BAG)}, BELAYER = ${JSON.stringify(BELAYER)};
const PHYS = ${JSON.stringify(PHYS)}, HOLD_STEP = ${HOLD_STEP};
const handHold = ${handHold.toString()};
const footHold = ${footHold.toString()};
const host = document.querySelector(".iso-stage");
const svg = host.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const climberG = q('[data-part="climber"]'), climbRope = q('[data-part="climb-rope"]');
const belayRope = q('[data-part="belay-rope"]'), brakeRope = q('[data-part="brake-rope"]'), belayerG = q('[data-part="belayer"]');
const g = 9.81;

// state, heights in metres
const S = { h: 0.95, target: 0.95, slack: 0.3, slackTarget: 0.3, mode: "climb", w: 0, d: 0, vd: 0, yb: 0, vb: 0, t: 0, peak: 0, peakB: 0, maxD: 0, maxYb: 0, k: 0, c: 0, Lc: 0, Lb: 0, Tc: 0, Tb: 0, hold: 0 };
const H = ROPE_TOP / U;
const MIN_H = 0.95, MAX_H = 4.7;
const devicePt = () => [DEVICE[0] - 0.2, DEVICE[1] - 0.4, DEVICE[2] + 2.2 + S.yb * U];
const strandLb = () => { const d = devicePt(); return Math.hypot(d[0] - BINER[1], d[1] - BINER_Y, d[2] - ROPE_TOP) / U; };

function startFall() {
  if (S.mode !== "climb") return;
  S.Lc = H - S.h; S.Lb = strandLb();
  S.k = (PHYS.r * PHYS.EA) / (S.Lb + PHYS.r * S.Lc);
  S.c = 2 * PHYS.zeta * Math.sqrt(S.k * PHYS.mc);
  Object.assign(S, { mode: "fall", d: 0, vd: 0, yb: 0, vb: 0, t: 0, peak: 0, peakB: 0, maxD: 0, maxYb: 0, Tc: 0, Tb: 0 });
  host.setAttribute("aria-valuetext", "Fall from " + feet(S.h).toFixed(1) + " m with " + S.slack.toFixed(2) + " m of slack");
}
const feet = (h) => h - 0.95; // feet above the mat when standing in the harness
function simulate(dt) {
  const n = Math.ceil(dt * 3000), h = dt / n;
  for (let i = 0; i < n; i++) {
    const E = S.d - S.slack - S.yb, Ed = S.vd - S.vb;
    S.Tc = E > 0 ? Math.max(0, S.k * E + S.c * Ed) : 0;
    S.Tb = S.Tc / PHYS.r;
    S.vd += (g - S.Tc / PHYS.mc) * h; S.d += S.vd * h;
    if (S.yb > 0 || S.Tb > PHYS.mb * g) { S.vb += (S.Tb / PHYS.mb - g) * h; S.yb += S.vb * h; if (S.yb < 0) { S.yb = 0; S.vb = 0; } }
    S.peak = Math.max(S.peak, S.Tc); S.peakB = Math.max(S.peakB, S.Tb); S.maxD = Math.max(S.maxD, S.d); S.maxYb = Math.max(S.maxYb, S.yb);
    if (S.h - S.d < MIN_H - 0.02) { S.d = S.h - MIN_H + 0.02; S.vd = 0; S.mode = "decked"; S.hold = 0; return; }
  }
  S.t += dt;
  if (S.t > 1.2 && Math.abs(S.vd) < 0.03 && Math.abs(S.vb) < 0.03 && S.yb === 0) { S.mode = "caught"; S.hold = 0; }
}
function settleNow() { while (S.mode === "fall") simulate(1 / 30); }

// poses
function climbPose(hz, w) {
  const z = hz * U;
  const pel = [CX, 12 + w * 12, z];
  const hand = (s) => {
    const u = (z + 30 - 40 - (s ? 9 : 0)) / HOLD_STEP, i = Math.floor(u), f = u - i;
    const a = handHold(s, i), b = handHold(s, i + 1), m = smooth(0.62, 1, f);
    const onWall = [a[0], 3.1, a[1] + (b[1] - a[1]) * m + 1.2 + Math.sin(m * Math.PI) * 4];
    const onRope = [CX + (s ? 1.2 : -1.2), 8 + w * 9, z + 22 + (s ? 5 : 0)];
    return lerp(onWall, onRope, w);
  };
  const foot = (s) => {
    const u = (z - 30 - 6 - (s ? 9 : 0)) / HOLD_STEP, i = Math.floor(u), f = u - i;
    const a = footHold(s, i), b = footHold(s, i + 1), m = smooth(0.55, 1, f);
    let onWall = [a[0], 3.4, a[1] + (b[1] - a[1]) * m + 2 + Math.sin(m * Math.PI) * 3];
    if (z < 48) onWall = [CX + (s ? 6 : -6), 14 + (s ? 4 : -2), MAT_T + 2.2];
    const hang = [CX + (s ? 6 : -7), 3.6, z - 20 + (s ? 3 : 0)];
    return lerp(onWall, hang, w);
  };
  return pose({ pelvis: pel, lean: w, hands: [hand(0), hand(1)], feet: [foot(0), foot(1)] });
}
const tieIn = (J) => add(J.pelvis, [0, -3.6, 3]);

// rope: a lit core over a dark sheath, with a mark every 0.5 m of rope
function ropeSvg(points, marks) {
  const d = pathOf(points.map((p) => iso(p, P)));
  return '<path class="iso-line" data-tone="lo" d="' + d + '" style="stroke-width:2.4"/><path class="iso-line" data-tone="lit" d="' + d + '" style="stroke-width:1.2"/>' + dotsSvg(marks, { size: 1.05, tone: "lo" });
}
function along(points, dist) {
  for (let i = 1; i < points.length; i++) {
    const l = len(sub(points[i], points[i - 1]));
    if (dist <= l) return lerp(points[i - 1], points[i], dist / l);
    dist -= l;
  }
  return null;
}
function polyLen(points) { let s = 0; for (let i = 1; i < points.length; i++) s += len(sub(points[i], points[i - 1])); return s; }
function sagged(a, b, extra, span = 1) {
  // a strand from a to b; the extra length hangs as a parabolic belly over the last \`span\` of it (the belayer's end)
  const chord = len(sub(b, a)), dir = unit(sub(b, a));
  const down = unit(sub([0, 0.35, -1], mul(dir, dot([0, 0.35, -1], dir))));
  const depth = Math.sqrt(Math.max(0, (3 * chord * span * extra) / 8));
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32, u = (t - (1 - span)) / span;
    pts.push(add(lerp(a, b, t), mul(down, u > 0 ? 4 * depth * u * (1 - u) : 0)));
  }
  return pts;
}

let J = climbPose(S.h, 0);
function draw() {
  const hz = S.h - (S.mode === "climb" ? 0 : S.d);
  J = climbPose(hz, S.w);
  climberG.innerHTML = personSvg(lib, J, { tone: "hi", harness: true });
  const knot = tieIn(J);
  const epsC = S.Tc / PHYS.EA, epsB = S.Tb / PHYS.EA;
  const left = [BINER[0] - 0.9, BINER_Y, ROPE_TOP], right = [BINER[1] + 0.9, BINER_Y, ROPE_TOP];
  const climb = [knot, [knot[0], knot[1], knot[2] + 1.5], left, right];
  const dev = devicePt();
  const slackNow = S.mode === "climb" ? S.slack : Math.max(0, S.slack + S.yb - (S.d - 0));
  const belay = sagged(right, dev, Math.max(0, slackNow) * U, 0.3);
  // marks at fixed points of the rope, counted from the knot
  const marks = [], marksB = [];
  const lc = polyLen(climb.slice(0, 3));
  const matC = lc / (1 + epsC);
  for (let m = 20; m < 420; m += 20) {
    let p;
    if (m <= matC) p = along(climb, m * (1 + epsC));
    else {
      const rest = (m - matC) * (1 + epsB);
      const top = len(sub(right, left));
      p = rest <= top ? lerp(left, right, rest / top) : along(belay, rest - top);
      if (p && rest > top) { marksB.push(iso(p, P)); continue; }
    }
    if (p) marks.push(iso(p, P));
  }
  climbRope.innerHTML = ropeSvg([...climb.slice(0, 3), right], marks.slice(0, marks.length));
  belayRope.innerHTML = ropeSvg(belay, marksB);
  const brakeHand = add(dev, [-4.2, 4.6, -9 + S.yb * 0]);
  brakeRope.innerHTML = ropeSvg(sagged(add(dev, [0, 0, -4.4]), [BAG[0] - 2, BAG[1] - 1, MAT_T + 7], 18), []);
  belayerG.setAttribute("transform", translateAlong(P, [0, 0, S.yb * U]));
  // readout from the same instant of the model
  let text;
  if (S.mode === "climb") text = "feet " + feet(S.h).toFixed(1) + " m · slack " + S.slack.toFixed(2) + " m";
  else if (S.mode === "fall") text = "falling " + S.d.toFixed(2) + " m · " + (S.Tc / 1000).toFixed(2) + " kN";
  else if (S.mode === "decked") text = "ground fall · slack " + S.slack.toFixed(2) + " m";
  else text = "drop " + S.maxD.toFixed(2) + " m · " + (S.peak / 1000).toFixed(2) + " kN · belayer +" + Math.round(S.maxYb * 100) + " cm";
  if (readout.textContent !== text) readout.textContent = text;
}

// loop
let frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourStep = 0, tourClock = 0;
const TOUR = [
  { h: 4.4, slack: 0.3, fall: true },
  { h: 2.6, slack: 0.3, fall: false },
  { h: 1.9, slack: 1.0, fall: true },
  { h: 3.0, slack: 0.15, fall: true },
];
function tick(now) {
  const dt0 = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const dt = dt0 * (window.__driveSpeed || 1);
  S.slack += (S.slackTarget - S.slack) * (1 - Math.exp(-dt / 0.35));
  if (S.mode === "climb") {
    S.w += (0 - S.w) * (1 - Math.exp(-dt / 0.3));
    const v = 0.35, dh = S.target - S.h;
    S.h += Math.sign(dh) * Math.min(Math.abs(dh), v * dt * Math.min(1, Math.abs(dh) / 0.15 + 0.2));
    if (touring) {
      const step = TOUR[tourStep % TOUR.length];
      S.target = step.h; S.slackTarget = step.slack;
      if (Math.abs(S.h - step.h) < 0.005 && Math.abs(S.slack - step.slack) < 0.01) {
        tourClock += dt;
        if (tourClock > 0.9) { tourClock = 0; tourStep++; if (step.fall) startFall(); }
      }
    }
  } else if (S.mode === "fall") {
    S.w += (1 - S.w) * (1 - Math.exp(-dt / 0.18));
    if (still.matches) settleNow(); else simulate(dt);
  } else {
    S.hold += dt;
    if (S.mode === "caught" || S.mode === "decked") {
      S.w += ((S.mode === "decked" ? 0 : 1) - S.w) * (1 - Math.exp(-dt / 0.3));
      if (S.hold > 2.6) {
        // back on the wall: the belayer takes the stretch in, the climber is where the fall left them
        S.h = Math.max(MIN_H, S.h - S.d); S.target = S.h; S.d = 0; S.Tc = 0; S.Tb = 0; S.yb = 0; S.mode = "climb";
      }
    }
  }
  draw();
  const busy = touring || S.mode !== "climb" || Math.abs(S.target - S.h) > 0.002 || Math.abs(S.slackTarget - S.slack) > 0.002 || S.w > 0.002;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const pause = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; tourClock = 0; run(); }, 3600); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(host);
if (still.matches) touring = false;

host.addEventListener("pointermove", (e) => {
  const box = svg.getBoundingClientRect();
  const fy = Math.min(1, Math.max(0, ((e.clientY - box.top) / box.height - 0.12) / 0.7));
  const fx = Math.min(1, Math.max(0, ((e.clientX - box.left) / box.width - 0.15) / 0.7));
  pause();
  if (S.mode === "climb") { S.target = MAX_H - fy * (MAX_H - MIN_H); S.slackTarget = Math.round(fx * 12) / 10; }
  run();
});
host.addEventListener("click", () => { pause(); startFall(); run(); });
host.addEventListener("keydown", (e) => {
  let used = true;
  if (e.key === "ArrowUp") S.target = Math.min(MAX_H, S.target + 0.25);
  else if (e.key === "ArrowDown") S.target = Math.max(MIN_H, S.target - 0.25);
  else if (e.key === "ArrowRight") S.slackTarget = Math.min(1.2, Math.round(S.slackTarget * 10 + 1) / 10);
  else if (e.key === "ArrowLeft") S.slackTarget = Math.max(0, Math.round(S.slackTarget * 10 - 1) / 10);
  else if (e.key === " " || e.key === "Enter") startFall();
  else used = false;
  if (!used) return;
  e.preventDefault(); pause();
  if (e.key.startsWith("Arrow")) host.setAttribute("aria-valuetext", "Feet " + feet(S.target).toFixed(1) + " m up, slack " + S.slackTarget.toFixed(1) + " m");
  run();
});
draw();
`;

const css = `<style>
.iso-stage { cursor: pointer; touch-action: pan-y; }
.iso-stage:focus-visible { outline: 1px solid var(--anatomy-muted); outline-offset: 6px; }
</style>`;
const body = css + k.plateHtml({
  fig: "Fig 2",
  title: "Top-rope belay",
  hint: "Hover, then click to fall",
  readout: "feet 0.0 m · slack 0.30 m",
  keys: [
    { mark: "lit", label: "The rope, marked every 0.5 m" },
    { mark: "raised", label: "Climber, 75 kg" },
    { mark: "flat", label: "Belayer, 70 kg, with an assisted-braking device" },
  ],
  caption:
    "The rope runs from the climber's tie-in up over two carabiners and down to the belayer's device. In a fall the climber drops through the slack, then the rope stretches: a dynamic rope gives about 8% under a hanging 80 kg climber, and the marks spread to show it. Friction where the rope bends 180° over the carabiners (about 1.7×) means the belayer feels only part of the climber's load, but enough of it lifts a lighter belayer off the mat. Low on the wall more rope is out, so the same fall stretches further: there, slack can mean a ground fall.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Top-rope belay: arrow up and down move the climber, left and right change the slack, Space makes the climber fall" aria-valuetext="Climber on the ground">${svg}</div>`,
});

const file = theme === "light" ? "belay-rope-light.html" : "belay-rope.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Top-rope belay", theme, body, script: kitScript() + live }));
console.log("wrote", file);
