/* Node test for Price Check! (window.__pcTest).
   Danny's daughter's school worksheets ("Which Costs More?" /
   "Which Costs Less?", The Autism Vault): TWO food items, each
   with a receipt price up to $10 — pick the one that costs MORE
   or LESS. The prompt is visual only: a gold coin with ⬆️ (MORE)
   or ⬇️ (LESS). No words anywhere in the game, only numerals on
   the price tags. 5 levels, 4 rounds each, MORE and LESS mixed
   in every level (two of each). Prices get closer per level:
   L1 gaps $2.00+, L2 $1.00+, L3 $0.50+, L4 $0.20+, L5 $0.01-$0.09
   (the sheets' own closest pair is $9.82 vs $9.83). Never equal
   prices. Wrong tap just wiggles — no penalty, retry until right.
   Right tap: star burst + ding, progress dot lights. Level
   clears only on HER tap on NEXT; finale after L5. No game over
   ever. Original 132 BPM bouncy market-day chiptune (bass 0.2,
   64 steps). Escalation: new treats each level, pink awning L2,
   gold receipt tags L3, coin fountain L4, sparkles L5.
   Run: node tools/tests/pricecheck.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "pricecheck", "game.js");

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
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox);
const T = sandbox.window.__pcTest;
if (!T) { console.error("FAIL: no __pcTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }

// The worksheets' own pairs, dealt in order (cents).
function dealWorksheets() {
  T.deal([
    { kind: "less", a: 724, b: 779, foods: [0, 1] },  // $7.24 vs $7.79, cheaper wins
    { kind: "more", a: 982, b: 983, foods: [2, 3] },  // $9.82 vs $9.83, pricier wins
    { kind: "more", a: 648, b: 684, foods: [4, 5] },  // $6.48 vs $6.84
    { kind: "less", a: 415, b: 515, foods: [6, 7] },  // $4.15 vs $5.15
  ]);
}
function playRoundRight() {
  T.tapItem(T.round.correct);
  T.stepN(60); // let the beat roll to the next round / level clear
}
function playLevelRight() {
  for (let r = 0; r < 4; r++) playRoundRight();
}

test("boots on the title screen; starting deals 4 rounds, MORE and LESS mixed", () => {
  eq(T.state, "title", "starts on title");
  T.startGame();
  eq(T.state, "play", "playing after start");
  eq(T.level, 1, "level 1");
  eq(T.rounds.length, 4, "four rounds per level");
  const kinds = T.rounds.map((r) => r.kind).sort().join(",");
  eq(kinds, "less,less,more,more", "two MORE and two LESS in every level (" + kinds + ")");
  for (const r of T.rounds) {
    ok(r.left.priceCents !== r.right.priceCents, "prices never equal");
    ok(r.correct === 0 || r.correct === 1, "one correct side");
  }
});

test("price-gap bands hold per level, prices $1.00-$10.00, never equal", () => {
  const bands = { 1: [200, 350], 2: [100, 250], 3: [50, 150], 4: [20, 80], 5: [1, 9] };
  for (let lv = 1; lv <= 5; lv++) {
    const [lo, hi] = bands[lv];
    for (let i = 0; i < 60; i++) {
      const [a, b] = T.pair(lv);
      const gap = Math.abs(b - a);
      ok(gap >= lo && gap <= hi, "L" + lv + " gap $" + (gap / 100).toFixed(2) + " inside $" + (lo / 100).toFixed(2) + "-$" + (hi / 100).toFixed(2));
      ok(a >= 100 && b <= 1000, "L" + lv + " prices in $1.00-$10.00 ($" + (a / 100).toFixed(2) + ", $" + (b / 100).toFixed(2) + ")");
      ok(a !== b, "L" + lv + " prices never equal");
    }
    eq(T.gapFor(lv)[0], lo, "L" + lv + " min gap pinned");
    eq(T.gapFor(lv)[1], hi, "L" + lv + " max gap pinned");
  }
});

test("level 5 can deal a one-cent gap — the worksheet's own $9.82 vs $9.83", () => {
  let sawOne = false;
  for (let i = 0; i < 300; i++) {
    const [a, b] = T.pair(5);
    if (Math.abs(b - a) === 1) { sawOne = true; break; }
  }
  ok(sawOne, "a $0.01 gap shows up in 300 L5 deals");
});

test("MORE rounds want the higher price, LESS rounds the lower — the worksheets' pairs", () => {
  dealWorksheets();
  eq(T.round.kind, "less", "round 1 is LESS");
  eq(T.round.correct, 0, "$7.24 (left) is cheaper than $7.79");
  playRoundRight();
  eq(T.round.kind, "more", "round 2 is MORE");
  eq(T.round.correct, 1, "$9.83 (right) costs more than $9.82");
  playRoundRight();
  eq(T.round.kind, "more", "round 3 is MORE");
  eq(T.round.correct, 1, "$6.84 (right) costs more than $6.48");
  playRoundRight();
  eq(T.round.kind, "less", "round 4 is LESS");
  eq(T.round.correct, 0, "$4.15 (left) costs less than $5.15");
});

test("a wrong tap wiggles and changes nothing — no penalty, retry until right", () => {
  dealWorksheets();
  const wrong = 1 - T.round.correct;
  T.tapItem(wrong);
  eq(T.roundsDone, 0, "no progress from a wrong tap");
  eq(T.roundIdx, 0, "still on the same round");
  eq(T.state, "play", "still playing");
  T.stepN(60);
  eq(T.roundIdx, 0, "still the same round after the wiggle settles");
  T.tapItem(T.round.correct);
  eq(T.roundsDone, 1, "the right tap earns a dot");
  T.stepN(60);
  eq(T.roundIdx, 1, "moves on to the next round");
});

test("four right picks clear the level and wait for HER tap on NEXT", () => {
  dealWorksheets();
  playLevelRight();
  eq(T.roundsDone, 4, "all four rounds done");
  eq(T.state, "levelClear", "level clears after the celebration beat");
  T.stepN(300);
  eq(T.state, "levelClear", "still waiting — nothing rolls on by itself");
  const b = T.nextBtn;
  T.onDown(b.x, b.y);
  eq(T.state, "play", "NEXT starts the next level");
  eq(T.level, 2, "level 2");
  eq(T.roundsDone, 0, "fresh set, nothing done yet");
  eq(T.roundIdx, 0, "back to round 1");
});

test("clearing level 5 wins the game; PLAY AGAIN restarts at level 1", () => {
  T.startGame();
  for (let lv = 1; lv <= 5; lv++) {
    eq(T.level, lv, "on level " + lv);
    playLevelRight();
    if (lv < 5) {
      eq(T.state, "levelClear", "level " + lv + " clears");
      const b = T.nextBtn;
      T.onDown(b.x, b.y);
    } else {
      eq(T.state, "win", "level 5 wins the game");
    }
  }
  T.stepN(180);
  const b = T.playBtn;
  T.onDown(b.x, b.y);
  eq(T.state, "play", "PLAY AGAIN restarts");
  eq(T.level, 1, "back at level 1");
  eq(T.roundsDone, 0, "nothing done yet");
});

test("every level brings a new set of treats — no repeats across levels", () => {
  const seen = new Set();
  for (let lv = 1; lv <= 5; lv++) {
    const band = T.foods.filter((f) => f.band === lv);
    eq(band.length, 8, "level " + lv + " has 8 treats");
    for (const f of band) {
      ok(!seen.has(f.e), "treat " + f.e + " is new to level " + lv);
      seen.add(f.e);
    }
  }
  eq(seen.size, 40, "40 distinct treats across 5 levels");
  T.startGame();
  for (const r of T.rounds) {
    ok(r.left.item.band === 1 && r.right.item.band === 1, "L1 only serves band-1 treats");
  }
});

test("tapping a tile by screen coordinates picks that side", () => {
  dealWorksheets();
  const g = T.tileGeom[T.round.correct];
  T.onDown(g.x + g.w / 2, g.y + g.h / 2);
  eq(T.roundsDone, 1, "tapping the right tile earns a dot");
});

test("two big tiles fill the playfield, prompt coin clear of the back button", () => {
  T.startGame();
  eq(T.tileGeom.length, 2, "two tiles");
  for (const g of T.tileGeom) {
    ok(g.w >= 150 && g.h >= 150, "tile big to tap (" + g.w.toFixed(0) + "x" + g.h.toFixed(0) + ")");
    ok(g.y >= 104, "tile starts below the back button (y=" + g.y + ")");
    ok(g.y + g.h < T.deckTop, "tile stays in the playfield, above the deck");
  }
  ok(T.tileGeom[0].x < T.tileGeom[1].x, "tiles lay out left to right");
  ok(T.promptCoin.y - T.promptCoin.r >= 98, "prompt coin clear of the 84px back button");
  ok(T.promptCoin.x - T.promptCoin.r > 0 && T.promptCoin.x + T.promptCoin.r < T.screen.W, "prompt coin inside the screen");
});

test("wide desktop layout: fonts capped, tiles and buttons fit inside the viewport", () => {
  function checkLayout(w, h, label) {
    T.resize(w, h);
    const L = T.layout, S = T.screen;
    ok(L.emojiFont <= 120, label + ": treat emoji capped (" + L.emojiFont + "px)");
    ok(L.tagFont <= 34, label + ": price tag font capped (" + L.tagFont + "px)");
    ok(L.coinFont <= 64, label + ": prompt coin arrow capped (" + L.coinFont + "px)");
    ok(L.winStars <= 150, label + ": win stars capped (" + L.winStars + "px)");
    for (const g of T.tileGeom) {
      ok(g.y + g.h < S.PH, label + ": tile stays in the playfield");
      ok(g.w <= 320, label + ": tile not stretched desktop-wide (w=" + g.w.toFixed(0) + ")");
      ok(g.y >= 104, label + ": tile clear of the back button");
    }
    ok(T.playBtn.y + T.playBtn.r <= h, label + ": play button inside the viewport");
    ok(T.nextBtn.y + T.nextBtn.r <= h, label + ": next button inside the viewport");
    T.render();
  }
  checkLayout(400, 700, "phone 400x700");
  checkLayout(1919, 998, "desktop 1919x998");
  checkLayout(1024, 768, "iPad landscape 1024x768");
  T.resize(400, 700); // leave the phone layout in place
});

test("music is its own 64-step bouncy market-day loop with loud bass and a harmony voice", () => {
  const m = T.music;
  eq(m.steps, 64, "64 steps");
  eq(m.bpm, 132, "132 BPM");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.lead.length, 64, "lead is 64 steps");
  eq(m.bass.length, 64, "bass is 64 steps");
  eq(m.harmony.length, 64, "harmony is 64 steps");
  ok(m.lead.some((n) => n > 0), "lead sings");
  ok(m.harmony.some((n) => n > 0), "harmony sings under it");
  ok(m.lead.join() !== m.bass.join(), "lead and bass are different lines");
  ok(m.lead.join() !== m.harmony.join(), "lead and harmony are different lines");
});

test("the music loop actually starts and ticks once the game starts", () => {
  T.fresh();
  const s0 = T.musicState.step;
  T.startGame();
  ok(T.musicState.on, "loop starts with the game (not just configured)");
  T.stepN(30);
  ok(T.musicState.step > s0, "loop ticks while playing");
});

test("renders every state without throwing, playfield clear of the back button", () => {
  T.fresh(); T.render();
  T.startGame(); T.render();
  dealWorksheets(); T.render();
  T.tapItem(T.round.correct); T.render();
  T.stepN(60); T.render();
  playLevelRight(); T.render();
  eq(T.state, "levelClear", "level-clear renders");
  T.levelClear(); T.render();
  T.winGame(); T.render();
  eq(T.state, "win", "win renders");
  T.stepN(120); T.render(); // finale fireworks keep bursting
  for (const g of T.tileGeom) ok(g.x > 70 || g.y > 70, "no tile under the back button");
});

console.log(pass + "/" + (pass + fail) + " pricecheck tests pass");
if (fail) process.exit(1);
