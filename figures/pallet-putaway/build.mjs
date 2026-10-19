// Fig: a selective pallet rack and a counterbalance forklift doing a putaway.
// World units are 20 mm. x runs along the aisle, y from the rack (−) into the aisle (+), z up.
// node build.mjs [--light]   writes pallet-putaway.html (or -light.html) next to this script.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const kitScript = () => readFileSync(join(HERE, "kit/iso-kit.mjs"), "utf8").replace(/^export /gm, "");

const MM = 20;
const WIDTH = 620;
const HEIGHT = 600;

// ---------- the truth ----------
// Rack: one bay, 2,300 mm clear between 90 × 70 mm uprights, 1,100 mm deep frames, beams at 1,500 mm pitch.
const COL_W = 4.5; // 90 mm
const COL_D = 3.5; // 70 mm
const FRAMES = [0, 119.5]; // frame x (left edge of its uprights)
const BAY = [FRAMES[0] + COL_W, FRAMES[1]]; // 2,300 mm clear
const DEPTH = 55; // 1,100 mm frame
const UPRIGHT_H = 270; // 5,400 mm
const LEVELS = [0, 75, 150, 225]; // beam tops: floor, 1,500, 3,000, 4,500 mm
const BEAM_H = 5.5; // 110 mm step beam
const BEAM_D = 2.5; // 50 mm
const DECK_T = 0.6; // wire deck
const SURFACE = LEVELS.map((z, i) => (i === 0 ? 0 : z + DECK_T)); // what the pallet sits on
// Pallet: 1,000 wide × 1,200 deep block pallet, 144 mm, load 1,040 mm, 100 mm gaps either side.
const PAL_W = 50, PAL_D = 60, PAL_H = 7.2, LOAD_H = 52;
const POS = [BAY[0] + 5 + PAL_W / 2, BAY[0] + 10 + PAL_W * 1.5]; // pallet centre x, positions A and B
const PAL_Y0 = -DEPTH - 2.5; // 50 mm overhang front and back
const POCKET = 5; // top of the fork pocket above the pallet's base
const STAGE_X = FRAMES[1] + COL_W + 10 + PAL_W / 2; // P&D spot beside the rack
// Truck: 2.5 t counterbalance, triplex mast, 1,550 mm free lift, 4,800 mm lift, 1,100 mm forks.
const FORK_L = 55, FORK_T = 2, FORK_W = 6, FORK_C = 11.25; // fork centres ±225 mm, in the pallet's pockets
const FREE = 77.5;
const Y_OUT = 68; // heel position clear of the rack face
const Y_IN = PAL_Y0 + PAL_D; // heel against a pallet that is fully in
const TRAVEL_F = 12.5; // fork top 250 mm: pallet base 150 mm off the floor
const LIFT_ABOVE = 5; // 100 mm over the beam before driving in
const FREE_F = 3; // forks 40 mm under the pocket roof once the pallet is down

const P = k.fitProjection(
  [
    ...k.boxCorners({ x: -26, y: -76, w: 238, d: 268 }, -4, 0),
    [FRAMES[0], -DEPTH, LEVELS[3] + SURFACE[3] - LEVELS[3] + PAL_H + LOAD_H],
    [POS[0], 4, 300],
    [FRAMES[1] + COL_W, -DEPTH, UPRIGHT_H],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 30 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style = {}) => k.solidSvg(paths, style);
const L = (d, style = {}) => k.lineSvg(d, style);
const D = (pts, style = {}) => k.dotsSvg(pts, style);
const box = (x0, x1, y0, y1, z0, z1, style = {}, r = 0.4, steps = 2, bevel = 0) =>
  S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style });
const poly = (pts) => k.pathOf(pts.map(at), true);
const seg = (a, b) => k.segment(a, b, P);
const depth = (p) => k.depthOf(p, P);
// A bar from a to b with a w × h cross-section (w along `side`).
function bar(a, b, w, h, side, style = {}) {
  const axis = G.unit3(G.sub3(b, a));
  const v = G.unit3(G.cross3(axis, side));
  const u = G.cross3(v, axis);
  const F = G.frameOf(a, axis, u, v);
  return S(G.prismOf(F, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 0, G.len3(G.sub3(b, a)), P), { tone: "mid", ...style });
}
// A closed rounded slot on a face at y = const (the aisle face).
const slotY = (x, y, z, w, h) => {
  const r = w / 2, pts = [];
  for (let i = 0; i <= 6; i++) { const t = Math.PI * (i / 6); pts.push([x + Math.cos(t) * r, y, z + h / 2 - r + Math.sin(t) * r]); }
  for (let i = 0; i <= 6; i++) { const t = Math.PI + Math.PI * (i / 6); pts.push([x + Math.cos(t) * r, y, z - h / 2 + r + Math.sin(t) * r]); }
  return poly(pts);
};
const slotX = (x, y, z, w, h) => {
  const r = w / 2, pts = [];
  for (let i = 0; i <= 6; i++) { const t = Math.PI * (i / 6); pts.push([x, y + Math.cos(t) * r, z + h / 2 - r + Math.sin(t) * r]); }
  for (let i = 0; i <= 6; i++) { const t = Math.PI + Math.PI * (i / 6); pts.push([x, y + Math.cos(t) * r, z - h / 2 + r + Math.sin(t) * r]); }
  return poly(pts);
};

