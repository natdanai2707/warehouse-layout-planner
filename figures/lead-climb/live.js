const host = document.querySelector(".iso-stage");
const svg = host.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const climberG = q('[data-part="climber"]'), climbRope = q('[data-part="climb-rope"]');
const belayRope = q('[data-part="belay-rope"]'), brakeRope = q('[data-part="brake-rope"]'), belayerG = q('[data-part="belayer"]');
const g = 9.81;
const MIN_H = 0.95, MAX_H = DRAWS[DRAWS.length - 1] - 0.3, CLIP_AT = 0.35, CLIP_TIME = 1.6, PULL = 0.9;

// state, heights in metres
const S = { h: MIN_H, target: MIN_H, slack: 0.3, slackTarget: 0.3, clipped: 0, mode: "climb", clipT: 0, w: 0, hold: 0,
  d: 0, vd: 0, yb: 0, vb: 0, t: 0, Tc: 0, peak: 0, maxD: 0, maxYb: 0, set: null, c: 0, fallClip: 0 };
const pulled = () => (S.mode === "clip" ? PULL * Math.sin(Math.PI * Math.min(1, S.clipT / CLIP_TIME)) : 0);

function startFall() {
  if (S.mode !== "climb" && S.mode !== "clip") return;
  const slack = S.slack + pulled();
  S.set = setup(S.h, S.clipped, slack);
  S.c = 2 * 0.2 * Math.sqrt(S.set.k * PEOPLE.mc);
  S.fallClip = S.mode === "clip" ? S.clipped + 1 : 0;
  Object.assign(S, { mode: "fall", d: 0, vd: 0, yb: 0, vb: 0, t: 0, Tc: 0, peak: 0, maxD: 0, maxYb: 0, slackAtFall: slack });
  host.setAttribute("aria-valuetext", "Fall from " + feet(S.h).toFixed(1) + " m, " + (S.clipped ? (S.set.above).toFixed(1) + " m above quickdraw " + S.clipped : "nothing clipped"));
}
const feet = (h) => h - FEET_BELOW;
function simulate(dt) {
  const n = Math.ceil(dt * 3000), h = dt / n, set = S.set;
  for (let i = 0; i < n; i++) {
    const E = S.d - set.free - S.yb, Ed = S.vd - S.vb;
    S.Tc = S.clipped > 0 && E > 0 ? Math.max(0, set.k * E + S.c * Ed) : 0;
    const Tb = S.Tc * set.belayRatio;
    S.vd += (g - S.Tc / PEOPLE.mc) * h; S.d += S.vd * h;
    if (S.yb > 0 || Tb > PEOPLE.mb * g) { S.vb += (Tb / PEOPLE.mb - g) * h; S.yb += S.vb * h; if (S.yb < 0) { S.yb = 0; S.vb = 0; } }
    S.peak = Math.max(S.peak, S.Tc); S.maxD = Math.max(S.maxD, S.d); S.maxYb = Math.max(S.maxYb, S.yb);
    if (feet(S.h - S.d) < 0.02) { S.d = S.h - FEET_BELOW - 0.02; S.vd = 0; S.mode = "decked"; S.hold = 0; return; }
  }
  S.t += dt;
  if (S.t > 1.2 && Math.abs(S.vd) < 0.03 && Math.abs(S.vb) < 0.03 && S.yb === 0) { S.mode = "caught"; S.hold = 0; }
}

