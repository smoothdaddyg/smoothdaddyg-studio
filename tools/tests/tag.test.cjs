/* Node test for Tag! You're It (window.__tagTest).
   Real playground tag rules: the star badge marks IT, and IT passes to
   whoever gets tagged. Verifies: title tap starts (you're it), drag-to-move,
   kids wander/flee/stay in bounds, you tag a kid -> they become it (+star),
   no-tag-back grace, the it-kid chases everybody (prefers you), it-kid tags
   you -> you're it again, it-kid tags a friend -> it bounces (no star),
   5 stars -> win/celebration/fanfare, replay resets, no NaNs, config sanity.
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
function dist2(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

const W = 400, H = 700;
const C = T.cfg;

// ---- config sanity ----
eq("5 kids to tag", C.KID_COUNT, 5);
eq("player speed 260", C.PLAYER_SPEED, 260);
eq("tag radius generous (70)", C.TAG_R, 70);
eq("5 star slots", C.STAR_SLOTS, 5);
ok("kids dawdle (max 90 < player 260)", C.KID_SPEED_MAX < C.PLAYER_SPEED);
ok("kid min speed sane", C.KID_SPEED_MIN >= 40 && C.KID_SPEED_MIN < C.KID_SPEED_MAX);
ok("it-kid outruns fleeing friends", C.IT_KID_SPEED > C.KID_FLEE_SPEED);
ok("it-kid slower than you (you can dodge)", C.IT_KID_SPEED < C.PLAYER_SPEED);
ok("no-tag-back grace is 2s", C.TAGBACK_GRACE === 2.0);

// ---- title -> play: YOU start as IT ----
eq("starts on title", T.state, "title");
T.tap(200, 350); // tap anywhere starts
eq("tap starts the game", T.state, "play");
eq("you start as IT", T.it, "player");
eq("no stars yet", T.starred, 0);
eq("5 kids spawned", T.debug.kids().length, 5);
ok("player exists", !!T.debug.player());

// ---- drag-to-move: player runs toward the finger ----
T.debug.placePlayer(200, 350);
T.debug.drag(200, 100); // drag straight up
const p0 = { x: T.debug.player().x, y: T.debug.player().y };
T.step(0.5);
const p1 = T.debug.player();
ok("drag moves player up", p1.y < p0.y - 50);
ok("player moves at ~260px/s", Math.abs((p0.y - p1.y) - 260 * 0.5) < 12);
ok("player doesn't move sideways", Math.abs(p1.x - p0.x) < 1);
T.debug.release();
eq("release clears the target", T.debug.target(), null);
const p2 = { x: T.debug.player().x, y: T.debug.player().y };
T.step(0.5);
ok("released player stays put", Math.abs(T.debug.player().x - p2.x) < 1 &&
   Math.abs(T.debug.player().y - p2.y) < 1);

// ---- kids wander slowly and stay in bounds ----
T.start();
const before = T.debug.kids().map((k) => ({ x: k.x, y: k.y }));
for (let i = 0; i < 600; i++) T.step(0.016); // ~10s of dawdling
let inBounds = true, moved = true, finite = true;
T.debug.kids().forEach((k, i) => {
  if (k.x < 0 || k.x > W || k.y < 0 || k.y > H) inBounds = false;
  if (!Number.isFinite(k.x) || !Number.isFinite(k.y)) finite = false;
  const d = dist2(k.x, k.y, before[i].x, before[i].y);
  if (d < 5 && !k.starred) moved = false; // unstarred kids should drift
});
ok("kids stay in bounds after 10s", inBounds);
ok("kids actually wander", moved);
ok("kid positions are finite", finite);
ok("player position is finite",
   Number.isFinite(T.debug.player().x) && Number.isFinite(T.debug.player().y));

// ---- you tag a kid -> THEY become it (+ your star) ----
T.start();
audioCalls.length = 0;
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300); // right on top of kid 0
T.step(0.016);
eq("touch -> 1 star", T.starred, 1);
ok("kid 0 earned your star", T.debug.kids()[0].starred === true);
eq("IT passes to kid 0", T.it, 0);
ok("tag plays the giggle arpeggio", audioCalls.some((c) => c[0] === "arp"));

// ---- no-tag-backs: the new IT can't instantly tag you back ----
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016); // you tag kid 0 -> they're it, on top of you
eq("it is kid 0", T.it, 0);
// park the other kids far away so the scenario stays deterministic
for (let i = 0; i < 60; i++) { // ~1s — inside the 2s grace
  T.step(0.016);
  T.debug.placeKid(1, 60, 620); T.debug.placeKid(2, 340, 620);
  T.debug.placeKid(3, 60, 120); T.debug.placeKid(4, 340, 120);
}
eq("no instant tag-back inside the grace", T.it, 0);
eq("still just your 1 star", T.starred, 1);
audioCalls.length = 0;
for (let i = 0; i < 90; i++) { // ~1.4s more — grace (2s) expires
  T.step(0.016);
  T.debug.placeKid(1, 60, 620); T.debug.placeKid(2, 340, 620);
  T.debug.placeKid(3, 60, 120); T.debug.placeKid(4, 340, 120);
}
eq("after the grace, the it-kid tags you back", T.it, "player");
ok("you're-it whistle plays", audioCalls.some((c) => c[0] === "tone"));

// ---- the IT kid chases everybody (prefers you) ----
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016); // you tag kid 0 -> it = 0
T.debug.placePlayer(300, 500); // you move off (weighted nearer than the corners)
const k0b = { x: T.debug.kids()[0].x, y: T.debug.kids()[0].y };
const dBefore = dist2(k0b.x, k0b.y, 300, 500);
for (let i = 0; i < 30; i++) { // 0.5s of chasing (grace blocks the tag, not the chase)
  T.step(0.016);
  T.debug.placeKid(1, 60, 620); T.debug.placeKid(2, 340, 620);
  T.debug.placeKid(3, 60, 120); T.debug.placeKid(4, 340, 120);
}
const k0a = T.debug.kids()[0];
const dAfter = dist2(k0a.x, k0a.y, 300, 500);
ok("it-kid runs toward you", dAfter < dBefore - 20);

// ---- the IT kid tags a friend -> IT bounces on (no star for that) ----
T.start();
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300);
T.step(0.016); // you tag kid 0 -> it = 0, your 1st star
T.debug.placeKid(1, 230, 300); // friend right next to the it-kid
T.debug.placePlayer(60, 620);  // you far away (beyond the chase bias)
T.debug.placeKid(2, 340, 620); T.debug.placeKid(3, 60, 120); T.debug.placeKid(4, 340, 120);
T.step(0.016);
eq("it-kid tags the friend", T.it, 1);
eq("kid tags earn no star", T.starred, 1);

// ---- friends run from IT ----
T.start(); // you are it
T.debug.placePlayer(200, 300);
T.debug.placeKid(0, 200, 380); // 80px below you — inside flee radius
const f0 = dist2(200, 380, 200, 300);
for (let i = 0; i < 30; i++) T.step(0.016); // 0.5s
const k0f = T.debug.kids()[0];
const f1 = dist2(k0f.x, k0f.y, T.debug.player().x, T.debug.player().y);
ok("friend flees from you", f1 > f0 + 20);

// ---- wrong taps do nothing bad ----
T.start();
const t0 = T.starred;
T.tap(20, 680); // tap far from everyone
for (let i = 0; i < 30; i++) T.step(0.016);
eq("far tap stars nothing", T.starred, t0);
eq("game still in play", T.state, "play");

// ---- 5 stars -> WIN + celebration + fanfare ----
T.start();
audioCalls.length = 0;
for (let i = 0; i < 5; i++) T.debug.forceTag(i);
eq("5 stars -> win state", T.state, "win");
eq("all 5 starred", T.starred, 5);
ok("win plays the fanfare", audioCalls.some((c) => c[0] === "arp"));
for (let i = 0; i < 120; i++) T.step(0.016); // celebration runs
eq("win state holds", T.state, "win");
ok("positions stay finite in win",
   Number.isFinite(T.debug.player().x) &&
   T.debug.kids().every((k) => Number.isFinite(k.x) && Number.isFinite(k.y)));

// ---- replay arrow resets everything ----
T.tap(W / 2, H * 0.62); // center of the replay button
eq("replay -> back to play", T.state, "play");
eq("stars reset", T.starred, 0);
eq("you're it again after replay", T.it, "player");
ok("no stars after reset", T.debug.kids().every((k) => k.starred === false));

// ---- long soak: no NaNs, no runaway state ----
T.start();
T.debug.drag(350, 100);
for (let i = 0; i < 1200; i++) T.step(0.016); // 20s of real tag
const pl = T.debug.player();
ok("soak: player finite", Number.isFinite(pl.x) && Number.isFinite(pl.y));
ok("soak: player in bounds", pl.x >= 0 && pl.x <= W && pl.y >= 0 && pl.y <= H);
ok("soak: kids finite",
   T.debug.kids().every((k) => Number.isFinite(k.x) && Number.isFinite(k.y)));
ok("soak: it is valid", T.it === "player" ||
   (Number.isInteger(T.it) && T.it >= 0 && T.it < 5));
ok("soak: starred count sane", T.starred >= 0 && T.starred <= 5);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