// ---------- floor ----------
function floor() {
  const plan = { x: -26, y: -76, w: 238, d: 268, r: 6 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -4, 4, P)}"/>`];
  out.push(S(k.slabOf(plan, -4, 4, P, 6, 1.2), { tone: "lo" }));
  // aisle edge line and a saw-cut joint, edge to edge on the slab
  out.push(L(k.lineOnTop([plan.x + 1.2, 8], [plan.x + plan.w - 1.2, 8], 0, P), { tone: "mid" }));
  out.push(L(k.lineOnTop([plan.x + 1.2, 10], [plan.x + plan.w - 1.2, 10], 0, P), { tone: "mid" }));
  out.push(L(k.lineOnTop([plan.x + 1.2, 120], [plan.x + plan.w - 1.2, 120], 0, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([96, plan.y + 1.2], [96, 8], 0, P), { tone: "faint" }));
  // P&D box beside the rack
  const pd = { x: STAGE_X - PAL_W / 2 - 3, y: PAL_Y0 - 3, w: PAL_W + 6, d: PAL_D + 6, r: 1 };
  out.push(L(k.planOutline(pd, 0, P, 2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(pd, 1.4), 0, P, 2), { tone: "mid" }));
  // floor plate with a ruler of the aisle: 100 mm ticks, every metre major
  const strip = { x: 14, y: 176, w: 152, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 1, strip.x + strip.w - 1, 5, 10, strip.y, 0.5, [1.8, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const plate = { x: 172, y: 172, w: 30, d: 14, r: 1 };
  out.push(S(k.slabOf(plate, 0, 0.7, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), 0.7, P, 3), { tone: "faint" }));
  [[4, 22], [7, 16], [10, 19]].forEach(([dy, len]) => out.push(L(k.lineOnTop([plate.x + 4, plate.y + dy], [plate.x + 4 + len, plate.y + dy], 0.7, P), { tone: "lo", free: true })));
  out.push(D([at([plate.x + 2, plate.y + 2, 0.7]), at([plate.x + plate.w - 2, plate.y + plate.d - 2, 0.7])], { size: 0.45 }));
  return out.join("");
}

// ---------- rack ----------
const frameX = (i) => FRAMES[i];
function basePlate(x, y) {
  const out = [];
  out.push(box(x - 1.6, x + COL_W + 1.6, y - 1.2, y + COL_D + 1.2, 0, 0.5, { tone: "lo" }, 0.3));
  out.push(D([at([x - 0.7, y + COL_D / 2, 0.5]), at([x + COL_W + 0.7, y + COL_D / 2, 0.5])], { size: 0.55 }));
  return out.join("");
}
function column(x, y0, front) {
  const y1 = y0 + COL_D;
  const out = [basePlate(x, y0)];
  const holes = [];
  for (let z = 6; z < UPRIGHT_H - 3; z += 3.75) holes.push(front ? slotY(x + COL_W / 2, y1, z, 0.9, 1.9) : "");
  const side = [];
  for (let z = 6; z < UPRIGHT_H - 3; z += 3.75) side.push(slotX(x + COL_W, y0 + COL_D / 2, z + 1.8, 0.8, 1.5));
  const folds = front ? L(seg([x + 1, y1, 0.5], [x + 1, y1, UPRIGHT_H]) + seg([x + COL_W - 1, y1, 0.5], [x + COL_W - 1, y1, UPRIGHT_H]), { tone: "faint" }) : "";
  out.push(S(k.slabOf({ x, y: y0, w: COL_W, d: COL_D, r: 0.3 }, 0.5, UPRIGHT_H - 0.5, P, 2), {
    tone: "mid",
    inner: folds + L(holes.join("") + side.join(""), { tone: "lo" }),
  }));
  out.push(box(x - 0.2, x + COL_W + 0.2, y0 - 0.2, y1 + 0.2, UPRIGHT_H, UPRIGHT_H + 0.6, { tone: "mid" }, 0.3));
  return out.join("");
}
// Frame bracing between the front and back uprights, in the plane x = cx.
function bracing(i) {
  const cx = frameX(i) + COL_W / 2;
  const yb = -DEPTH + COL_D, yf = -COL_D;
  const nodes = [8, 45, 85, 125, 165, 205, 243];
  const items = [];
  const side = [1, 0, 0];
  items.push({ d: 0, s: bar([cx, yb, nodes[0]], [cx, yf, nodes[0]], 2, 2.2, side) });
  items.push({ d: 0, s: bar([cx, yb, nodes[nodes.length - 1]], [cx, yf, nodes[nodes.length - 1]], 2, 2.2, side) });
  items.push({ d: 0, s: bar([cx, yb, 37], [cx, yf, 37], 2, 2.2, side) });
  for (let j = 0; j < nodes.length - 1; j++) {
    const a = [cx, j % 2 ? yf : yb, nodes[j] + 1.2], b = [cx, j % 2 ? yb : yf, nodes[j + 1] - 1.2];
    items.push({ d: 0, s: bar(a, b, 1.8, 2, side, { tone: "mid" }) });
  }
  const out = items.map((it) => it.s);
  out.push(D([nodes[0], 37, nodes[nodes.length - 1]].flatMap((z) => [at([cx + 1, yb + 0.6, z]), at([cx + 1, yf - 0.6, z])]), { size: 0.4 }));
  return out.join("");
}
function loadSign(i) {
  // Load notice on the end frame, bolted to the 740 mm horizontal.
  const x = frameX(i) + COL_W / 2 + 1, y0 = -42, y1 = -14, z0 = 39.2, z1 = 55;
  const plan = { x, y: y0, w: 0.6, d: y1 - y0, r: 0.2 };
  const rules = [[49, 18], [46, 22], [43, 14]].map(([z, len]) => seg([x + 0.6, y1 - 3, z], [x + 0.6, y1 - 3 - len, z])).join("");
  const out = [S(k.slabOf(plan, z0, z1 - z0, P, 2), { tone: "hi", inner: L(poly([[x + 0.6, y0 + 1.2, z0 + 1.2], [x + 0.6, y1 - 1.2, z0 + 1.2], [x + 0.6, y1 - 1.2, z1 - 1.2], [x + 0.6, y0 + 1.2, z1 - 1.2]]), { tone: "faint" }) })];
  out.push(L(rules, { tone: "lo", free: true }));
  out.push(k.faceTextSvg(k.sideMatrix([x + 0.6, y1 - 3, 51.4], 0, P, "right"), "2000 KG", { size: 2.6, tone: "mid" }));
  out.push(D([at([x + 0.6, y0 + 2.4, z0 + 2]), at([x + 0.6, y1 - 2.4, z0 + 2])], { size: 0.45 }));
  return out.join("");
}
function beam(level, y0, front) {
  const zt = LEVELS[level];
  const out = [];
  const lip = front ? L(seg([BAY[0], y0 + BEAM_D, zt - 1.3], [BAY[1], y0 + BEAM_D, zt - 1.3]), { tone: "faint" }) : "";
  out.push(S(k.slabOf({ x: BAY[0], y: y0, w: BAY[1] - BAY[0], d: BEAM_D, r: 0.2 }, zt - BEAM_H, BEAM_H, P, 2), { tone: "mid", inner: lip }));
  if (front) {
    // end connectors hooked into the upright face, with their safety locks
    for (const [x0, x1] of [[FRAMES[0] + 0.8, FRAMES[0] + COL_W], [FRAMES[1], FRAMES[1] + COL_W - 0.8]]) {
      out.push(box(x0, x1, 0, 0.5, zt - 9, zt + 0.5, { tone: "mid" }, 0.2));
      out.push(D([at([(x0 + x1) / 2, 0.5, zt - 2.5]), at([(x0 + x1) / 2, 0.5, zt - 6.5])], { size: 0.5, tone: "hi" }));
    }
    // location labels on the beam face, one per position
    POS.forEach((cx, p) => {
      const yf = y0 + BEAM_D;
      out.push(L(poly([[cx - 4, yf, zt - 4.6], [cx + 4, yf, zt - 4.6], [cx + 4, yf, zt - 0.9], [cx - 4, yf, zt - 0.9]]), { tone: "lo" }));
      const bars = [];
      for (let b = 0; b < 9; b++) { const x = cx - 3.3 + b * (b % 3 ? 0.55 : 0.9); bars.push(seg([x, yf, zt - 4.0], [x, yf, zt - 2.6])); }
      out.push(L(bars.join(""), { tone: "mid", free: true }));
      out.push(L(seg([cx + 0.9, yf, zt - 1.8], [cx + 3.2, yf, zt - 1.8]), { tone: "lo", free: true }));
    });
  }
  return out.join("");
}
function deck(level) {
  const zt = LEVELS[level];
  const out = [];
  for (const [x0, x1] of [[BAY[0] + 0.3, (BAY[0] + BAY[1]) / 2 - 0.3], [(BAY[0] + BAY[1]) / 2 + 0.3, BAY[1] - 0.3]]) {
    const plan = { x: x0, y: -DEPTH + 0.2, w: x1 - x0, d: DEPTH - 0.4, r: 0.3 };
    const wires = [];
    for (let x = x0 + 2.4; x < x1 - 1; x += 2.4) wires.push(k.lineOnTop([x, plan.y + 0.2], [x, plan.y + plan.d - 0.2], zt + DECK_T, P));
    for (const y of [-41, -27.5, -14]) wires.push(k.lineOnTop([x0 + 0.2, y], [x1 - 0.2, y], zt + DECK_T, P));
    out.push(S(k.slabOf(plan, zt, DECK_T, P, 2), { tone: "lo", crease: "none", inner: L(wires.join(""), { tone: "faint" }) }));
  }
  return out.join("");
}

// ---------- pallet ----------
// Built at its own origin (x0, y0, z0 = 0). Split into three columns so a fork can be drawn in each pocket.
const BLOCK_X = [[0, 5], [22.5, 27.5], [45, 50]];
const BLOCK_Y = [[0, 7.25], [26.4, 33.6], [52.75, 60]];
function palletParts(lit) {
  const cols = BLOCK_X.map(([x0, x1]) => {
    const out = [];
    out.push(box(x0, x1, 0, PAL_D, 0, 1.1, { tone: "lo" }, 0.2));
    for (const [y0, y1] of BLOCK_Y) out.push(box(x0, x1, y0, y1, 1.1, POCKET, { tone: "lo" }, 0.3));
    out.push(box(x0, x1, 0, PAL_D, POCKET, 6.1, { tone: "lo" }, 0.2));
    out.push(D(BLOCK_Y.map(([y0, y1]) => at([x1, (y0 + y1) / 2, 5.55])), { size: 0.35, tone: "lo" }));
    return out.join("");
  });
  const top = [];
  for (let i = 0; i < 5; i++) {
    const y0 = i * 13.25;
    top.push(box(0, PAL_W, y0, y0 + 7, 6.1, PAL_H, { tone: "lo" }, 0.2));
  }
  // the load: four layers of cartons, stretch wrapped
  const lp = { x: 0.6, y: 0.6, w: PAL_W - 1.2, d: PAL_D - 1.2, r: 0.8 };
  const z0 = PAL_H, z1 = PAL_H + LOAD_H;
  const lines = [];
  for (let j = 1; j < 4; j++) lines.push(k.sideSeam(lp, z0 + (LOAD_H / 4) * j, P, 3));
  for (const y of [15.3, 30, 44.7]) lines.push(seg([lp.x + lp.w, y, z0], [lp.x + lp.w, y, z1]));
  for (const x of [12.8, 25, 37.2]) lines.push(seg([x, lp.y + lp.d, z0], [x, lp.y + lp.d, z1]));
  for (const y of [15.3, 30, 44.7]) lines.push(k.lineOnTop([lp.x + 0.3, y], [lp.x + lp.w - 0.3, y], z1, P));
  for (const x of [12.8, 25, 37.2]) lines.push(k.lineOnTop([x, lp.y + 0.3], [x, lp.y + lp.d - 0.3], z1, P));
  const yf = lp.y + lp.d;
  const label = poly([[28, yf, 40], [36, yf, 40], [36, yf, 45], [28, yf, 45]]);
  const labelText = [43.6, 42.2, 41.0].map((z, i) => seg([29, yf, z], [29 + [6, 4.5, 5.2][i], yf, z])).join("");
  top.push(S(k.slabOf(lp, z0, LOAD_H, P, 3, 0.8), {
    tone: "hi",
    lit,
    crease: lit ? "faint" : "lo",
    inner: L(lines.join(""), { tone: "faint" }) + L(label, { tone: "lo" }) + L(labelText, { tone: "lo", free: true }),
  }));
  return { a: cols[0], b: cols[1], c: cols[2] + top.join("") };
}
const STORED = palletParts(false);
const CARRIED = palletParts(true);
const storedSvg = STORED.a + STORED.b + STORED.c;

// ---------- forks (move with the truck and the carriage) ----------
function fork(cx) {
  const out = [];
  out.push(box(cx - FORK_W / 2, cx + FORK_W / 2, -FORK_L, 0.4, -FORK_T, 0, { tone: "hi" }, 0.6, 3, 0.3));
  out.push(box(cx - FORK_W / 2, cx + FORK_W / 2, 0, 2, -FORK_T, 22, { tone: "hi" }, 0.4, 2, 0.3));
  out.push(L(k.lineOnTop([cx - FORK_W / 2 + 0.3, -FORK_L + 6], [cx + FORK_W / 2 - 0.3, -FORK_L + 6], 0, P), { tone: "faint" }));
  return out.join("");
}

// ---------- truck ----------
// Local frame: x across the truck, y = 0 at the fork heel, y+ toward the counterweight.
const MAST_Y = [5, 12];
function wheel(x0, x1, yc, zc, r, outer) {
  const F = G.frameAlong([x0, yc, zc], [1, 0, 0]);
  const w = x1 - x0;
  const out = [];
  const tread = G.ribsOf(F, 0, w, r, 44, P, { fade: [0.05, 0.5] });
  out.push(S(G.disc(0, w, r, F, P), { tone: "lo", inner: k.fadedSvg(tread, { tone: "faint" }) }));
  if (outer) {
    out.push(L(G.circleOf(F, w, r * 0.64, P), { tone: "lo" }));
    out.push(S(G.disc(w, w + 0.8, r * 0.46, F, P), { tone: "mid" }));
    out.push(S(G.disc(w + 0.8, w + 1.6, r * 0.2, F, P), { tone: "mid" }));
    out.push(D(G.dotsOf(F, w + 0.8, r * 0.34, 6, P, { all: true }), { size: 0.5 }));
  }
  return out.join("");
}
function carriage() {
  // Built at fork top f = 0 and moved up by f.
  const out = [];
  out.push(box(-26, 26, 2, 4.6, 1, 8, { tone: "mid" }, 0.5, 2, 0.3));
  for (const x of [-14, 12]) out.push(box(x, x + 2, 4.6, 6, 2, 22, { tone: "mid" }, 0.2));
  const verticals = [-24, -16, -8, 0, 8, 16, 24];
  for (const x of verticals) out.push(box(x - 0.8, x + 0.8, 2.6, 3.8, 22, 60, { tone: "mid" }, 0.3));
  out.push(box(-26, 26, 2, 4.6, 16, 22.4, { tone: "mid" }, 0.5, 2, 0.3));
  out.push(box(-25.5, 25.5, 2.2, 4.2, 40, 42, { tone: "mid" }, 0.4));
  out.push(box(-25.5, 25.5, 2.2, 4.2, 59, 62, { tone: "mid" }, 0.6, 2, 0.3));
  // fork hooks over the top bar, with their locating pins
  for (const cx of [-FORK_C, FORK_C]) {
    out.push(box(cx - FORK_W / 2, cx + FORK_W / 2, 0, 5, 22.4, 24, { tone: "hi" }, 0.3));
    out.push(S(k.cylinder(cx, 2.5, 0.9, 24, 1.2, P, 12), { tone: "mid" }));
  }
  // chain anchors
  for (const x of [-5, 5]) out.push(box(x - 1.2, x + 1.2, 3, 6.2, 22.4, 24.4, { tone: "mid" }, 0.2));
  out.push(D([-20, -10, 10, 20].map((x) => at([x, 4.6, 19.2])), { size: 0.45 }));
  return out.join("");
}
function channel(x0, x1, y0, y1, z0, z1) {
  // An I-section mast channel: web line on the visible flange, roller bolt heads.
  const seam = L(seg([x0 + (x1 - x0) / 2, y1, z0], [x0 + (x1 - x0) / 2, y1, z1]), { tone: "faint" });
  return S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.4 }, z0, z1 - z0, P, 2, 0.3), { tone: "mid", inner: seam }) +
    D([at([x0 + (x1 - x0) / 2, y1, z0 + 4]), at([x0 + (x1 - x0) / 2, y1, z1 - 4])], { size: 0.5 });
}
const OUTER = [[-24, -20], [20, 24]];
const MIDDLE = [[-20, -16], [16, 20]];
const INNER = [[-16, -12], [12, 16]];
function mastStage(pair, y0, y1, z0, z1, crossY, crossZ, side) {
  const [x0, x1] = side === "left" ? pair[0] : pair[1];
  return channel(x0, x1, y0, y1, z0, z1);
}
function crossbar(pair, y0, y1, z0, z1) {
  return box(pair[0][0], pair[1][1], y0, y1, z0, z1, { tone: "mid" }, 0.4, 2, 0.4);
}
function truckBody() {
  const out = [];
  out.push(box(-19, 19, 16, 92, 6, 34, { tone: "mid" }, 2, 3));
  return out.join("");
}
function truckUpper() {
  const out = [];
  out.push(box(-29, 29, 15.4, 92, 34, 37, { tone: "mid" }, 2, 4, 0.6));
  // anti-slip mat in the operator's footwell, edge to edge on the deck
  const mat = [];
  for (let y = 36; y < 49; y += 1.6) mat.push(k.lineOnTop([-28.4, y], [28.4, y], 37, P));
  out.push(L(mat.join(""), { tone: "faint" }));
  // front-left guard post and its work lamp
  out.push(box(-27, -23, 15, 18, 97, 103, { tone: "mid" }, 0.6, 2, 0.3));
  out.push(box(-27, -23, 18, 22, 37, 104, { tone: "mid" }, 0.6));
  // cowl and dash
  out.push(box(-22, 22, 16, 34, 37, 58, { tone: "mid" }, 3, 4, 0.8));
  out.push(L(k.planOutline({ x: -9, y: 19, w: 12, d: 7, r: 1 }, 58, P, 3), { tone: "lo" }));
  out.push(D([at([-6, 22.5, 58]), at([-3, 22.5, 58]), at([0, 22.5, 58])], { size: 0.45, tone: "hi" }));
  // steering column and wheel
  const axis = G.unit3([0, 0.42, 1]);
  const colF = G.frameAlong([0, 30, 58], axis);
  out.push(S(G.disc(0, 9, 1.6, colF, P), { tone: "mid" }));
  const hub = G.pointOf(colF, 9, 0, 0);
  const wheelF = G.frameAlong(hub, axis);
  out.push(S(G.ringBand(-0.7, 0.7, 6.6, 8, wheelF, P), { tone: "mid" }));
  out.push(S(G.disc(-0.6, 1, 1.8, wheelF, P), { tone: "mid" }));
  out.push(S(G.sphereOf(G.pointOf(wheelF, 1, 7.3, Math.PI * 0.3), 1.1, P), { tone: "hi" }));
  // hydraulic levers
  for (const x of [9, 12, 15]) {
    out.push(S(k.cylinder(x, 31.5, 0.5, 58, 6, P, 10), { tone: "mid", crease: "none" }));
    out.push(S(G.sphereOf([x, 31.5, 65], 1.1, P), { tone: "hi" }));
  }
  // battery hood, seat
  const hoodSeam = L(k.sideSeam({ x: -24, y: 50, w: 48, d: 42, r: 3 }, 44, P, 4), { tone: "faint" });
  out.push(S(k.slabOf({ x: -24, y: 50, w: 48, d: 42, r: 3 }, 37, 15, P, 4, 0.8), { tone: "mid", inner: hoodSeam }));
  const vents = [];
  for (let i = 0; i < 5; i++) vents.push(k.planOutline({ x: 14, y: 56 + i * 3.6, w: 7, d: 1.4, r: 0.6 }, 52, P, 3));
  out.push(L(vents.join(""), { tone: "lo" }));
  out.push(box(-11, 11, 58, 78, 52, 55.5, { tone: "mid" }, 3, 4, 0.6));
  out.push(box(-11, 11, 76, 80, 55.5, 71, { tone: "mid" }, 2.5, 4, 0.6));
  // front-right post and lamp
  out.push(box(23, 27, 15, 18, 97, 103, { tone: "mid" }, 0.6, 2, 0.3));
  out.push(box(23, 27, 18, 22, 37, 104, { tone: "mid" }, 0.6));
  // counterweight
  const cw = { x: -29, y: 92, w: 58, d: 25, r: 9 };
  out.push(S(k.slabOf(cw, 6, 56, P, 8, 1.2), { tone: "mid", inner: L(k.sideSeam(cw, 30, P, 8), { tone: "faint" }) }));
  out.push(L(poly([[-5, 117, 16.5], [5, 117, 16.5], [5, 117, 21.5], [-5, 117, 21.5]]), { tone: "lo" }));
  out.push(L([-14, 14].map((x) => k.ring(x, 100, 1.6, 62, P, 14)).join(""), { tone: "lo" }));
  out.push(S(k.cylinder(0, 113, 1.4, 62, 3.4, P, 14), { tone: "mid" }));
  // rear-left post, then the strobe beacon on the guard (drawn with the roof)
  out.push(box(-27, -23, 94, 98, 62, 104, { tone: "mid" }, 0.6));
  out.push(box(-23, -14, 95, 97, 76, 78, { tone: "mid" }, 0.4));
  out.push(S(k.cylinder(-14, 96, 1.4, 70, 12, P, 14), { tone: "mid", crease: "none" }));
  out.push(box(-26, -20, 110, 115, 62, 65, { tone: "mid" }, 0.6, 2, 0.3));
  out.push(box(20, 26, 110, 115, 62, 65, { tone: "mid" }, 0.6, 2, 0.3));
  out.push(box(23, 27, 94, 98, 62, 104, { tone: "mid" }, 0.6));
  // overhead guard
  out.push(box(-28, -22, 16, 99, 104, 107, { tone: "mid" }, 0.8, 2, 0.4));
  out.push(box(-22, 22, 16, 21, 104, 107, { tone: "mid" }, 0.4, 2, 0.4));
  for (let i = 0; i < 8; i++) { const y = 25 + i * 9; out.push(box(-22, 22, y, y + 3, 104.6, 106.6, { tone: "mid" }, 0.3)); }
  out.push(box(22, 28, 16, 99, 104, 107, { tone: "mid" }, 0.8, 2, 0.4));
  out.push(box(-22, 22, 94, 99, 104, 107, { tone: "mid" }, 0.4, 2, 0.4));
  out.push(D([[-25, 18], [25, 18], [-25, 96.5], [25, 96.5]].map(([x, y]) => at([x, y, 107])), { size: 0.5 }));
  out.push(S(k.cylinder(18, 90, 2.6, 107, 1.2, P, 20), { tone: "mid" }));
  out.push(S(G.solidOf([[0, 2.1], [2.2, 2.1, 1], [3.4, 1.4, 1], [3.9, 0]], G.frameAlong([18, 90, 108.2], [0, 0, 1]), P), { tone: "hi", lit: false }));
  return out.join("");
}

