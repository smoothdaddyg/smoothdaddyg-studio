// Clockwork! (#27) — his daughter's time worksheets as a game.
//
// The worksheets: "Write the Time" (whole hours 3:00, 7:00, 2:00,
// 5:00, 8:00, 12:00, 10:00, 4:00, 11:00), "What's the Time?"
// (quarter hours 2:15, 6:15, 7:45, 3:45, 7:15, 12:45, 6:45,
// 5:15), "Sort the Time" (AM: school bus, breakfast, brushing
// teeth, recess; PM: sunset, dinner, homework, leaving school),
// "Color the Clock" (green = on the hour, yellow = quarter past,
// blue = half past, red = quarter to — the clock faces wear
// those colors here), and the elapsed-time sheet (cupcake 12:00
// + 45 = 12:45, cinnamon roll 1:00 + 35 = 1:35, cupcake 1:00 +
// 40 = 1:40, sandwich 2:00 + 10 = 2:10).
//
// Five levels, all tap-to-answer, no drawing hands, no reading:
// numerals and pictures only — not one word anywhere in the game.
//   L1 whole hours: a big digital time, three analog clocks, tap the match.
//   L2 quarter past / quarter to: same, with :15 and :45.
//   L3 AM/PM sort: 8 picture cards, sun bucket = AM, moon bucket = PM.
//      Tap a card to pick it up, tap a bucket to drop it. Wrong
//      bucket: the card wiggles and stays. All 8 sorted clears.
//   L4 end time: a food picture + start time + "+N min", three
//      digital end times, tap the right one. Starts on the hour
//      or half hour; answers may cross the hour, never the half-day.
//   L5 mixed grand round: 5 questions mixing L1-L4, golden clocks.
// A wrong tap just wiggles — no penalty, no game over, retry until
// right. Correct: star burst + ding, a progress dot lights up.
// A level clears only when SHE taps the big NEXT button (never
// auto-advance); clear L5 for the grand finale (fireworks +
// confetti until PLAY AGAIN restarts at L1).
(function () {
  "use strict";

  const CFG = {
    VERSION: "1.0.0",
    MAX_LEVEL: 5,
    BEAT: 0.7,    // celebration beat after the last question of a level
    WIGGLE_T: 0.5,
    PLAY_R: 46,
  };

  // ---- time helpers --------------------------------------------------
  // Times are {h: 1..12, m: 0|15|30|45}. Minutes are counted from
  // 12:00 so 12:xx sits at the start of the half-day, never the end.
  function fmtTime(h, m) {
    return h + ":" + (m < 10 ? "0" + m : "" + m);
  }
  function toMin(h, m) { return ((h % 12) * 60) + m; }
  function fromMin(total) {
    const t = ((total % 720) + 720) % 720;
    let h = Math.floor(t / 60);
    if (h === 0) h = 12;
    return { h: h, m: t % 60 };
  }
  function addMinutes(h, m, add) { return fromMin(toMin(h, m) + add); }
  function sameTime(a, b) { return a.h === b.h && a.m === b.m; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // The sort cards, straight off the "Sort the Time" worksheet.
  // Pictures only — the cards carry no words at all.
  const SORT_CARDS = [
    { e: "\u{1F68C}", side: "AM" }, // school bus — going to school
    { e: "\u{1F373}", side: "AM" }, // breakfast
    { e: "\u{1FAA5}", side: "AM" }, // brushing teeth
    { e: "\u{1F6DD}", side: "AM" }, // recess (playground slide)
    { e: "\u{1F307}", side: "PM" }, // sunset
    { e: "\u{1F35D}", side: "PM" }, // dinner (spaghetti)
    { e: "\u270F\uFE0F", side: "PM" }, // homework (pencil)
    { e: "\u{1F392}", side: "PM" }, // leaving school (backpack)
  ];
  // The cooking foods, off the elapsed-time sheet (plus two more
  // for L4's later questions so every round brings a new dish).
  const FOODS = [
    { e: "\u{1F9C1}" }, // cupcake
    { e: "\u{1F950}" }, // cinnamon roll (croissant — closest picture)
    { e: "\u{1F96A}" }, // sandwich
    { e: "\u{1F355}" }, // pizza
    { e: "\u{1F36A}" }, // cookie
    { e: "\u{1F370}" }, // cake
  ];
  const ELAPSED_ADDS = [10, 15, 20, 25, 30, 35, 40, 45, 50];

  // ---- sound: the shared chiptune system (js/chiptune.js) ---------
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  function sndTick() { tone(660, 0.06, { type: "square", vol: 0.08 }); }
  function sndDing() {
    tone(880, 0.12, { type: "square", vol: 0.12 });
    tone(1318, 0.18, { type: "square", vol: 0.10, when: 0.07 });
  }
  function sndPop() {
    tone(520, 0.09, { type: "triangle", vol: 0.10 });
    tone(780, 0.12, { type: "triangle", vol: 0.08, when: 0.05 });
  }
  function sndBoop() { tone(220, 0.14, { type: "sine", vol: 0.10 }); }
  function sndWin() { arp([523, 659, 784, 1046, 1318], 0.11, "square", 0.10); }
  // A tick-tock: two quick clock ticks, high then low.
  function sndTickTock() {
    tone(1200, 0.05, { type: "square", vol: 0.07 });
    tone(800, 0.05, { type: "square", vol: 0.07, when: 0.12 });
  }

  // ---- music: an ORIGINAL tick-tock waltz, composed here -----------
  // G major, 3/4 — oom-pah-pah bass (root on beat 1, fifth on 2
  // and 3, walking home to G at the end of the phrase), a singable
  // lead that climbs to the high D and steps back down, and a
  // harmony voice a third under the lead (the NES second pulse
  // channel). Kick on beat 1 of each bar, snare on beats 2 and 3,
  // hats ticking the off-beats like a clock. 48 sixteenth steps
  // at 132 BPM, bass LOUD at 0.2. Nothing like Dollar Up!'s
  // cheerful C-major bounce: different key, different meter,
  // different bass role (waltz pedal, not bounce).
  const G2 = 98, A2 = 110, B2 = 123.47, C3 = 130.81, D3 = 146.83, G3 = 196;
  const B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25,
        FS5 = 739.99, G5 = 783.99, A5 = 880, B5 = 987.77, D6 = 1174.66;
  const MUSIC_CFG = {
    bpm: 132, steps: 48, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 12, 24, 36], snares: [4, 8, 16, 20, 28, 32, 40, 44], hats: "odd",
    bass: [G2,0,0,0, D3,0,0,0, D3,0,0,0,
           C3,0,0,0, G3,0,0,0, G3,0,0,0,
           G2,0,0,0, D3,0,0,0, B2,0,0,0,
           D3,0,0,0, A2,0,0,0, G2,0,0,0],
    lead: [D5,0,G5,0, B5,0,A5,0, G5,0,E5,0,
           D5,0,E5,0, G5,0,A5,0, B5,0,A5,0,
           G5,0,A5,0, B5,0,D6,0, B5,0,G5,0,
           A5,0,G5,0, E5,0,D5,0, 0,0,G5,0],
    harmony: new Array(48).fill(0),
  };
  // Harmony: a third under the lead wherever the lead sings.
  (function () {
    const third = {};
    third[D5] = B4; third[E5] = C5; third[G5] = E5;
    third[A5] = FS5; third[B5] = G5; third[D6] = B5;
    for (let i = 0; i < 48; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }

  // ---- canvas --------------------------------------------------------
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  let W = 400, H = 700, DPR = 1, DECK_H = 200, PH = 500;
  let choiceGeom = []; // clocks: {x, y, r} | digital: {x, y, w, h}
  let sortGeom = [];   // {x, y, w, h} per sort card
  let bucketGeom = { AM: null, PM: null }; // {x, y, w, h} in the deck
  let playBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  let nextBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  // LAY: every font that scales with the screen is capped here.
  let LAY = { titleClock: 150, promptFont: 56, choiceFont: 34, cardEmoji: 64,
    bucketEmoji: 64, winStars: 96, levelFont: 30, foodEmoji: 72,
    clockNum: 15, levelDigit: 44 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.28, 190, 220));
    PH = H - DECK_H;
    // Three clock choices in a row across the playfield.
    const clockR = Math.round(Math.min((W - 60) / 6, (PH - 300) / 2, 120));
    const clockY = Math.round(104 + 78 + clockR + 30);
    choiceGeom = [0, 1, 2].map((i) => ({
      x: Math.round(W * (1 + 2 * i) / 6), y: clockY, r: clockR,
    }));
    // Sort cards: 4 across x 2 down, in the playfield.
    const sGap = 12;
    const sw = Math.min((W - sGap * 5) / 4, 170);
    const sh = Math.min(120, (PH - 104 - 60 - sGap) / 2);
    const sx = (W - (sw * 4 + sGap * 3)) / 2;
    sortGeom = [];
    for (let i = 0; i < 8; i++) {
      sortGeom.push({
        x: sx + (i % 4) * (sw + sGap),
        y: 104 + Math.floor(i / 4) * (sh + sGap),
        w: sw, h: sh,
      });
    }
    // Buckets: sun (AM) left, moon (PM) right, mirrored in the deck.
    const bGap = 16, bw = (W - bGap * 3) / 2;
    bucketGeom = {
      AM: { x: bGap, y: PH + 18, w: bw, h: DECK_H - 36 },
      PM: { x: bGap * 2 + bw, y: PH + 18, w: bw, h: DECK_H - 36 },
    };
    playBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    nextBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    LAY = {
      titleClock: Math.round(Math.min(W * 0.42, PH * 0.34, 220)),
      promptFont: Math.round(Math.min(W * 0.14, 72)),
      choiceFont: Math.round(Math.min(W * 0.085, 44)),
      cardEmoji: Math.round(Math.min(sw * 0.55, 72)),
      bucketEmoji: Math.round(Math.min(bw * 0.30, 84)),
      winStars: Math.round(Math.min(W * 0.24, 150)),
      levelFont: Math.round(Math.min(W * 0.075, 64)),
      foodEmoji: Math.round(Math.min(W * 0.18, 96)),
      clockNum: Math.round(clamp(clockR * 0.24, 10, 22)),
      levelDigit: 44,
    };
  }

  // ---- game state ----------------------------------------------------
  let state = "title"; // title | play | levelClear | win
  let level = 1;
  let qIdx = 0, qTotal = 4; // questions answered / in this level
  let plan = []; // question kinds for this level
  let q = null;  // current question
  let selCard = -1; // sort: the card picked up, -1 = none
  let beatT = 0, pendingNext = false;
  let wiggle = null; // {kind: "choice"|"card"|"bucket", idx, t}
  let flash = null;  // {t} — star flash after a correct answer

  // The clock faces wear the "Color the Clock" colors: green on
  // the hour, yellow quarter past, blue half past, red quarter to.
  // L5's grand round turns every face gold.
  function faceColorFor(m, lv) {
    if (lv >= 5) return "#ffd94d";
    if (m === 0) return "#b8f5c8";
    if (m === 15) return "#fff3a0";
    if (m === 30) return "#a8d8ff";
    return "#ffb3c8"; // :45
  }
  function rimColorFor(m, lv) {
    if (lv >= 5) return "#ff9d00";
    if (m === 0) return "#22a355";
    if (m === 15) return "#d8a900";
    if (m === 30) return "#1f6fd6";
    return "#d6336c";
  }

  // A clock question: one true time, two plausible-but-wrong ones
  // (same minute, a different hour — or the same hour, a different
  // quarter, so neither the hour hand nor the minute hand alone
  // gives it away).
  function makeClockQ(minSet) {
    const m = pick(minSet);
    const h = 1 + Math.floor(Math.random() * 12);
    const correct = { h: h, m: m };
    const cands = [];
    for (let dh = -3; dh <= 3; dh++) {
      if (dh === 0) continue;
      const hh = ((h - 1 + dh + 12) % 12) + 1;
      cands.push({ h: hh, m: m });
    }
    for (const mm of minSet) {
      if (mm !== m) cands.push({ h: h, m: mm });
    }
    shuffle(cands);
    const wrongs = [];
    for (const c of cands) {
      if (wrongs.length >= 2) break;
      if (!wrongs.some((w) => sameTime(w, c))) wrongs.push(c);
    }
    const choices = shuffle([correct].concat(wrongs));
    return {
      kind: "clock", prompt: correct,
      choices: choices,
      correct: choices.findIndex((c) => sameTime(c, correct)),
    };
  }
  // An elapsed-time question, off the cooking sheet: start on the
  // hour or half hour, add minutes, end inside the same half-day.
  // Wrong ends are the worksheet's kind of near-miss: the right
  // minutes on the wrong hour, or the wrong minutes on the right hour.
  function makeElapsedQ() {
    const food = pick(FOODS);
    let start, end, add;
    for (let tries = 0; tries < 40; tries++) {
      const sh = 1 + Math.floor(Math.random() * 12);
      const sm = pick([0, 30]);
      add = pick(ELAPSED_ADDS);
      start = { h: sh, m: sm };
      end = addMinutes(sh, sm, add);
      // End must stay inside the half-day: never wrap past 11:59.
      if (toMin(sh, sm) + add <= 719) break;
    }
    // Safety net: if every roll crossed the half-day, fall back to
    // the worksheet's own first row (12:00 + 45 = 12:45).
    if (toMin(start.h, start.m) + add > 719) {
      start = { h: 12, m: 0 }; add = 45;
      end = addMinutes(12, 0, 45);
    }
    const cands = [
      { h: end.h === 12 ? 11 : end.h + 1, m: end.m },
      { h: end.h === 1 ? 2 : end.h - 1, m: end.m },
      { h: end.h, m: (end.m + 15) % 60 === end.m ? (end.m + 30) % 60 : (end.m + 15) % 60 },
      { h: end.h, m: (end.m + 45) % 60 },
      { h: start.h, m: start.m },
    ];
    shuffle(cands);
    const wrongs = [];
    for (const c of cands) {
      if (wrongs.length >= 2) break;
      if (!sameTime(c, end) && !wrongs.some((w) => sameTime(w, c))) wrongs.push(c);
    }
    const choices = shuffle([end].concat(wrongs));
    return {
      kind: "elapsed", food: food, start: start, add: add,
      choices: choices,
      correct: choices.findIndex((c) => sameTime(c, end)),
    };
  }
  // A sort question: 8 cards (L3) or 4 (the L5 mini-sort).
  function makeSortQ(n) {
    const ams = shuffle(SORT_CARDS.filter((c) => c.side === "AM").slice());
    const pms = shuffle(SORT_CARDS.filter((c) => c.side === "PM").slice());
    const half = n / 2;
    const cards = shuffle(ams.slice(0, half).concat(pms.slice(0, half)))
      .map((c) => ({ e: c.e, side: c.side, sorted: false }));
    return { kind: "sort", cards: cards, sortedCount: 0 };
  }
  function buildQuestion(kind) {
    if (kind === "whole") return makeClockQ([0]);
    if (kind === "quarter") return makeClockQ([15, 45]);
    if (kind === "elapsed") return makeElapsedQ();
    if (kind === "sort") return makeSortQ(8);
    if (kind === "sort4") return makeSortQ(4);
    return makeClockQ([0]);
  }
  function makeLevel(n) {
    if (n === 1) return { plan: ["whole", "whole", "whole", "whole"], qTotal: 4 };
    if (n === 2) return { plan: ["quarter", "quarter", "quarter", "quarter"], qTotal: 4 };
    if (n === 3) return { plan: ["sort"], qTotal: 1 };
    if (n === 4) return { plan: ["elapsed", "elapsed", "elapsed", "elapsed"], qTotal: 4 };
    // L5: one of each kind, golden clocks — the grand round.
    return { plan: shuffle(["whole", "quarter", "elapsed", "sort4", "quarter"]), qTotal: 5 };
  }

  function startGame() {
    level = 1; qIdx = 0; selCard = -1;
    beatT = 0; pendingNext = false; wiggle = null; flash = null;
    const lv = makeLevel(1);
    plan = lv.plan; qTotal = lv.qTotal;
    q = buildQuestion(plan[0]);
    state = "play";
    if (MUSIC) { try { MUSIC.start(); } catch (e) {} }
    if (window.SDGplays) window.SDGplays.played("clockwork");
  }
  function nextLevel() {
    level++;
    qIdx = 0; selCard = -1;
    beatT = 0; pendingNext = false; wiggle = null; flash = null;
    const lv = makeLevel(level);
    plan = lv.plan; qTotal = lv.qTotal;
    q = buildQuestion(plan[0]);
    state = "play";
  }
  function levelClear() {
    state = "levelClear";
    sndWin();
  }
  function winGame() {
    state = "win";
    sndWin();
    fireworks(W / 2, PH * 0.35);
  }
  function nextQuestion() {
    qIdx++;
    selCard = -1;
    q = buildQuestion(plan[qIdx]);
  }
  // The level is done when every question is answered (the sort
  // counts as its one question, done when its last card lands).
  function questionDone() {
    beatT = CFG.BEAT;
    flash = { t: CFG.BEAT };
    if (qIdx + 1 >= qTotal) pendingNext = false;
    else pendingNext = true;
  }

  // ---- answering -----------------------------------------------------
  function answerChoice(i) {
    if (!q || q.kind === "sort") return;
    if (i === q.correct) {
      const g = choiceGeom[i];
      const cx = g.x + (g.w ? g.w / 2 : 0), cy = g.y + (g.h ? g.h / 2 : 0);
      burst(cx, cy, "#ffe14d");
      sndDing();
      questionDone();
    } else {
      wiggle = { kind: "choice", idx: i, t: CFG.WIGGLE_T };
      sndBoop();
    }
  }
  function pickCard(i) {
    if (!q || q.kind !== "sort") return;
    const c = q.cards[i];
    if (!c || c.sorted) return;
    if (selCard === i) { selCard = -1; sndTick(); return; }
    selCard = i;
    sndTick();
  }
  function dropBucket(side) {
    if (!q || q.kind !== "sort") return;
    if (selCard < 0) {
      // Nothing picked up: a little tick-tock says "pick a card first".
      sndTickTock();
      return;
    }
    const c = q.cards[selCard];
    if (!c) return;
    if (c.side === side) {
      c.sorted = true;
      q.sortedCount++;
      selCard = -1;
      const b = bucketGeom[side];
      burst(b.x + b.w / 2, b.y + b.h / 2, side === "AM" ? "#ffe14d" : "#a8a0ff");
      sndDing();
      if (q.sortedCount >= q.cards.length) questionDone();
    } else {
      // Wrong bucket: the card wiggles and stays — try the other one.
      wiggle = { kind: "card", idx: selCard, t: CFG.WIGGLE_T };
      sndBoop();
    }
  }

  // ---- particles -----------------------------------------------------
  let parts = [];
  function burst(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 170;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.55 + Math.random() * 0.3, t: 0, color: color, r: 3 + Math.random() * 3 });
    }
  }
  function fireworks(x, y) {
    const colors = ["#ffe14d", "#29faff", "#ff6ec7", "#7dff5e"];
    for (let k = 0; k < 3; k++) {
      const c = colors[k % colors.length];
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + k, sp = 120 + Math.random() * 160;
        parts.push({ x: x + (Math.random() - 0.5) * 90, y: y + (Math.random() - 0.5) * 50,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: 0.8 + Math.random() * 0.5, t: 0, color: c, r: 3 + Math.random() * 3 });
      }
    }
  }
  function stepParticles(dt) {
    parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; });
    parts = parts.filter((p) => p.t < p.life);
  }
  function drawParticles() {
    parts.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // ---- drawing -------------------------------------------------------
  function drawAnalogClock(cx, cy, r, h, m, lv) {
    const face = faceColorFor(m, lv), rim = rimColorFor(m, lv);
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rim; ctx.lineWidth = 5; ctx.stroke();
    // Tick marks, longer on the quarters.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const long = i % 3 === 0;
      const r1 = r - (long ? 12 : 7), r2 = r - 2;
      ctx.strokeStyle = "#111111"; ctx.lineWidth = long ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // Numerals 1-12 around the face.
    ctx.fillStyle = "#111111";
    ctx.font = "bold " + LAY.clockNum + "px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let n = 1; n <= 12; n++) {
      const a = (n / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(String(n), cx + Math.cos(a) * (r - 20), cy + Math.sin(a) * (r - 20));
    }
    // Hands: hour short and thick, minute long and thin.
    const ha = (((h % 12) + m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    const ma = (m / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = "#111111"; ctx.lineCap = "round";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ha) * r * 0.5, cy + Math.sin(ha) * r * 0.5); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ma) * r * 0.78, cy + Math.sin(ma) * r * 0.78); ctx.stroke();
    ctx.fillStyle = "#111111";
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  }
  function drawBigButton(b, label, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, b.x, b.y + 2);
  }
  function drawDots() {
    // Progress dots: one per question — except the sort, where
    // every card sorted lights a dot of its own.
    const total = (q && q.kind === "sort") ? q.cards.length : qTotal;
    const lit = (q && q.kind === "sort") ? q.sortedCount : qIdx;
    for (let i = 0; i < total; i++) {
      const x = W / 2 + (i - (total - 1) / 2) * 26;
      const y = PH - 26;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < lit ? "#ffe14d" : "#2a3a4d";
      ctx.fill();
      ctx.strokeStyle = "#29faff"; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  function drawLevelDigit() {
    ctx.fillStyle = "rgba(41,250,255,0.35)";
    ctx.font = "bold 44px 'Press Start 2P', monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(String(level), W - 18, PH - 34);
  }
  function drawPromptClock() {
    // The big digital time to match — numerals only.
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + LAY.promptFont + "px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(fmtTime(q.prompt.h, q.prompt.m), W / 2, 150);
  }
  function drawClockChoices() {
    q.choices.forEach((c, i) => {
      const g = choiceGeom[i];
      if (!g) return;
      let cx = g.x, cy = g.y;
      if (wiggle && wiggle.kind === "choice" && wiggle.idx === i) {
        cx += Math.sin(wiggle.t * 40) * 6;
      }
      drawAnalogClock(cx, cy, g.r, c.h, c.m, level);
    });
  }
  function drawElapsed() {
    // Food picture + start time + "+N min", up top; three digital
    // end times in a row below — numerals and pictures only.
    const f = q.food;
    ctx.font = LAY.foodEmoji + "px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(f.e, W * 0.22, 168);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + LAY.promptFont + "px 'Press Start 2P', monospace";
    ctx.textAlign = "left";
    ctx.fillText(fmtTime(q.start.h, q.start.m), W * 0.38, 150);
    ctx.fillStyle = "#ffe14d";
    ctx.font = "bold " + Math.round(LAY.promptFont * 0.62) + "px 'Press Start 2P', monospace";
    ctx.fillText("\u{1F550} +" + q.add, W * 0.38, 196);
    // Three digital end-time cards.
    const gap = 12;
    const cw = Math.min((W - gap * 4) / 3, 220);
    const ch = 110;
    const totalW = cw * 3 + gap * 2;
    const startX = (W - totalW) / 2;
    const cy = Math.round(PH * 0.58);
    choiceGeom = [0, 1, 2].map((i) => ({
      x: startX + i * (cw + gap), y: cy - ch / 2, w: cw, h: ch,
    }));
    q.choices.forEach((c, i) => {
      const g = choiceGeom[i];
      let x = g.x;
      if (wiggle && wiggle.kind === "choice" && wiggle.idx === i) {
        x += Math.sin(wiggle.t * 40) * 6;
      }
      ctx.fillStyle = "#14202e";
      ctx.strokeStyle = "#29faff"; ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, g.y, g.w, g.h, 16); else ctx.rect(x, g.y, g.w, g.h);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + LAY.choiceFont + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(fmtTime(c.h, c.m), x + g.w / 2, g.y + g.h / 2);
    });
  }
  function drawSort() {
    // Eight picture cards up top; sun bucket (AM) and moon bucket
    // (PM) in the deck, mirrored left and right.
    q.cards.forEach((c, i) => {
      const g = sortGeom[i];
      if (!g) return;
      if (c.sorted) return; // landed cards live in their bucket now
      let x = g.x, y = g.y;
      if (selCard === i) y -= 10; // picked up: it lifts
      if (wiggle && wiggle.kind === "card" && wiggle.idx === i) {
        x += Math.sin(wiggle.t * 40) * 6;
      }
      ctx.fillStyle = selCard === i ? "#1d3a2a" : "#14202e";
      ctx.strokeStyle = selCard === i ? "#ffe14d" : "#29faff";
      ctx.lineWidth = selCard === i ? 4 : 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, g.w, g.h, 14); else ctx.rect(x, y, g.w, g.h);
      ctx.fill(); ctx.stroke();
      ctx.font = LAY.cardEmoji + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(c.e, x + g.w / 2, y + g.h / 2);
    });
    // The buckets.
    const buckets = [
      { side: "AM", icon: "\u2600\uFE0F", bg: "#3a2f10", rim: "#ffe14d" },
      { side: "PM", icon: "\u{1F319}", bg: "#1a1a3a", rim: "#a8a0ff" },
    ];
    buckets.forEach((b) => {
      const g = bucketGeom[b.side];
      ctx.fillStyle = b.bg;
      ctx.strokeStyle = selCard >= 0 ? b.rim : "#29faff";
      ctx.lineWidth = selCard >= 0 ? 4 : 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(g.x, g.y, g.w, g.h, 18); else ctx.rect(g.x, g.y, g.w, g.h);
      ctx.fill(); ctx.stroke();
      ctx.font = LAY.bucketEmoji + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.icon, g.x + g.w / 2, g.y + g.h * 0.38);
      // Sorted cards pile up inside their bucket as little pictures.
      const landed = q.cards.filter((c) => c.sorted && c.side === b.side);
      landed.forEach((c, k) => {
        const lx = g.x + 26 + (k % 4) * ((g.w - 52) / 3);
        const ly = g.y + g.h * 0.72 + Math.floor(k / 4) * 34;
        ctx.font = "30px monospace";
        ctx.fillText(c.e, lx, ly);
      });
    });
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    // Playfield: deep teal with a retro awning stripe on top.
    ctx.fillStyle = "#0a1a24";
    ctx.fillRect(0, 0, W, PH);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#0d2436" : "#12303a";
      ctx.fillRect((W / 8) * i, 0, W / 8, 96);
    }
    // Deck: darker shelf with a cyan top edge.
    ctx.fillStyle = "#0b141f";
    ctx.fillRect(0, PH, W, DECK_H);
    ctx.fillStyle = "#29faff";
    ctx.fillRect(0, PH, W, 3);

    if (state === "title") {
      // A big clock face, three little clock pictures, one ▶.
      // No words — the clocks say what the game is.
      drawAnalogClock(W / 2, PH * 0.34, LAY.titleClock / 2, 10, 10, 1);
      ctx.font = Math.round(Math.min(W * 0.16, 96)) + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u{1F550} \u{1F55C} \u{1F55D}", W / 2, PH * 0.68);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    if (state === "win") {
      ctx.font = LAY.winStars + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u2605\u2605\u2605", W / 2, PH * 0.42);
      drawAnalogClock(W / 2, PH * 0.68, Math.round(Math.min(W * 0.16, 64)), 12, 0, 5);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    // play + levelClear: the question, the dots, the level digit.
    if (q) {
      if (q.kind === "clock") { drawPromptClock(); drawClockChoices(); }
      else if (q.kind === "elapsed") drawElapsed();
      else if (q.kind === "sort") drawSort();
    }
    drawDots();
    drawLevelDigit();
    if (flash && flash.t > 0) {
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold " + Math.round(Math.min(W * 0.20, 120)) + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u2605", W / 2, PH * 0.52);
    }
    if (state === "levelClear") {
      ctx.fillStyle = "rgba(6,10,18,0.55)";
      ctx.fillRect(0, 0, W, PH);
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold " + LAY.winStars + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u2605", W / 2, PH * 0.32);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + LAY.levelFont + "px 'Press Start 2P', monospace";
      ctx.fillText(String(level), W / 2, PH * 0.52);
      drawBigButton(nextBtn, "\u25B6", "#22a355");
    }
    drawParticles();
  }

  // ---- loop + input --------------------------------------------------
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    step(dt);
    render();
    requestAnimationFrame(frame);
  }
  function step(dt) {
    if (MUSIC) { try { MUSIC.tick(dt); } catch (e) {} }
    stepParticles(dt);
    if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
    if (wiggle) { wiggle.t -= dt; if (wiggle.t <= 0) wiggle = null; }
    if (beatT > 0) {
      beatT -= dt;
      if (beatT <= 0) {
        if (pendingNext) { pendingNext = false; nextQuestion(); }
        else if (level >= CFG.MAX_LEVEL) winGame();
        else levelClear();
      }
    }
    if (state === "win" && Math.random() < dt * 1.6) {
      fireworks(Math.random() * W, Math.random() * PH * 0.6 + 40);
    }
  }
  function inRect(x, y, g) {
    return g && x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h;
  }
  function onDown(x, y) {
    if (state === "title") {
      if (Math.hypot(x - playBtn.x, y - playBtn.y) <= playBtn.r + 10) { sndTick(); startGame(); }
      return;
    }
    if (state === "levelClear") {
      if (Math.hypot(x - nextBtn.x, y - nextBtn.y) <= nextBtn.r + 10) { sndTick(); nextLevel(); }
      return;
    }
    if (state === "win") {
      if (Math.hypot(x - playBtn.x, y - playBtn.y) <= playBtn.r + 10) { sndTick(); startGame(); }
      return;
    }
    if (!q) return;
    if (q.kind === "sort") {
      // Cards first, then the buckets.
      for (let i = 0; i < sortGeom.length; i++) {
        const g = sortGeom[i];
        if (q.cards[i] && !q.cards[i].sorted &&
            x >= g.x && x <= g.x + g.w && y >= g.y - 12 && y <= g.y + g.h) {
          pickCard(i);
          return;
        }
      }
      if (inRect(x, y, bucketGeom.AM)) { dropBucket("AM"); return; }
      if (inRect(x, y, bucketGeom.PM)) { dropBucket("PM"); return; }
      return;
    }
    if (q.kind === "clock") {
      for (let i = 0; i < choiceGeom.length; i++) {
        const g = choiceGeom[i];
        if (Math.hypot(x - g.x, y - g.y) <= g.r + 10) { answerChoice(i); return; }
      }
      return;
    }
    // elapsed: three digital cards.
    for (let i = 0; i < choiceGeom.length; i++) {
      if (inRect(x, y, choiceGeom[i])) { answerChoice(i); return; }
    }
  }
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    onDown(e.clientX - r.left, e.clientY - r.top);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state === "title") startGame();
  });

  // ---- boot ----------------------------------------------------------
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);

  // ---- test hook -----------------------------------------------------
  window.__cwTest = {
    get state() { return state; },
    get level() { return level; },
    get qIdx() { return qIdx; },
    get qTotal() { return qTotal; },
    get q() { return q; },
    get plan() { return plan; },
    get selCard() { return selCard; },
    get choiceGeom() { return choiceGeom; },
    get sortGeom() { return sortGeom; },
    get bucketGeom() { return bucketGeom; },
    get playBtn() { return playBtn; },
    get nextBtn() { return nextBtn; },
    get deckTop() { return PH; },
    get layout() { return LAY; },
    get screen() { return { W: W, H: H, PH: PH }; },
    get music() { return MUSIC_CFG; },
    get musicState() { return MUSIC ? { on: MUSIC.on, step: MUSIC.step } : null; },
    get sortCards() { return SORT_CARDS; },
    get foods() { return FOODS; },
    fmtTime: fmtTime,
    addMinutes: addMinutes,
    sameTime: sameTime,
    makeClockQ: makeClockQ,
    makeElapsedQ: makeElapsedQ,
    makeSortQ: makeSortQ,
    faceColorFor: faceColorFor,
    fresh: function () {
      state = "title"; level = 1; qIdx = 0; qTotal = 4;
      plan = []; q = null; selCard = -1;
      beatT = 0; pendingNext = false; wiggle = null; flash = null;
    },
    startGame: startGame,
    nextLevel: nextLevel,
    levelClear: levelClear,
    winGame: winGame,
    answerChoice: answerChoice,
    pickCard: pickCard,
    dropBucket: dropBucket,
    onDown: onDown,
    render: render,
    resize: function (w, h) { window.innerWidth = w; window.innerHeight = h; resize(); },
    // Deal an exact clock question: correct time + two wrongs.
    dealClock: function (correct, wrongs) {
      const choices = shuffle([correct].concat(wrongs));
      q = { kind: "clock", prompt: correct, choices: choices,
        correct: choices.findIndex((c) => sameTime(c, correct)) };
      qIdx = 0; qTotal = 1; plan = ["whole"];
      state = "play";
    },
    // Deal an exact elapsed question: start + add, end is computed.
    dealElapsed: function (start, add, wrongs) {
      const end = addMinutes(start.h, start.m, add);
      const choices = shuffle([end].concat(wrongs));
      q = { kind: "elapsed", food: FOODS[0], start: start, add: add,
        choices: choices,
        correct: choices.findIndex((c) => sameTime(c, end)) };
      qIdx = 0; qTotal = 1; plan = ["elapsed"];
      state = "play";
    },
    // Deal an exact sort: cards given as [{e, side}].
    dealSort: function (cards) {
      q = { kind: "sort",
        cards: cards.map((c) => ({ e: c.e, side: c.side, sorted: false })),
        sortedCount: 0 };
      selCard = -1;
      qIdx = 0; qTotal = 1; plan = ["sort"];
      state = "play";
    },
    // Set the whole level up for a playthrough: plan + first question.
    dealLevel: function (n) {
      level = n;
      const lv = makeLevel(n);
      plan = lv.plan; qTotal = lv.qTotal; qIdx = 0;
      q = buildQuestion(plan[0]);
      state = "play";
    },
    stepN: function (n) { for (let i = 0; i < n; i++) step(1 / 60); },
  };
})();
