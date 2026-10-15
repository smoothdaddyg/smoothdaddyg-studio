/* Node test for Frisbee Dog (window.__dogTest).
   Verifies: title tap starts, tap throws frisbee to tap point, taps ignored
   mid-flight, lead-the-runner catch (tap ahead -> catch), tap directly on
   the dog -> miss (he outruns the landing), catch counter, forgiving miss
   (no penalty, immediate re-throw), 10 catches -> win, PLAY AGAIN resets,
   dog turns at edges, and config sanity.
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
const DOG_Y = H * 0.70;

// put the dog somewhere deterministic: x, moving right at fixed speed
function placeDog(x, speed) {
  const d = F.debug.dog();
  d.x = x; d.dir = 1; d.speed = speed; d.flipT = 0; d.tiltT = 0;
  return d;
}
// tap where the dog WILL be at landing: lead = speed * FLIGHT_T
function tapAhead(x, speed) {
  F.tap(x + speed * F.cfg.FLIGHT_T, DOG_Y);
}

// ---- config sanity ----
eq("win at 10 catches", F.cfg.WIN_CATCHES, 10);
eq("catch radius is generous (68)", F.cfg.CATCH_R, 68);
eq("flight time is 0.6s", F.cfg.FLIGHT_T, 0.6);
ok("catch radius > dog body radius", F.cfg.CATCH_R > F.cfg.DOG_R);

// ---- title -> play ----
eq("starts on title", F.state, "title");
F.tap(200, 350); // tap anywhere starts
eq("tap starts the game", F.state, "play");
eq("frisbee ready after start", F.debug.frisbee().mode, "ready");
eq("counter starts at 0", F.catches, 0);

// ---- tap throws frisbee to tap point ----
placeDog(100, 130);
F.tap(300, 400);
eq("tap -> frisbee flying", F.debug.frisbee().mode, "flying");
eq("frisbee target x", F.debug.frisbee().tx, 300);
eq("frisbee target y", F.debug.frisbee().ty, 400);

// ---- taps ignored mid-flight ----
F.tap(100, 100);
eq("mid-flight tap ignored (target x unchanged)", F.debug.frisbee().tx, 300);
eq("mid-flight tap ignored (target y unchanged)", F.debug.frisbee().ty, 400);

// let it land (0.6s flight); dog parked far away -> miss, no penalty
for (let i = 0; i < 45; i++) F.step(0.016); // 0.72s
eq("frisbee ready again after landing", F.debug.frisbee().mode, "ready");
eq("miss: counter unchanged", F.catches, 0);
eq("miss: still playing (no penalty)", F.state, "play");

// ---- lead-the-runner catch ----
F.start();
placeDog(100, 130);
tapAhead(100, 130); // tap where he'll be at landing, not where he is
eq("throw away", F.debug.frisbee().mode, "flying");
for (let i = 0; i < 45; i++) F.step(0.016);
eq("lead tap -> CATCH", F.catches, 1);
eq("still playing after catch", F.state, "play");

// ---- tap directly on the dog -> MISS (he outruns the landing) ----
F.start();
placeDog(100, 130);
F.tap(100, DOG_Y); // right on his nose at throw time
for (let i = 0; i < 45; i++) F.step(0.016);
eq("tap-on-dog -> miss (counter 0)", F.catches, 0);
eq("miss keeps game in play", F.state, "play");
// ...and you can throw again immediately
F.tap(200, 300);
eq("immediate re-throw works", F.debug.frisbee().mode, "flying");

// ---- dog turns at edges ----
F.start();
{
  const d = F.debug.dog();
  d.x = W - 70; d.dir = 1; d.speed = 130; // past the turn line (W-80)
  F.step(0.016);
  eq("dog turns at right edge", d.dir, -1);
  d.x = 70; d.dir = -1;
  F.step(0.016);
  eq("dog turns at left edge", d.dir, 1);
}

// ---- 10 catches -> WIN ----
F.start();
for (let c = 0; c < 10; c++) {
  placeDog(100, 130);
  tapAhead(100, 130);
  for (let i = 0; i < 45; i++) F.step(0.016);
}
eq("10 catches -> win state", F.state, "win");
eq("counter shows 10", F.catches, 10);

// ---- PLAY AGAIN resets ----
F.tap(W / 2, H * 0.66 + 42); // center of the PLAY AGAIN button
eq("play again -> back to play", F.state, "play");
eq("counter reset", F.catches, 0);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