// ---------- assemble ----------
const forkOrigin = (X, Y, f) => k.translateAlong(P, [X, Y, f]);
const palletAt = (x0, y0, z0) => k.translateAlong(P, [x0, y0, z0]);
const SLOTS = [];
LEVELS.forEach((_, level) => POS.forEach((cx, pos) => SLOTS.push({ level, pos, cx, x0: cx - PAL_W / 2, z0: SURFACE[level], name: `L${level}-${"AB"[pos]}` })));
const START_FULL = new Set(["L0-A", "L0-B", "L1-A", "L2-B", "L3-A"]);

const rackBack = [
  column(FRAMES[0], -DEPTH, false),
  column(FRAMES[1], -DEPTH, false),
  ...LEVELS.slice(1).map((_, i) => beam(i + 1, -DEPTH, false)),
].join("");

function levelGroup(level) {
  const out = [];
  if (level > 0) { out.push(beam(level, -BEAM_D, true)); out.push(deck(level)); }
  out.push(`<path class="iso-line" data-tone="hi" data-dashed data-marker="${level}" d="" style="stroke-dasharray:2 1.6"/>`);
  SLOTS.filter((s) => s.level === level).forEach((s) => {
    const i = SLOTS.indexOf(s);
    out.push(`<g data-slot="${i}" class="pp-slot"${START_FULL.has(s.name) ? "" : ' data-empty=""'} transform="${palletAt(s.x0, PAL_Y0, s.z0)}">${storedSvg}</g>`);
  });
  out.push(`<g data-anchor="${level}"></g>`);
  return out.join("");
}

