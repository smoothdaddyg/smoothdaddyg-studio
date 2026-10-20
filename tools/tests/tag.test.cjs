/* Node test for Tag! You're It (window.__tagTest).
   Simple playground tag: you start as IT, tag someone -> they're it,
   they chase whoever's closest, tag anybody. 60s timer — whoever is
   IT at 0 loses. Verifies: title tap starts (you're it), drag-to-move,
   kids wander/flee/stay in bounds, you tag a kid -> they become it,
   tag cooldown (no instant re-tag), it-kid tags you -> you're it again,
   it-kid tags a friend -> it bounces, it-kid chases the CLOSEST (no
   favorites), timer counts down -> end at 0, loser = who's it,
   replay resets, obstacles solid, no NaNs, config sanity.
   Run: node tools/tests/tag.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "tag", "game.js");

const noop = () => {};
const audioCalls = [];
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
  makeAudio: () => ({
    tone: (...a) => audioCalls.push(["tone", ...a]),
    noise: (...a) => audioCalls.push(["noise", ...a]),
    arp: (...a) => audioCalls.push(["arp", ...a]),
    unlock: noop,
    state: () => "running",
  }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });

const T = sandbox.window.__tagTest;
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}
const CFG = T.cfg;

// ---- title starts the game, you're it ----
eq("initial state is title", T.state, "title");
T.tap(200, 350);
eq("tap starts game", T.state, "play");
eq("you start as IT", T.it, "player");
eq("timer starts at ROUND_T", T.roundT, CFG.ROUND_T);

// ---- timer counts down ----
T.step(1.0);
ok("timer ticks down", T.roundT < CFG.ROUND_T && T.roundT > CFG.ROUND_T - 2);

// ---- drag moves you ----
T.start();
const p0 = { x: T.debug.player().x, y: T.debug.player().y };
T.debug.drag(p0.x + 100, p0.y);
for (let i = 0; i < 30; i++) T.step(0.016);
const p1 = T.debug.player();
ok("drag moves you right", p1.x > p0.x + 30);
T.debug.release();

// ---- you tag a kid -> THEY'RE it ----
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016);
eq("your tag: kid 0 is it", T.it, 0);

// ---- cooldown: no instant re-tag ----
T.debug.placePlayer(200, 300); // still on top of kid 0
T.step(0.016);
eq("cooldown blocks instant tag-back", T.it, 0);
// wait out the cooldown, then the it-kid CAN tag you back (tag anybody)
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
for (let i = 0; i < 70 && T.it !== "player"; i++) T.step(0.016);
eq("after cooldown, it-kid tags you -> you're it", T.it, "player");

// ---- it-kid tags a friend -> it bounces ----
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016); // you tag kid 0
eq("you tag kid 0", T.it, 0);
T.debug.placeKid(1, 230, 300); // friend next to the it-kid
T.debug.placePlayer(60, 120);  // you far away
for (const j of [2, 3, 4]) T.debug.placeKid(j, 340, 520 + j * 40);
for (let i = 0; i < 250 && T.it !== 1; i++) T.step(0.016); // hold + chase
eq("it-kid tags the friend", T.it, 1);

// ---- the HOLD: the new "it" must wait a full second, standing still ----
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016); // you tag kid 0 -> it = 0, hold starts
eq("tag starts the one-second hold", Math.abs(T.itHold - 1.0) < 0.03, true);
{
  const k0 = T.debug.kids()[0];
  const hx = k0.x, hy = k0.y;
  // hold the friend right next to the it-kid the whole time
  T.debug.placePlayer(60, 120); // you far away
  T.debug.placeKid(1, 230, 300); // friend 30px off
  for (let i = 0; i < 30; i++) T.step(0.016); // 0.48s into the hold
  eq("it-kid stands still during the hold", T.debug.kids()[0].x === hx && T.debug.kids()[0].y === hy, true);
  eq("no ping-pong tag during the hold", T.it, 0);
  // let the hold run out; the it-kid should start chasing again
  const hx2 = T.debug.kids()[0].x, hy2 = T.debug.kids()[0].y;
  for (let i = 0; i < 70; i++) T.step(0.016);
  ok("hold ran down (or a fresh tag restarted it)", T.itHold < 1.0);
  const moved = Math.hypot(T.debug.kids()[0].x - hx2, T.debug.kids()[0].y - hy2);
  ok("it-kid resumes the chase after the hold", moved > 20);
}
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016); // you tag kid 0 -> it = 0
T.debug.placePlayer(350, 620); // you FAR away
T.debug.placeKid(1, 240, 340); // friend CLOSE to the it-kid
for (const j of [2, 3, 4]) T.debug.placeKid(j, 340, 120 + j * 40);
for (let i = 0; i < 70; i++) T.step(0.016); // let the hold run out first
// now put the friend right next to the it-kid and keep everyone else far
{
  const itk = T.debug.kids()[0];
  T.debug.placeKid(1, itk.x + 120, itk.y); // close, but outside tag range
  for (const j of [2, 3, 4]) T.debug.placeKid(j, 340, 120 + j * 40);
  T.debug.placePlayer(350, 620);
  const fr = T.debug.kids()[1];
  const dBefore = Math.hypot(itk.x - fr.x, itk.y - fr.y);
  for (let i = 0; i < 40; i++) T.step(0.016);
  const itk2 = T.debug.kids()[0];
  const fr2 = T.debug.kids()[1];
  const dAfter = Math.hypot(itk2.x - fr2.x, itk2.y - fr2.y);
  ok("it-kid runs toward the closest (the friend)", dAfter < dBefore - 10);
}

// ---- timer ends the game; loser = who's it ----
T.start();
for (let i = 0; i < 70; i++) T.step(1.0); // 70s > 60s round
eq("timer at 0 -> end state", T.state, "end");
ok("roundT is 0", T.roundT === 0);
T.start(); // you're it at start, nobody tags
for (let i = 0; i < 61; i++) T.step(1.0);
eq("end with you it (nobody tagged)", T.state, "end");
eq("you're it at the buzzer", T.it, "player");

// ---- replay resets ----
T.start();
eq("replay -> play", T.state, "play");
eq("replay -> you're it", T.it, "player");
eq("replay -> timer reset", T.roundT, CFG.ROUND_T);

// ---- obstacles: 3, solid, kids spawn clear ----
T.start();
const obs = T.debug.obstacles();
eq("3 obstacles", obs.length, 3);
for (const o of obs) {
  ok("obstacle in field: " + o.kind, o.x > 0 && o.x + o.w < 400 && o.y > 100 && o.y + o.h < 700);
}
let clear = true;
for (const k of T.debug.kids()) {
  for (const o of obs) {
    if (k.x > o.x - 45 && k.x < o.x + o.w + 45 && k.y > o.y - 45 && k.y < o.y + o.h + 45) clear = false;
  }
}
ok("no kid spawns inside an obstacle", clear);
// drag through the slide: push-out keeps you out
T.start();
const slide = T.debug.obstacles().find((o) => o.kind === "slide");
T.debug.placePlayer(slide.x - 90, slide.y + slide.h / 2);
T.debug.drag(slide.x + slide.w + 90, slide.y + slide.h / 2);
for (let i = 0; i < 120; i++) T.step(0.016);
const pp = T.debug.player();
const inside = pp.x > slide.x - 20 && pp.x < slide.x + slide.w + 20 &&
               pp.y > slide.y - 20 && pp.y < slide.y + slide.h + 20;
ok("slide is solid (drag-through pushes out)", !inside);
T.debug.release();

// ---- kids stay in bounds, no NaNs ----
T.start();
for (let i = 0; i < 300; i++) T.step(0.016);
let sane = true;
for (const k of [...T.debug.kids(), T.debug.player()]) {
  if (!isFinite(k.x) || !isFinite(k.y) || k.x < -50 || k.x > 450 || k.y < -50 || k.y > 750) sane = false;
}
ok("positions finite and in bounds", sane);

// ---- config sanity ----
ok("ROUND_T positive", CFG.ROUND_T > 0);
ok("TAG_R generous", CFG.TAG_R >= 50);
ok("cooldown brief", CFG.TAG_COOLDOWN > 0 && CFG.TAG_COOLDOWN <= 1.5);
ok("it-kid outruns fleeing friends", CFG.IT_KID_SPEED > CFG.KID_FLEE_SPEED);
ok("you outrun the it-kid", CFG.PLAYER_SPEED > CFG.IT_KID_SPEED);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
