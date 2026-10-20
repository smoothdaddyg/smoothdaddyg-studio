/* Node test for Sink the Ship! (window.__shipTest).
   Verifies: title tap -> splash -> play, drag steers the sub (clamped to
   the bottom two-thirds), torpedoes auto-fire upward, torpedo-ship
   proximity fuse sinks ships, wrecks plunge to the ocean floor,
   falling wrecks crush you, mine contact kills (respawn in 1s, progress
   intact), ships come in several kinds, torpedoes destroy enemy subs
   and planes, level 1->2->3 progression with new hazards per level,
   octopus contact grants rapid-fire, enemy torpedoes and depth charges
   kill, level 3 goal -> win + fireworks, PLAY AGAIN
   resets, no NaNs, config sanity.
   Run: node tools/tests/sinktheship.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "sinktheship", "game.js");

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

const F = sandbox.window.__shipTest;
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
const WL = H * 0.12;

// sink one ship by parking a stationary ship right above the sub.
// Returns false if the round already ended (goal reached by a stray).
function sinkOne() {
  if (F.state !== "play") return F.sunk > 0;
  const before = F.sunk;
  waitForVulnerable(200);
  if (F.state !== "play") return F.sunk > before;
  const s = F.debug.sub();
  F.debug.spawnShip(s.x, WL + 6, 1, 0);
  for (let i = 0; i < 300 && F.sunk === before && F.state === "play"; i++) F.step(0.016);
  return F.sunk > before;
}
function stepUntilState(want, cap) {
  for (let i = 0; i < (cap || 400); i++) {
    if (F.state === want) return true;
    F.step(0.016);
  }
  return F.state === want;
}
// wait until the sub is alive and vulnerable (no deadT, no grace)
function waitForVulnerable(cap) {
  for (let i = 0; i < (cap || 400); i++) {
    const s = F.debug.sub();
    if (s.deadT <= 0 && s.graceT <= 0) return true;
    F.step(0.016);
  }
  const s = F.debug.sub();
  return s.deadT <= 0 && s.graceT <= 0;
}
// wait until the sub has respawned (deadT expired)
function waitForRespawn(cap) {
  for (let i = 0; i < (cap || 400); i++) {
    if (F.debug.sub().deadT <= 0) return true;
    F.step(0.016);
  }
  return F.debug.sub().deadT <= 0;
}
function finite(n) { return typeof n === "number" && isFinite(n); }

// ---- config sanity ----
eq("goals are 5/6/7", F.cfg.GOALS.join(","), "5,6,7");
eq("proximity fuse is generous (46)", F.cfg.FUSE_R, 46);
eq("torpedoes auto-fire every 0.9s", F.cfg.TORP_INTERVAL, 0.9);
eq("octopus rapid-fire lasts 8s", F.cfg.RAPID_T, 8);
eq("you respawn 1s after a kill", F.cfg.RESPAWN_T, 1.0);

// ---- title -> splash -> play ----
eq("starts on title", F.state, "title");
F.tap(200, 350);
eq("tap starts the game (level splash)", F.state, "splash");
eq("level 1", F.level, 1);
ok("splash clears into play", stepUntilState("play", 200));

// ---- drag steers the sub, clamped to the bottom two-thirds ----
F.drag(200, 600);
for (let i = 0; i < 90; i++) F.step(0.016);
{
  const s = F.debug.sub();
  ok("sub steered toward the drag point", Math.abs(s.x - 200) < 30 && Math.abs(s.y - 600) < 30);
}
F.drag(200, 40); // above the allowed zone
eq("drag clamps to bottom two-thirds (top)", F.debug.sub().ty, H * 0.34);
F.drag(200, 690);
eq("drag clamps to bottom two-thirds (bottom)", F.debug.sub().ty, H - 70);
F.drag(200, 600);
for (let i = 0; i < 90; i++) F.step(0.016);

// ---- torpedoes auto-fire upward ----
{
  let everSeen = 0, movedUp = false;
  let prevY = null;
  for (let i = 0; i < 140; i++) {
    F.step(0.016);
    const ts = F.debug.torps();
    if (ts.length > everSeen) everSeen = ts.length;
    if (ts.length > 0) {
      if (prevY !== null && ts[0].y < prevY) movedUp = true;
      prevY = ts[0].y;
    } else prevY = null;
  }
  ok("torpedoes auto-fire with no input", everSeen > 0);
  ok("torpedoes travel upward", movedUp);
}

// ---- torpedo-ship proximity fuse sinks the ship ----
{
  const s = F.debug.sub();
  F.debug.spawnShip(s.x + 30, WL + 6, 1, 0); // 30px off the torp line — fuse is 46
  const before = F.sunk;
  for (let i = 0; i < 160 && F.sunk === before; i++) F.step(0.016);
  eq("near-miss still sinks the ship (fuse)", F.sunk, before + 1);
  for (let i = 0; i < 100; i++) F.step(0.016); // let the wreck slide under
}

// ---- mine contact KILLS you, you respawn in a second, progress intact ----
F.debug.forceLevel(2);
ok("level 2 splash -> play", stepUntilState("play", 200));
ok("level 2 has drifting mines", F.debug.mines().length > 0);
{
  F.drag(200, 600);
  for (let i = 0; i < 60; i++) F.step(0.016);
  const sunkBefore = F.sunk;
  const m = F.debug.mines()[0];
  const s = F.debug.sub();
  m.x = s.x; m.y = s.y; m.vx = 0; m.vy = 0;
  F.step(0.05);
  ok("mine contact kills the sub", F.debug.sub().deadT > 0);
  eq("death costs no progress", F.sunk, sunkBefore);
  eq("game continues after the hit", F.state, "play");
  ok("sub pops back to life", waitForRespawn(200)); // ~1s later
  eq("still playing", F.state, "play");
}

// ---- ships come in different kinds ----
{
  const kinds = new Set();
  for (let i = 0; i < 20; i++) {
    F.debug.ships().length = 0;
    F.debug.spawnShip(200, WL + 6, 1, 0);
    kinds.add(F.debug.ships()[0].kind);
  }
  ok("random ships use several kinds", kinds.size >= 3);
  F.debug.ships().length = 0;
  for (const k of ["cargo", "sail", "destroyer", "liner", "tug"]) {
    F.debug.spawnShip(200, WL + 6, 1, 0, k);
    eq("kind stored: " + k, F.debug.ships()[0].kind, k);
    F.debug.ships().length = 0;
  }
}

// ---- sunk ships plunge to the ocean floor, not just fade ----
{
  F.drag(200, 600);
  for (let i = 0; i < 60; i++) F.step(0.016);
  const s = F.debug.sub();
  const before = F.sunk;
  F.debug.spawnShip(s.x, WL + 6, 1, 0, "cargo");
  for (let i = 0; i < 200 && F.sunk === before; i++) F.step(0.016);
  eq("ship sunk", F.sunk, before + 1);
  let maxY = 0;
  for (let i = 0; i < 400 && F.debug.ships().length > 0; i++) {
    F.step(0.016);
    for (const w of F.debug.ships()) if (w.sinking) maxY = Math.max(maxY, w.y);
  }
  ok("wreck sank deep before disappearing (maxY=" + Math.round(maxY) + ")", maxY > H * 0.7);
}

// ---- a falling wreck crushes you ----
{
  F.debug.forceLevel(1); // clean slate: sunk=0, known goal, no carry-over
  ok("wreck test reaches play", stepUntilState("play", 300));
  ok("sub vulnerable for the wreck test", waitForVulnerable(300));
  F.drag(200, 600);
  for (let i = 0; i < 60; i++) F.step(0.016);
  const s = F.debug.sub();
  const before = F.sunk;
  F.debug.spawnShip(s.x, WL + 6, 1, 0, "tug"); // speed 0: sits still, sinks straight down
  for (let i = 0; i < 200 && F.sunk === before; i++) F.step(0.016);
  eq("ship sunk", F.sunk, before + 1);
  let died = false;
  for (let i = 0; i < 300 && !died; i++) { F.step(0.016); died = F.debug.sub().deadT > 0; }
  ok("the falling wreck kills you", died);
  ok("respawn after the wreck", waitForRespawn(200));
  ok("vulnerable again after the wreck", waitForVulnerable(300));
}

// ---- level 1 -> 2 progression ----
F.debug.forceLevel(1);
ok("back to level 1 play", stepUntilState("play", 200));
F.drag(200, 600);
for (let i = 0; i < 60; i++) F.step(0.016);
// sink until level 1's goal is met (stray torps may help — that's fine)
const lv1 = F.level;
for (let k = 0; k < 12 && F.level === lv1; k++) sinkOne();
eq("level 1 goal reached -> level 2", F.level, lv1 + 1);
eq("sunk counter resets per level", F.sunk, 0);
F.debug.ships().length = 0; // clear stray traffic — test the transition itself
ok("level 2 splash -> play", stepUntilState("play", 300));
eq("now on level 2", F.level, 2);
eq("sunk counter resets per level", F.sunk, 0);

// ---- octopus contact grants rapid-fire ----
ok("level 2 play", stepUntilState("play", 200));
{
  const s = F.debug.sub();
  F.debug.spawnOcto(s.x, s.y);
  F.step(0.05);
  ok("octopus grants 8s rapid-fire", F.debug.sub().rapidT > 7);
}

// ---- torpedoes destroy enemy subs ----
{
  F.debug.mines().length = 0; // isolate: test the torp, not mine-dodging
  F.debug.ships().length = 0; // clear the sky for a clean shot
  const s = F.debug.sub();
  F.debug.spawnESub(s.x, s.y - 220, 1);
  const e = F.debug.esubs()[F.debug.esubs().length - 1];
  e.speed = 0; e.fireT = 9999; // parked, harmless
  const n = F.debug.esubs().length;
  for (let i = 0; i < 200 && F.debug.esubs().length === n; i++) F.step(0.016);
  eq("torpedo destroys the enemy sub", F.debug.esubs().length, n - 1);
}

// ---- torpedoes hit planes in the sky ----
{
  F.debug.mines().length = 0;
  const s = F.debug.sub();
  F.debug.spawnPlane(s.x);
  const p = F.debug.planes()[F.debug.planes().length - 1];
  p.speed = 0; p.dropT = 9999; // parked, no charge
  let gone = false;
  for (let i = 0; i < 500 && !gone; i++) {
    if (i % 15 === 0) F.debug.ships().length = 0; // keep the flight path clear
    F.step(0.016);
    gone = F.debug.planes().indexOf(p) < 0; // our plane specifically
  }
  ok("torpedo shoots down the plane", gone);
}

// ---- level 3: enemy subs + planes ----
F.debug.forceLevel(3);
ok("level 3 splash -> play", stepUntilState("play", 200));
eq("level 3 fields two enemy subs", F.debug.esubs().length, 2);
for (let i = 0; i < 200 && F.debug.sub().graceT > 0; i++) F.step(0.016); // grace must fully expire
{
  const s = F.debug.sub();
  const e = F.debug.esubs()[0];
  e.x = s.x - 150; e.y = s.y; e.fireT = 0.01;
  let dead = false;
  for (let i = 0; i < 160 && !dead; i++) { F.step(0.016); dead = F.debug.sub().deadT > 0; }
  ok("enemy torpedo kills (dodgeable, no penalty)", dead);
  eq("still playing after enemy hit", F.state, "play");
}
for (let i = 0; i < 200 && F.debug.sub().deadT > 0; i++) F.step(0.016); // respawn
for (let i = 0; i < 200 && F.debug.sub().graceT > 0; i++) F.step(0.016); // grace must fully expire
{
  F.debug.charges().length = 0; // ignore any earlier auto-dropped charges
  F.debug.spawnPlane(200);
  let sawCharge = false;
  for (let i = 0; i < 400 && !sawCharge; i++) {
    F.step(0.016);
    sawCharge = F.debug.charges().length > 0;
    if (!sawCharge && i === 200) F.debug.spawnPlane(200); // first one flew off — try again
  }
  ok("plane drops a depth charge", sawCharge);
  const c = F.debug.charges()[0];
  ok("charge telegraphs its landing", c.warnT > 0);
  F.debug.esubs().length = 0; // isolate: test the charge, not torpedo-dodging
  F.debug.etorps().length = 0;
  ok("sub vulnerable for the charge test", waitForVulnerable(300));
  const s = F.debug.sub();
  c.x = s.x; c.y = s.y; c.warnT = 0;
  F.step(0.05);
  ok("depth charge kills on contact", F.debug.sub().deadT > 0);
}
ok("respawn after the charge", waitForRespawn(200));

// ---- level 3 goal -> WIN + replay ----
F.debug.esubs().length = 0; // clear the hunters — test the goal, not the dodge
F.debug.etorps().length = 0;
F.drag(200, 600);
for (let i = 0; i < 60; i++) F.step(0.016);
// sink until the goal is met (stray torps may help — that's fine)
for (let k = 0; k < 14 && F.sunk < 7 && F.state === "play"; k++) {
  ok("sinking toward 7 (now " + F.sunk + ")", sinkOne());
}
ok("goal of 7 reached", F.sunk >= 7);
F.debug.ships().length = 0; // clear stray traffic — test the transition itself
for (let i = 0; i < 110; i++) F.step(0.016); // let the last wreck slide under
eq("level 3 goal -> win state", F.state, "win");
{
  const b = F.debug.playBtn();
  F.tap(b.x + b.w / 2, b.y + b.h / 2);
}
eq("replay -> fresh run at level 1 splash", F.state, "splash");
eq("replay resets to level 1", F.level, 1);
eq("replay resets the counter", F.sunk, 0);
ok("replay reaches play", stepUntilState("play", 200));

// ---- no NaNs anywhere ----
{
  F.drag(150, 500);
  for (let i = 0; i < 120; i++) F.step(0.016);
  let bad = 0;
  const s = F.debug.sub();
  if (!finite(s.x) || !finite(s.y)) bad++;
  for (const arr of [F.debug.ships(), F.debug.torps(), F.debug.mines(),
                     F.debug.esubs(), F.debug.etorps(), F.debug.charges()]) {
    for (const e of arr) if (!finite(e.x) || !finite(e.y)) bad++;
  }
  eq("no NaN positions", bad, 0);
}

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
