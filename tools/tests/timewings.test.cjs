/* Node test for Time Wings redesign (window.__timewings).
   Verifies: plane pinned to screen center, world scrolls under it,
   drag rotates the plane, gentler difficulty, eras intact.
   Run: node tools/tests/timewings.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "timewings", "game.js");

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
  window: { innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1, addEventListener: noop },
  document: {
    getElementById: (id) => (id === "stage" ? mkCanvas() : { addEventListener: noop, style: {} }),
    createElement: () => mkCanvas(),
    addEventListener: noop,
    head: { appendChild: noop },
  },
  performance: { now: () => 1000 },
  requestAnimationFrame: noop,
  makeAudio: () => ({ tone: noop, noise: noop, arp: noop, toggleMute: () => false, unlock: noop, state: () => "running" }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });

const T = sandbox.window.__timewings;
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}

T._set({ W: 1024, H: 768, level: 1 });
T._state("play");

// 1. math helpers still sane
eq("angDiff wraps", Math.round(T.angDiff(0, Math.PI * 1.5) * 1000), Math.round(-Math.PI / 2 * 1000));
eq("turnToward steps", T.turnToward(0, 1, 0.3), 0.3);
eq("wrap negative", T.wrap(-3, 10), 7);

// 2. eras intact
const e1 = T.eraInfo(1), e4 = T.eraInfo(4);
eq("era 1 year", e1.year, 1910);
eq("era 4 year", e4.year, 1983);
eq("four levels", e1.levels, 4);
ok("quotas positive", e1.quota > 0 && e4.quota > 0);

// 3. THE core redesign: the plane never leaves screen center.
//    Fly east for 3 seconds; camera must track the player exactly,
//    so the player's screen position stays (W/2, H/2).
T._setPlayer(0, 0, 0); // heading east
T._drag(1024, 384);    // finger to the east of center
for (let i = 0; i < 180; i++) T._frame(1 / 60);
T._undrag();
const p = T._player(), c = T._cam();
ok("player traveled east in world", p.x > 500);
eq("camera glued to player x", Math.round(c.x), Math.round(p.x));
eq("camera glued to player y", Math.round(c.y), Math.round(p.y));
const scr = T._screen(p.x, p.y);
eq("player screen x is center", Math.round(scr.x), 512);
eq("player screen y is center", Math.round(scr.y), 384);

// 4. drag rotates the plane: finger south -> nose swings toward south
T._setPlayer(0, 0, 0);
T._drag(512, 700); // finger below center
for (let i = 0; i < 60; i++) T._frame(1 / 60);
T._undrag();
const hd = T._player().hd;
ok("plane rotated toward finger (south)", Math.abs(hd - Math.PI / 2) < 0.35);

// 5. no drag -> heading holds steady
T._setPlayer(0, 0, 1.2);
for (let i = 0; i < 30; i++) T._frame(1 / 60);
ok("heading steady without input", Math.abs(T._player().hd - 1.2) < 0.001);

// 6. gentler difficulty: spawned enemies are slower than the old 1.0x,
//    and enemy fire is delayed (fireT starts >= 1.5)
T._setPlayer(0, 0, 0);
T._spawnEnemy();
const en = T._enemies()[T._enemies().length - 1];
ok("enemy speed gentler than old 1.0x era esp", en.sp < 125);
ok("enemy holds fire at first", en.fireT >= 1.5);

// 7. a full minute of unaimed flight: no crash, world keeps scrolling
T._setPlayer(0, 0, -Math.PI / 2);
const yBefore = T._cam().y;
for (let i = 0; i < 3600; i++) T._frame(1 / 60);
ok("world scrolled (camera moved)", Math.abs(T._cam().y - yBefore) > 1000);
eq("still playing after 60s drift", T._state(), "play");

// 8. THE thumb stick: anchored at the BOTTOM, tilt steers the plane —
//    the finger never has to cover the plane in the middle.
const home = T._stickPos().home;
eq("stick home is at the bottom", home.y, 768 - 118);
eq("stick home is centered", home.x, 512);
T._setPlayer(0, 0, 0);                     // heading east
T._stick(512, 650, 512, 590);              // thumb at the bottom, tilted UP
for (let i = 0; i < 60; i++) T._frame(1 / 60);
T._undrag();
ok("stick tilt up -> nose swings north", Math.abs(T._player().hd - (-Math.PI / 2)) < 0.4);
const sp = T._stickPos();
ok("stick released -> inactive", !sp.active);
// dead zone: a tiny tilt doesn't turn the plane
T._setPlayer(0, 0, 0);
T._stick(512, 650, 518, 644);              // 8px tilt — inside the dead zone
for (let i = 0; i < 30; i++) T._frame(1 / 60);
T._undrag();
ok("tiny tilt inside dead zone -> heading holds", Math.abs(T._player().hd) < 0.001);
// knob clamps to the stick radius
T._stick(512, 650, 512, 100);
const clamped = T._stickPos();
ok("knob clamps to the base radius", Math.hypot(clamped.kx - 512, clamped.ky - 650) <= 92.5);
T._undrag();

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
