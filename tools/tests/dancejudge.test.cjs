/* Node test for Dance Judge logic hooks (window.__dance).
   Run: node tools/tests/dancejudge.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "dancejudge", "game.js");

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
  makeAudio: () => ({ tone: noop, noise: noop, arp: noop, toggleMute: () => false, unlock: noop }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });

const D = sandbox.window.__dance;
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}

// move library: 50+ moves across all categories
eq("moves >= 50", D.MOVES.length >= 50, true);
const cats = {};
D.MOVES.forEach(m => { cats[m.cat] = (cats[m.cat] || 0) + 1; });
["basic", "spin", "jump", "floor", "partner", "comedy", "finish"].forEach(c =>
  eq("category " + c + " has moves", (cats[c] || 0) >= 4, true));
eq("every move has fn", D.MOVES.every(m => typeof m.fn === "function"), true);
eq("every move has dur", D.MOVES.every(m => m.dur > 0), true);

// every move fn runs without throwing for both dancers
const mkD = () => ({ x: 100, y: 400, hx: 100, hy: 400, face: 1, s: 1, skin: "#fff", hairStyle: 0, hairColor: "#000", hat: 0, dress: false, topC: "#f00", botC: "#00f", shoeC: "#000", size: 1, blush: false, rot: 0, crouch: 0, jump: 0, tilt: 0, armL: 0, armR: 0, legL: 0, legR: 0, twirl: 0, spin: 0, expr: "happy", hatFly: 0 });
let moveErr = null;
for (const m of D.MOVES) {
  try {
    const a = mkD(), b = mkD();
    for (const t of [0, 0.5, 1]) { m.fn(t, a, b, 0.5); m.fn(t, b, a, 0.5); }
  } catch (e) { moveErr = m.id + ": " + e.message; break; }
}
eq("all move fns run clean", moveErr, null);
if (moveErr) console.log("  move error:", moveErr);

// REGRESSION: no move may walk a dancer off-screen.
// Run every move frame-by-frame from x=500; assert < 220px drift from home.
let driftErr = null;
for (const m of D.MOVES) {
  const a = mkD(), b = mkD();
  a.x = a.hx = 500; b.x = b.hx = 620;
  for (let f = 0; f <= 90; f++) {
    const t = f / 90;
    try { m.fn(t, a, b, 0.5); } catch (e) { driftErr = m.id + " threw: " + e.message; break; }
    if (Math.abs(a.x - 500) > 220 || Math.abs(b.x - 620) > 220) {
      driftErr = m.id + " drifted off-screen (a.x=" + Math.round(a.x) + ", b.x=" + Math.round(b.x) + ")";
      break;
    }
  }
  if (driftErr) break;
}
eq("no move drifts dancers off-screen", driftErr, null);
if (driftErr) console.log("  drift:", driftErr);

// styles & grooves line up
eq("16 styles", D.STYLES.length, 16);
eq("groove per style", D.STYLES.every(s => !!D.GROOVES[s]), true);
for (const s of D.STYLES) {
  const mu = D.Music(s);
  eq("music " + s + " has steps", mu.totalSteps > 0, true);
  let merr = null;
  try {
    mu.start(0);
    for (let i = 0; i < mu.totalSteps + 2; i++) mu.playStep(i % mu.totalSteps, 0);
  } catch (e) { merr = e.message; }
  eq("music " + s + " plays clean", merr, null);
}

// choreography structure: entrance -> ... -> finish pose, ~10-14s
for (const s of D.STYLES) {
  const r = D.buildRoutine(s);
  const total = r.reduce((a, m) => a + m.dur, 0);
  eq("routine " + s + " duration 8-16s", total >= 8 && total <= 16, true);
  eq("routine " + s + " ends with finish", r[r.length - 1].mv.cat, "finish");
  eq("routine " + s + " 7-10 moves", r.length >= 7 && r.length <= 10, true);
}

// stages
eq("14 stages", D.STAGE_IDS.length, 14);

// couples: 3 distinct themes per show
D._newShow();
const show = D._show();
eq("3 acts", show.acts.length, 3);
eq("3 distinct themes", new Set(show.acts.map(a => a.couple.theme)).size, 3);
eq("3 distinct personalities", new Set(show.acts.map(a => a.personality)).size, 3);
eq("acts have music+style", show.acts.every(a => a.music && a.style), true);
eq("acts have confetti themes", show.acts.every(a => !!a.confetti), true);
eq("3 distinct confetti", new Set(show.acts.map(a => a.confetti)).size, 3);
eq("routine built at act start", show.acts.every(a => { a.routine = D.buildRoutine(a.style); return a.routine.length > 0; }), true);

// winner logic incl. ties
eq("clear winner", JSON.stringify(D._winnerOf([7, 9, 5])), "[1]");
eq("tie wins together", JSON.stringify(D._winnerOf([8, 8, 5])), "[0,1]");
eq("three-way tie", JSON.stringify(D._winnerOf([10, 10, 10])), "[0,1,2]");

// REGRESSION: the awards-show freeze (2026-10-07). With show.idx past the
// last act (all three couples judged), no draw helper may see undefined acts.
D._newShow();
const sh2 = D._show();
sh2.idx = 3;
["results", "suspense", "winner", "replay", "judge", "dance"].forEach(function (st) {
  D._state(st);
  let acts = null, herr = null;
  try { acts = D._hatsActs(); } catch (e) { herr = e.message; }
  eq("hats acts no-throw in " + st, herr, null);
  eq("hats acts all defined in " + st, acts && acts.every(function (a) { return !!a && !!a.couple; }), true);
});
D._state("title");

// hook smoke test
let renderOk = true, renderErr = "";
try {
  eq("initial state", D._state(), "title");
  D._newShow();
  eq("show rebuilt", D._show().acts.length, 3);
} catch (e) { renderOk = false; renderErr = e.stack || e.message; }
eq("hook smoke test", renderOk, true);
if (!renderOk) console.log("RENDER ERROR:", renderErr);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
