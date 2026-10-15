/* Node test for Frisbee Dog v2 — top-down route running (window.__dogTest).
   Verifies: title tap starts (ready phase + telegraph), taps ignored during
   ready, release -> running + telegraph fades, route generation (streak /
   slant / out, mirrored sides, cut range), tap throws frisbee flat to the
   tap point, one throw per round, intercept-a-catch on streak and slant,
   tap-where-he-was -> miss (forgiving, no penalty), no-throw runoff ->
   quiet reset, round cycling (resolve -> return -> ready), 10 catches ->
   win, PLAY AGAIN resets, and config sanity.
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
const LINEUP = { x: W / 2, y: H - 90 }; // bottom-center

// tap the meeting point: where the dog WILL be when the frisbee lands
function tapMeeting() {
  const d = F.debug.dog();
  F.tap(d.x + Math.cos(d.angle) * d.speed * F.cfg.FLIGHT_T,
        d.y + Math.sin(d.angle) * d.speed * F.cfg.FLIGHT_T);
}
// step until the round phase becomes `want` (or give up after cap steps)
function stepUntil(want, cap) {
  for (let i = 0; i < (cap || 500); i++) {
    if (F.debug.phase() === want) return true;
    F.step(0.016);
  }
  return F.debug.phase() === want;
}

// ---- config sanity ----
eq("win at 10 catches", F.cfg.WIN_CATCHES, 10);
eq("catch radius is generous (68)", F.cfg.CATCH_R, 68);
eq("flight time is 0.6s", F.cfg.FLIGHT_T, 0.6);
eq("cut range 30-60%", F.cfg.CUT_MIN, 0.30);
eq("cut range 30-60% (max)", F.cfg.CUT_MAX, 0.60);
ok("catch radius > dog body size", F.cfg.CATCH_R > F.cfg.DOG_R);

// ---- title -> play: ready phase + telegraph ----
eq("starts on title", F.state, "title");
F.tap(200, 350); // tap anywhere starts
eq("tap starts the game", F.state, "play");
eq("round starts in ready phase", F.debug.phase(), "ready");
ok("telegraph visible during ready", F.debug.dotAlpha() > 0.5);
eq("frisbee ready after start", F.debug.frisbee().mode, "ready");
eq("counter starts at 0", F.catches, 0);
eq("dog lines up at bottom-center", F.debug.dog().x, LINEUP.x);
eq("dog lines up at bottom-center (y)", F.debug.dog().y, LINEUP.y);

// ---- taps during the ready beat do nothing ----
F.tap(200, 300);
eq("ready-beat tap ignored (still ready)", F.debug.frisbee().mode, "ready");

// ---- release: ready -> running, telegraph fades ----
ok("release happens after the ready beat", stepUntil("running", 80));
for (let i = 0; i < 50; i++) F.step(0.016); // let the dots fade
eq("telegraph gone after release", F.debug.dotAlpha(), 0);

// ---- route generation: all three types, mirrored, cut in range ----
F.start();
F.debug.forceRoute("streak");
{
  const r = F.debug.route();
  eq("streak type", r.type, "streak");
  eq("streak has 2 waypoints", r.points.length, 2);
  eq("streak starts at lineup x", r.points[0].x, LINEUP.x);
  eq("streak starts at lineup y", r.points[0].y, LINEUP.y);
  eq("streak runs straight up", r.points[1].x, LINEUP.x);
  eq("streak runs off the top", r.points[1].y, -60);
}
F.debug.forceRoute("slant", 1, 0.4);
{
  const r = F.debug.route();
  eq("slant has 4 waypoints", r.points.length, 4);
  eq("slant stem is up the middle", r.points[1].x, LINEUP.x);
  ok("slant cutY in range", r.cutY >= 60 && r.cutY <= LINEUP.y - 80);
  eq("slant breaks right", r.points[2].x, W - 40);
  ok("slant diagonal climbs", r.points[2].y < r.points[1].y);
  eq("slant finishes off the top", r.points[3].y, -60);
}
F.debug.forceRoute("slant", -1, 0.4);
eq("slant mirrors left", F.debug.route().points[2].x, 40);
F.debug.forceRoute("out", 1, 0.5);
{
  const r = F.debug.route();
  eq("out has 4 waypoints", r.points.length, 4);
  eq("out cut is horizontal", r.points[2].y, r.points[1].y);
  eq("out breaks right", r.points[2].x, W - 40);
  eq("out finishes off the top", r.points[3].y, -60);
}
// all three types are producible from the random generator
{
  const seen = {};
  for (let i = 0; i < 60; i++) { F.debug.forceRoute(); seen[F.debug.route().type] = 1; }
  ok("random routes produce streak", !!seen.streak);
  ok("random routes produce slant", !!seen.slant);
  ok("random routes produce out", !!seen.out);
}

// ---- tap throws the frisbee flat to the tap point ----
F.start();
F.debug.forceRoute("streak"); // skipReady -> straight to running
F.tap(300, 300);
eq("tap -> frisbee flying", F.debug.frisbee().mode, "flying");
eq("frisbee target x", F.debug.frisbee().tx, 300);
eq("frisbee target y", F.debug.frisbee().ty, 300);

// ---- one throw per round: taps ignored mid-flight ----
F.tap(100, 100);
eq("mid-flight tap ignored (x)", F.debug.frisbee().tx, 300);
eq("mid-flight tap ignored (y)", F.debug.frisbee().ty, 300);

// ---- intercept-a-catch on a streak: tap the meeting point ----
F.start();
F.debug.forceRoute("streak");
tapMeeting(); // where he'll be at landing, not where he is
eq("throw away", F.debug.frisbee().mode, "flying");
for (let i = 0; i < 45; i++) F.step(0.016); // 0.72s > 0.6s flight
eq("meeting-point tap -> CATCH", F.catches, 1);
eq("catch -> resolve beat", F.debug.phase(), "resolve");
// round cycles: resolve -> return (jog back) -> ready (fresh route)
ok("round cycles back to ready", stepUntil("ready", 400));
eq("frisbee ready for the next round", F.debug.frisbee().mode, "ready");
ok("next round releases", stepUntil("running", 80));
F.tap(250, 250);
eq("can throw again next round", F.debug.frisbee().mode, "flying");

// ---- tap where he WAS (behind him) -> miss, forgiving ----
F.start();
F.debug.forceRoute("streak");
F.tap(LINEUP.x, LINEUP.y); // right where he stood at throw time — he's gone
for (let i = 0; i < 45; i++) F.step(0.016);
eq("tap-behind -> miss (counter 0)", F.catches, 0);
eq("miss keeps game in play", F.state, "play");
ok("miss cycles to a fresh round", stepUntil("ready", 400));
eq("still no penalty after the cycle", F.catches, 0);

// ---- intercept-a-catch on a slant: read the cut, hit the meeting point ----
F.start();
F.debug.forceRoute("slant", 1, 0.4); // deterministic cut
// route: (200,610) -> (200,330) -> (360,170) -> (360,-60); leg1 = 280px @130
for (let i = 0; i < 150; i++) F.step(0.016); // 2.4s: dog is on the diagonal
{
  const d = F.debug.dog();
  ok("dog made the cut", d.x > 205);
  ok("dog still on the field", d.y > 60);
}
tapMeeting(); // lead him along the diagonal
for (let i = 0; i < 45; i++) F.step(0.016);
eq("slant intercept -> CATCH", F.catches, 1);

// ---- no-throw runoff -> quiet reset, no penalty, no celebration ----
F.start();
F.debug.forceRoute("streak");
for (let i = 0; i < 500; i++) F.step(0.016); // 8s: 5.2s to run off + jog back
eq("runoff cycles back to ready", F.debug.phase(), "ready");
eq("runoff: counter untouched", F.catches, 0);
eq("runoff: frisbee ready", F.debug.frisbee().mode, "ready");
eq("runoff: no catch spin", F.debug.dog().flipT, 0);
eq("runoff: no miss shake", F.debug.dog().shakeT, 0);

// ---- 10 catches -> WIN ----
F.start();
for (let c = 0; c < 10; c++) {
  F.debug.forceRoute("streak");
  tapMeeting();
  for (let i = 0; i < 45; i++) F.step(0.016);
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
