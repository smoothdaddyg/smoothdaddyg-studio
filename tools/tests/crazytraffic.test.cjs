/* Node test for Crazy Traffic (window.__trafficTest).
   Odyssey-style traffic dodger: one-finger floating stick (drag
   sideways = steer, up = faster, down = slower), traffic falls
   toward you, ricochet cars bounce off the road edges, funny
   obstacles, blaster pickups, 5 levels with a new car each,
   distance-to-flag progression, crashes spin you out but never
   cost progress. Run: node tools/tests/crazytraffic.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "crazytraffic", "game.js");

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
const mkCanvas = () => ({ getContext: () => ctxStub, addEventListener: noop, style: {}, width: 0, height: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }) });

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

const T = sandbox.window.__trafficTest;
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}
function steps(n, dt) { for (let i = 0; i < n; i++) T.step(dt || 0.016); }

// ---- config sanity ----
eq("5 levels", T.levels.length, 5);
ok("miles increase per level", T.levels.every((l, i) => i === 0 || l.miles > T.levels[i - 1].miles));
ok("traffic cap grows", T.levels[4].cars > T.levels[0].cars);

// ---- short levels: every level finishes inside 30s at cruise ----
{
  const rate = T.cfg.MILES_RATE * (0.35 + T.cfg.CRUISE);
  ok("every level runs max ~30s at cruise", T.levels.every((l) => l.miles / rate <= 30));
  ok("events come often (max gap 3.5s)", T.levels.every((l) => l.event <= 3.5));
  ok("later levels throw surprises faster", T.levels[4].event < T.levels[0].event);
}

// ---- title -> start ----
eq("starts on title", T.state, "title");
T.start();
eq("start -> play", T.state, "play");
eq("level 1", T.level, 1);
eq("dist 0", T.dist, 0);
{
  const p = T.debug.player(), r = T.debug.road();
  ok("player on the road", p.x > r.l && p.x < r.r);
  ok("player near the bottom of the FIELD", p.y > r.ph - 200 && p.y < r.ph);
  ok("the deck takes the bottom strip", r.stripH >= 120 && r.ph < r.h);
  ok("player is NOT in the deck", p.y + T.cfg.PLAYER_H / 2 <= r.ph + 2);
}

// ---- distance accumulates, faster = more miles ----
T.start();
T.debug.setStick(0, -62); // hold full speed
steps(50); // ramp up
const d1 = T.dist;
steps(60);
const fastGain = T.dist - d1;
T.debug.setStick(0, 0); // neutral stick = cruise
steps(50); // settle to cruise
const d2 = T.dist;
steps(60);
ok("distance accumulates", fastGain > 0.01);
ok("full speed earns miles faster", fastGain > (T.dist - d2) * 1.25);
T.debug.release();

// ---- the stick: steer ----
T.start();
{
  const r = T.debug.road();
  const x0 = T.debug.player().x;
  T.debug.setStick(62, 0); // full right
  steps(30);
  ok("stick right steers right", T.debug.player().x > x0 + 40);
  T.debug.setStick(-62, 0); // full left
  steps(60);
  ok("stick left steers left", T.debug.player().x < r.l + (r.r - r.l) / 2);
  // clamp: hold hard left forever, never leave the road
  steps(120);
  ok("car stays on the road (left)", T.debug.player().x >= r.l + T.cfg.PLAYER_W / 2);
  T.debug.setStick(62, 0);
  steps(240);
  ok("car stays on the road (right)", T.debug.player().x <= r.r - T.cfg.PLAYER_W / 2);
  T.debug.release();
}

// ---- the stick: speed ----
T.start();
T.debug.setStick(0, -62); // push UP = faster
steps(50);
ok("stick up speeds up past cruise", T.speed01 > 0.8);
T.debug.setStick(0, 62); // pull DOWN = slower
steps(60);
ok("stick down slows below cruise", T.speed01 < 0.3);
T.debug.release();
steps(90);
ok("release settles back toward cruise", Math.abs(T.speed01 - T.cfg.CRUISE) < 0.15);

// ---- traffic spawns, falls, stays on the road ----
T.start();
steps(400); // ~6.4s of traffic
ok("traffic spawns", T.debug.cars().length > 0);
{
  const r = T.debug.road();
  let allIn = true, anyFell = false;
  for (const c of T.debug.cars()) {
    if (c.knocked > 0) continue; // knocked cars fly off the road ON PURPOSE
    if (c.x < r.l + 20 || c.x > r.r - 20) allIn = false;
    if (c.y > -60) anyFell = true;
  }
  ok("cars stay on the road", allIn);
  ok("cars fall toward you", anyFell);
  ok("traffic cap respected", T.debug.cars().length <= T.levels[0].cars);
}

// ---- ricochet: a bouncing car flips vx at the edge ----
T.start();
{
  const r = T.debug.road();
  const c = T.debug.placeCar(r.l + 40, 200, { vx: -120, rel: 0.5 });
  steps(40);
  ok("ricochet car bounced off the left edge", c.vx > 0);
  ok("ricochet car still on the road", c.x >= r.l + T.cfg.CAR_W / 2 - 1);
}

// ---- crash: spin out, ghost, progress kept, other car knocked off ----
T.start();
T.debug.setDist(0.5);
{
  const p = T.debug.player();
  const c = T.debug.placeCar(p.x, p.y, { rel: 0.5 });
  T.step(0.016);
  ok("crash spins you out", p.spinT > 0);
  ok("crash grants ghost time", p.ghost > 1);
  ok("crash keeps your miles (not reset)", Math.abs(T.dist - 0.5) < 0.01);
  ok("the car you hit gets knocked away", c.knocked > 0);
  // while ghosted, driving through another car does nothing
  const p2 = T.debug.player();
  T.debug.placeCar(p2.x, p2.y, { rel: 0.5 });
  const spinBefore = p2.spinT;
  steps(3);
  ok("no double-crash while ghosted", T.debug.player().spinT <= spinBefore);
}

// ---- oil slick: spin, no crash needed ----
T.start();
{
  const p = T.debug.player();
  T.debug.placeThing("oil", p.x, p.y, { w: 72, h: 34 });
  T.step(0.016);
  ok("oil slick spins you", p.spinT > 0);
  eq("oil slick is consumed", T.debug.things().length, 0);
}

// ---- banana peel: same ----
T.start();
{
  const p = T.debug.player();
  T.debug.placeThing("banana", p.x, p.y, { w: 36, h: 22 });
  T.step(0.016);
  ok("banana peel spins you", p.spinT > 0);
}

// ---- unicorn: leaps away when you reach it ----
T.start();
{
  const p = T.debug.player();
  const u = T.debug.placeThing("unicorn", p.x, p.y, { w: 68, h: 46, vx: 58 });
  T.step(0.016);
  ok("unicorn leaps away", u.leapt > 0);
}

// ---- chicken: leaps away too ----
T.start();
{
  const p = T.debug.player();
  const ch = T.debug.placeThing("chicken", p.x, p.y, { w: 36, h: 32, vx: 92 });
  T.step(0.016);
  ok("chicken leaps away", ch.leapt > 0);
}

// ---- beach ball: bounces off you with a boing, no crash ----
T.start();
{
  const p = T.debug.player();
  const b = T.debug.placeThing("ball", p.x + 10, p.y, { w: 46, h: 46, vx: -60 });
  T.step(0.016);
  ok("beach ball bounces away", b.vx > 0);
  eq("beach ball doesn't crash you", p.spinT, 0);
}

// ---- plane: it's a crash, and the plane lumbers on ----
T.start();
{
  const p = T.debug.player();
  const pl = T.debug.placeThing("plane", p.x, p.y, { w: 224, h: 168 });
  const yBefore = pl.y;
  T.step(0.016);
  ok("hitting the plane spins you out", p.spinT > 0);
  ok("the plane lumbers past", pl.y > yBefore);
}

// ---- blaster pickup: zap the car ahead ----
T.start();
{
  const p = T.debug.player();
  T.debug.placeThing("blaster", p.x, p.y, { w: 40, h: 30 });
  T.step(0.016);
  ok("star pickup arms the blaster", p.blasterT > 0);
  T.debug.placeCar(p.x, p.y - 200, { rel: 0.5 });
  eq("car ahead placed", T.debug.cars().length, 1);
  steps(30);
  eq("blaster zaps the car ahead", T.debug.cars().length, 0);
}

// ---- speed range: slow is a crawl, fast is REALLY fast ----
T.start();
T.debug.setSpeed(0);
ok("slow means slow (<110 px/s)", T.debug.worldSpeed() < 110);
T.debug.setSpeed(1);
ok("fast means fast (>650 px/s)", T.debug.worldSpeed() > 650);

// ---- background music: on at start, steps advance, notes sound ----
T.start();
eq("music turns on with the game", T.musicOn, true);
{
  const s0 = T.musicStep, a0 = audioCalls.length;
  steps(400); // ~6.4s of play = ~59 sequencer steps at 140 BPM 16ths
  ok("music steps advance", T.musicStep > s0 + 40);
  ok("music produces notes", audioCalls.length > a0 + 12);
  const calls = audioCalls.slice(a0);
  ok("chiptune: square-wave lead", calls.some((c) => c[0] === "tone" && c[3] && c[3].type === "square" && c[3].vol === 0.055));
  ok("chiptune: triangle bass", calls.some((c) => c[0] === "tone" && c[3] && c[3].type === "triangle" && c[3].vol === 0.13));
}

// ---- ramp: hit it and FLY — no crashes while airborne ----
T.start();
{
  const p = T.debug.player();
  T.debug.placeThing("ramp", p.x, p.y, { w: 84, h: 40 });
  T.step(0.016);
  ok("ramp launches you", p.jumpT > 0.5);
  T.debug.placeCar(p.x, p.y, { rel: 0.5 });
  steps(10);
  eq("no crash while airborne", p.spinT, 0);
  steps(60); // ~1s: landed by now
  ok("you land after the jump", p.jumpT <= 0);
}

// ---- cow: a crash, a moo, and the cow stays put ----
T.start();
{
  const p = T.debug.player();
  const cow = T.debug.placeThing("cow", p.x, p.y, { w: 78, h: 54 });
  const cowY = cow.y;
  T.step(0.016);
  ok("hitting the cow spins you out", p.spinT > 0);
  ok("the cow is startled", cow.startled > 0);
  ok("the cow does not fly away", Math.abs(cow.y - cowY) < 30);
}

// ---- crab: scuttles off like the chicken ----
T.start();
{
  const p = T.debug.player();
  const crab = T.debug.placeThing("crab", p.x, p.y, { w: 44, h: 28, vx: 150 });
  T.step(0.016);
  ok("crab scuttles away when reached", crab.leapt > 0);
  eq("crab doesn't spin you", p.spinT, 0);
}

// ---- seagull: flies right over you, totally harmless ----
T.start();
{
  const p = T.debug.player();
  T.debug.placeThing("gull", p.x, p.y, { w: 52, h: 24, vx: 190 });
  steps(5);
  eq("gull never crashes you", p.spinT, 0);
}

// ---- tumbleweed: bounces off like the beach ball ----
T.start();
{
  const p = T.debug.player();
  const tw = T.debug.placeThing("tumbleweed", p.x + 10, p.y, { w: 46, h: 46, vx: -60 });
  T.step(0.016);
  ok("tumbleweed bounces away", tw.vx > 0);
  eq("tumbleweed doesn't crash you", p.spinT, 0);
}

// ---- sunbather: spin out (they sat up in the road!) ----
T.start();
{
  const p = T.debug.player();
  const sb = T.debug.placeThing("sunbather", p.x, p.y, { w: 66, h: 66 });
  T.step(0.016);
  ok("sunbather spins you", p.spinT > 0);
  ok("sunbather sits up startled", sb.startled > 0);
}

// ---- skateboarder: a crash, and he wipes out sideways ----
T.start();
{
  const p = T.debug.player();
  const sk = T.debug.placeThing("skater", p.x, p.y, { w: 32, h: 54 });
  T.step(0.016);
  ok("hitting the skater spins you out", p.spinT > 0);
  ok("the skater wipes out", sk.knocked > 0);
}

// ---- level flow: finish L1 -> celebration -> tap -> L2, new car ----
T.start();
T.debug.setDist(1.49);
T.debug.setSpeed(1);
steps(30);
eq("finishing the miles ends the level", T.state, "levelup");
T.debug.tap(); // too soon — celebration must not skip instantly
eq("early tap doesn't skip the celebration", T.state, "levelup");
steps(120); // 1.9s of celebration
T.debug.tap();
eq("tap after the celebration starts level 2", T.state, "play");
eq("now level 2", T.level, 2);
eq("miles reset for the new level", T.dist, 0);

// ---- win: finish L5 -> win screen -> tap -> fresh game ----
T.debug.setLevel(5);
T.debug.setDist(3.49);
T.debug.setSpeed(1);
steps(30);
eq("finishing level 5 wins the game", T.state, "win");
steps(120);
T.debug.tap();
eq("tap on win restarts", T.state, "play");
eq("restart is level 1", T.level, 1);

// ---- long sim: mixed inputs, nothing breaks, no NaNs ----
T.start();
{
  let nan = false;
  for (let i = 0; i < 3000; i++) {
    if (i % 90 === 0) T.debug.setStick((Math.random() - 0.5) * 124, (Math.random() - 0.5) * 124);
    if (i % 400 === 399) T.debug.release();
    T.step(0.016);
    const p = T.debug.player();
    if (Number.isNaN(p.x) || Number.isNaN(p.y) || Number.isNaN(T.dist) || Number.isNaN(T.speed01)) nan = true;
    for (const c of T.debug.cars()) if (Number.isNaN(c.x) || Number.isNaN(c.y)) nan = true;
    for (const t of T.debug.things()) if (Number.isNaN(t.x) || Number.isNaN(t.y)) nan = true;
    if (T.state === "levelup") { steps(120); T.debug.tap(); }
    if (T.state === "win") break;
  }
  ok("3000-step sim: no NaNs", !nan);
  ok("sim made progress", T.level > 1 || T.dist > 0.2 || T.state === "win");
}

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
