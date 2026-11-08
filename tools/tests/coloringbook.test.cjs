/* Node test for Coloring Book (window.__colorTest).
   Danny's 2026-11-08 call, shaped by his daughter's real
   photos: a crayon-box palette (crayon-shaped swatches,
   classic crayon colors) and 6 pictures — unicorn, rocket,
   spaceship, satellite, flower, and a cat in her activity
   book's style. Pick a crayon, tap a region to fill it.
   RANDOM every playthrough: fresh load and PLAY AGAIN
   shuffle the pictures; finishing one rolls to a random
   unfinished one; the NEW PICTURE button re-rolls any
   time, never erasing work. Gallery picker jumps to any
   picture. Color all 6 for the finale gallery + PLAY AGAIN.
   Run: node tools/tests/coloringbook.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "coloringbook", "game.js");

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
const mkEl = () => ({
  innerHTML: "", textContent: "", hidden: false, className: "",
  style: { setProperty: noop },
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  dataset: {},
  addEventListener: noop, setAttribute: noop, appendChild: noop,
  getContext: () => ctxStub,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
});
const els = {};
const sandbox = {
  window: { innerWidth: 800, innerHeight: 1000, devicePixelRatio: 1, addEventListener: noop, SDGplays: { played: noop } },
  document: {
    getElementById: (id) => (els[id] = els[id] || mkEl()),
    createElement: () => mkEl(),
    addEventListener: noop, hidden: false,
    head: { appendChild: noop },
  },
  performance: { now: () => 1000 },
  requestAnimationFrame: noop,
  makeAudio: () => ({
    tone: noop, noise: noop, arp: noop, unlock: noop, state: () => "running",
    makeMusic: () => ({ tick: noop, start: noop, stop: noop, on: false, step: 0 }),
  }),
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox);
const T = sandbox.window.__colorTest;
if (!T) { console.error("FAIL: no __colorTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }
function stepN(n, dt) { for (let i = 0; i < n; i++) T.step(dt || 0.016); }
function isPerm(a) {
  return a.length === 6 && a.slice().sort((x, y) => x - y).join(",") === "0,1,2,3,4,5";
}
// Finish the current picture the honest way: fill every
// region but one, then tap the last one with a crayon.
function finishCurrent() {
  const regs = T.pages[T.current].regions;
  T.debug.fillAllBut(regs[regs.length - 1]);
  eq(T.state, "color", "not done with one region left");
  T.selectColor(0);
  T.tapRegion(regs[regs.length - 1]);
  eq(T.state, "celebrate", "last fill throws the celebration");
  ok(T.isDone(T.current), "page marked finished");
}

test("boots with 6 pictures, 8-14 big regions each, all blank", () => {
  T.start();
  eq(T.state, "color", "coloring right away");
  eq(T.pages.length, 6, "six pictures");
  eq(T.pages.map((p) => p.name).join(","), "unicorn,rocket,spaceship,satellite,flower,cat", "his five plus the cat");
  for (const p of T.pages) {
    ok(p.regions.length >= 8 && p.regions.length <= 14, p.name + " has " + p.regions.length + " regions");
    eq(new Set(p.regions).size, p.regions.length, p.name + " region ids are unique");
  }
  ok(isPerm(T.order), "order is a shuffle of all 6");
  eq(T.current, T.order[0], "first picture is the shuffled first");
  eq(T.done.length, 0, "nothing finished yet");
  eq(T.progress.filled, 0, "no regions filled yet");
  eq(T.unfinishedCount, 6, "six unfinished");
});

test("crayon box: 13 crayon colors plus an eraser", () => {
  T.start();
  eq(T.palette.length, 14, "14 swatches in the box");
  eq(T.palette.map((c) => c.name).join(","),
    "red,pink,orange,yellow,lightgreen,green,blue,darkblue,purple,brown,peach,white,black,eraser",
    "classic crayon colors, eraser last");
  ok(T.palette.filter((c) => !c.eraser).every((c) => /^#[0-9a-f]{6}$/.test(c.hex)), "every crayon has a real color");
  ok(T.palette[13].eraser, "last swatch is the eraser");
  T.selectColor(2);
  eq(T.selected, 2, "orange selected");
  eq(T.selectedName, "orange", "selected name is orange");
  eq(T.selectedColor, "#ff7518", "selected color is orange");
});

test("pick a crayon, tap a region, it fills; recoloring works", () => {
  T.start();
  const r0 = T.pages[T.current].regions[0];
  T.selectColor(0); // red
  ok(T.tapRegion(r0), "tap fills the region");
  eq(T.fills[T.current][r0], "#ee204d", "region is red");
  eq(T.progress.filled, 1, "one region filled");
  T.selectColor(6); // blue
  T.tapRegion(r0);
  eq(T.fills[T.current][r0], "#1f75fe", "same region recolors blue");
  eq(T.progress.filled, 1, "still one region filled");
  ok(!T.isDone(T.current), "not done after one region");
});

test("eraser puts a region back to white", () => {
  T.start();
  const r0 = T.pages[T.current].regions[0];
  T.selectColor(0);
  T.tapRegion(r0);
  eq(T.progress.filled, 1, "filled");
  T.selectColor(13); // eraser
  eq(T.selectedName, "eraser", "eraser selected");
  T.tapRegion(r0);
  eq(T.fills[T.current][r0], "#ffffff", "region is white again");
  eq(T.progress.filled, 0, "progress back to zero");
  ok(!T.isDone(T.current), "erasing never completes a page");
});

test("a page completes only when every region is filled", () => {
  T.start();
  const regs = T.pages[T.current].regions;
  T.debug.fillAllBut(regs[regs.length - 1]);
  eq(T.progress.filled, regs.length - 1, "all but one filled");
  eq(T.state, "color", "still coloring with one region left");
  ok(!T.isDone(T.current), "not finished yet");
  T.selectColor(0);
  T.tapRegion(regs[regs.length - 1]);
  eq(T.state, "celebrate", "last fill starts the celebration");
  ok(T.isDone(T.current), "page finished");
  eq(T.progress.filled, regs.length, "every region filled");
});

test("celebration rolls to a random unfinished picture", () => {
  T.start();
  const first = T.current;
  finishCurrent();
  stepN(140); // 2.24s > 2.0s celebration
  eq(T.state, "color", "back to coloring after the celebration");
  ok(T.current !== first, "a different picture");
  ok(!T.isDone(T.current), "the new picture is unfinished");
  eq(T.done.length, 1, "exactly one finished");
  eq(T.unfinishedCount, 5, "five left");
});

test("NEW PICTURE re-rolls to a random unfinished picture, keeps work", () => {
  T.start();
  const first = T.current;
  T.selectColor(0);
  T.tapRegion(T.pages[first].regions[0]);
  T.tapRegion(T.pages[first].regions[1]);
  eq(T.progress.filled, 2, "two regions colored on the first picture");
  ok(T.newPicture(), "NEW PICTURE swaps");
  ok(T.current !== first, "a different picture");
  ok(!T.isDone(T.current), "swapped to an unfinished picture");
  eq(T.state, "color", "still coloring");
  // Cycle back: the work is still there.
  T.openPage(first);
  eq(T.filledCount(first), 2, "skipping never erases work");
  eq(T.fills[first][T.pages[first].regions[0]], "#ee204d", "first region still red");
});

test("NEW PICTURE does nothing when only the current picture is left", () => {
  T.start();
  let guard = 0;
  while (T.done.length < 5 && guard++ < 10) {
    finishCurrent();
    stepN(140);
  }
  eq(T.done.length, 5, "five finished");
  eq(T.unfinishedCount, 1, "one picture left");
  const cur = T.current;
  eq(T.newPicture(), false, "nowhere to re-roll to");
  eq(T.current, cur, "still on the last picture");
});

test("thumbnail gallery jumps to any picture, finished or not", () => {
  T.start();
  const first = T.current;
  finishCurrent();
  stepN(140);
  const finished = T.done[0];
  T.openPage(finished);
  eq(T.current, finished, "jumped back to the finished picture");
  eq(T.state, "color", "coloring it again is fine");
  T.openPage(first);
  eq(T.current, first, "jumped to another picture");
  // Finishing an already-finished picture must not re-celebrate.
  T.debug.fillAll();
  T.selectColor(0);
  T.tapRegion(T.pages[first].regions[0]);
  eq(T.state, "color", "no second celebration for a finished page");
});

test("coloring all 6 reaches the finale, then PLAY AGAIN resets", () => {
  T.start();
  const seen = new Set();
  let guard = 0;
  while (T.state !== "finale" && guard++ < 10) {
    seen.add(T.current);
    finishCurrent();
    stepN(140);
  }
  eq(T.state, "finale", "grand finale after the sixth picture");
  eq(seen.size, 6, "every picture visited exactly once — random, no repeats");
  eq(T.done.length, 6, "all six finished");
  stepN(170); // 2.72s > 2.5s finale beat
  ok(T.galleryShown, "finale gallery appears after the celebration");
  eq(T.galleryMode, "finale", "gallery is in finale mode");
  T.playAgain();
  eq(T.state, "color", "playing again");
  eq(T.done.length, 0, "no finished pictures after PLAY AGAIN");
  ok(T.fills.every((f) => Object.keys(f).length === 0), "every page blank again");
  ok(isPerm(T.order), "PLAY AGAIN re-shuffles");
  eq(T.current, T.order[0], "a fresh random first picture");
});

test("no two playthroughs run the same shuffle", () => {
  const firsts = new Set();
  for (let i = 0; i < 30; i++) {
    T.start();
    ok(isPerm(T.order), "every shuffle is a full permutation");
    firsts.add(T.order[0]);
  }
  ok(firsts.size >= 3, "30 fresh starts began on " + firsts.size + " different pictures");
});

test("music is its own gentle music-box loop", () => {
  T.start();
  const m = T.music;
  eq(m.steps, 64, "64 steps");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.bpm, 96, "gentle 96 BPM");
  ok(m.lead.some((n) => n === 0), "lead has rests that breathe");
  ok(new Set(m.lead.filter(Boolean)).size >= 5, "lead has a real phrase, not one note");
  ok(m.harmony.some((n) => n > 0), "harmony voice present");
  ok(m.kicks.length <= 4, "barely any drums — a soft heartbeat");
});

console.log(pass + "/" + (pass + fail) + " coloring book tests pass");
process.exit(fail ? 1 : 0);