const forkSet = (cx) => fork(cx);
const carried = `<g data-carried>` +
  `<g data-cp="a">${CARRIED.a}</g><g data-fk>${forkSet(-FORK_C)}</g>` +
  `<g data-cp="b">${CARRIED.b}</g><g data-fk>${forkSet(FORK_C)}</g>` +
  `<g data-cp="c">${CARRIED.c}</g></g>`;

const truck = [
  `<path class="iso-halo" d="${k.haloOf({ x: -30, y: 4, w: 62, d: 114, r: 10 }, 0, 0.1, P)}" style="filter:blur(4px)"/>`,
  wheel(-31, -24.5, 26, 17, 17, false),
  wheel(-26, -20, 78, 13, 13, false),
  box(-24, -19, 12, 16.5, 12, 24, { tone: "mid" }, 0.3),
  `<g data-part="carriage">${carriage()}</g>`,
  channel(OUTER[0][0], OUTER[0][1], 5, 12, 4, 107),
  `<g data-part="middle">${channel(MIDDLE[0][0], MIDDLE[0][1], 5.5, 11.5, 6, 109)}</g>`,
  `<g data-part="inner">${channel(INNER[0][0], INNER[0][1], 6, 11, 8, 111)}</g>`,
  `<g data-part="chains"></g>`,
  `<g data-part="inner">${S(k.cylinder(0, 8.5, 3, 8, 56, P, 24, 0.4), { tone: "mid", inner: L(k.sideArc(0, 8.5, 3, 12, P, 16), { tone: "faint" }) })}${box(-12, 12, 6, 11, 8, 11, { tone: "mid" }, 0.3)}</g>`,
  `<g data-part="rod"></g>`,
  `<g data-part="head">${S(G.disc(0, 13, 2.2, G.frameAlong([-6.5, 8.5, 0], [1, 0, 0]), P), { tone: "mid" })}${box(-7.5, 7.5, 7, 10, -3.6, -2.2, { tone: "mid" }, 0.2)}</g>`,
  `<g data-part="inner">${channel(INNER[1][0], INNER[1][1], 6, 11, 8, 111)}</g>`,
  `<g data-part="middle">${channel(MIDDLE[1][0], MIDDLE[1][1], 5.5, 11.5, 6, 109)}</g>`,
  channel(OUTER[1][0], OUTER[1][1], 5, 12, 4, 107),
  `<g data-part="inner">${crossbar(INNER, 11, 12.4, 107, 111)}</g>`,
  `<g data-part="middle">${crossbar(MIDDLE, 12.4, 13.6, 104.5, 109)}</g>`,
  crossbar(OUTER, 13.6, 15, 101, 107),
  crossbar(OUTER, 12, 15, 40, 45),
  box(19, 24, 12, 16.5, 12, 24, { tone: "mid" }, 0.3),
  truckBody(),
  wheel(24.5, 31, 26, 17, 17, true),
  wheel(20, 26, 78, 13, 13, true),
  truckUpper(),
].join("");

