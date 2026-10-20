/* Node test for Frisbee Dog v4 — "out and across" mechanics (window.__dogTest).
   Verifies: title tap starts (ready phase), taps ignored during ready,
   taps inside the top UI strip don't throw, route shape (3 waypoints:
   out deep, turn, across — turn depth in the 55-70% band, always clear
   of the strip, sides mirrored), one throw per round, disc flies at
   constant speed, lead-the-cross interception -> CATCH (disc visibly
   in his mouth), throw where he isn't -> MISS (disc stays on the grass,
   forgiving, no penalty), no-throw -> quiet reset, round cycling
   (resolve -> return -> ready), 10 catches -> win, PLAY AGAIN resets,
   and config sanity.
   Run: node tools/tests/frisbeedog.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "frisbeedog", "game.js");

const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradStub;
    if (k === "measureText") return () => ({ width: 0 });
    if (k === "canvas") return {};
    return noop;
  },
  set: () => true,
});
const mkCanvas = () => ({ getContext: () => ctxStub, addEventListener: noop, style: {}, width: 0, height: 0 });

const sandbox = {
  window: { innerWidth: 400, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, SDGplays: { played: noop } },
  document: {
    getElementById: (id) => (id === "stage" ? mkCanvas() : { addEventListener: noop, style: {} }),
    createElement: () => mkCanvas(),
    addEventListener: noop,
    head: { appendChild: noop },
  },
  performance: { now: () => 1000 },
  requestAnimationFrame: noop,
  makeAudio: () => ({ tone: noop, noise: noop, arp: noop, unlock: noop, state: () => "running" }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });

const F = sandbox.window.__dogTest;
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}

const W = 400, H = 700;
const CFG = F.cfg;
const LINEUP = { x: W / 2, y: H - 90 }; // bottom-center

// step until the round phase becomes `want` (or give up after cap steps)
function stepUntil(want, cap) {
  for (let i = 0; i < (cap || 900); i++) {
    if (F.debug.phase() === want) return true;
    F.step(0.016);
  }
  return F.debug.phase() === want;
}

// tap the interception point: solve for the spot on his cross leg where
// the constant-speed disc and the dog arrive together. Bisection on
// f(L) = dogTime(L) - discTime(L); f is monotonic on [0, 176] for the
// game's speed range, and the tap x stays on-screen (<= W - 24).
function tapIntercept() {
  const d = F.debug.dog();
  const r = F.debug.route();
  const s = d.speed;
  const yT = r.yTurn;
  const lx = W / 2, ly = H - 24; // disc launch point
  const t1 = (d.y - yT) / s;     // his remaining time to the turn
  const Hh = ly - yT;
  const f = (L) => (t1 + L / s) - Math.hypot(L, Hh) / CFG.DISC_SPEED;
  let lo = 0, hi = 176;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  const L = (lo + hi) / 2;
  F.tap(W / 2 + r.side * L, yT);
  return L;
}

// ---- config sanity ----
eq("win at 10 catches", CFG.WIN_CATCHES, 10);
eq("dog is small (32)", CFG.DOG_R, 32);
eq("catch radius is generous (68)", CFG.CATCH_R, 68);
eq("dog is fast now (240)", CFG.DOG_SPEED, 240);
eq("speed ramp +12 every 2, cap 300",
  CFG.DOG_SPEED_UP === 12 && CFG.SPEED_EVERY === 2 && CFG.DOG_SPEED_MAX === 300, true);
eq("disc speed (250)", CFG.DISC_SPEED, 250);
eq("top UI strip 120px", CFG.STRIP_H, 120);
eq("turn band 35-70%", CFG.TURN_MIN === 0.35 && CFG.TURN_MAX === 0.70, true);

// ---- title -> play: ready phase ----
eq("starts on title", F.state, "title");
F.tap(200, 350); // tap anywhere starts
eq("tap starts the game", F.state, "play");
eq("round starts in ready phase", F.debug.phase(), "ready");
eq("frisbee ready after start", F.debug.frisbee().mode, "ready");
eq("counter starts at 0", F.catches, 0);

// ---- taps during the ready beat do nothing ----
F.tap(200, 300);
eq("ready-beat tap ignored (still ready)", F.debug.frisbee().mode, "ready");

// ---- route shape: out deep, turn, across ----
F.start();
F.debug.forceRoute(1, 0.6, 0);
{
  const r = F.debug.route();
  eq("route side", r.side, 1);
  eq("route has 3 waypoints", r.points.length, 3);
  eq("starts at lineup x", r.points[0].x, LINEUP.x);
  eq("starts at lineup y", r.points[0].y, LINEUP.y);
  eq("runs straight up first", r.points[1].x, LINEUP.x);
  const yBot = H - 90, yTop = CFG.STRIP_H + 60;
  const loY = yBot - CFG.TURN_MAX * (yBot - yTop);
  const hiY = yBot - CFG.TURN_MIN * (yBot - yTop);
  ok("turn depth inside the 35-70% band", r.yTurn >= loY - 1 && r.yTurn <= hiY + 1);
  eq("turn point matches yTurn", r.points[1].y, r.yTurn);
  ok("turn is deep but clear of the strip", r.yTurn > CFG.STRIP_H + 40);
  eq("turns across to the right sideline", r.points[2].x, W + 60);
  eq("cross leg stays at turn height", r.points[2].y, r.yTurn);
}
F.debug.forceRoute(-1, 0.6, 0);
{
  const r = F.debug.route();
  eq("route side -1", r.side, -1);
  eq("mirrors across to the left sideline", r.points[2].x, -60);
  eq("cross leg stays at turn height (left)", r.points[2].y, r.yTurn);
}

// ---- routes are random every round, but always out-and-turn ----
{
  const sides = {};
  let minY = Infinity, maxY = -Infinity;
  const yBot = H - 90, yTop = CFG.STRIP_H + 60;
  const loY = yBot - CFG.TURN_MAX * (yBot - yTop);
  const hiY = yBot - CFG.TURN_MIN * (yBot - yTop);
  for (let i = 0; i < 20; i++) {
    F.debug.forceRoute();
    const r = F.debug.route();
    sides[r.side] = 1;
    if (r.yTurn < minY) minY = r.yTurn;
    if (r.yTurn > maxY) maxY = r.yTurn;
    ok("random turn depth in band", r.yTurn >= loY - 1 && r.yTurn <= hiY + 1);
    ok("random turn clear of strip", r.yTurn > CFG.STRIP_H + 40);
    eq("random route has 3 waypoints", r.points.length, 3);
  }
  ok("both sides appear", !!sides[1] && !!sides[-1]);
  ok("turn depths vary", maxY - minY > 20);
}

// ---- taps inside the top UI strip don't throw ----
F.start();
F.debug.forceRoute(1, 0.6, 0); // straight to running
F.tap(200, 60); // y < STRIP_H
eq("strip tap ignored (frisbee still ready)", F.debug.frisbee().mode, "ready");
eq("strip tap ignored (not thrown)", F.debug.thrown(), false);

// ---- one throw per round ----
F.tap(300, 400);
eq("first throw flies", F.debug.frisbee().mode, "flying");
{
  const tx = F.debug.frisbee().tx;
  F.tap(100, 500);
  eq("second tap ignored (target unchanged)", F.debug.frisbee().tx, tx);
}

// ---- disc flies at constant speed ----
F.start();
F.debug.forceRoute(1, 0.6, 0);
F.tap(300, 400); // far enough to still be flying after 1s
{
  const f0 = F.debug.frisbee();
  const sx = f0.x, sy = f0.y;
  for (let i = 0; i < 62; i++) F.step(0.016); // 0.992s
  const f1 = F.debug.frisbee();
  eq("disc still flying", f1.mode, "flying");
  const covered = Math.hypot(f1.x - sx, f1.y - sy);
  ok("disc covers ~250px in 1s (constant speed)", Math.abs(covered - 248) < 15);
}

// ---- lead-the-cross interception -> CATCH, disc in his mouth ----
F.start();
F.debug.forceRoute(1, 0.6, 0);
tapIntercept(); // solved: disc and dog arrive together on the cross leg
for (let i = 0; i < 130; i++) F.step(0.016);
eq("intercepted cross -> CATCH", F.catches, 1);
eq("catch -> disc visibly in his mouth", F.debug.frisbee().mode, "caught");
eq("catch -> resolve beat", F.debug.phase(), "resolve");
ok("round cycles back to ready", stepUntil("ready", 900));
eq("frisbee ready for the next round", F.debug.frisbee().mode, "ready");

// ---- throw where he isn't -> MISS, forgiving ----
F.start();
F.debug.forceRoute(1, 0.6, 0); // he goes up, then right
F.tap(60, 500); // left side: nowhere near his path
for (let i = 0; i < 90; i++) F.step(0.016);
eq("throw off his path -> MISS (counter 0)", F.catches, 0);
eq("miss -> disc stays on the grass", F.debug.frisbee().mode, "landed");
eq("miss keeps game in play", F.state, "play");
ok("miss cycles to a fresh round", stepUntil("ready", 900));
eq("still no penalty after the cycle", F.catches, 0);

// ---- no-throw: he runs it all, quiet reset, no penalty ----
F.start();
F.debug.forceRoute(1, 0.6, 0);
ok("no-throw run cycles back to ready", stepUntil("ready", 900));
eq("runoff: counter untouched", F.catches, 0);
eq("runoff: frisbee ready", F.debug.frisbee().mode, "ready");
eq("runoff: no catch spin", F.debug.dog().flipT, 0);
eq("runoff: no miss shake", F.debug.dog().shakeT, 0);

// ---- interceptions stay catchable as he speeds up (ramp check) ----
F.start();
for (let c = 0; c < 4; c++) {
  F.debug.forceRoute(1, 0.55 + (c % 3) * 0.05, 0);
  tapIntercept();
  for (let i = 0; i < 130; i++) F.step(0.016);
}
eq("4 ramped interceptions -> 4 catches", F.catches, 4);

// ---- 10 catches -> WIN ----
F.start();
for (let c = 0; c < 10; c++) {
  F.debug.forceRoute(1, 0.55 + (c % 3) * 0.05, 0);
  tapIntercept();
  for (let i = 0; i < 130; i++) F.step(0.016);
}
eq("10 catches -> win state", F.state, "win");
eq("counter shows 10", F.catches, 10);

// ---- PLAY AGAIN resets ----
F.tap(W / 2, H * 0.66 + 42); // center of the PLAY AGAIN button
eq("play again -> back to play", F.state, "play");
eq("counter reset", F.catches, 0);
eq("streak reset", F.streak, 0);
eq("fresh round in ready", F.debug.phase(), "ready");

// ---- route shapes: 1 = diagonal cut (up then out at an angle) ----
F.start();
F.debug.forceRoute(1, 0.55, 1);
const r1 = F.debug.route();
eq("shape 1 stored", r1.shape, 1);
{
  // segment 0 goes UP (mostly vertical), segment 1 goes up-and-OUT
  // (clearly diagonal: more horizontal than vertical)
  const p0 = r1.points[0], p1 = r1.points[1], p2 = r1.points[2];
  const dx0 = Math.abs(p1.x - p0.x), dy0 = Math.abs(p1.y - p0.y);
  const dx1 = Math.abs(p2.x - p1.x), dy1 = Math.abs(p2.y - p1.y);
  ok("shape 1 seg0 mostly vertical", dy0 > dx0 * 1.5);
  ok("shape 1 seg1 diagonal", dx1 > dy1 * 0.5 && dy1 > 0);
  ok("shape 1 seg1 heads up-and-out", p2.y < p1.y);
}

// ---- route shapes: 2 = diagonal out (angled start, then across) ----
F.start();
F.debug.forceRoute(1, 0.55, 2);
const r2 = F.debug.route();
eq("shape 2 stored", r2.shape, 2);
{
  const p0 = r2.points[0], p1 = r2.points[1], p2 = r2.points[2];
  const dx0 = Math.abs(p1.x - p0.x), dy0 = Math.abs(p1.y - p0.y);
  const dx1 = Math.abs(p2.x - p1.x), dy1 = Math.abs(p2.y - p1.y);
  ok("shape 2 seg0 diagonal (not straight up)", dx0 > dy0 * 0.3);
  ok("shape 2 seg1 mostly horizontal", dx1 > dy1 * 2);
}

// ---- shape 0 = classic (straight up, then 90deg across) ----
F.start();
F.debug.forceRoute(1, 0.55, 0);
const r0 = F.debug.route();
eq("shape 0 stored", r0.shape, 0);
{
  const p0 = r0.points[0], p1 = r0.points[1], p2 = r0.points[2];
  const dx0 = Math.abs(p1.x - p0.x), dy0 = Math.abs(p1.y - p0.y);
  const dx1 = Math.abs(p2.x - p1.x), dy1 = Math.abs(p2.y - p1.y);
  ok("shape 0 seg0 vertical", dx0 < 8 && dy0 > 40);
  ok("shape 0 seg1 horizontal", dy1 < 8 && dx1 > 40);
}

// ---- random shapes actually vary ----
{
  const seen = {};
  for (let i = 0; i < 30; i++) {
    F.start();
    F.debug.forceRoute(1, 0.5, undefined); // omit shape -> random
    seen[F.debug.route().shape] = true;
  }
  ok("random routes use more than one shape", Object.keys(seen).length >= 2);
}

// ---- streaks: 3 in a row -> ON FIRE ----
// shape-agnostic interceptor: scan his whole path, tap the point where
// disc arrival time best matches his arrival time.
function tapInterceptAny() {
  const d = F.debug.dog();
  const r = F.debug.route();
  const s = d.speed;
  const lx = W / 2, ly = H - 24;
  const pts = [{ x: d.x, y: d.y }];
  for (let i = r.seg; i < r.points.length; i++) pts.push(r.points[i]);
  let tDog = 0, px = pts[0].x, py = pts[0].y, best = null, bestErr = 1e9;
  for (let i = 1; i < pts.length; i++) {
    const q = pts[i];
    const segLen = Math.hypot(q.x - px, q.y - py);
    const steps = Math.max(1, Math.ceil(segLen / 3));
    for (let j = 1; j <= steps; j++) {
      const f = j / steps;
      const x = px + (q.x - px) * f, y = py + (q.y - py) * f;
      const td = tDog + (segLen * f) / s;
      const tf = Math.hypot(x - lx, y - ly) / CFG.DISC_SPEED;
      const err = Math.abs(tf - td);
      if (err < bestErr) { bestErr = err; best = { x, y }; }
    }
    tDog += segLen / s; px = q.x; py = q.y;
  }
  F.tap(best.x, best.y);
}
F.start();
for (let c = 0; c < 3; c++) {
  F.debug.forceRoute(1, 0.55, 0);
  tapIntercept();
  for (let i = 0; i < 130; i++) F.step(0.016);
}
eq("3 catches -> streak 3", F.streak, 3);
ok("3 catches -> fire popup lit", F.fireT > 0);

// ---- a miss cools the streak off ----
F.debug.forceRoute(1, 0.55, 0);
F.tap(30, 620); // throw nowhere near him
for (let i = 0; i < 160; i++) F.step(0.016);
eq("miss -> streak reset", F.streak, 0);

// ---- catches still count during a streak ----
F.start();
for (let c = 0; c < 5; c++) {
  F.debug.forceRoute(1, 0.55, c % 3); // mix shapes
  tapInterceptAny();
  for (let i = 0; i < 130; i++) F.step(0.016);
}
eq("5 mixed-shape catches -> 5 catches", F.catches, 5);
eq("5 mixed-shape catches -> streak 5", F.streak, 5);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
