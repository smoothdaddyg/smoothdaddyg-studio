/* Node test for Unicorn Joust (window.__joustTest).
   Classic Joust, literal rule: whoever is HIGHER wins.
   One interaction — mirrored FLAP buttons in the bottom
   deck (field touches ignored); unicorn auto-flies and
   wraps; gravity pulls down. Unseat riders from above,
   get knocked off from below (brief pause, respawn with
   progress intact — no game over ever), near-equal height
   bounces both apart. 5 levels, each crazier (pigs →
   diving dragon → robot chickens + golden star → space
   llamas + wind → Grand Dragon, 3 hits). Rainbow stars
   to collect, original gallop chiptune (bass 0.2, 64 steps).
   Run: node tools/tests/unicornjoust.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "unicornjoust", "game.js");

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
const mkCanvas = () => ({
  getContext: () => ctxStub, addEventListener: noop, style: {},
  width: 0, height: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }),
});
const sandbox = {
  window: { innerWidth: 400, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, SDGplays: { played: noop } },
  document: {
    getElementById: (id) => (id === "stage" ? mkCanvas() : { addEventListener: noop, style: {} }),
    createElement: () => mkCanvas(),
    addEventListener: noop, hidden: false,
    head: { appendChild: noop },
  },
  performance: { now: () => 1000 },
  requestAnimationFrame: noop,
  makeAudio: () => ({
    tone: noop, noise: noop, arp: noop, unlock: noop, state: () => "running",
    makeMusic: () => ({ tick: noop, start: noop, stop: noop, on: false, step: 0 }),
  }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox);
const T = sandbox.window.__joustTest;
if (!T) { console.error("FAIL: no __joustTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }
function stepN(n, dt) { for (let i = 0; i < n; i++) T.step(dt || 0.016); }
function burnInvuln() { stepN(110); } // 1.76s > 1.5s spawn invulnerability
function fresh() { T.start(); burnInvuln(); }

test("boots on title with 5 escalating levels", () => {
  T.toTitle();
  eq(T.state, "title", "starts on title");
  eq(T.levels.length, 5, "five levels");
  eq(T.levels[0].riders.length, 3, "L1 has 3 riders");
  ok(T.levels[0].riders.every((r) => r.kind === "pig"), "L1 is all pigs");
  ok(T.levels[1].riders.some((r) => r.kind === "dragon"), "L2 adds a diving dragon");
  ok(T.levels[1].riders.find((r) => r.kind === "dragon").dive, "L2 dragon dives");
  ok(T.levels[2].riders.some((r) => r.kind === "chicken"), "L3 adds robot chickens");
  ok(T.levels[2].golden, "L3 adds a golden star");
  ok(T.levels[3].riders.some((r) => r.kind === "llama"), "L4 adds space llamas");
  eq(T.levels[3].wind, 1, "L4 adds wind gusts");
  ok(T.levels[4].riders.some((r) => r.kind === "grand"), "L5 has the Grand Dragon");
  eq(T.levels[4].riders.find((r) => r.kind === "grand").hp, 3, "Grand Dragon takes 3 hits");
});

test("start begins play; music is its own gallop loop", () => {
  fresh();
  eq(T.state, "play", "playing after start");
  eq(T.level, 1, "level 1");
  eq(T.hearts, 5, "five hearts");
  const m = T.music;
  eq(m.steps, 64, "64 steps");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.bpm, 140, "gallop tempo 140");
  ok(m.lead.some((n) => n === 0), "lead has rests that breathe");
  ok(new Set(m.lead.filter(Boolean)).size >= 5, "lead has a real phrase, not one note");
  ok(m.harmony.some((n) => n > 0), "harmony voice present");
});

test("flap lifts the unicorn; gravity pulls it down without flapping", () => {
  fresh();
  T.debug.placePlayer(200, 300);
  const y0 = T.player.y;
  T.debug.setFlap(true);
  T.step(0.016);
  T.debug.setFlap(false);
  ok(T.player.vy < 0, "flap gives upward velocity");
  ok(T.player.y < y0, "unicorn rises on flap");
  // No flap: it falls.
  T.debug.placePlayer(200, 200);
  const y1 = T.player.y;
  stepN(10);
  ok(T.player.y > y1, "gravity pulls the unicorn down");
  ok(T.player.vy > 0, "falling velocity is downward");
});

test("unicorn wraps around the screen", () => {
  fresh();
  T.debug.placePlayer(445, 200);
  T.step(0.016);
  ok(T.player.x < 0, "wrapped to the left edge (got " + T.player.x + ")");
});

test("higher rider wins: unseat from above, star earned", () => {
  fresh();
  const stars0 = T.stars;
  // Pick a joust spot clear of rainbow stars and other riders, so
  // the star delta below can only come from the unseat itself
  // (star positions are random per run — the old fixed spot
  // sometimes sat on a star and the count came out 2 too high).
  const cands = [[100, 150], [200, 150], [300, 150], [100, 350], [200, 350], [300, 350], [150, 250], [250, 250]];
  let spot = cands[0];
  for (const [x, y] of cands) {
    const starNear = T.starPickups.some((s) => !s.taken && Math.hypot(s.x - x, s.y - y) < 90);
    const riderNear = T.riders.some((r, i) => i !== 0 && r.alive && Math.hypot(r.x - x, r.y - y) < 100);
    if (!starNear && !riderNear) { spot = [x, y]; break; }
  }
  T.debug.placeRider(0, spot[0], spot[1] + 30);
  T.debug.placePlayer(spot[0], spot[1]);
  T.step(0.016);
  ok(!T.riders[0].alive, "rider unseated from above");
  eq(T.stars, stars0 + 1, "unseating earns a star");
  eq(T.state, "play", "game keeps going");
});

test("lower rider loses: knocked off, heart lost, respawn keeps progress", () => {
  fresh();
  // Unseat one rider first, so progress exists to keep.
  T.debug.placeRider(0, 200, 250);
  T.debug.placePlayer(200, 220);
  T.step(0.016);
  ok(!T.riders[0].alive, "setup: rider 0 unseated");
  const hearts0 = T.hearts;
  T.debug.placeRider(1, 200, 250);
  T.debug.placePlayer(200, 250 + 30);
  T.step(0.016);
  eq(T.state, "dead", "knocked off from below");
  eq(T.hearts, hearts0 - 1, "one heart lost");
  stepN(90); // 1.44s > 1.2s respawn
  eq(T.state, "play", "respawned");
  ok(!T.riders[0].alive, "unseated rider stays unseated — progress intact");
  eq(T.level, 1, "same level after respawn");
});

test("near-equal height bounces both apart, no harm", () => {
  fresh();
  const hearts0 = T.hearts;
  T.debug.placeRider(0, 200, 250);
  T.debug.placePlayer(200, 250);
  T.step(0.016);
  ok(T.riders[0].alive, "rider survives a level hit");
  eq(T.hearts, hearts0, "no heart lost on a level hit");
  eq(T.state, "play", "still playing");
  ok(T.player.vy < 0, "player bounces upward");
});

test("flying through a rainbow star collects it", () => {
  // Fresh level, no burn: during a burn the falling unicorn can
  // already collect the star this test would then "find" taken.
  T.debug.forceLevel(1);
  T.debug.clearInvuln();
  // Pick any untaken rainbow star, then park every rider in the
  // far corner (a rider under the spot could also be unseated in
  // the same step and add a star of its own). Count by newly-taken
  // stars: two adjacent stars can both be within pickup range of
  // one spot, so the delta is the count of stars taken, not a
  // fixed +1.
  const s = T.starPickups.find((p) => !p.gold && !p.taken);
  ok(s, "an untaken rainbow star exists");
  const corner = s.x < 200 ? [360, 480] : [40, 480];
  T.riders.forEach((r, i) => T.debug.placeRider(i, corner[0], corner[1]));
  const stars0 = T.stars;
  const takenBefore = T.starPickups.filter((p) => p.taken).length;
  T.debug.placePlayer(s.x, s.y);
  T.step(0.016);
  ok(s.taken, "star collected");
  const newly = T.starPickups.filter((p) => p.taken).length - takenBefore;
  ok(newly >= 1, "at least the target star was collected");
  eq(T.stars, stars0 + newly, "each collected star adds exactly one");
});

test("unseating every rider clears the level", () => {
  fresh();
  const alive = T.riders.map((r, i) => i);
  for (const i of alive) {
    T.debug.placeRider(i, 200, 250);
    T.debug.placePlayer(200, 220);
    T.step(0.016);
    ok(!T.riders[i].alive, "rider " + i + " unseated");
    T.debug.placePlayer(80, 400); // clear of the rest
  }
  eq(T.state, "levelup", "level cleared");
  stepN(150); // 2.4s > 2.2s celebration
  eq(T.state, "play", "next level starts");
  eq(T.level, 2, "now on level 2");
});

test("no game over: last heart refills, progress kept", () => {
  fresh();
  T.debug.setHearts(1);
  T.debug.placeRider(0, 200, 250);
  T.debug.placePlayer(200, 280);
  T.step(0.016);
  eq(T.state, "dead", "knocked off on last heart");
  stepN(90);
  eq(T.state, "play", "still playing after respawn — never a game over");
  eq(T.hearts, 5, "hearts refilled");
  eq(T.level, 1, "level kept");
});

test("field tap does nothing; deck FLAP buttons are mirrored", () => {
  fresh();
  const y0 = T.player.y;
  T.debug.fieldTap(200, 200);
  ok(!T.debug.flapHeld(), "field tap does not engage FLAP");
  eq(T.state, "play", "still playing after field tap");
  ok(T.player.y >= y0, "field tap did not lift the unicorn");
  const c = T.cfg;
  T.debug.deckTap(c.flapL.x, c.flapL.y);
  ok(T.debug.flapHeld(), "left FLAP button works");
  T.debug.deckRelease();
  ok(!T.debug.flapHeld(), "release clears FLAP");
  T.debug.deckTap(c.flapR.x, c.flapR.y);
  ok(T.debug.flapHeld(), "right FLAP button works too — mirrored");
  T.debug.deckRelease();
});

test("title tap on FLAP starts the game and flaps at once", () => {
  T.toTitle();
  const c = T.cfg;
  T.debug.deckTap(c.flapL.x, c.flapL.y);
  eq(T.state, "play", "title tap starts the game");
  ok(T.debug.flapHeld(), "same finger is already flapping");
  T.debug.deckRelease();
});

test("Grand Dragon takes three above-hits", () => {
  T.debug.forceLevel(5);
  T.debug.clearInvuln(); // diving dragons would knock the idle player off during a burn
  const gi = T.riders.findIndex((r) => r.kind === "grand");
  ok(gi >= 0, "Grand Dragon present on L5");
  for (let hit = 1; hit <= 3; hit++) {
    const r = T.riders[gi];
    T.debug.placeRider(gi, 200, 250);
    T.debug.placePlayer(200, 220);
    T.step(0.016);
    if (hit < 3) {
      ok(r.alive, "Grand Dragon survives hit " + hit);
      eq(r.hp, 3 - hit, "hp drops to " + (3 - hit));
    } else {
      ok(!r.alive, "Grand Dragon unseated on the third hit");
    }
  }
});

test("wind gusts exist on L4+ and push the unicorn", () => {
  T.debug.forceLevel(4);
  T.debug.clearInvuln(); // diving dragons would knock the idle player off during a burn
  eq(T.levels[3].wind, 1, "L4 has wind");
  T.debug.setWind(-260);
  eq(T.windAmt, -260, "wind can push up");
  T.debug.placePlayer(200, 300);
  T.step(0.016);
  const vyWind = T.player.vy;
  T.debug.setWind(0);
  T.debug.placePlayer(200, 300);
  T.step(0.016);
  ok(vyWind < T.player.vy, "upward wind lightens the fall");
});

test("clearing level 5 wins the game", () => {
  T.debug.forceLevel(5);
  T.debug.clearInvuln(); // diving dragons would knock the idle player off during a burn
  const alive = T.riders.map((r, i) => i);
  for (const i of alive) {
    const r = T.riders[i];
    const hits = r.kind === "grand" ? 3 : 1;
    for (let h = 0; h < hits; h++) {
      T.debug.placeRider(i, 200, 250);
      T.debug.placePlayer(200, 220);
      T.step(0.016);
    }
    ok(!T.riders[i].alive, "rider " + i + " unseated");
    T.debug.placePlayer(80, 400);
  }
  eq(T.state, "levelup", "final level cleared");
  stepN(150);
  eq(T.state, "win", "big finale after level 5");
});

console.log(pass + "/" + (pass + fail) + " unicorn joust tests pass");
process.exit(fail ? 1 : 0);