const stage = `<g data-stage transform="${palletAt(STAGE_X - PAL_W / 2, PAL_Y0, 0)}">${storedSvg}</g>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A single bay of selective pallet racking, four levels of two pallet positions on step beams and wire decks, beside a P&D floor spot. A triplex-mast counterbalance forklift takes the pallet on its forks, travels the aisle, lifts it 100 mm above the target beam, drives in, lowers it onto the deck, backs out and returns for the next pallet.",
  body: [
    floor(),
    rackBack,
    column(FRAMES[0], -COL_D, true),
    bracing(0),
    ...LEVELS.map((_, level) => levelGroup(level)),
    bracing(1),
    loadSign(1),
    column(FRAMES[1], -COL_D, true),
    stage,
    `<g data-anchor="out">${carried}</g>`,
    `<g data-part="truck">${truck}</g>`,
  ],
});

// ---------- live ----------
const live = `
const P = ${JSON.stringify(P)};
const SLOTS = ${JSON.stringify(SLOTS)};
const LEVELS = ${JSON.stringify(LEVELS)}, SURFACE = ${JSON.stringify(SURFACE)};
const PAL_W = ${PAL_W}, PAL_D = ${PAL_D}, PAL_Y0 = ${PAL_Y0}, POCKET = ${POCKET}, FORK_L = ${FORK_L};
const STAGE_X = ${STAGE_X}, Y_OUT = ${Y_OUT}, Y_IN = ${Y_IN}, TRAVEL_F = ${TRAVEL_F}, LIFT_ABOVE = ${LIFT_ABOVE}, FREE_F = ${FREE_F}, FREE = ${FREE};
const BAY_X1 = ${FRAMES[1]}, MM = ${MM};
const PLAY = 2; // playback speed
const host = document.querySelector(".iso-stage");
const svg = host.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const truck = q('[data-part="truck"]'), carriageG = q('[data-part="carriage"]');
const middles = qa('[data-part="middle"]'), inners = qa('[data-part="inner"]');
const chains = q('[data-part="chains"]'), rod = q('[data-part="rod"]'), head = q('[data-part="head"]');
const carried = q("[data-carried]"), forks = qa("[data-fk]"), cps = qa("[data-cp]");
const stageEl = q("[data-stage]");
const slotEls = SLOTS.map((_, i) => q('[data-slot="' + i + '"]'));
const markers = LEVELS.map((_, l) => q('[data-marker="' + l + '"]'));
const anchors = { out: q('[data-anchor="out"]') };
LEVELS.forEach((_, l) => (anchors[l] = q('[data-anchor="' + l + '"]')));
const full = SLOTS.map((_, i) => !slotEls[i].hasAttribute("data-empty"));
const filledByTour = [];

