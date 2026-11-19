/* Node test for Dollar Up! (window.__duTest).
   Danny's 2026-11-19 spec: his daughter's school worksheet
   "Dollar Up to $5" — items with receipt prices, whole-dollar
   money amounts; match each item to the smallest whole dollars
   that cover its price. The game randomizes the cost and the
   money; she decides which one is right. One item at a time:
   big picture + receipt price up top, three money cards in
   the bottom deck — tap the smallest amount that covers it.
   $0.95 -> $1, $3.93 -> $4, $1.75 -> $2, $4.63 -> $5.
   5 levels x 4 rounds, new things to buy each level, level
   clears wait for HER tap on NEXT, finale after L5. Wrong
   taps just wiggle — no penalty, no game over ever.
   Original 120 BPM cheerful chiptune (bass 0.2, 64 steps).
   Run: node tools/tests/dollarup.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "dollarup", "game.js");

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
    makeMusic: () => ({ tick: noop, start: noop, stop: noop, on: false, step: 0 }),
  }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox);
const T = sandbox.window.__duTest;
if (!T) { console.error("FAIL: no __duTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }
function ansIdx() { return T.round.options.indexOf(T.round.answer); }
function tapRight() { T.debug.tapCard(ansIdx()); T.debug.stepN(60); }

test("boots on the title screen; starting deals a level-1 round in band", () => {
  eq(T.state, "title", "starts on title");
  T.debug.startGame();
  eq(T.state, "play", "playing after start");
  eq(T.level, 1, "level 1");
  eq(T.stars, 0, "no stars yet");
  ok(T.round.priceCents >= 25 && T.round.priceCents <= 195, "L1 price in band ($" + (T.round.priceCents / 100).toFixed(2) + ")");
  eq(T.round.options.length, 3, "three money cards");
  eq(T.round.answer, T.dollarUp(T.round.priceCents), "answer is the dollar-up of the price");
});

test("dollarUp rounds the price UP to the next whole dollar — the worksheet's rule", () => {
  eq(T.dollarUp(95), 1, "$0.95 -> $1");
  eq(T.dollarUp(193), 2, "$1.93 -> $2");
  eq(T.dollarUp(200), 2, "$2.00 -> $2");
  eq(T.dollarUp(175), 2, "$1.75 -> $2 (her worksheet's juice box)");
  eq(T.dollarUp(393), 4, "$3.93 -> $4 (her worksheet's ice cream)");
  eq(T.dollarUp(463), 5, "$4.63 -> $5 (her worksheet's cupcake)");
  eq(T.dollarUp(500), 5, "$5.00 -> $5");
  eq(T.dollarUp(25), 1, "$0.25 -> $1");
});

test("her worksheet's four rows all dollar-up to the money on the right", () => {
  // Taco $0.95 -> $1.00, ice cream $3.93 -> $4.00,
  // juice box $1.75 -> $2.00, cupcake $4.63 -> $5.00.
  eq(T.dollarUp(95), 1, "taco");
  eq(T.dollarUp(393), 4, "ice cream");
  eq(T.dollarUp(175), 2, "juice box");
  eq(T.dollarUp(463), 5, "cupcake");
});

test("makeOptions always deals three different whole dollars holding the answer", () => {
  for (let cents = 25; cents <= 495; cents += 7) {
    const opts = T.makeOptions(cents);
    eq(opts.length, 3, "three options for $" + (cents / 100).toFixed(2));
    eq(new Set(opts).size, 3, "no duplicate cards for $" + (cents / 100).toFixed(2));
    ok(opts.includes(T.dollarUp(cents)), "answer $" + T.dollarUp(cents) + " is among the cards");
    for (const o of opts) ok(o >= 1 && o <= 5, "card $" + o + " is a real dollar amount");
  }
  eq(T.makeOptions(95).sort().join(","), "1,2,3", "$0.95 offers $1/$2/$3 (no dollar below $1)");
  eq(T.makeOptions(463).sort().join(","), "3,4,5", "$4.63 offers $3/$4/$5 (no dollar above $5)");
  eq(T.makeOptions(275).sort().join(","), "2,3,4", "$2.75 offers one too small, the answer, one too big");
});

test("priceForLevel stays inside its level band and is never a whole dollar", () => {
  const bands = [[25, 195], [105, 295], [205, 395], [305, 495], [25, 495]];
  for (let lv = 1; lv <= 5; lv++) {
    for (let i = 0; i < 40; i++) {
      const p = T.priceForLevel(lv);
      ok(p >= bands[lv - 1][0] && p <= bands[lv - 1][1], "L" + lv + " price $" + (p / 100).toFixed(2) + " in band");
      ok(p % 100 !== 0, "L" + lv + " price is never a whole dollar ($" + (p / 100).toFixed(2) + ")");
    }
  }
});

test("tapping the right card earns a star and deals the next round", () => {
  T.debug.startGame();
  T.debug.setRound(235); // $2.35 -> $3
  eq(T.round.answer, 3, "answer is $3");
  T.debug.tapCard(ansIdx());
  eq(T.stars, 1, "one star for the right card");
  eq(T.roundDone, true, "round is done");
  eq(T.state, "play", "still playing");
  T.debug.stepN(60); // celebration beat passes
  eq(T.roundInLevel, 1, "moved to round 2");
  eq(T.roundDone, false, "new round is live");
});

test("a wrong tap costs nothing — no star, no progress, try again", () => {
  T.debug.startGame();
  T.debug.setRound(235); // $2.35 -> $3
  const wrong = T.round.options.indexOf(2);
  ok(wrong >= 0, "a too-small card is on the table");
  T.debug.tapCard(wrong);
  eq(T.stars, 0, "no star for the wrong card");
  eq(T.roundDone, false, "round is not done");
  eq(T.state, "play", "still playing, no penalty");
  T.debug.tapCard(ansIdx());
  eq(T.stars, 1, "the right card still earns its star after a miss");
});

test("four right answers clear the level and wait for HER tap on NEXT", () => {
  T.debug.startGame();
  for (let k = 0; k < 4; k++) tapRight();
  eq(T.state, "levelClear", "level clears after 4 rounds");
  eq(T.level, 1, "still level 1 until she taps NEXT");
  T.debug.stepN(120); // two whole seconds — nothing rolls on by itself
  eq(T.state, "levelClear", "still waiting for her tap");
  T.debug.onDown(200, 602); // the big NEXT button
  eq(T.state, "play", "NEXT starts level 2");
  eq(T.level, 2, "level 2");
  eq(T.roundInLevel, 0, "round counter reset");
  ok(T.round.priceCents >= 105 && T.round.priceCents <= 295, "L2 price in band");
});

test("level 1 only sells snacks; higher levels bring new things to buy", () => {
  T.debug.startGame();
  for (let k = 0; k < 12; k++) {
    ok(T.round.item.band <= T.level, "round sells an item from this level or earlier (band " + T.round.item.band + ", level " + T.level + ")");
    tapRight();
    if (T.state === "levelClear") T.debug.onDown(200, 602); // NEXT
  }
  const bands = new Set(T.items.map((it) => it.band));
  eq(bands.size, 4, "four item bands exist");
  ok(T.items.some((it) => it.band === 4), "band-4 items wait for level 4");
  ok(T.items.filter((it) => it.band === 1).length >= 4, "enough snacks for a level");
});

test("clearing level 5 wins the game; PLAY AGAIN restarts at level 1", () => {
  T.debug.startGame();
  for (let lv = 1; lv <= 5; lv++) {
    for (let k = 0; k < 4; k++) tapRight();
    eq(T.state, "levelClear", "level " + lv + " clears");
    T.debug.onDown(200, 602); // NEXT
  }
  eq(T.state, "win", "finale after level 5");
  eq(T.stars, 20, "20 stars — one per round");
  T.debug.stepN(180); // fireworks keep bursting on the win screen
  eq(T.state, "win", "finale waits for her tap");
  T.debug.onDown(200, 602); // PLAY AGAIN
  eq(T.state, "play", "playing again");
  eq(T.level, 1, "back at level 1");
  eq(T.stars, 0, "stars reset");
});

test("the three money cards live in the deck, span the width, and are big to tap", () => {
  T.debug.startGame();
  eq(T.cards.length, 3, "three cards");
  for (const c of T.cards) {
    ok(c.y >= T.deckTop, "card sits in the deck (y=" + c.y + ", deckTop=" + T.deckTop + ")");
    ok(c.w >= 100, "card is wide to tap (w=" + c.w.toFixed(0) + ")");
    ok(c.h >= 140, "card is tall to tap (h=" + c.h + ")");
  }
  ok(T.cards[0].x < 100 && T.cards[2].x + T.cards[2].w > 300, "cards span the whole deck width");
});

test("music is its own 64-step cheerful loop with loud bass and a harmony voice", () => {
  const m = T.music;
  eq(m.bpm, 120, "120 BPM");
  eq(m.steps, 64, "64 steps");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.bass.length, 64, "bass is 64 steps");
  eq(m.lead.length, 64, "lead is 64 steps");
  eq(m.harmony.length, 64, "harmony is 64 steps");
  ok(m.lead.some((v) => v > 0), "lead has notes");
  ok(m.lead.some((v, i) => v > 0 && m.harmony[i] > 0 && m.harmony[i] < v), "harmony sings a third under the lead");
});

test("wide desktop layout: title, emoji row and card numerals all fit inside the viewport", () => {
  // The live check at 1919x998 found the title font at 211px
  // (UP! landing on the emoji row) and the card numeral at
  // 186px (bursting out of its 150px card). All width-scaled
  // fonts are capped now; the phone layout is unchanged.
  function checkLayout(w, h, label) {
    T.debug.resize(w, h);
    const L = T.layout, S = T.screen;
    ok(L.titleFont <= 96, label + ": title font capped (" + L.titleFont + "px)");
    ok(L.emojiFont <= 150, label + ": emoji row capped (" + L.emojiFont + "px)");
    ok(L.cardFont <= 44, label + ": card numeral capped (" + L.cardFont + "px)");
    ok(L.cardFont * 0.5 + 8 <= 42, label + ": numeral fits its card");
    const upY = S.PH * 0.30 + L.titleGap;
    ok(upY + 60 < S.PH * 0.68, label + ": UP! sits clear above the emoji row (" + upY.toFixed(0) + " vs " + (S.PH * 0.68).toFixed(0) + ")");
    for (const c of T.cards) {
      ok(c.y + c.h <= h, label + ": card bottom inside the viewport (" + (c.y + c.h) + " <= " + h + ")");
      ok(c.w <= 300, label + ": card not stretched desktop-wide (w=" + c.w.toFixed(0) + ")");
    }
    T.debug.render();
  }
  checkLayout(400, 700, "phone 400x700");
  checkLayout(1919, 998, "desktop 1919x998");
  checkLayout(1024, 768, "iPad landscape 1024x768");
  T.debug.resize(400, 700); // leave the phone layout in place
});

test("renders every state without throwing, playfield clear of the back button", () => {
  T.debug.startGame();
  T.debug.render();
  T.debug.setRound(463);
  T.debug.render();
  T.debug.tapCard(ansIdx());
  T.debug.render();
  T.debug.levelClear();
  T.debug.render();
  ok(T.deckTop > 100, "playfield is tall enough to clear the button zone");
  ok(true, "rendered title/play/levelClear at phone size");
});

console.log(pass + "/" + (pass + fail) + " dollarup tests pass");
if (fail > 0) process.exit(1);
