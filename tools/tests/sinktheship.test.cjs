/* Node test for Sink the Ship! (window.__shipTest).
   Verifies: title tap -> splash -> play, drag steers the sub (clamped to
   the bottom two-thirds), torpedoes auto-fire upward, torpedo-ship
   proximity fuse sinks ships, sunk counter advances, mine contact stuns
   with no penalty or progress loss, level 1->2->3 progression with new
   hazards per level, octopus contact grants rapid-fire, enemy torpedoes
   and depth charges stun, level 3 goal -> win + fireworks, PLAY AGAIN
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

// sink one ship by parking a stationary ship right above the sub
function sinkOne() {
  const before = F.sunk;
  const s = F.debug.sub();
  F.debug.spawnShip(s.x, WL + 6, 1, 0);
  for (let i = 0; i < 200 && F.sunk === before; i++) F.step(0.016);
  return F.sunk > before;
}
function stepUntilState(want, cap) {
  for (let i = 0; i < (cap || 400); i++) {
    if (F.state === want) return true;
    F.step(0.016);
  }
  return F.state === want;
}
function finite(n) { return typeof n === "number" && isFinite(n); }

// ---- config sanity ----
eq("goals are 5/6/7", F.cfg.GOALS.join(","), "5,6,7");
eq("proximity fuse is generous (46)", F.cfg.FUSE_R, 46);
eq("torpedoes auto-fire every 0.9s", F.cfg.TORP_INTERVAL, 0.9);
eq("octopus rapid-fire lasts 8s", F.cfg.RAPID_T, 8);
eq("stun lasts 1s", F.cfg.STUN_T, 1.0);

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

// ---- mine contact stuns, no penalty, progress intact ----
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
  ok("mine contact stuns the sub", F.debug.sub().stunT > 0);
  eq("stun costs no progress", F.sunk, sunkBefore);
  eq("game continues after the hit", F.state, "play");
  for (let i = 0; i < 90; i++) F.step(0.016); // 1.4s > stun
  ok("sub recovers from the stun", F.debug.sub().stunT <= 0);
}

// ---- level 1 -> 2 progression ----
F.debug.forceLevel(1);
ok("back to level 1 play", stepUntilState("play", 200));
F.drag(200, 600);
for (let i = 0; i < 60; i++) F.step(0.016);
for (let k = 0; k < 5; k++) ok("sank ship " + (k + 1) + " of 5", sinkOne());
F.debug.ships().length = 0; // clear stray traffic — test the transition itself
for (let i = 0; i < 110; i++) F.step(0.016); // let the last wreck slide under
eq("level 1 goal -> level 2 splash", F.state, "splash");
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

// ---- level 3: enemy subs + planes ----
F.debug.forceLevel(3);
ok("level 3 splash -> play", stepUntilState("play", 200));
eq("level 3 fields two enemy subs", F.debug.esubs().length, 2);
{
  const s = F.debug.sub();
  const e = F.debug.esubs()[0];
  e.x = s.x - 150; e.y = s.y; e.fireT = 0.01;
  let stunned = false;
  for (let i = 0; i < 120 && !stunned; i++) { F.step(0.016); stunned = F.debug.sub().stunT > 0; }
  ok("enemy torpedo stuns (dodgeable, no penalty)", stunned);
  eq("still playing after enemy hit", F.state, "play");
}
for (let i = 0; i < 90; i++) F.step(0.016); // recover
for (let i = 0; i < 200 && F.debug.sub().graceT > 0; i++) F.step(0.016); // grace must fully expire
{
  F.debug.charges().length = 0; // ignore any earlier auto-dropped charges
  F.debug.spawnPlane(200);
  let sawCharge = false;
  for (let i = 0; i < 200 && !sawCharge; i++) { F.step(0.016); sawCharge = F.debug.charges().length > 0; }
  ok("plane drops a depth charge", sawCharge);
  const c = F.debug.charges()[0];
  ok("charge telegraphs its landing", c.warnT > 0);
  const s = F.debug.sub();
  c.x = s.x; c.y = s.y; c.warnT = 0;
  F.step(0.05);
  ok("depth charge stuns on contact", F.debug.sub().stunT > 0);
}
for (let i = 0; i < 90; i++) F.step(0.016); // recover

// ---- level 3 goal -> WIN + replay ----
F.drag(200, 600);
for (let i = 0; i < 60; i++) F.step(0.016);
for (let k = 0; k < 7; k++) ok("sank ship " + (k + 1) + " of 7", sinkOne());
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