// truck state: X along the aisle, Y heel position, F fork top; all in 20 mm units
const T = { X: STAGE_X, Y: Y_OUT, F: TRAVEL_F, v: { X: 0, Y: 0, F: 0 } };
const cp = { on: true, att: true, x0: STAGE_X - PAL_W / 2, y0: Y_OUT - PAL_D, z0: TRAVEL_F - POCKET };
let stagePresent = true, stageFade = 1;
let job = null, queued = null, phaseName = "ready", target = null, hover = null, cursor = 2;

const AX = { X: { acc: 25 }, Y: { acc: 12 }, F: { acc: 12 } };
function speedOf(axis, to) {
  const laden = cp.on && cp.att;
  if (axis === "X") return laden ? 80 : 100;          // 1.6 / 2.0 m/s in the aisle
  if (axis === "Y") return 20;                         // 0.4 m/s inching
  return to > T.F ? (laden ? 24 : 30) : 25;            // lift 0.48 / 0.60 m/s, lower 0.50 m/s
}
function engaged() { return cp.on && Math.abs(T.Y - (cp.y0 + PAL_D)) < 0.6 && Math.abs(T.X - (cp.x0 + PAL_W / 2)) < 0.6; }
function surfaceUnder() {
  if (cp.x0 + PAL_W > BAY_X1 + 2 || cp.y0 > PAL_Y0 + 4) return 0;
  let s = 0; SURFACE.forEach((z) => { if (z <= cp.z0 + 0.01) s = z; }); return s;
}
function slotOfPallet() { return SLOTS.findIndex((s) => Math.abs(s.x0 - cp.x0) < 0.5 && Math.abs(s.z0 - cp.z0) < 0.5 && Math.abs(cp.y0 - PAL_Y0) < 0.5); }

