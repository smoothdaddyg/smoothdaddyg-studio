/* Node test for Bigger! #29 (window.__bgTest).
   His daughter's "Comparing Numbers" worksheet as a game: two-digit
   numbers, tap the BIGGER one — or the SMALLER one on alternate
   rounds. The prompt is visual only (giant ▲ + oversized "9" for
   BIGGER, tiny ▼ + small "1" for SMALLER), no words anywhere.
   Gap bands: L1 >= 20, L2 >= 10, L3 >= 5, L4 >= 2, L5 exactly 1.
   Numbers never equal, 4 rounds per level, wrong tap just wiggles
   (no penalty, no game over), level clears only on the player's
   tap of the big ▶ button, grand finale after L5. Escalation is
   visible: L1 plain pads, L2 coloured balls, L3 stars + sparkles,
   L4 balloons, L5 golden numbers + fireworks on every correct pick.
   Original 132 BPM fanfare-march chiptune (bass 0.2, 64 steps).
   Run: node tools/tests/bigger.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "bigger", "game.js");

const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradStub;
    if (k === "measureText") return () => ({ width: 90 });
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
    makeMusic: () => {
      const m = { on: false, step: 0 };
      m.start = () => { m.on = true; };
      m.stop = () => { m.on = false; };
      m.tick = () => { if (m.on) m.step++; };
      return m;
    },
  }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array, Date,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox);
const T = sandbox.window.__bgTest;
if (!T) { console.error("FAIL: no __bgTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }

// Answer every round of the current level correctly.
function playLevelRight() {
  for (let i = 0; i < 4; i++) {
    eq(T.state, "play", "still playing at round " + i);
    T.answer(T.correctIdx);
  }
  eq(T.done, 4, "all four rounds right");
}

test("boots on the title screen; starting deals 4 rounds, mixed BIGGER/SMALLER", () => {
  eq(T.state, "title", "starts on title");
  T.startGame();
  eq(T.state, "play", "playing after start");
  eq(T.level, 1, "level 1");
  eq(T.rounds.length, 4, "four rounds per level");
  const kinds = T.rounds.map((r) => r.kind);
  eq(kinds.filter((k) => k === "bigger").length, 2, "two BIGGER rounds (" + kinds.join(",") + ")");
  eq(kinds.filter((k) => k === "smaller").length, 2, "two SMALLER rounds (" + kinds.join(",") + ")");
  for (const r of T.rounds) {
    ok(r.a >= 10 && r.a <= 99, "a is two-digit (" + r.a + ")");
    ok(r.b >= 10 && r.b <= 99, "b is two-digit (" + r.b + ")");
    ok(r.a !== r.b, "numbers never equal (" + r.a + " vs " + r.b + ")");
  }
});

test("gap bands per level over many deals (L1 >= 20, L2 >= 10, L3 >= 5, L4 >= 2, L5 exactly 1)", () => {
  const minGap = [20, 10, 5, 2, 1];
  for (let lv = 1; lv <= 5; lv++) {
    for (let d = 0; d < 60; d++) {
      const rs = T.makeLevel(lv);
      eq(rs.length, 4, "L" + lv + " has 4 rounds");
      const kinds = rs.map((r) => r.kind);
      eq(kinds.filter((k) => k === "bigger").length, 2, "L" + lv + " mixes 2 BIGGER rounds");
      eq(kinds.filter((k) => k === "smaller").length, 2, "L" + lv + " mixes 2 SMALLER rounds");
      for (const r of rs) {
        const gap = Math.abs(r.a - r.b);
        ok(r.a >= 10 && r.a <= 99 && r.b >= 10 && r.b <= 99, "L" + lv + " two-digit (" + r.a + " vs " + r.b + ")");
        ok(r.a !== r.b, "L" + lv + " never equal");
        if (lv < 5) {
          ok(gap >= minGap[lv - 1], "L" + lv + " gap >= " + minGap[lv - 1] + " (got " + gap + ": " + r.a + " vs " + r.b + ")");
        } else {
          eq(gap, 1, "L5 gap is exactly 1 (got " + gap + ": " + r.a + " vs " + r.b + ")");
        }
      }
    }
  }
});

test("makePair honours the L5 exactly-1 rule and the L1 >= 20 rule directly", () => {
  for (let i = 0; i < 100; i++) {
    const p = T.makePair(5);
    eq(Math.abs(p.a - p.b), 1, "L5 pair gap 1 (" + p.a + " vs " + p.b + ")");
    ok(p.a !== p.b, "L5 pair never equal");
  }
  for (let i = 0; i < 100; i++) {
    const p = T.makePair(1);
    ok(Math.abs(p.a - p.b) >= 20, "L1 pair gap >= 20 (" + p.a + " vs " + p.b + ")");
  }
  eq(T.minGapFor(1), 20, "L1 min gap 20");
  eq(T.minGapFor(2), 10, "L2 min gap 10");
  eq(T.minGapFor(3), 5, "L3 min gap 5");
  eq(T.minGapFor(4), 2, "L4 min gap 2");
  eq(T.minGapFor(5), 1, "L5 min gap 1");
});

test("BIGGER rounds want the larger number, SMALLER rounds the smaller — both sides", () => {
  // Worksheet rows, dealt in order: 45 vs 39, 91 vs 71, 16 vs 81, 28 vs 25.
  T.deal([
    { a: 45, b: 39, kind: "bigger" },
    { a: 91, b: 71, kind: "smaller" },
    { a: 16, b: 81, kind: "bigger" },
    { a: 28, b: 25, kind: "smaller" },
  ]);
  eq(T.correctIdx, 0, "45 > 39: BIGGER is the left number");
  T.answer(0);
  eq(T.done, 1, "right answer counts");
  eq(T.correctIdx, 1, "91 vs 71: SMALLER is the right number (71)");
  T.answer(1);
  eq(T.done, 2, "second round right");
  eq(T.correctIdx, 1, "16 vs 81: BIGGER is the right number (81)");
  T.answer(1);
  eq(T.done, 3, "third round right");
  eq(T.correctIdx, 1, "28 vs 25: SMALLER is the right number (25)");
  T.answer(1);
  eq(T.done, 4, "all four right");
});

test("a wrong tap wiggles and does not advance — retry until right, no penalty", () => {
  T.deal([
    { a: 53, b: 97, kind: "bigger" },
    { a: 40, b: 20, kind: "smaller" },
    { a: 60, b: 61, kind: "bigger" },
    { a: 11, b: 99, kind: "smaller" },
  ]);
  const wrong = 1 - T.correctIdx;
  T.answer(wrong);
  eq(T.done, 0, "wrong tap earns nothing");
  eq(T.roundIdx, 0, "wrong tap does not advance the round");
  eq(T.state, "play", "still playing after a wrong tap — no game over");
  T.answer(wrong);
  eq(T.done, 0, "wrong again, still nothing lost");
  T.answer(T.correctIdx);
  eq(T.done, 1, "the right tap works right after");
  eq(T.roundIdx, 1, "round advances only on a right tap");
});

test("finishing a level waits for the player's tap on the big ▶ button — never auto-advances", () => {
  T.startGame();
  playLevelRight();
  T.stepN(60);
  eq(T.state, "levelClear", "level clears after the celebration beat");
  T.stepN(300);
  eq(T.state, "levelClear", "still waiting — nothing rolls on by itself");
  eq(T.level, 1, "still level 1 until NEXT");
  const b = T.nextBtn;
  T.onDown(b.x, b.y);
  eq(T.state, "play", "▶ starts the next level");
  eq(T.level, 2, "level 2");
  eq(T.done, 0, "fresh rounds, nothing done yet");
  eq(T.rounds.length, 4, "four new rounds");
});

test("clearing level 5 wins the game; PLAY AGAIN restarts at level 1", () => {
  T.startGame();
  for (let lv = 1; lv <= 5; lv++) {
    eq(T.level, lv, "on level " + lv);
    playLevelRight();
    T.stepN(60);
    if (lv < 5) {
      eq(T.state, "levelClear", "level " + lv + " clears");
      const b = T.nextBtn;
      T.onDown(b.x, b.y);
    } else {
      eq(T.state, "win", "level 5 wins the game");
    }
  }
  T.stepN(180); // finale fireworks + confetti keep going
  eq(T.state, "win", "finale keeps going until PLAY AGAIN");
  const b = T.playBtn;
  T.onDown(b.x, b.y);
  eq(T.state, "play", "PLAY AGAIN restarts");
  eq(T.level, 1, "back at level 1");
  eq(T.done, 0, "nothing done yet");
});

test("tapping a number pad on screen answers that side", () => {
  T.deal([
    { a: 45, b: 39, kind: "bigger" },
    { a: 91, b: 71, kind: "smaller" },
    { a: 16, b: 81, kind: "bigger" },
    { a: 28, b: 25, kind: "smaller" },
  ]);
  const g0 = T.numGeom[0], g1 = T.numGeom[1];
  ok(g0.x + g0.w <= g1.x, "pads sit side by side, left then right");
  T.onDown(g0.x + g0.w / 2, g0.y + g0.h / 2);
  eq(T.done, 1, "tapping the left pad answers it (45 is bigger)");
  T.onDown(g1.x + g1.w / 2, g1.y + g1.h / 2);
  eq(T.done, 2, "tapping the right pad answers it (71 is smaller)");
});

test("two number pads fill the playfield, clear of the back button and the deck", () => {
  T.startGame();
  const S = T.screen;
  eq(T.numGeom.length, 2, "two number pads");
  for (const g of T.numGeom) {
    ok(g.w >= 150 && g.h >= 150, "pad big to tap (" + g.w.toFixed(0) + "x" + g.h.toFixed(0) + ")");
    ok(g.y >= 104, "pad starts below the 84px back button (y=" + g.y + ")");
    ok(g.y + g.h <= S.PH, "pad stays in the playfield, above the deck");
  }
  ok(T.numGeom[0].x < T.numGeom[1].x, "pads lay out left to right");
});

test("wide desktop layout: number font capped, pads fit inside the viewport", () => {
  function checkLayout(w, h, label) {
    T.resize(w, h);
    const L = T.layout, S = T.screen;
    ok(L.numFont <= 110, label + ": number font capped (" + L.numFont + "px)");
    ok(L.promptFont <= 64, label + ": prompt font capped (" + L.promptFont + "px)");
    ok(L.bigDigit <= 160, label + ": big digit capped (" + L.bigDigit + "px)");
    for (const g of T.numGeom) {
      ok(g.x + g.w <= w, label + ": pad inside the viewport (" + (g.x + g.w).toFixed(0) + " <= " + w + ")");
      ok(g.w <= 340, label + ": pad not stretched desktop-wide (w=" + g.w.toFixed(0) + ")");
      ok(g.y >= 104, label + ": pad clear of the back button");
    }
    T.render();
  }
  checkLayout(400, 700, "phone 400x700");
  checkLayout(1919, 998, "desktop 1919x998");
  checkLayout(1024, 768, "iPad landscape 1024x768");
  T.resize(400, 700); // leave the phone layout in place
});

test("music is its own 64-step fanfare march with loud bass and a harmony voice", () => {
  const m = T.music;
  eq(m.steps, 64, "64 steps");
  eq(m.bpm, 132, "132 BPM march");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.lead.length, 64, "lead is 64 steps");
  eq(m.bass.length, 64, "bass is 64 steps");
  eq(m.harmony.length, 64, "harmony is 64 steps");
  ok(m.lead.some((n) => n > 0), "lead sings");
  ok(m.harmony.some((n) => n > 0), "harmony sings under it");
  ok(m.lead.join() !== m.bass.join(), "lead and bass are different lines");
  ok(m.lead.every((n) => n === 0 || n >= 300), "lead stays in a bright register");
});

test("the music loop actually starts and ticks once the game starts", () => {
  T.fresh();
  const s0 = T.musicState.step;
  T.startGame();
  ok(T.musicState.on, "loop starts with the game (not just configured)");
  T.stepN(30);
  ok(T.musicState.step > s0, "loop ticks while playing");
});

test("renders every state and every level dressing without throwing", () => {
  T.fresh(); T.render();
  T.startGame(); T.render();
  for (let lv = 1; lv <= 5; lv++) {
    // Drive each level's draw path: pads, prompt, dots, sparkles.
    T.setLevel(lv);
    T.deal([
      { a: 45, b: 39, kind: "bigger" },
      { a: 91, b: 71, kind: "smaller" },
      { a: 16, b: 81, kind: "bigger" },
      { a: 28, b: 25, kind: "smaller" },
    ]);
    T.render();
    T.stepN(30);
    T.render();
    // Answer one round right (star burst) and one wrong (wiggle).
    T.answer(T.correctIdx); T.render();
    T.answer(1 - T.correctIdx); T.render();
    T.stepN(10);
  }
  T.levelClear(); T.render();
  eq(T.state, "levelClear", "level-clear renders");
  T.winGame(); T.render();
  eq(T.state, "win", "win renders");
  T.stepN(120); T.render(); // finale fireworks + confetti keep going
  // Nothing drawn over the top-left back button.
  for (const g of T.numGeom) ok(g.x > 70 || g.y > 70, "no pad under the back button");
});

console.log(pass + "/" + (pass + fail) + " bigger tests pass");
if (fail) process.exit(1);
