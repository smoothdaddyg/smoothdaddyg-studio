/* Node test for Coloring Book v3 — real crayon + SAVE.
   Danny's 2026-11-10 call: "change the color book game to
   work more like a real crayon. U have it where u just tap
   and the color shows up. That's not fun. In the real word
   we move our hands back and forth and color the area.
   Doesn't have to be in the lines either. That's the beauty
   of coloring. U try to stay in the lines."
   So: pick a crayon, SCRIBBLE back and forth — strokes lay
   down waxy crayon under the line art, spilling outside
   the lines like the real thing. 10 dots light up as the
   line-art area fills (paint outside the lines shows, but
   doesn't count). The eraser scrubs paint back off.
   RANDOM every playthrough: fresh load and PLAY AGAIN
   shuffle the pictures; the NEW PICTURE button re-rolls any
   time, never erasing work — and if there's nowhere left to
   re-roll to it opens the gallery instead of silently doing
   nothing. Gallery picker jumps to any picture, thumbnails
   show the real coloring. Color all 6 for the finale
   gallery + PLAY AGAIN.
   Danny's 2026-11-10 playtest (v3): the game NEVER
   finishes a page on its own — reaching half the picture
   only lights the last dot. A big green SAVE button
   appears once any color is down; SHE taps it when SHE
   thinks she's done, and only then does the page
   celebrate and roll on. The paper also stays clear of
   the site-wide 84px back button in portrait.
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
  Math, JSON, Object, Array, Uint8Array, parseInt,
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
function approx(a, b, tol, m) { if (Math.abs(a - b) > tol) throw new Error(m + " (got " + a + ", want ~" + b + ")"); }
function stepN(n, dt) { for (let i = 0; i < n; i++) T.step(dt || 0.016); }
function isPerm(a) {
  return a.length === 6 && a.slice().sort((x, y) => x - y).join(",") === "0,1,2,3,4,5";
}
// Scribble back and forth across the whole page, like a
// real hand — a zigzag of long strokes.
function scribblePage() {
  const pts = [];
  for (let y = 20; y <= 380; y += 40) {
    pts.push({ x: 20, y: y });
    pts.push({ x: 380, y: y + 20 });
  }
  T.stroke(pts);
}
// Finish the current picture the honest way: scribble
// until the dots are full, then SHE taps SAVE — the game
// never finishes a page on its own.
function finishCurrent() {
  T.debug.paintToComplete();
  eq(T.state, "color", "half the picture colored still doesn't finish it on its own");
  ok(T.saveReady, "SAVE is showing once there's color down");
  ok(T.save(), "SAVE finishes the page");
  eq(T.state, "celebrate", "SAVE throws the celebration");
  ok(T.isDone(T.current), "page marked finished");
}

test("boots with 6 pictures, 8-14 regions each, all blank", () => {
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
  eq(T.progress.coverage, 0, "nothing colored yet");
  eq(T.progress.dots, 0, "no dots lit yet");
  eq(T.progress.total, 10, "ten dots to earn");
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

test("scribbling back and forth colors the page; dots light up as it fills", () => {
  T.start();
  T.selectColor(0); // red
  ok(T.stroke([{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 100, y: 150 }, { x: 300, y: 150 }]), "a back-and-forth stroke paints");
  ok(T.coverage > 0, "coverage climbs from scribbling (got " + T.coverage + ")");
  ok(T.progress.dots >= 1, "at least one dot lights up");
  const cov1 = T.coverage;
  T.selectColor(6); // blue, keep going over new ground
  T.stroke([{ x: 100, y: 250 }, { x: 300, y: 250 }, { x: 100, y: 300 }, { x: 300, y: 300 }]);
  ok(T.coverage > cov1, "more scribbling covers more of the picture");
  ok(!T.isDone(T.current), "not done after a couple of strokes");
});

test("a single tap is just one dab — no more tap-to-fill", () => {
  T.start();
  T.selectColor(0);
  T.stamp(200, 200);
  ok(T.coverage > 0, "a dab leaves a little color");
  ok(T.coverage < 0.05, "but one dab barely moves the page (got " + T.coverage + ")");
  eq(T.progress.dots, 0, "one dab earns no dots");
  ok(!T.isDone(T.current), "one tap never finishes a page");
});

test("paint outside the lines shows but doesn't count", () => {
  T.start();
  // Synthetic mask: only the left half of the page is
  // "inside the lines".
  T.debug.setMask(T.current, (x) => (x < 200 ? 1 : 0));
  T.selectColor(0);
  T.stroke([{ x: 250, y: 100 }, { x: 380, y: 100 }, { x: 250, y: 300 }, { x: 380, y: 300 }]);
  eq(T.coverage, 0, "scribbling only outside the lines earns nothing");
  eq(T.progress.dots, 0, "no dots for outside-the-lines paint");
  // A dense back-and-forth inside the lines: five rows.
  T.stroke([
    { x: 20, y: 100 }, { x: 180, y: 100 }, { x: 20, y: 150 }, { x: 180, y: 150 },
    { x: 20, y: 200 }, { x: 180, y: 200 }, { x: 20, y: 250 }, { x: 180, y: 250 },
    { x: 20, y: 300 }, { x: 180, y: 300 },
  ]);
  ok(T.coverage > 0.2, "scribbling inside the lines counts (got " + T.coverage + ")");
  ok(T.progress.dots >= 4, "dots light up for inside-the-lines work");
});

test("eraser scrubs paint back off, dots unlight", () => {
  T.start();
  T.selectColor(0);
  // Color part of the page — well short of half, so the
  // page doesn't complete under the crayon.
  const paintPts = [];
  for (let y = 20; y <= 180; y += 40) {
    paintPts.push({ x: 20, y: y });
    paintPts.push({ x: 380, y: y + 20 });
  }
  T.stroke(paintPts);
  const cov = T.coverage;
  ok(cov > 0.2 && cov < T.target, "page partly colored first (got " + cov + ")");
  const dots = T.progress.dots;
  ok(dots >= 5, "dots lit (got " + dots + ")");
  T.selectColor(13); // eraser
  eq(T.selectedName, "eraser", "eraser selected");
  // Erase with the same back-and-forth motion.
  T.stroke(paintPts);
  ok(T.coverage < cov / 2, "erasing takes most of the color back off (got " + T.coverage + ")");
  ok(T.progress.dots < dots, "dots unlight as paint comes off");
  ok(!T.isDone(T.current), "erasing never completes a page");
});

test("half the picture lights the last dot but NEVER finishes the page on its own", () => {
  T.start();
  T.selectColor(0);
  T.debug.paintToCoverage(0.45);
  ok(T.coverage >= 0.44 && T.coverage < T.target, "just under half colored (got " + T.coverage + ")");
  eq(T.state, "color", "still coloring just under half");
  ok(!T.isDone(T.current), "not finished yet");
  T.stroke([{ x: 50, y: 350 }, { x: 350, y: 350 }, { x: 50, y: 380 }, { x: 350, y: 380 }]);
  ok(T.coverage >= T.target, "crossed half the picture (got " + T.coverage + ")");
  eq(T.progress.dots, 10, "all ten dots lit at half");
  eq(T.state, "color", "still coloring — the game never decides she's done");
  ok(!T.isDone(T.current), "not finished without her SAVE tap");
  // And she can keep coloring past half as long as she likes.
  T.stroke([{ x: 50, y: 50 }, { x: 350, y: 50 }]);
  eq(T.state, "color", "still coloring after more scribbling");
  ok(!T.isDone(T.current), "still not finished");
});

test("SAVE is the only way to finish a page — hidden on a blank page, back off when erased", () => {
  T.start();
  eq(T.saveReady, false, "no SAVE on a blank page");
  eq(T.save(), false, "SAVE on a blank page does nothing");
  T.selectColor(0);
  T.stamp(200, 200);
  eq(T.saveReady, true, "SAVE appears once there's color down");
  ok(T.coverage > 0 && T.coverage < T.target, "a dab is nowhere near half — SAVE is her call, not the game's");
  ok(T.save(), "SAVE finishes the page");
  eq(T.state, "celebrate", "SAVE throws the celebration");
  ok(T.isDone(T.current), "page finished");
  eq(T.saveReady, false, "no SAVE while celebrating");
  eq(T.save(), false, "no double-finish during the celebration");
  stepN(140);
  eq(T.state, "color", "rolled on to the next picture");
  // A fresh page: SAVE hides again until she colors.
  eq(T.saveReady, false, "SAVE hidden on the fresh page");
  // Erasing everything hides SAVE again.
  T.selectColor(0);
  T.stamp(200, 200);
  eq(T.saveReady, true, "SAVE back after a dab");
  T.selectColor(13); // eraser
  T.stroke([{ x: 200, y: 200 }, { x: 200, y: 200 }]);
  T.stamp(200, 200);
  eq(T.coverage, 0, "all paint erased");
  eq(T.saveReady, false, "SAVE hides when the paint is gone");
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

test("NEW PICTURE re-rolls to a random unfinished picture, keeps the scribbles", () => {
  T.start();
  const first = T.current;
  T.selectColor(0);
  T.stroke([{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 100, y: 150 }, { x: 300, y: 150 }]);
  const cov = T.coverage;
  ok(cov > 0, "some color on the first picture");
  ok(T.newPicture(), "NEW PICTURE swaps");
  ok(T.current !== first, "a different picture");
  ok(!T.isDone(T.current), "swapped to an unfinished picture");
  eq(T.state, "color", "still coloring");
  // Cycle back: the scribbles are still there.
  T.openPage(first);
  approx(T.coverageOf(first), cov, 0.001, "skipping never erases work");
});

test("NEW PICTURE opens the gallery when only the current picture is left", () => {
  T.start();
  let guard = 0;
  while (T.done.length < 5 && guard++ < 10) {
    finishCurrent();
    stepN(140);
  }
  eq(T.done.length, 5, "five finished");
  eq(T.unfinishedCount, 1, "one picture left");
  const cur = T.current;
  ok(T.newPicture(), "NEW PICTURE does something instead of silently nothing");
  eq(T.current, cur, "still on the last picture — nothing to re-roll to");
  ok(T.galleryShown, "the gallery opens so she can jump anywhere");
  eq(T.galleryMode, "picker", "gallery is in picker mode");
});

test("NEW PICTURE during the celebration jumps right away", () => {
  T.start();
  const first = T.current;
  finishCurrent(); // state is "celebrate" now
  eq(T.state, "celebrate", "celebrating");
  ok(T.newPicture(), "NEW PICTURE works mid-celebration");
  eq(T.state, "color", "straight back to coloring, no waiting out the beat");
  ok(T.current !== first, "a different picture");
  eq(T.done.length, 1, "the finished page stays finished");
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
  // Scribbling more on an already-finished picture must
  // not re-celebrate.
  T.selectColor(0);
  T.stroke([{ x: 100, y: 100 }, { x: 300, y: 100 }]);
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
  ok(T.coverages.every((c) => c === 0), "every page blank again");
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