// poses
function climbPose(hz, w, clipBump, clipIndex) {
  const z = hz * U;
  const pel = [CX, 12 + w * 12, z];
  const hand = (s) => {
    const u = (z + 30 - 40 - (s ? 9 : 0)) / HOLD_STEP, i = Math.floor(u), f = u - i;
    const a = handHold(s, i), b = handHold(s, i + 1), m = smooth(0.62, 1, f);
    let onWall = [a[0], 3.1, a[1] + (b[1] - a[1]) * m + 1.2 + Math.sin(m * Math.PI) * 4];
    if (s === 1 && clipBump > 0) onWall = lerp(onWall, add(ropePoint(clipIndex), [0, 1.2, 0]), clipBump);
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

function ropeSvg(points, marks) {
  const d = pathOf(points.map((p) => iso(p, P)));
  return '<path class="iso-line" data-tone="lo" d="' + d + '" style="stroke-width:2.4"/><path class="iso-line" data-tone="lit" d="' + d + '" style="stroke-width:1.2"/>' + dotsSvg(marks, { size: 1.05, tone: "lo" });
}
function sagged(a, b, extra, span = 1) {
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
// Marks every 0.5 m of rope from the knot, each run stretched by its own tension.
function marksOn(runs) {
  const front = [], back = [];
  let carry = 0;
  for (const run of runs) {
    let pos = 20 * (1 + run.eps) - carry;
    let seglen = 0;
    const lens = []; for (let i = 1; i < run.pts.length; i++) { const l = len(sub(run.pts[i], run.pts[i - 1])); lens.push(l); seglen += l; }
    while (pos <= seglen) {
      let rem = pos, i = 0;
      while (rem > lens[i]) { rem -= lens[i]; i++; }
      (run.back ? back : front).push(iso(lerp(run.pts[i], run.pts[i + 1], rem / lens[i]), P));
      pos += 20 * (1 + run.eps);
    }
    carry = (seglen - (pos - 20 * (1 + run.eps))) / (1 + run.eps);
  }
  return { front, back };
}

const devicePt = () => [DEVICE[0] - 0.2, DEVICE[1] - 0.4, DEVICE[2] + 2.2 + S.yb * U];
function draw() {
  const hz = S.h - (S.mode === "fall" || S.mode === "caught" || S.mode === "decked" ? S.d : 0);
  const bump = S.mode === "clip" ? Math.sin(Math.PI * Math.min(1, S.clipT / CLIP_TIME)) : 0;
  const J = climbPose(hz, S.w, bump, S.clipped);
  climberG.innerHTML = personSvg(lib, J, { tone: "hi", harness: true });
  const knot = tieIn(J), dev = devicePt();
  const eps0 = S.Tc / ROPE.EA;
  const rTop = Math.exp(ROPE.mu * Math.PI), rZig = Math.exp(ROPE.mu * ROPE.zig);
  // climber's strand, then down through the clipped quickdraws, then the strand to the belayer
  const upper = [];
  let climbPts;
  if (S.clipped > 0) {
    const top = ropePoint(S.clipped - 1);
    if (bump > 0) climbPts = [knot, add(J.hR, [0, 0.6, -1]), top];
    else climbPts = [knot, add(knot, [0, -0.6, 1.2]), top];
    upper.push({ pts: climbPts, eps: eps0 });
    let a = 1 / rTop;
    for (let i = S.clipped - 1; i > 0; i--) { upper.push({ pts: [ropePoint(i), ropePoint(i - 1)], eps: eps0 * a }); a /= rZig; }
    const belay = sagged(ropePoint(0), dev, Math.min(1.5, Math.max(0, S.mode === "fall" || S.mode === "caught" || S.mode === "decked" ? Math.max(0, S.set.free - S.d + S.yb) : S.slack)) * U, 0.3);
    upper.push({ pts: belay, eps: eps0 * a, back: true });
  } else {
    climbPts = [knot, add(knot, [0, 1.5, -1]), ...sagged(add(knot, [0, 1.5, -1]), dev, S.slack * U, 0.5).slice(1)];
    upper.push({ pts: climbPts, eps: 0, back: true });
  }
  const marks = marksOn(upper);
  const fore = upper.filter((r) => !r.back).flatMap((r, i) => (i ? r.pts.slice(1) : r.pts));
  climbRope.innerHTML = fore.length ? ropeSvg(fore, marks.front) : "";
  belayRope.innerHTML = ropeSvg(upper[upper.length - 1].pts, marks.back);
  brakeRope.innerHTML = ropeSvg(sagged(add(dev, [0, 0, -4.4]), [BAG[0] - 2, BAG[1] - 1, MAT_T + 7], 18), []);
  belayerG.setAttribute("transform", translateAlong(P, [0, 0, S.yb * U]));
  let text;
  const over = S.clipped ? S.h - DRAWS[S.clipped - 1] : 0;
  if (S.mode === "climb") text = "feet " + feet(S.h).toFixed(1) + " m · " + (S.clipped ? (over > 0 ? over.toFixed(1) + " m over clip " + S.clipped : "below clip " + S.clipped) : "no clip yet");
  else if (S.mode === "clip") text = "clipping " + (S.clipped + 1) + " · " + pulled().toFixed(1) + " m pulled";
  else if (S.mode === "fall") text = "falling " + S.d.toFixed(2) + " m · " + (S.Tc / 1000).toFixed(2) + " kN";
  else if (S.mode === "decked") text = "ground fall · " + (S.clipped ? "only " + S.clipped + " clipped" : "nothing clipped");
  else if (S.mode === "lower") text = "lowering · feet " + feet(S.h).toFixed(1) + " m";
  else text = "fell " + S.maxD.toFixed(1) + " m · ff " + S.set.factor.toFixed(2) + " · " + (S.peak / 1000).toFixed(1) + " kN · draw " + (S.peak * S.set.topLoad / 1000).toFixed(1);
  if (readout.textContent !== text) readout.textContent = text;
}

// loop
let frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourStep = 0, tourClock = 0;
const TOUR = [
  { h: 7.2, slack: 0.3, act: "fall" },
  { act: "lower" },
  { h: DRAWS[1] - CLIP_AT + 0.05, slack: 0.3, act: "clipfall", clip: 1 },
  { act: "lower" },
];
function tourTick(dt) {
  const step = TOUR[tourStep % TOUR.length];
  if (step.act === "lower") { if (S.mode === "climb" && S.h <= MIN_H + 0.001) { tourStep++; tourClock = 0; } else if (S.mode === "climb") S.mode = "lower"; return; }
  if (S.mode !== "climb" && S.mode !== "clip") return;
  S.target = step.h; S.slackTarget = step.slack;
  if (step.act === "clipfall") { if (S.mode === "clip" && S.clipped === step.clip && S.clipT > CLIP_TIME * 0.45) { tourStep++; startFall(); } return; }
  if (S.mode === "climb" && Math.abs(S.h - step.h) < 0.005) { tourClock += dt; if (tourClock > 0.9) { tourClock = 0; tourStep++; startFall(); } }
}
function tick(now) {
  const dt0 = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const dt = dt0 * (window.__driveSpeed || 1);
  S.slack += (S.slackTarget - S.slack) * (1 - Math.exp(-dt / 0.35));
  if (touring) tourTick(dt);
  if (S.mode === "climb") {
    S.w += (0 - S.w) * (1 - Math.exp(-dt / 0.3));
    const next = S.clipped < DRAWS.length ? DRAWS[S.clipped] - CLIP_AT : Infinity;
    const goal = Math.min(S.target, next);
    const dh = goal - S.h;
    S.h += Math.sign(dh) * Math.min(Math.abs(dh), 0.5 * dt * Math.min(1, Math.abs(dh) / 0.15 + 0.2));
    if (S.target > next && S.h >= next - 0.002) { S.mode = "clip"; S.clipT = 0; }
  } else if (S.mode === "clip") {
    S.clipT += dt;
    if (S.clipT >= CLIP_TIME) { S.clipped++; S.mode = "climb"; }
  } else if (S.mode === "fall") {
    S.w += (1 - S.w) * (1 - Math.exp(-dt / 0.18));
    if (still.matches) while (S.mode === "fall") simulate(1 / 30); else simulate(dt);
  } else if (S.mode === "caught" || S.mode === "decked") {
    S.hold += dt;
    S.w += ((S.mode === "decked" ? 0 : 1) - S.w) * (1 - Math.exp(-dt / 0.3));
    if (S.hold > 2.6) {
      S.h = Math.max(MIN_H, S.h - S.d); S.target = S.h; S.d = 0; S.Tc = 0; S.yb = 0;
      if (S.mode === "decked") { S.clipped = 0; S.target = MIN_H; }
      S.mode = "climb";
    }
  } else if (S.mode === "lower") {
    // the belayer lowers the climber on the rope, still running through the clips
    S.w += (1 - S.w) * (1 - Math.exp(-dt / 0.3));
    S.h = Math.max(MIN_H, S.h - 0.8 * dt);
    if (S.h <= MIN_H) { S.clipped = 0; S.target = MIN_H; S.mode = "climb"; }
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
  const fy = Math.min(1, Math.max(0, ((e.clientY - box.top) / box.height - 0.08) / 0.75));
  const fx = Math.min(1, Math.max(0, ((e.clientX - box.left) / box.width - 0.15) / 0.7));
  pause();
  if (S.mode === "climb" || S.mode === "clip") { S.target = MAX_H - fy * (MAX_H - MIN_H); S.slackTarget = Math.round(fx * 12) / 10; }
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
  else if (e.key === "l" || e.key === "L") { if (S.mode === "climb") S.mode = "lower"; }
  else used = false;
  if (!used) return;
  e.preventDefault(); pause();
  if (e.key.startsWith("Arrow")) host.setAttribute("aria-valuetext", "Feet " + feet(S.target).toFixed(1) + " m up, slack " + S.slackTarget.toFixed(1) + " m");
  run();
});
draw();
