// Fig: a lead climb. The climber clips quickdraws on the way up; the belayer pays out rope.
// A fall is twice the distance above the last clip, plus slack, plus stretch. World units are 25 mm.
// node build.mjs [--light]   writes lead-climb.html (or -light.html) next to this script.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as M from "./man.mjs";
import * as R from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const src = (file) => readFileSync(join(HERE, file), "utf8");
const kitScript = () => src("kit/iso-kit.mjs").replace(/^export /gm, "");
const latheScript = () =>
  "const G = (() => {" + src("kit/lathe.mjs").replace(/^import .*$/m, "").replace(/^export /gm, "") +
  "\nreturn { frameOf, frameAlong, prismOf, sphereOf, disc, ringBand, solidOf, circleOf, arcOf };\n})();\n";
const manScript = () => src("man.mjs").replace(/^export /gm, "");
const modelScript = () => src("model.mjs").replace(/^export /gm, "");

const U = 40; // units per metre
const WIDTH = 620;
const HEIGHT = 760;

// ---------- the truth ----------
const WALL = { x0: -60, x1: 60, t: 10, h: 368 }; // 3 m lane, 9.2 m lead wall
const MAT_T = 3;
const CX = -4;
const BELAYER = [18, 31]; // close to the wall and to one side of the first clip
const DEVICE = [18, 26.6, 40.5];
const BAG = [40, 52];
const HOLD_STEP = 18;
const handHold = (side, i) => [CX + (side ? 10 : -12), 40 + HOLD_STEP * i + (side ? 9 : 0)];
const footHold = (side, i) => [CX + (side ? 7 : -8), 6 + HOLD_STEP * i + (side ? 9 : 0)];
// Quickdraws: hanger on the bolt, a dogbone, and the rope carabiner hanging parallel to the wall.
const drawX = (i) => CX + (i % 2 ? -3 : 3);
const ropePoint = (i) => [drawX(i), 2.8, R.DRAWS[i] * U - 11.6];

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
  for (const z of [97.6, 195.2, 292.8]) seams.push(seg([x0, 0, z], [x1, 0, z]));
  const sideSeams = [97.6, 195.2, 292.8].map((z) => seg([x1, -t, z], [x1, 0, z])).join("");
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
  for (let i = 0; i < 19; i++) for (const s of [0, 1]) {
    const [hx, hz] = handHold(s, i);
    if (hz < WALL.h - 24) put(hx, hz, hold(hx, hz, 2.8, "hi"));
    const [fx, fz] = footHold(s, i);
    if (fz < WALL.h - 34 && fz > 8) put(fx, fz, hold(fx, fz, 1.5, "hi"));
  }
  // other routes on the lane, quieter
  const others = [[-44, 30], [-36, 66], [-48, 102], [-30, 140], [-46, 176], [-38, 206], [28, 20], [40, 56], [22, 150], [44, 188], [34, 120], [-52, 156], [-40, 240], [30, 262], [-48, 290], [40, 318], [-34, 336], [24, 226], [46, 286]];
  others.forEach(([x, z], i) => put(x, z, hold(x, z, 2 + (i % 3) * 0.6, "lo")));
  items.sort((a, b) => a.d - b.d);
  // a volume bolted to the lane
  const F = G.frameOf([30, 0, 72], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const vol = S(G.prismOf(F, [[-14, -10], [14, -10], [0, 18]], 0, 9, P), { tone: "mid" });
  return vol + items.map((i) => i.svg).join("");
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



function quickdraw(i) {
  const x = drawX(i), z = R.DRAWS[i] * U;
  const out = [];
  const top = i === R.DRAWS.length - 1;
  if (top) out.push(box(x - 7, x + 7, 0, 0.8, z - 2, z + 8, { tone: "mid" }, 0.4, 2, 0.3)); // two-bolt anchor plate
  out.push(S(G.disc(0, 1.4, 1.2, G.frameAlong([x, 0, z], [0, 1, 0]), P), { tone: "mid" }));
  out.push(box(x - 1.2, x + 1.2, 0, 1.2, z - 3.2, z + 1.4, { tone: "mid" }, 0.4));
  out.push(S(G.ringBand(-0.45, 0.45, 1.25, 1.75, G.frameOf([x, 2.0, z - 3.6], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P), { tone: "mid" }));
  out.push(box(x - 0.8, x + 0.8, 2.2, 3.0, z - 9, z - 5, { tone: "lo" }, 0.3));
  out.push(S(G.ringBand(-0.45, 0.45, 1.65, 2.25, G.frameOf([x, 2.8, z - 10.6], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "hi" }));
  return out.join("");
}
const belayerJ = (() => {
  const [bx, by] = BELAYER;
  return M.pose({ pelvis: [bx, by - 0.6, 38], lean: 0.2, hands: [[bx - 4.5, by - 8.5, 33], [bx + 5.5, by - 7.5, 54]], feet: [[bx - 6, by + 3, MAT_T + 2.2], [bx + 6, by - 4, MAT_T + 2.2]] });
})();

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A 9 m lead-climbing lane with seven quickdraws. The climber clips the rope into each quickdraw on the way up while the belayer pays out rope through an assisted-braking device. A fall is twice the height above the last clipped quickdraw, plus slack and rope stretch.",
  body: [
    floor(),
    wall(),
    holds(),
    R.DRAWS.map((_, i) => quickdraw(i)).join(""),
    `<g data-part="climb-rope"></g>`,
    `<g data-part="climber"></g>`,
    `<g data-part="belay-rope"></g>`,
    `<g data-part="belayer">${M.personSvg(lib, belayerJ, { tone: "mid", harness: true })}${device()}</g>`,
    `<g data-part="brake-rope"></g>`,
    ropeBag(),
  ],
});

const live = `
${latheScript()}
${manScript()}
${modelScript()}
const P = ${JSON.stringify(P)};
const k = { solidSvg, lineSvg, dotsSvg, depthOf, iso, pathOf };
const lib = { k, G, P };
const U = ${U}, MAT_T = ${MAT_T}, CX = ${CX}, HOLD_STEP = ${HOLD_STEP};
const DEVICE = ${JSON.stringify(DEVICE)}, BAG = ${JSON.stringify(BAG)};
const handHold = ${handHold.toString()};
const footHold = ${footHold.toString()};
const drawX = ${drawX.toString()};
const ropePoint = (i) => [drawX(i), 2.8, DRAWS[i] * U - 11.6];
${src("live.js")}
`;

const css = `<style>
.iso-stage { cursor: pointer; touch-action: pan-y; }
.iso-stage:focus-visible { outline: 1px solid var(--anatomy-muted); outline-offset: 6px; }
</style>`;
const body = css + k.plateHtml({
  fig: "Fig 3",
  title: "Lead climbing",
  hint: "Hover, then click to fall",
  readout: "feet 0.0 m · no clip yet",
  keys: [
    { mark: "lit", label: "The rope, marked every 0.5 m" },
    { mark: "raised", label: "Quickdraws at 2.6 m, then every 1 m" },
    { mark: "flat", label: "Belayer, 70 kg, paying out rope" },
  ],
  caption:
    "The climber trails the rope and clips it into each quickdraw. Fall from 1 m above the last clip and you fall 1 m to it and 1 m past it, plus slack and stretch. Fall factor is that fall over the rope out: high near the ground, low high up, where a long rope absorbs it. The top quickdraw carries the climber's pull plus the rope's pull down to the belayer, about 1.6× the climber's load. Pulling up rope to clip adds slack, so a fall while clipping the second quickdraw usually reaches the ground. Rope stiffness is set so the UIAA test (80 kg, factor 1.77) peaks at 8.2 kN.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Lead climb: arrow up and down move the climber, who clips on the way up; left and right change the slack; Space makes the climber fall" aria-valuetext="Climber on the ground">${svg}</div>`,
});

const file = theme === "light" ? "lead-climb-light.html" : "lead-climb.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Lead climbing", theme, body, script: kitScript() + live }));
console.log("wrote", file);
