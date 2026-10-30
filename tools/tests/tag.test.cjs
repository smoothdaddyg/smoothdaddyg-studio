/* Node test for Tag! You're It (window.__tagTest).
   Playground tag, sharpened: you start as IT, tag someone -> they're
   it, they chase whoever's closest, NO TAG-BACKS (a tagged player
   can't tag their tagger back until they've tagged someone else).
   5 quick levels, each faster; the clock ends a level — whoever is
   IT at 0 retries it, surviving clears it. Plus: dodgeball throws
   (IT grabs a ball, TAP throws), a star that tags three at once,
   and pop-up obstacles that block the field. Verifies: title tap
   starts (you're it), drag-to-move, kids wander/flee/stay in bounds,
   you tag a kid -> they become it, tag cooldown (no instant re-tag),
   no-tag-backs chain, it-kid tags a friend -> it bounces, it-kid
   chases the CLOSEST (no favorites), timer counts down -> level
   ends, replay resets, obstacles + pop-ups solid, ball throw tags,
   star fires three, level advance + speeds, no NaNs, config sanity.
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
    makeMusic: () => ({ tick: noop, start: noop, stop: noop, on: false, step: 0 }),
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
eq("timer starts at level 1 time", T.roundT, CFG.LEVEL_TIMES[0]);

// ---- timer counts down ----
T.step(1.0);
ok("timer ticks down", T.roundT < CFG.LEVEL_TIMES[0] && T.roundT > CFG.LEVEL_TIMES[0] - 2);

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

// ---- NO TAG-BACKS: kid 0 can't tag you back until kid 0 tags someone else ----
T.debug.placePlayer(200, 300); // still on top of kid 0
T.step(0.016);
eq("cooldown blocks instant tag-back", T.it, 0);
// wait out cooldown + hold with you still on top of kid 0: still no tag-back
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
for (const j of [1, 2, 3, 4]) T.debug.placeKid(j, j % 2 ? 80 : 320, j < 3 ? 130 : 620);
for (let i = 0; i < 120; i++) {
  T.step(0.016);
  if (i % 10 === 9) {
    // pin everyone in place (re-placed faster than anyone can close
    // the gap) so the it-kid can't reach anybody at all
    T.debug.placeKid(0, 200, 300);
    for (const j of [1, 2, 3, 4]) T.debug.placeKid(j, j % 2 ? 80 : 320, j < 3 ? 130 : 620);
  }
}
eq("no tag-back even after cooldown", T.it, 0);
ok("noBack pair recorded", T.noBack && T.noBack.it === 0 && T.noBack.not === "player");
// kid 0 tags a friend first, THEN that friend can tag you
T.debug.placeKid(1, 230, 300); // friend next to the it-kid
T.debug.placePlayer(60, 120);  // you far away
for (const j of [2, 3, 4]) T.debug.placeKid(j, 340, 520 + j * 40);
for (let i = 0; i < 250 && T.it !== 1; i++) T.step(0.016);
eq("it-kid tags the friend (not you)", T.it, 1);
T.debug.placePlayer(230, 300); // you next to the new it-kid
for (let i = 0; i < 250 && T.it !== "player"; i++) T.step(0.016);
eq("after tagging someone else, the chain can reach you", T.it, "player");

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
  // let the hold run out, then watch the it-kid actually chase: measure
  // movement in the first steps after the hold, before any tag-and-flee
  // can cancel the chase out (faster speeds made the old net check flaky)
  for (let i = 0; i < 70 && T.itHold > 0; i++) T.step(0.016);
  ok("hold ran down", T.itHold === 0);
  const hx2 = T.debug.kids()[0].x, hy2 = T.debug.kids()[0].y;
  for (let i = 0; i < 10; i++) T.step(0.016);
  const moved = Math.hypot(T.debug.kids()[0].x - hx2, T.debug.kids()[0].y - hy2);
  ok("it-kid resumes the chase after the hold", moved > 5);
}
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016); // you tag kid 0 -> it = 0
T.debug.placePlayer(350, 620); // you FAR away
T.debug.placeKid(1, 240, 340); // friend CLOSE to the it-kid
// decoys far south: at the new faster flee speed the friend ends up
// farther than the old decoy spots, and the it-kid must chase the friend
for (const j of [2, 3, 4]) T.debug.placeKid(j, 340, 520 + j * 40);
for (let i = 0; i < 70; i++) T.step(0.016); // let the hold run out first
// now put the friend right next to the it-kid and keep everyone else far
{
  const itk = T.debug.kids()[0];
  T.debug.placeKid(1, itk.x + 120, itk.y); // close, but outside tag range
  for (const j of [2, 3, 4]) T.debug.placeKid(j, 340, 520 + j * 40);
  T.debug.placePlayer(350, 620);
  const fr = T.debug.kids()[1];
  const dBefore = Math.hypot(itk.x - fr.x, itk.y - fr.y);
  // 20 steps only: long enough to see the chase close in, short enough
  // that an edge-pin tag-and-flee-back can't undo the measurement
  for (let i = 0; i < 20; i++) T.step(0.016);
  const itk2 = T.debug.kids()[0];
  const fr2 = T.debug.kids()[1];
  const dAfter = Math.hypot(itk2.x - fr2.x, itk2.y - fr2.y);
  ok("it-kid runs toward the closest (the friend)", dAfter < dBefore - 10);
}

// ---- timer ends the level; you're it at the buzzer -> retry screen ----
// small real-play steps: 1-second steps let dawdling kids teleport past
// the flee ring into tag range (a test artifact — real frames are 1/60s)
T.start();
for (let i = 0; i < 2600; i++) T.step(0.016); // 41.6s > 40s level 1
eq("timer at 0 -> end state", T.state, "end");
ok("roundT is 0", T.roundT === 0);
T.start(); // you're it at start, nobody tags
for (let i = 0; i < 2600; i++) T.step(0.016);
eq("end with you it (nobody tagged)", T.state, "end");
eq("you're it at the buzzer", T.it, "player");

// ---- replay resets ----
T.start();
eq("replay -> play", T.state, "play");
eq("replay -> you're it", T.it, "player");
eq("replay -> timer reset", T.roundT, CFG.LEVEL_TIMES[0]);
eq("replay -> level 1", T.level, 1);

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

// ---- NEW v2: dodgeball throw ----
T.start();
T.debug.placeBall(200, 300);
T.debug.placePlayer(200, 300);
T.debug.placeKid(0, 320, 300); // in throw range, out of touch range
for (const j of [1, 2, 3, 4]) T.debug.placeKid(j, 340, 120 + j * 40);
T.step(0.016);
eq("IT picks up a ball", T.carried, true);
T.tap(200, 300); // quick tap = throw
ok("tap throws the ball", T.thrown.length === 1);
for (let i = 0; i < 60 && T.it === "player"; i++) T.step(0.016);
eq("thrown ball tags the friend", T.it, 0);

// ---- NEW v2: star frenzy tags three ----
T.start();
T.debug.placeStar(200, 300);
T.debug.placePlayer(200, 300);
T.debug.placeKid(0, 260, 300);
T.debug.placeKid(1, 240, 360);
T.debug.placeKid(2, 280, 340);
for (const j of [3, 4]) T.debug.placeKid(j, 340, 120 + j * 40);
T.step(0.016);
ok("star consumed on touch", T.star === null);
ok("star fires three bullets", T.thrown.length === 3);
for (let i = 0; i < 60 && T.thrown.length > 0; i++) T.step(0.016);
ok("star bullets all resolve", T.thrown.length === 0);
ok("IT ends on a friend, not you", T.it !== "player");

// ---- NEW v2: pop-ups are solid ----
T.start();
T.debug.spawnPopup(150, 300, "bench");
T.debug.placePlayer(60, 300);
T.debug.drag(300, 300);
for (let i = 0; i < 120; i++) T.step(0.016);
const pp2 = T.debug.player();
const inPopup = pp2.x > 150 - 20 && pp2.x < 150 + 84 + 20 &&
                pp2.y > 300 - 20 && pp2.y < 300 + 64 + 20;
ok("pop-up bench is solid (drag-through pushes out)", !inPopup);
T.debug.release();

// ---- NEW v2: levels advance and speed up ----
T.start();
eq("level 1 at start", T.level, 1);
const s1 = T.debug.speeds();
T.debug.forceLevel(5);
eq("force level 5", T.level, 5);
const s5 = T.debug.speeds();
ok("level 5 kids faster than level 1", s5.itKid > s1.itKid && s5.flee > s1.flee);
ok("you still outrun the level 5 it-kid", s5.player > s5.itKid);
eq("level 5 timer is quicker", T.roundT, CFG.LEVEL_TIMES[4]);
// survive a level: tag a kid, then run out the clock without being IT
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016);
eq("you tag kid 0", T.it, 0);
for (let s = 0; s < 45; s++) {
  // pin the badge in a far cluster and yourself far away, every step,
  // so the buzzer can only find the badge on a friend
  T.debug.placeKid(0, 200, 420);
  for (const j of [1, 2, 3, 4]) T.debug.placeKid(j, 200, 450 + j * 30);
  T.debug.placePlayer(350, 640);
  T.step(1.0);
}
eq("surviving level 1 advances to level 2", T.level, 2);
eq("level 2 is playing", T.state, "play");

// ---- config sanity ----
ok("5 level times, all positive", CFG.LEVEL_TIMES.length === 5 && CFG.LEVEL_TIMES.every((t) => t > 0));
ok("TAG_R generous", CFG.TAG_R >= 50);
ok("cooldown brief", CFG.TAG_COOLDOWN > 0 && CFG.TAG_COOLDOWN <= 1.5);
ok("it-kid outruns fleeing friends", CFG.IT_KID_SPEED > CFG.KID_FLEE_SPEED);
ok("you outrun the it-kid", CFG.PLAYER_SPEED > CFG.IT_KID_SPEED);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