function putaway(i) {
  const s = SLOTS[i];
  const sf = SURFACE[s.level];
  return [
    { name: "travel to " + s.name, axis: "X", to: s.cx },
    { name: "lift above beam", axis: "F", to: sf + POCKET + LIFT_ABOVE },
    { name: "drive in", axis: "Y", to: Y_IN },
    { name: "set down on deck", axis: "F", to: sf + FREE_F },
    { name: "back out", axis: "Y", to: Y_OUT },
    { name: "lower forks", axis: "F", to: TRAVEL_F },
    { name: "return to P&D", axis: "X", to: STAGE_X },
    { name: "fork next pallet", axis: "F", to: FREE_F + 1 },
    { name: "fork next pallet", axis: "Y", to: Y_IN },
    { name: "lift pallet", axis: "F", to: TRAVEL_F },
    { name: "back out", axis: "Y", to: Y_OUT },
  ];
}
function start(i) {
  if (full[i]) return;
  if (job) { queued = i; return; }
  target = i;
  job = putaway(i);
  run();
}
function stepAxis(axis, to, dt) {
  const d = to - T[axis];
  const vmax = speedOf(axis, to), acc = AX[axis].acc * (axis === "X" ? 4 : 2);
  const want = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * acc * Math.abs(d)));
  const v = T.v[axis];
  T.v[axis] = v + Math.max(-acc * dt, Math.min(acc * dt, want - v));
  const next = T[axis] + T.v[axis] * dt;
  if (Math.abs(d) < 0.02 || Math.sign(to - next) !== Math.sign(d)) { T[axis] = to; T.v[axis] = 0; return true; }
  T[axis] = next;
  return false;
}
function physics() {
  // forks entering the P&D pallet pick it up off the floor spot
  if (!cp.on && stagePresent && stageFade > 0.99 && Math.abs(T.X - STAGE_X) < 0.5 && T.Y - FORK_L < PAL_Y0 + PAL_D && T.F < POCKET) {
    cp.on = true; cp.att = false; cp.x0 = STAGE_X - PAL_W / 2; cp.y0 = PAL_Y0; cp.z0 = 0; stagePresent = false; stageFade = 0;
  }
  if (cp.on && cp.att) {
    cp.x0 = T.X - PAL_W / 2; cp.y0 = T.Y - PAL_D;
    const s = surfaceUnder();
    cp.z0 = Math.max(s, T.F - POCKET);
    if (T.F - POCKET <= s) cp.att = false;
  } else if (cp.on && engaged() && T.F - POCKET > surfaceUnder() + 0.01) cp.att = true;
  // once the fork tips clear a pallet resting in a slot, it is stored
  if (cp.on && !cp.att && T.Y - FORK_L > cp.y0 + PAL_D + 0.5) {
    const i = slotOfPallet();
    if (i >= 0) { full[i] = true; slotEls[i].removeAttribute("data-empty"); cp.on = false; if (touring) filledByTour.push(i); }
  }
}
function place() {
  const inside = T.Y - (cp.on && cp.att ? PAL_D : FORK_L) < 0.5 && T.X < BAY_X1;
  let anchor = anchors.out;
  if (inside) { let l = 0; LEVELS.forEach((z, i) => { if (SURFACE[i] <= T.F - 1) l = i; }); anchor = anchors[l]; }
  if (carried.parentNode !== anchor) anchor.appendChild(carried);
}
function chainPath(x, f, h) {
  return segment([x, 5.2, f + 24.4], [x, 5.2, h + 2.2], P) + segment([x, 11.6, h + 2.2], [x, 11.6, h - 20], P);
}
function draw() {
  const f = T.F;
  const n = Math.max(0, f - FREE), m = n / 2;
  const h = 66 + n + Math.min(f, FREE) / 2;
  truck.setAttribute("transform", translateAlong(P, [T.X, T.Y, 0]));
  carriageG.setAttribute("transform", translateAlong(P, [0, 0, f]));
  middles.forEach((g) => g.setAttribute("transform", translateAlong(P, [0, 0, m])));
  inners.forEach((g) => g.setAttribute("transform", translateAlong(P, [0, 0, n])));
  head.setAttribute("transform", translateAlong(P, [0, 0, h]));
  rod.innerHTML = solidSvg(cylinder(0, 8.5, 1.5, 64 + n, h - 64 - n - 3.6, P, 16), { tone: "hi", crease: "none" });
  chains.innerHTML = lineSvg(chainPath(-5, f, h) + chainPath(5, f, h), { tone: "mid", dotted: true });
  const fk = translateAlong(P, [T.X, T.Y, f]);
  forks.forEach((g) => g.setAttribute("transform", fk));
  const pt = translateAlong(P, [cp.x0, cp.y0, cp.z0]);
  cps.forEach((g) => { g.setAttribute("transform", pt); g.style.display = cp.on ? "" : "none"; });
  stageEl.style.opacity = stagePresent ? String(stageFade) : "0";
  place();
  const mm = (u) => Math.round(u * MM).toLocaleString("en-US");
  const where = target === null ? "P&D" : SLOTS[target].name;
  const text = phaseName === "ready" ? "ready · forks " + mm(f) + " mm · " + SLOTS.filter((_, i) => !full[i]).length + " empty" : where + " · " + phaseName + " · forks " + mm(f) + " mm";
  if (readout.textContent !== text) readout.textContent = text;
}
function showMarker() {
  const i = hover !== null ? hover : (job ? target : null);
  markers.forEach((mk, l) => {
    const s = i !== null ? SLOTS[i] : null;
    const on = s && s.level === l && !full[i];
    mk.setAttribute("d", on ? planOutline({ x: s.x0, y: PAL_Y0, w: PAL_W, d: PAL_D, r: 0.6 }, SURFACE[l] + 0.08, P, 2) : "");
  });
}

let frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, idleClock = 0, wait = 0;
function finishInstantly() {
  // reduced motion: the putaway lands at once and the truck is back at the P&D spot with the next pallet
  for (const ph of job) T[ph.axis] = ph.to;
  full[target] = true; slotEls[target].removeAttribute("data-empty");
  if (touring) filledByTour.push(target);
  cp.on = true; cp.att = true; cp.x0 = STAGE_X - PAL_W / 2; cp.y0 = Y_OUT - PAL_D; cp.z0 = TRAVEL_F - POCKET;
  job = null; phaseName = "ready";
}
function nextTour() {
  const empties = SLOTS.map((_, i) => i).filter((i) => !full[i]);
  if (empties.length) return start(empties[(Math.random() * 0) | 0]);
  // all full: the night shift picks the tour's pallets back out
  filledByTour.splice(0).forEach((i) => { full[i] = false; slotEls[i].setAttribute("data-empty", ""); });
  if (!SLOTS.some((_, i) => !full[i])) ["L1-B", "L2-A", "L3-B"].forEach((n) => { const i = SLOTS.findIndex((s) => s.name === n); full[i] = false; slotEls[i].setAttribute("data-empty", ""); });
  wait = 1.2;
}
function tick(now) {
  const dt0 = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const dt = dt0 * PLAY * (window.__driveSpeed || 1);
  if (!stagePresent && (Math.abs(T.X - STAGE_X) > 30 || (cp.on && T.Y >= Y_OUT - 0.01))) { stagePresent = true; stageFade = 0; }
  if (stagePresent && stageFade < 1) stageFade = Math.min(1, stageFade + dt0 / 0.9);
  if (wait > 0) wait -= dt0;
  else if (job) {
    if (still.matches) finishInstantly();
    else {
      const ph = job[0];
      phaseName = ph.name;
      if (stepAxis(ph.axis, ph.to, dt)) { job.shift(); if (!job.length) { job = null; phaseName = "ready"; target = null; wait = 0.5; } }
      physics();
    }
  } else if (queued !== null) { const i = queued; queued = null; start(i); }
  else if (touring) { idleClock += dt0; if (idleClock > 1.4) { idleClock = 0; nextTour(); } }
  draw();
  showMarker();
  const busy = job || queued !== null || touring || wait > 0 || stageFade < 1;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const describe = (text) => host.setAttribute("aria-valuetext", text);
const pause = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; idleClock = 0; run(); }, 3600); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(host);
if (still.matches) touring = false;

// pointer: the nearest slot centre on screen
const centres = SLOTS.map((s) => iso([s.cx, PAL_Y0 + PAL_D / 2, s.z0 + 30], P));
function slotAt(event) {
  const pt = svg.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  let best = null, dist = 46;
  centres.forEach(([x, y], i) => { const d = Math.hypot(x - p.x, y - p.y); if (d < dist) { dist = d; best = i; } });
  return best;
}
host.addEventListener("pointermove", (e) => { const i = slotAt(e); if (i !== hover) { hover = i; pause(); showMarker(); if (!frame) draw(); } });
host.addEventListener("pointerleave", () => { hover = null; showMarker(); });
host.addEventListener("click", (e) => {
  const i = slotAt(e); if (i === null) return; pause();
  if (full[i]) { describe(SLOTS[i].name + " is occupied"); return; }
  describe("Putting away to " + SLOTS[i].name); start(i);
});
host.addEventListener("keydown", (e) => {
  const s = SLOTS[cursor];
  let to = null;
  if (e.key === "ArrowUp") to = SLOTS.findIndex((t) => t.level === Math.min(3, s.level + 1) && t.pos === s.pos);
  if (e.key === "ArrowDown") to = SLOTS.findIndex((t) => t.level === Math.max(0, s.level - 1) && t.pos === s.pos);
  if (e.key === "ArrowLeft") to = SLOTS.findIndex((t) => t.level === s.level && t.pos === 0);
  if (e.key === "ArrowRight") to = SLOTS.findIndex((t) => t.level === s.level && t.pos === 1);
  if (to !== null) { e.preventDefault(); cursor = to; hover = to; pause(); showMarker(); describe(SLOTS[to].name + (full[to] ? ", occupied" : ", empty")); return; }
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pause(); if (!full[cursor]) { describe("Putting away to " + SLOTS[cursor].name); start(cursor); } else describe(SLOTS[cursor].name + " is occupied"); }
});
draw();
`;

const css = `<style>
.pp-slot[data-empty] { display: none; }
.iso-stage { cursor: pointer; touch-action: pan-y; }
.iso-stage:focus-visible { outline: 1px solid var(--anatomy-muted); outline-offset: 6px; }
</style>`;

const body = css + k.plateHtml({
  fig: "Fig 1",
  title: "Selective rack putaway",
  hint: "Click an empty slot",
  readout: "ready · forks 250 mm · 3 empty",
  keys: [
    { mark: "lit", label: "The pallet being put away" },
    { mark: "raised", label: "Forks: 1,100 mm, in the pallet's two pockets" },
    { mark: "dashed", label: "Target slot on the wire deck" },
  ],
  caption:
    "One bay of selective racking: 2,300 mm clear between uprights, beams at 1,500 mm pitch, 1,100 mm frames carrying 1,000 × 1,200 pallets with 50 mm overhang and 100 mm side gaps. The triplex truck travels with the load 150 mm up, lifts it 100 mm above the target beam, inches in, lowers it onto the deck, backs out and lowers before it travels. Mast stages follow the true motion: the carriage uses 1,550 mm of free lift before the inner and middle channels extend. Played at 2× speed.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Pallet putaway: click an empty slot, or use the arrow keys to choose one and Enter to put a pallet away" aria-valuetext="ready">${svg}</div>`,
});

const file = theme === "light" ? "pallet-putaway-light.html" : "pallet-putaway.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Pallet putaway", theme, body, script: kitScript() + live }));
console.log("wrote", file);
