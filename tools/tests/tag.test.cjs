/* Node test for Tag! You're It (window.__tagTest).
   Verifies: title tap starts, drag-to-move runs the player toward the
   finger at player speed, kids wander slowly and stay in bounds,
   proximity tag works (burst + giggle + kid sits out), wrong taps do
   nothing bad, 5 tags -> win/celebration/fanfare, replay resets,
   no NaNs anywhere, and config sanity.
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

const W = 400, H = 700;
const C = T.cfg;

// ---- config sanity ----
eq("5 kids to tag", C.KID_COUNT, 5);
eq("player speed 260", C.PLAYER_SPEED, 260);
eq("tag radius generous (70)", C.TAG_R, 70);
eq("5 star slots", C.STAR_SLOTS, 5);
ok("kids dawdle (max 90 < player 260)", C.KID_SPEED_MAX < C.PLAYER_SPEED);
ok("kid min speed sane", C.KID_SPEED_MIN >= 40 && C.KID_SPEED_MIN < C.KID_SPEED_MAX);

// ---- title -> play ----
eq("starts on title", T.state, "title");
T.tap(200, 350); // tap anywhere starts
eq("tap starts the game", T.state, "play");
eq("no tags yet", T.tagged, 0);
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
  const d = Math.hypot(k.x - before[i].x, k.y - before[i].y);
  if (d < 5 && !k.tagged) moved = false; // untagged kids should drift
});
ok("kids stay in bounds after 10s", inBounds);
ok("kids actually wander", moved);
ok("kid positions are finite", finite);
ok("player position is finite",
   Number.isFinite(T.debug.player().x) && Number.isFinite(T.debug.player().y));

// ---- proximity tag: touch a kid -> tagged, sits out ----
T.start();
audioCalls.length = 0;
T.debug.placeKid(0, 200, 300);
T.debug.placePlayer(200, 300); // right on top of kid 0
T.step(0.016);
eq("touch -> 1 tag", T.tagged, 1);
ok("kid 0 sits out", T.debug.kids()[0].tagged === true);
ok("tag plays the giggle arpeggio", audioCalls.some((c) => c[0] === "arp"));
const kx = T.debug.kids()[0].x, ky = T.debug.kids()[0].y;
for (let i = 0; i < 120; i++) T.step(0.016);
ok("tagged kid stays seated", Math.abs(T.debug.kids()[0].x - kx) < 1 &&
   Math.abs(T.debug.kids()[0].y - ky) < 1);
eq("no double-tag", T.tagged, 1);

// ---- wrong taps do nothing bad ----
T.start();
const t0 = T.tagged;
T.tap(20, 680); // tap far from everyone
for (let i = 0; i < 30; i++) T.step(0.016);
eq("far tap tags nothing", T.tagged, t0);
eq("game still in play", T.state, "play");

// ---- 5 tags -> WIN + celebration + fanfare ----
T.start();
audioCalls.length = 0;
for (let i = 0; i < 5; i++) T.debug.forceTag(i);
eq("5 tags -> win state", T.state, "win");
eq("all 5 tagged", T.tagged, 5);
ok("win plays the fanfare", audioCalls.some((c) => c[0] === "arp"));
for (let i = 0; i < 120; i++) T.step(0.016); // celebration runs
eq("win state holds", T.state, "win");
ok("positions stay finite in win",
   Number.isFinite(T.debug.player().x) &&
   T.debug.kids().every((k) => Number.isFinite(k.x) && Number.isFinite(k.y)));

// ---- replay arrow resets everything ----
T.tap(W / 2, H * 0.62); // center of the replay button
eq("replay -> back to play", T.state, "play");
eq("tags reset", T.tagged, 0);
ok("kids are back up", T.debug.kids().every((k) => k.tagged === false));

// ---- long soak: no NaNs, no runaway state ----
T.start();
T.debug.drag(350, 100);
for (let i = 0; i < 1200; i++) T.step(0.016); // 20s
const pl = T.debug.player();
ok("soak: player finite", Number.isFinite(pl.x) && Number.isFinite(pl.y));
ok("soak: player in bounds", pl.x >= 0 && pl.x <= W && pl.y >= 0 && pl.y <= H);
ok("soak: kids finite",
   T.debug.kids().every((k) => Number.isFinite(k.x) && Number.isFinite(k.y)));
ok("soak: tagged count sane", T.tagged >= 0 && T.tagged <= 5);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
