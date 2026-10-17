/* Node test for Frisbee Dog v3 — "lead him" mechanics (window.__dogTest).
   Verifies: title tap starts (ready phase), taps ignored during ready,
   taps inside the top UI strip don't throw, throw led inside the sprint
   reach -> CATCH (disc visibly in his mouth), throw at 2x reach -> MISS
   (disc stays on the grass, forgiving, no penalty), one throw per round,
   dog diverts after the read beat (1.5x sprint straight at the landing
   point), headings vary across rounds (upfield-biased, never scripted),
   no-throw -> quiet reset, dog never enters the top strip, round cycling
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

// throw px ahead of the dog along his current heading
function throwLead(px) {
  const d = F.debug.dog();
  const hd = F.debug.heading();
  F.tap(d.x + Math.cos(hd) * px, d.y + Math.sin(hd) * px);
}
// step until the round phase becomes `want` (or give up after cap steps)
function stepUntil(want, cap) {
  for (let i = 0; i < (cap || 600); i++) {
    if (F.debug.phase() === want) return true;
    F.step(0.016);
  }
  return F.debug.phase() === want;
}
// step until the dog starts reacting to a throw
function stepUntilReact(cap) {
  for (let i = 0; i < (cap || 60); i++) {
    if (F.debug.reacting()) return true;
    F.step(0.016);
  }
  return F.debug.reacting();
}

// ---- config sanity ----
eq("win at 10 catches", CFG.WIN_CATCHES, 10);
eq("dog is smaller now (32)", CFG.DOG_R, 32);
eq("catch radius is generous (68)", CFG.CATCH_R, 68);
eq("sprint multiplier 1.5", CFG.SPRINT_MULT, 1.5);
eq("flight time 0.9s", CFG.FLIGHT_T, 0.9);
eq("reaction beat 0.25s", CFG.REACT_T, 0.25);
eq("slow read 0.55s", CFG.SLOW_REACT_T, 0.55);
eq("slow read chance 10%", CFG.SLOW_REACT_CHANCE, 0.1);
eq("top UI strip 120px", CFG.STRIP_H, 120);
eq("max free run 4.5s", CFG.RUN_T, 4.5);
eq("base speed 130, ramps +12/2, caps 230",
  CFG.DOG_SPEED === 130 && CFG.DOG_SPEED_UP === 12 &&
  CFG.SPEED_EVERY === 2 && CFG.DOG_SPEED_MAX === 230, true);

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

// ---- taps inside the top UI strip don't throw ----
F.start();
F.debug.forceHeading(-Math.PI / 2); // straight to running
F.tap(200, 60); // y < STRIP_H
eq("strip tap ignored (frisbee still ready)", F.debug.frisbee().mode, "ready");
eq("strip tap ignored (not thrown)", F.debug.thrown(), false);

// ---- one throw per round ----
throwLead(80);
eq("first throw flies", F.debug.frisbee().mode, "flying");
{
  const tx = F.debug.frisbee().tx;
  F.tap(100, 500);
  eq("second tap ignored (target unchanged)", F.debug.frisbee().tx, tx);
}

// ---- throw led inside reach -> CATCH, disc in his mouth ----
F.start();
F.debug.forceHeading(-Math.PI / 2); // straight up
{
  const r = F.debug.zoneR();
  ok("reach ring is positive and sane", r > 100 && r < 200);
}
throwLead(80); // well inside the reach ring
for (let i = 0; i < 60; i++) F.step(0.016); // 0.96s > 0.9s flight
eq("led throw inside reach -> CATCH", F.catches, 1);
eq("catch -> resolve beat", F.debug.phase(), "resolve");
eq("catch -> disc visibly in his mouth", F.debug.frisbee().mode, "caught");
// round cycles: resolve -> return (jog back) -> ready (fresh heading)
ok("round cycles back to ready", stepUntil("ready", 600));
eq("frisbee ready for the next round", F.debug.frisbee().mode, "ready");

// ---- throw at 2x reach -> MISS, forgiving ----
F.start();
F.debug.forceHeading(-Math.PI / 2);
{
  const r = F.debug.zoneR();
  throwLead(r * 2); // way beyond what he can sprint to
}
for (let i = 0; i < 60; i++) F.step(0.016);
eq("throw at 2x reach -> MISS (counter 0)", F.catches, 0);
eq("miss -> resolve beat", F.debug.phase(), "resolve");
eq("miss -> disc stays on the grass", F.debug.frisbee().mode, "landed");
eq("miss keeps game in play", F.state, "play");
ok("miss cycles to a fresh round", stepUntil("ready", 600));
eq("still no penalty after the cycle", F.catches, 0);

// ---- after the read beat the dog diverts: 1.5x sprint at the landing ----
F.start();
F.debug.forceHeading(-Math.PI / 2);
{
  const d0 = F.debug.dog();
  const base = d0.base;
  const tx = d0.x + 100, ty = d0.y - 60; // off to his right and ahead
  F.tap(tx, ty);
  ok("throw registered", F.debug.thrown());
  ok("dog reads the throw", stepUntilReact(60));
  const s = F.debug.dog().speed;
  ok("sprint speed is 1.5x base", Math.abs(s - base * 1.5) < 1);
  const p0 = { x: F.debug.dog().x, y: F.debug.dog().y };
  F.step(0.2);
  const p1 = F.debug.dog();
  const mvx = p1.x - p0.x, mvy = p1.y - p0.y;
  const mv = Math.hypot(mvx, mvy);
  ok("dog is moving", mv > 20);
  const dx = tx - p0.x, dy = ty - p0.y;
  const dot = (mvx * dx + mvy * dy) / (mv * Math.hypot(dx, dy));
  ok("dog sprints straight at the landing point", dot > 0.95);
  ok("sprint covers ~1.5x base speed", Math.abs(mv / 0.2 - base * 1.5) < base * 1.5 * 0.2);
}

// ---- headings vary across rounds: upfield-biased, never scripted ----
{
  const seen = [];
  for (let i = 0; i < 20; i++) { F.start(); seen.push(F.debug.heading()); }
  const up = -Math.PI / 2;
  for (const h of seen) ok("heading within +/-80deg of up", Math.abs(h - up) <= 1.41);
  const distinct = new Set(seen.map((h) => h.toFixed(3))).size;
  ok("headings vary across rounds", distinct >= 4);
  const upfield = seen.filter((h) => Math.abs(h - up) <= 0.87).length;
  ok("headings are upfield-biased", upfield >= 10);
}

// ---- no-throw -> quiet reset, no penalty ----
F.start();
F.debug.forceHeading(-Math.PI / 2);
ok("no-throw run cycles back to ready", stepUntil("ready", 700));
eq("runoff: counter untouched", F.catches, 0);
eq("runoff: frisbee ready", F.debug.frisbee().mode, "ready");
eq("runoff: no catch spin", F.debug.dog().flipT, 0);
eq("runoff: no miss shake", F.debug.dog().shakeT, 0);

// ---- dog never enters the top strip ----
F.start();
F.debug.forceHeading(-Math.PI / 2); // straight up: worst case
{
  let minY = Infinity;
  for (let i = 0; i < 400; i++) {
    F.step(0.016);
    const y = F.debug.dog().y;
    if (y < minY) minY = y;
  }
  ok("dog stays below the strip (y >= STRIP_H + 40)", minY >= CFG.STRIP_H + 40 - 1);
}

// ---- 10 catches -> WIN ----
F.start();
for (let c = 0; c < 10; c++) {
  F.debug.forceHeading(-Math.PI / 2);
  throwLead(80);
  for (let i = 0; i < 60; i++) F.step(0.016);
}
eq("10 catches -> win state", F.state, "win");
eq("counter shows 10", F.catches, 10);

// ---- PLAY AGAIN resets ----
F.tap(W / 2, H * 0.66 + 42); // center of the PLAY AGAIN button
eq("play again -> back to play", F.state, "play");
eq("counter reset", F.catches, 0);
eq("fresh round in ready", F.debug.phase(), "ready");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
