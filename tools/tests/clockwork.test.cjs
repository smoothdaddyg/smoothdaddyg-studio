/* Node test for Clockwork! (#27, window.__cwTest).
   His daughter's time worksheets as a game: whole hours,
   quarter past / quarter to, the AM/PM sort (school bus,
   breakfast, brushing teeth, recess = AM; sunset, dinner,
   homework, leaving school = PM), and elapsed time
   (12:00 + 45 = 12:45, 1:00 + 35 = 1:35, 1:00 + 40 = 1:40,
   2:00 + 10 = 2:10). All tap-to-answer, numerals and pictures
   only, no words in the game. Wrong tap wiggles, no penalty,
   no game over ever. Level clears only on HER tap on NEXT.
   Finale after L5. Original 132 BPM tick-tock waltz in G major
   (48 steps, bass 0.2, harmony voice).
   Run: node tools/tests/clockwork.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "clockwork", "game.js");

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
const T = sandbox.window.__cwTest;
if (!T) { console.error("FAIL: no __cwTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }
function timeStr(t) { return T.fmtTime(t.h, t.m); }

// Answer the current clock/elapsed question right, whatever it is.
function answerRight() {
  const before = T.qIdx;
  T.answerChoice(T.q.correct);
  T.stepN(60);
  return before;
}
// Play a whole level by answering every question right, then
// tapping NEXT (or, on L5, reaching the win screen).
function playLevel(n) {
  T.dealLevel(n);
  const total = T.qTotal;
  for (let i = 0; i < total; i++) {
    eq(T.qIdx, i, "L" + n + " on question " + (i + 1) + " of " + total);
    if (T.q.kind === "sort") {
      sortAllRight();
    } else {
      answerRight();
    }
  }
  return T.state;
}
function sortAllRight() {
  // Pick each card up and drop it in its own bucket.
  for (let round = 0; round < 20 && T.q.sortedCount < T.q.cards.length; round++) {
    const i = T.q.cards.findIndex((c) => !c.sorted);
    if (i < 0) break;
    T.pickCard(i);
    T.dropBucket(T.q.cards[i].side);
  }
  eq(T.q.sortedCount, T.q.cards.length, "all sort cards landed");
  T.stepN(60);
}

test("boots on the title screen; starting deals level 1, whole hours, 4 questions", () => {
  eq(T.state, "title", "starts on title");
  T.startGame();
  eq(T.state, "play", "playing after start");
  eq(T.level, 1, "level 1");
  eq(T.qTotal, 4, "four questions");
  eq(T.qIdx, 0, "first question");
  eq(T.q.kind, "clock", "L1 asks clock questions");
  eq(T.q.prompt.m, 0, "L1 is whole hours only (" + timeStr(T.q.prompt) + ")");
});

test("elapsed-time math: the worksheet's own rows, plus hour crossings", () => {
  eq(timeStr(T.addMinutes(12, 0, 45)), "12:45", "cupcake 12:00 + 45 = 12:45");
  eq(timeStr(T.addMinutes(1, 0, 35)), "1:35", "cinnamon roll 1:00 + 35 = 1:35");
  eq(timeStr(T.addMinutes(1, 0, 40)), "1:40", "cupcake 1:00 + 40 = 1:40");
  eq(timeStr(T.addMinutes(2, 0, 10)), "2:10", "sandwich 2:00 + 10 = 2:10");
  eq(timeStr(T.addMinutes(11, 30, 45)), "12:15", "11:30 + 45 crosses the hour to 12:15");
  eq(timeStr(T.addMinutes(3, 30, 30)), "4:00", "3:30 + 30 lands on the hour");
  eq(timeStr(T.addMinutes(12, 30, 30)), "1:00", "12:30 + 30 = 1:00");
});

test("clock questions: the right clock is always among the three, wrongs are plausible but wrong", () => {
  for (let round = 0; round < 60; round++) {
    const q = T.makeClockQ([0]);
    eq(q.choices.length, 3, "three clocks to tap");
    eq(q.choices.filter((c) => T.sameTime(c, q.prompt)).length, 1, "exactly one clock shows " + timeStr(q.prompt));
    eq(q.choices[q.correct].m, 0, "whole-hour question, minute is :00");
    for (let i = 0; i < 3; i++) {
      if (i !== q.correct) ok(!T.sameTime(q.choices[i], q.prompt), "wrong clock " + timeStr(q.choices[i]) + " is not " + timeStr(q.prompt));
    }
    ok(new Set(q.choices.map((c) => timeStr(c))).size === 3, "three distinct clocks");
  }
  for (let round = 0; round < 60; round++) {
    const q = T.makeClockQ([15, 45]);
    ok(q.prompt.m === 15 || q.prompt.m === 45, "quarter question is :15 or :45 (" + timeStr(q.prompt) + ")");
    eq(q.choices.filter((c) => T.sameTime(c, q.prompt)).length, 1, "exactly one clock shows " + timeStr(q.prompt));
    ok(new Set(q.choices.map((c) => timeStr(c))).size === 3, "three distinct clocks");
  }
});

test("the worksheet's quarter hours all appear as generatable prompts", () => {
  const seen = new Set();
  for (let round = 0; round < 200; round++) {
    const q = T.makeClockQ([15, 45]);
    seen.add(timeStr(q.prompt));
  }
  for (const t of ["2:15", "6:15", "7:45", "3:45", "7:15", "12:45", "6:45", "5:15"]) {
    ok(seen.has(t), "quarter hour " + t + " can come up");
  }
  const whole = new Set();
  for (let round = 0; round < 200; round++) whole.add(timeStr(T.makeClockQ([0]).prompt));
  for (const t of ["3:00", "7:00", "2:00", "5:00", "8:00", "12:00", "10:00", "4:00", "11:00"]) {
    ok(whole.has(t), "whole hour " + t + " can come up");
  }
});

test("elapsed questions: start on the hour/half hour, end inside the half-day, wrongs are near-misses", () => {
  for (let round = 0; round < 60; round++) {
    const q = T.makeElapsedQ();
    ok(q.start.m === 0 || q.start.m === 30, "start is on the hour or half hour (" + timeStr(q.start) + ")");
    ok([10, 15, 20, 25, 30, 35, 40, 45, 50].includes(q.add), "+ " + q.add + " min is a worksheet-style step");
    const end = T.addMinutes(q.start.h, q.start.m, q.add);
    eq(q.choices.filter((c) => T.sameTime(c, end)).length, 1, "exactly one end time is " + timeStr(end) + " (start " + timeStr(q.start) + " +" + q.add + ")");
    ok(new Set(q.choices.map((c) => timeStr(c))).size === 3, "three distinct end times");
    for (let i = 0; i < 3; i++) {
      if (i !== q.correct) ok(!T.sameTime(q.choices[i], end), "wrong end " + timeStr(q.choices[i]) + " is not " + timeStr(end));
    }
  }
});

test("the AM/PM sort has all 8 worksheet cards, classified right", () => {
  const all = T.sortCards;
  eq(all.length, 8, "eight sort cards");
  eq(all.filter((c) => c.side === "AM").length, 4, "four AM cards");
  eq(all.filter((c) => c.side === "PM").length, 4, "four PM cards");
  for (let round = 0; round < 20; round++) {
    const q = T.makeSortQ(8);
    eq(q.cards.length, 8, "eight cards dealt");
    eq(q.cards.filter((c) => c.side === "AM").length, 4, "four AM in the deal");
    eq(q.cards.filter((c) => c.side === "PM").length, 4, "four PM in the deal");
    const q4 = T.makeSortQ(4);
    eq(q4.cards.length, 4, "L5 mini-sort deals four");
    eq(q4.cards.filter((c) => c.side === "AM").length, 2, "two AM in the mini-sort");
    eq(q4.cards.filter((c) => c.side === "PM").length, 2, "two PM in the mini-sort");
  }
});

test("wrong tap does not advance; right tap does — and the level waits for NEXT", () => {
  T.startGame();
  const wrong = (T.q.correct + 1) % 3;
  T.answerChoice(wrong);
  eq(T.qIdx, 0, "wrong tap stays on question 1");
  T.stepN(120);
  eq(T.state, "play", "wrong tap never clears anything");
  answerRight();
  eq(T.qIdx, 1, "right tap moves to question 2");
  // Answer the rest of L1 right.
  answerRight(); answerRight(); answerRight();
  eq(T.state, "levelClear", "level clears after the last right answer");
  T.stepN(300);
  eq(T.state, "levelClear", "still waiting — nothing rolls on by itself");
  const b = T.nextBtn;
  T.onDown(b.x, b.y);
  eq(T.state, "play", "NEXT starts the next level");
  eq(T.level, 2, "level 2");
  eq(T.qIdx, 0, "fresh questions");
});

test("L2 is quarter past / quarter to only", () => {
  T.dealLevel(2);
  eq(T.qTotal, 4, "four questions");
  for (let i = 0; i < 4; i++) {
    ok(T.q.prompt.m === 15 || T.q.prompt.m === 45, "L2 question " + (i + 1) + " is :15 or :45 (" + timeStr(T.q.prompt) + ")");
    answerRight();
  }
  eq(T.state, "levelClear", "L2 clears");
});

test("L3 sort: wrong bucket wiggles and the card stays; right bucket lands it; all 8 clear the level", () => {
  T.dealLevel(3);
  eq(T.q.kind, "sort", "L3 is the sort");
  eq(T.q.cards.length, 8, "eight cards");
  const i = 0;
  const side = T.q.cards[i].side;
  const wrongSide = side === "AM" ? "PM" : "AM";
  T.pickCard(i);
  eq(T.selCard, i, "card picked up");
  T.dropBucket(wrongSide);
  eq(T.q.cards[i].sorted, false, "wrong bucket: card stays unsorted");
  eq(T.q.sortedCount, 0, "no progress from a wrong bucket");
  eq(T.selCard, i, "still holding the card — try the other bucket");
  T.dropBucket(side);
  eq(T.q.cards[i].sorted, true, "right bucket lands it");
  eq(T.q.sortedCount, 1, "one sorted");
  sortAllRight();
  eq(T.state, "levelClear", "all 8 sorted clears L3");
  T.stepN(300);
  eq(T.state, "levelClear", "waits for NEXT");
  const b = T.nextBtn;
  T.onDown(b.x, b.y);
  eq(T.level, 4, "NEXT goes to L4");
});

test("tapping a bucket with nothing picked up sorts nothing", () => {
  T.dealLevel(3);
  T.dropBucket("AM");
  eq(T.q.sortedCount, 0, "no card, no sort");
  T.pickCard(0);
  T.pickCard(0); // tap again to put it down
  eq(T.selCard, -1, "tapping the held card again puts it down");
  T.dropBucket(T.q.cards[0].side);
  eq(T.q.sortedCount, 0, "still nothing sorted");
});

test("L4 is four elapsed-time questions with food pictures", () => {
  T.dealLevel(4);
  eq(T.qTotal, 4, "four questions");
  for (let i = 0; i < 4; i++) {
    eq(T.q.kind, "elapsed", "L4 question " + (i + 1) + " is elapsed time");
    ok(T.q.food && T.q.food.e, "a food picture shows");
    answerRight();
  }
  eq(T.state, "levelClear", "L4 clears");
});

test("L5 is a 5-question mixed grand round with golden clock faces", () => {
  T.dealLevel(5);
  eq(T.qTotal, 5, "five questions");
  const kinds = new Set(T.plan);
  ok(kinds.has("whole") || kinds.has("quarter"), "L5 mixes in clock questions");
  ok(kinds.has("elapsed"), "L5 mixes in an elapsed question");
  ok(kinds.has("sort4"), "L5 mixes in the mini-sort");
  eq(T.faceColorFor(15, 5), "#ffd94d", "L5 faces are gold, not quarter-yellow");
  eq(T.faceColorFor(0, 1), "#b8f5c8", "L1 on-the-hour faces are worksheet green");
  eq(T.faceColorFor(15, 2), "#fff3a0", "quarter-past faces are worksheet yellow");
  eq(T.faceColorFor(45, 2), "#ffb3c8", "quarter-to faces are worksheet red");
  for (let i = 0; i < 5; i++) {
    if (T.q.kind === "sort") sortAllRight();
    else answerRight();
  }
  eq(T.state, "win", "clearing L5 wins the game");
});

test("clearing all 5 levels wins; PLAY AGAIN restarts at level 1", () => {
  T.startGame();
  for (let lv = 1; lv <= 5; lv++) {
    eq(T.level, lv, "on level " + lv);
    const total = T.qTotal;
    for (let i = 0; i < total; i++) {
      if (T.q.kind === "sort") sortAllRight();
      else answerRight();
    }
    if (lv < 5) {
      eq(T.state, "levelClear", "level " + lv + " clears");
      const b = T.nextBtn;
      T.onDown(b.x, b.y);
      eq(T.state, "play", "NEXT starts level " + (lv + 1));
    } else {
      eq(T.state, "win", "level 5 wins the game");
    }
  }
  T.stepN(180);
  T.render();
  const b = T.playBtn;
  T.onDown(b.x, b.y);
  eq(T.state, "play", "PLAY AGAIN restarts");
  eq(T.level, 1, "back at level 1");
  eq(T.qIdx, 0, "first question again");
});

test("music is its own 48-step tick-tock waltz with loud bass and a harmony voice", () => {
  const m = T.music;
  eq(m.steps, 48, "48 steps");
  eq(m.bpm, 132, "132 BPM");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.lead.length, 48, "lead is 48 steps");
  eq(m.bass.length, 48, "bass is 48 steps");
  eq(m.harmony.length, 48, "harmony is 48 steps");
  ok(m.lead.some((n) => n > 0), "lead sings");
  ok(m.harmony.some((n) => n > 0), "harmony sings under it");
  ok(m.lead.join() !== m.bass.join(), "lead and bass are different lines");
  eq(m.kicks.join(), [0, 12, 24, 36].join(), "kick on beat 1 of each waltz bar");
  ok(m.snares.length === 8, "snare on beats 2 and 3");
  // The waltz bass walks home: last bar ends on the root.
  eq(m.bass[44], 98, "final bar resolves to G (98 Hz)");
});

test("the music loop actually starts and ticks once the game starts", () => {
  T.fresh();
  const s0 = T.musicState.step;
  T.startGame();
  ok(T.musicState.on, "loop starts with the game (not just configured)");
  T.stepN(30);
  ok(T.musicState.step > s0, "loop ticks while playing");
});

test("wide desktop layout: prompt, clocks, cards and buckets all fit, fonts capped", () => {
  function checkLayout(w, h, label) {
    T.resize(w, h);
    const L = T.layout, S = T.screen;
    ok(L.promptFont <= 72, label + ": prompt font capped (" + L.promptFont + "px)");
    ok(L.choiceFont <= 44, label + ": choice font capped (" + L.choiceFont + "px)");
    ok(L.titleClock <= 220, label + ": title clock capped (" + L.titleClock + "px)");
    T.fresh(); T.render();
    T.startGame(); T.render();
    // Clock choices sit below the back button and inside the playfield.
    for (const g of T.choiceGeom) {
      ok(g.y - g.r >= 104, label + ": clock top clear of the back button (" + (g.y - g.r).toFixed(0) + " >= 104)");
      ok(g.y + g.r < S.PH, label + ": clock bottom inside the playfield");
      ok(g.x - g.r >= 0 && g.x + g.r <= w, label + ": clock inside the viewport");
    }
    // Sort cards and buckets.
    T.dealLevel(3); T.render();
    for (const g of T.sortGeom) {
      ok(g.y >= 104, label + ": sort card top clear of the back button");
      ok(g.y + g.h < S.PH, label + ": sort card inside the playfield");
    }
    ok(T.bucketGeom.AM.x >= 0 && T.bucketGeom.PM.x + T.bucketGeom.PM.w <= w, label + ": buckets inside the viewport");
    ok(T.bucketGeom.AM.x < T.bucketGeom.PM.x, label + ": sun bucket left, moon bucket right");
    // Elapsed choices.
    T.dealLevel(4); T.render();
    for (const g of T.choiceGeom) {
      ok(g.y >= 104, label + ": end-time card top clear of the back button");
      ok(g.y + g.h < S.PH, label + ": end-time card inside the playfield");
    }
  }
  checkLayout(400, 700, "phone 400x700");
  checkLayout(1919, 998, "desktop 1919x998");
  checkLayout(1024, 768, "iPad landscape 1024x768");
  T.resize(400, 700); // leave the phone layout in place
});

test("renders every state without throwing, playfield clear of the back button", () => {
  T.fresh(); T.render();
  T.startGame(); T.render();
  T.dealClock({ h: 3, m: 0 }, [{ h: 5, m: 0 }, { h: 7, m: 0 }]); T.render();
  T.answerChoice(T.q.correct); T.stepN(60); T.render();
  T.dealElapsed({ h: 12, m: 0 }, 45, [{ h: 10, m: 45 }, { h: 12, m: 30 }]); T.render();
  T.answerChoice(T.q.correct); T.stepN(60); T.render();
  T.dealSort(T.sortCards); T.render();
  sortAllRight(); T.render();
  eq(T.state, "levelClear", "sort level-clear renders");
  T.levelClear(); T.render();
  T.winGame(); T.render();
  eq(T.state, "win", "win renders");
  T.stepN(120); T.render();
  for (const g of T.choiceGeom) ok(g.y >= 0, "choice geometry exists after renders");
});

console.log(pass + "/" + (pass + fail) + " clockwork tests pass");
if (fail) process.exit(1);
