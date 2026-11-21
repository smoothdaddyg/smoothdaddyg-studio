/* Node test for Dollar Up! v2 (window.__duTest).
   Danny's 2026-11-19 correction: the worksheet gives FOUR items
   with receipt prices and FOUR whole-dollar amounts, and the job
   is to buy them ALL. Any bill that covers a price CAN buy that
   item — a $5 bill buys a $2 juice just fine — but each bill is
   spent once, so the $5 on the juice leaves the $4.63 cupcake
   with nothing that covers it. The game is the allocation:
   which bill goes where so everything gets bought. v1 demanded
   the single smallest amount per item; that was the wrong game.
   v2: four items in a 2x2 grid up top, four money cards in the
   deck. Tap a money card to pick it up, tap an item to spend it.
   Too small wiggles; tap a bought item to take its money back
   and rearrange. Buy all four, level clears (waits for HER tap
   on NEXT), finale after L5. No penalty, no game over ever.
   Each level deals four DISTINCT amounts, each price strictly
   inside one dollar band, so the intended match is the ONLY
   full allocation. 5 levels, new things to buy each level.
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
const T = sandbox.window.__duTest;
if (!T) { console.error("FAIL: no __duTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }

// Her worksheet's exact four rows, dealt in order.
function dealWorksheet() {
  T.deal([1, 2, 4, 5], [95, 175, 393, 463], [0, 2, 1, 3]);
  // tiles: 0 taco $0.95, 1 juice $1.75, 2 ice cream $3.93, 3 cupcake $4.63
}
function deckIdx(amount) {
  return T.deck.findIndex((d) => d.amount === amount);
}
function buy(amount, tileIdx) {
  T.selectDeck(deckIdx(amount));
  T.placeOnTile(tileIdx);
}
function buyIntended() {
  // taco $1, juice $2, ice cream $4, cupcake $5
  buy(1, 0); buy(2, 1); buy(4, 2); buy(5, 3);
}
function perms(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of perms(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}

test("boots on the title screen; starting deals four things and four bills", () => {
  eq(T.state, "title", "starts on title");
  T.startGame();
  eq(T.state, "play", "playing after start");
  eq(T.level, 1, "level 1");
  eq(T.stars, 0, "nothing bought yet");
  eq(T.tiles.length, 4, "four things to buy");
  eq(T.deck.length, 4, "four bills to spend");
  const amounts = T.deck.map((d) => d.amount).sort((a, b) => a - b);
  eq(new Set(amounts).size, 4, "four DISTINCT amounts (" + amounts.join(",") + ")");
  for (const t of T.tiles) {
    ok(t.priceCents % 100 !== 0, "price is never a whole dollar ($" + (t.priceCents / 100).toFixed(2) + ")");
    eq(t.need, T.dollarUp(t.priceCents), "each thing's dollar-up is its intended bill");
  }
});

test("dollarUp rounds the price UP to the next whole dollar — the worksheet's rule", () => {
  eq(T.dollarUp(95), 1, "$0.95 -> $1");
  eq(T.dollarUp(100), 1, "$1.00 -> $1");
  eq(T.dollarUp(101), 2, "$1.01 -> $2");
  eq(T.dollarUp(463), 5, "$4.63 -> $5");
  eq(T.dollarUp(500), 5, "$5.00 -> $5");
});

test("her worksheet's four rows all dollar-up to the money on the right", () => {
  const rows = [[95, 1], [393, 4], [175, 2], [463, 5]];
  for (const [price, money] of rows) {
    eq(T.dollarUp(price), money, "$" + (price / 100).toFixed(2) + " -> $" + money);
  }
});

test("the intended match is the ONLY way to buy everything (brute-forced)", () => {
  for (let round = 0; round < 20; round++) {
    T.startGame();
    const amounts = T.deck.map((d) => d.amount);
    let full = 0;
    for (const p of perms(amounts)) {
      const coversAll = T.tiles.every((t, i) => p[i] * 100 >= t.priceCents);
      if (coversAll) full++;
    }
    eq(full, 1, "exactly one full allocation (level " + T.level + ", round " + round + ")");
  }
});

test("a five dollar bill CAN buy a two dollar item — Danny's correction, pinned", () => {
  dealWorksheet();
  buy(5, 1); // $5 on the $1.75 juice
  eq(T.tiles[1].placed, 5, "$5 sticks on the juice — it covers the price");
  eq(T.stars, 1, "one thing bought, star earned");
  ok(T.deck.find((d) => d.amount === 5).placed, "$5 leaves the deck");
});

test("too little money can't buy it — the card wiggles, nothing is lost", () => {
  dealWorksheet();
  buy(1, 1); // $1 on the $1.75 juice
  eq(T.tiles[1].placed, 0, "juice stays unbought");
  eq(T.stars, 0, "no star, no progress");
  ok(!T.deck.find((d) => d.amount === 1).placed, "$1 stays in the deck to try elsewhere");
  buy(2, 1); // the right bill works right after
  eq(T.tiles[1].placed, 2, "juice bought with $2");
});

test("buying all four the intended way clears the level and waits for HER tap on NEXT", () => {
  dealWorksheet();
  buyIntended();
  eq(T.stars, 4, "all four bought");
  T.stepN(60);
  eq(T.state, "levelClear", "level clears after the celebration beat");
  T.stepN(300);
  eq(T.state, "levelClear", "still waiting — nothing rolls on by itself");
  const b = T.nextBtn;
  T.onDown(b.x, b.y);
  eq(T.state, "play", "NEXT starts the next level");
  eq(T.level, 2, "level 2");
  eq(T.stars, 0, "fresh set, nothing bought yet");
});

test("a wrong-but-covering spend dead-ends — and taking it back fixes it", () => {
  dealWorksheet();
  buy(5, 0); // $5 on the $0.95 taco: covers it, but now the cupcake is stuck
  eq(T.tiles[0].placed, 5, "$5 sticks on the taco");
  buy(1, 3); buy(2, 3); buy(4, 3); // nothing left covers the $4.63 cupcake
  eq(T.tiles[3].placed, 0, "cupcake can't be bought with what's left");
  eq(T.stars, 1, "only the taco is bought");
  // Take the $5 back off the taco and do it the intended way.
  T.placeOnTile(0);
  eq(T.tiles[0].placed, 0, "taco unbought again");
  ok(!T.deck.find((d) => d.amount === 5).placed, "$5 is back in the deck");
  buyIntended();
  eq(T.stars, 4, "all four bought after rearranging");
});

test("clearing level 5 wins the game; PLAY AGAIN restarts at level 1", () => {
  T.startGame();
  for (let lv = 1; lv <= 5; lv++) {
    eq(T.level, lv, "on level " + lv);
    for (let i = 0; i < 4; i++) {
      const t = T.tiles[i];
      buy(t.need, i);
    }
    eq(T.stars, 4, "level " + lv + " all bought");
    T.stepN(60);
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
  eq(T.stars, 0, "nothing bought yet");
});

test("level 1 only sells snacks; higher levels bring new things to buy", () => {
  T.startGame();
  for (const t of T.tiles) ok(t.item.band <= 1, "L1 sells a band-1 snack");
  const bands = new Set(T.items.map((it) => it.band));
  eq(bands.size, 4, "four item bands exist");
  ok(T.items.some((it) => it.band === 4), "band-4 items wait for level 4");
  ok(T.items.filter((it) => it.band === 1).length >= 4, "enough snacks for a level");
});

test("four money cards live in the deck and four tiles fill the playfield", () => {
  T.startGame();
  const H = T.screen.H;
  for (const c of T.cards) {
    ok(c.w >= 80, "card big to tap (w=" + c.w.toFixed(0) + ")");
    ok(c.y + c.h <= H, "card bottom inside the viewport");
  }
  ok(T.cards[0].x < 100, "first card near the left edge");
  ok(T.cards[3].x + T.cards[3].w > 300, "last card near the right edge");
  for (const g of T.tileGeom) {
    ok(g.w >= 150 && g.h >= 150, "tile big to tap (" + g.w.toFixed(0) + "x" + g.h.toFixed(0) + ")");
    ok(g.y + g.h < T.deckTop, "tile stays in the playfield, above the deck");
  }
  ok(T.tileGeom[0].x < T.tileGeom[1].x, "tiles lay out left to right");
  ok(T.tileGeom[0].y < T.tileGeom[2].y, "tiles lay out top to bottom");
});

test("wide desktop layout: title, emoji row and card numerals all fit inside the viewport", () => {
  function checkLayout(w, h, label) {
    T.resize(w, h);
    const L = T.layout, S = T.screen;
    ok(L.titleFont <= 96, label + ": title font capped (" + L.titleFont + "px)");
    ok(L.emojiFont <= 150, label + ": emoji row capped (" + L.emojiFont + "px)");
    ok(L.cardFont <= 44, label + ": card numeral capped (" + L.cardFont + "px)");
    ok(L.cardFont * 0.5 + 8 <= 42, label + ": numeral fits its card");
    const upY = S.PH * 0.30 + L.titleGap;
    ok(upY + 60 < S.PH * 0.68, label + ": UP! sits clear above the emoji row (" + upY.toFixed(0) + " vs " + (S.PH * 0.68).toFixed(0) + ")");
    for (const c of T.cards) {
      ok(c.y + c.h <= h, label + ": card bottom inside the viewport (" + (c.y + c.h) + " <= " + h + ")");
      ok(c.w <= 220, label + ": card not stretched desktop-wide (w=" + c.w.toFixed(0) + ")");
    }
    for (const g of T.tileGeom) {
      ok(g.y + g.h < S.PH, label + ": tile stays in the playfield");
      ok(g.w <= 320, label + ": tile not stretched desktop-wide (w=" + g.w.toFixed(0) + ")");
    }
    T.render();
  }
  checkLayout(400, 700, "phone 400x700");
  checkLayout(1919, 998, "desktop 1919x998");
  checkLayout(1024, 768, "iPad landscape 1024x768");
  T.resize(400, 700); // leave the phone layout in place
});

test("music is its own 64-step cheerful loop with loud bass and a harmony voice", () => {
  const m = T.music;
  eq(m.steps, 64, "64 steps");
  eq(m.bpm, 120, "120 BPM");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.lead.length, 64, "lead is 64 steps");
  eq(m.bass.length, 64, "bass is 64 steps");
  eq(m.harmony.length, 64, "harmony is 64 steps");
  ok(m.lead.some((n) => n > 0), "lead sings");
  ok(m.harmony.some((n) => n > 0), "harmony sings under it");
  ok(m.lead.join() !== m.bass.join(), "lead and bass are different lines");
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
  dealWorksheet(); buyIntended(); T.render();
  T.stepN(60); T.render();
  eq(T.state, "levelClear", "level-clear renders");
  T.levelClear(); T.render();
  T.winGame(); T.render();
  eq(T.state, "win", "win renders");
  // Nothing drawn over the top-left back button.
  for (const g of T.tileGeom) ok(g.x > 70 || g.y > 70, "no tile under the back button");
});

console.log(pass + "/" + (pass + fail) + " dollarup tests pass");
if (fail) process.exit(1);
