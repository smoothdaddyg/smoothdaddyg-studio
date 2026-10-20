/* Node test for Glam Hair hair sim + tools (window.__glam).
   Run: node tools/tests/glamhair.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "glamhair", "game.js");

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
  Math, JSON, Object, Array, setTimeout: (fn) => 0,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });

const G = sandbox.window.__glam;
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}
function finiteStrand(s) {
  for (const p of s.pts) {
    if (!isFinite(p.x) || !isFinite(p.y)) return false;
  }
  return true;
}

// layout like an iPad, fresh model
G._layout(1024, 768);
G._newModel();
const strands = G.strands();
ok("has back + front strands", strands.length === 42);
ok("strand point counts sane", strands.every((s) => s.pts.length === s.maxN && (s.front ? s.maxN === 6 : s.maxN === 9)));

// expanded options: more dye, more lips, eyeshadow, more accessories, 9 tools
{
  const c = G._counts();
  ok("12 hair dyes", c.dye === 12);
  ok("8 lipstick colors", c.lips === 8);
  ok("6 eyeshadow colors", c.shadows === 6);
  ok("7 accessories", c.bows === 7);
  ok("9 tools incl. eyeshadow", c.tools === 9);
}

// sim stability: 600 steps, nothing explodes or NaNs
let stable = true, bounded = true;
for (let i = 0; i < 600; i++) {
  G.pinRoots();
  G.stepStrands(1 / 60);
  for (const s of strands) {
    if (!finiteStrand(s)) stable = false;
    for (const p of s.pts) {
      if (Math.abs(p.x) > 5000 || Math.abs(p.y) > 5000) bounded = false;
    }
  }
}
ok("600 steps: no NaN", stable);
ok("600 steps: points stay bounded", bounded);

// roots stay pinned to scalp
G.pinRoots();
ok("roots pinned after sim", strands.every((s) => Math.abs(s.pts[0].x - s.rx) < 0.01 && Math.abs(s.pts[0].y - s.ry) < 0.01));

// brush: dragging through hair moves points toward the brush
const s0 = strands[3];
const tipBefore = { x: s0.pts[5].x, y: s0.pts[5].y };
G._selectTool("brush");
for (let i = 0; i < 30; i++) { // drag the brush rightward through the hair
  const nx = tipBefore.x + (i + 1) * 7;
  G._setPointer(nx, tipBefore.y);
  G.pinRoots(); G._applyDragTool(1 / 60); G.stepStrands(1 / 60);
}
G._clearPointer();
ok("brush pulls hair toward pointer", s0.pts[5].x > tipBefore.x + 20);

// curl: iron raises curl toward 1
const s1 = strands[5];
s1.curl = 0;
G._selectTool("curl");
const mid = s1.pts[4];
G._setPointer(mid.x, mid.y);
for (let i = 0; i < 60; i++) { G._applyDragTool(1 / 60); }
G._clearPointer();
ok("curling iron adds curl", s1.curl > 0.5);

// brush smooths curl back out
G._selectTool("brush");
G._setPointer(mid.x, mid.y);
for (let i = 0; i < 120; i++) { G._applyDragTool(1 / 60); }
G._clearPointer();
ok("brush smooths curls", s1.curl < 0.2);

// color: dyes strands near pointer
G._selectTool("color"); // dyeIdx 0
const s2 = strands[8];
if (s2.color === G._dye()) G._selectTool("color"); // cycle if it's already this dye
const before = s2.color;
G._setPointer(s2.pts[3].x, s2.pts[3].y);
for (let i = 0; i < 5; i++) { G._applyDragTool(1 / 60); }
G._clearPointer();
ok("color tool dyes hair", s2.color !== before);

// cut: DRAG the scissors through the hair — strands near the drag
// path get snipped (area effect, not one strand per tap)
G._selectTool("cut");
const totalBefore = strands.reduce((a, s) => a + s.n, 0);
for (let i = 0; i < 30; i++) { // drag horizontally through the mid-hair
  G._setPointer(300 + i * 15, 380);
  G.pinRoots(); G._applyDragTool(1 / 60); G.stepStrands(1 / 60);
}
G._clearPointer();
const totalAfter = strands.reduce((a, s) => a + s.n, 0);
ok("scissors snip many strands on a drag", totalAfter < totalBefore - 10);

// eyeshadow: sweeping over the eyes paints the lids
G._selectTool("shadow");
const m0 = G._model();
m0.eyeShadow = 0; m0.eyeShadowColor = null;
for (let i = 0; i < 60; i++) {
  G._setPointer(430 + (i % 10) * 16, 259); // sweep across both eyes
  G._applyDragTool(1 / 60);
}
G._clearPointer();
ok("eyeshadow paints the lids", m0.eyeShadow > 0.5 && !!m0.eyeShadowColor);

// blush: tap cheek raises blush
G._selectTool("blush");
const m = G._model();
const bBefore = m.blush;
G._applyTapTool(512 - 60, 300); // near left cheek for 1024x768 layout
ok("blush tap applies", m.blush > bBefore);

// style meter climbs with styling
G._setStyle(0);
const stBefore = G._style();
G._selectTool("brush");
G._setPointer(512, 200);
for (let i = 0; i < 30; i++) { G._applyDragTool(1 / 60); }
G._clearPointer();
ok("styling fills the style meter", G._style() > stBefore);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
