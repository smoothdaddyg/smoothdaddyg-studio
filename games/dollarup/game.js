/* ============================================================
   DOLLAR UP! — SmoothDaddyG
   ------------------------------------------------------------
   Danny's 2026-11-19 call: his daughter's school worksheet,
   "Dollar Up to $5" — items with receipt prices on the left,
   whole-dollar money amounts on the right; match each item to
   the smallest whole dollars that cover its price. The game
   randomizes the cost and the money, and she decides which
   one is right.

   THE WORKSHEET, AS A GAME — one item at a time (not the
   worksheet's 4x4 match — one obvious interaction, his
   call to keep or change): a big picture of the thing with
   its receipt price, and three big money cards in the
   bottom deck. Tap the smallest amount that covers the
   price. $0.95 -> $1, $3.93 -> $4, $1.75 -> $2, $4.63
   -> $5 — "dollar up", exactly like her worksheet.

   THE MONEY IS REAL BILLS: $1 is one $1 bill, $2 is two
   $1 bills, $3 is three, $4 is four, $5 is one $5 bill —
   she can count the bills, and the big "$3" numeral sits
   right on the card. The numbers ARE the game here (she
   counts to ~10); there is nothing else to read.

   LEVELS (5, 4 rounds each — short, surprises often):
   L1 Snacks under $2, L2 Treats up to $3, L3 Toys up to
   $4, L4 Big stuff up to $5, L5 everything mixed. Each
   level brings NEW things to buy (escalation = new items,
   not just bigger prices). A level clears with confetti
   and a big NEXT button SHE taps — the game never rolls
   on by itself at a progress mark. Clear L5 for the grand
   finale: fireworks until PLAY AGAIN.

   FORGIVING: a wrong tap just wiggles the card with a
   soft boop — no penalty, no lost stars, try again.
   No timers, no game over, ever.
   MUSIC: an original cheerful C-major bounce composed
   here (square lead, triangle bass at vol 0.2, noise
   drums, a harmony voice a third under the lead) — its
   own melody, never a re-skin.
   ============================================================ */
"use strict";
(function () {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  /* ---------------- config ---------------- */
  const CFG = {
    ROUNDS_PER_LEVEL: 4,
    LEVELS: 5,
    NEXT_BEAT: 0.9,     // s of celebration before the next round
    CARD_H: 150,        // px tall money cards in the deck
    PLAY_R: 52,         // px PLAY button radius
  };
  // Price bands per level, in cents. L5 is the whole range.
  const BANDS = [
    { lo: 25, hi: 195 },   // L1: under $2
    { lo: 105, hi: 295 },  // L2: up to $3
    { lo: 205, hi: 395 },  // L3: up to $4
    { lo: 305, hi: 495 },  // L4: up to $5
    { lo: 25, hi: 495 },   // L5: everything
  ];
  // Things to buy. Each item joins the shop at its band —
  // a new level means new things to see, not just new prices.
  const ITEMS = [
    { e: "\u{1F32E}", band: 1 }, // taco (from her worksheet)
    { e: "\u{1F366}", band: 1 }, // ice cream (from her worksheet)
    { e: "\u{1F9C3}", band: 1 }, // juice box (from her worksheet)
    { e: "\u{1F9C1}", band: 1 }, // cupcake (from her worksheet)
    { e: "\u{1F36A}", band: 1 }, // cookie
    { e: "\u{1F34E}", band: 1 }, // apple
    { e: "\u{1F355}", band: 2 }, // pizza
    { e: "\u{1F369}", band: 2 }, // donut
    { e: "\u{1F964}", band: 2 }, // soda
    { e: "\u{1F353}", band: 2 }, // strawberry
    { e: "\u{1F37F}", band: 2 }, // popcorn
    { e: "\u{1F36C}", band: 2 }, // candy
    { e: "\u{1F388}", band: 3 }, // balloon
    { e: "\u{1F9F8}", band: 3 }, // teddy
    { e: "\u{26BD}", band: 3 }, // ball
    { e: "\u{1FA80}", band: 3 }, // yo-yo
    { e: "\u{1FA81}", band: 3 }, // kite
    { e: "\u{1F986}", band: 3 }, // duck
    { e: "\u{1F697}", band: 4 }, // toy car
    { e: "\u{1F381}", band: 4 }, // gift
    { e: "\u{1F680}", band: 4 }, // rocket
    { e: "\u{1F3B8}", band: 4 }, // guitar
    { e: "\u{1F451}", band: 4 }, // crown
    { e: "\u{1F6B2}", band: 4 }, // bike
  ];

  /* ---------------- helpers ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  const fmtPrice = (cents) => "$" + Math.floor(cents / 100) + "." + String(cents % 100).padStart(2, "0");

  /* ---------------- the money logic (pure — tested) ----------------
     dollarUp: the smallest whole dollars that cover the price.
     makeOptions: three money cards — the right answer, one
     too small (when one exists) and one too big. For a $1
     answer there is no smaller whole dollar, so the cards
     are $1/$2/$3; for $5 they are $3/$4/$5. */
  function dollarUp(cents) { return Math.ceil(cents / 100); }
  function makeOptions(priceCents) {
    const a = dollarUp(priceCents);
    let opts;
    if (a <= 1) opts = [1, 2, 3];
    else if (a >= 5) opts = [3, 4, 5];
    else opts = [a - 1, a, a + 1];
    return shuffle(opts.slice());
  }
  function priceForLevel(level) {
    const b = BANDS[clamp(level, 1, 5) - 1];
    let cents = rndi(b.lo, b.hi);
    if (cents % 100 === 0) cents += 25; // never a whole dollar
    return cents;
  }
  function pickItem(level) {
    const pool = ITEMS.filter((it) => it.band <= level);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------------- audio ---------------- */
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  function sndCoin() {
    tone(988, 0.09, { type: "square", vol: 0.10 });
    tone(1319, 0.16, { type: "square", vol: 0.10, when: 0.09 });
    noiseS(0.25, { filter: "highpass", freq: 5000, vol: 0.04, when: 0.05 });
  }
  function sndBoop() { tone(196, 0.22, { type: "triangle", vol: 0.10, slideTo: 130 }); }
  function sndLevel() { arp([523, 659, 784, 1046], 0.11, "square", 0.10); }
  function sndFanfare() { arp([523, 659, 784, 1046, 784, 1046, 1318, 1568], 0.11, "square", 0.10); }
  function sndCheer() { noiseS(1.2, { filter: "highpass", freq: 2500, vol: 0.06, when: 0.1 }); }

  /* ---------------- background music ----------------
     An ORIGINAL cheerful bounce, composed here for Dollar
     Up!: C major, short singable phrases with a variation
     at the end, rests that breathe, and a harmony voice a
     third under the lead (the NES second pulse channel).
     Bouncy bass (root on the beat, fifth off it) and a
     clap-along drum feel (kick on 1 and 3, snare on 2
     and 4). 64 sixteenth steps at 120 BPM, bass LOUD
     at 0.2. */
  const C2 = 65.41, G2 = 98, A2 = 110, F2 = 87.31, D2 = 73.42;
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46,
        G5 = 783.99, A5 = 880, C6 = 1046.5;
  const MUSIC_CFG = {
    bpm: 120, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 8, 16, 24, 32, 40, 48, 56], snares: [4, 12, 20, 28, 36, 44, 52, 60], hats: "odd",
    bass: [C2,0,G2,0, C2,0,G2,0, C2,0,G2,0, C2,0,G2,0,
           F2,0,C2,0, F2,0,C2,0, F2,0,C2,0, F2,0,G2,0,
           G2,0,D2,0, G2,0,D2,0, G2,0,D2,0, G2,0,D2,0,
           C2,0,G2,0, C2,0,G2,0, C2,0,G2,0, C2,0,0,0],
    lead: [C5,0,E5,0, G5,0,E5,0, A5,0,G5,0, E5,0,C5,0,
           D5,0,F5,0, A5,0,F5,0, G5,0,E5,0, D5,0,0,0,
           E5,0,G5,0, C6,0,G5,0, A5,0,G5,0, E5,0,D5,0,
           C5,0,E5,0, G5,0,C6,0, G5,0,E5,0, C5,0,0,0],
    harmony: new Array(64).fill(0),
  };
  // Harmony: a third under the lead wherever the lead sings.
  (function () {
    const third = {};
    third[C5] = 440; third[D5] = 493.88; third[E5] = 523.25;
    third[F5] = 587.33; third[G5] = 659.25; third[A5] = 698.46;
    third[C6] = 880;
    for (let i = 0; i < 64; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }

  /* ---------------- layout ----------------
     Playfield above, money deck below (the studio deck
     rule — a thumb never covers the item or its price).
     The 84px back button lives top-left in HTML; nothing
     is drawn in that corner. */
  let W = 400, H = 700, DPR = 1, DECK_H = 200, PH = 500;
  let cards = [];   // {x, y, w, h, amount} — the three money cards
  let playBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  let nextBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.28, 190, 220));
    PH = H - DECK_H;
    const gap = 14, cw = (W - gap * 4) / 3;
    const cy = PH + (DECK_H - CFG.CARD_H) / 2;
    cards = [0, 1, 2].map((i) => ({
      x: gap + i * (cw + gap), y: cy, w: cw, h: CFG.CARD_H, amount: 0,
    }));
    playBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    nextBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
  }
  window.addEventListener("resize", resize);

  /* ---------------- state ---------------- */
  let state = "title"; // title | play | levelClear | win
  let level = 1, roundInLevel = 0, stars = 0;
  let round = null;    // {item, priceCents, options[], answer}
  let roundDone = false, beatT = 0;
  let wrongIdx = -1, wiggleT = 0;
  let flash = null;    // {text, t}
  let usedItems = [];  // emojis already shown this level
  let parts = [], confetti = [], fireworks = [];
  let winT = 0;

  function newRound() {
    const priceCents = priceForLevel(level);
    let item = pickItem(level);
    let guard = 0;
    while (usedItems.indexOf(item.e) !== -1 && guard++ < 20) item = pickItem(level);
    usedItems.push(item.e);
    round = {
      item: item,
      priceCents: priceCents,
      options: makeOptions(priceCents),
      answer: dollarUp(priceCents),
    };
    for (let i = 0; i < 3; i++) cards[i].amount = round.options[i];
    roundDone = false; beatT = 0; wrongIdx = -1; wiggleT = 0;
  }
  function startLevel(lv) {
    level = lv; roundInLevel = 0; usedItems = [];
    newRound();
    state = "play";
  }
  function fresh() {
    level = 1; stars = 0; winT = 0;
    parts = []; confetti = []; fireworks = [];
    flash = null;
    startLevel(1);
  }
  function startGame() {
    try { if (window.SDGplays) window.SDGplays.played("dollarup"); } catch (e) {}
    try { if (MUSIC) MUSIC.start(); } catch (e) {}
    fresh();
  }
  function burst(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = rnd(60, 260);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        t: 0, life: rnd(0.5, 0.9), c: colors[i % colors.length], r: rnd(3, 7) });
    }
  }
  function rainConfetti(n) {
    for (let i = 0; i < n; i++) {
      confetti.push({ x: rnd(0, W), y: rnd(-40, -5), vy: rnd(60, 160),
        vx: rnd(-30, 30), t: 0, life: rnd(1.5, 2.5),
        c: ["#29faff", "#ffe14d", "#ff5e8a", "#7dff5e", "#ff9f2e"][i % 5], s: rnd(5, 9) });
    }
  }
  function levelClear() {
    state = "levelClear";
    flash = { text: "LEVEL " + level + "!", t: 1.4 };
    sndLevel();
    rainConfetti(60);
  }
  function winGame() {
    state = "win"; winT = 0;
    sndFanfare(); sndCheer();
    rainConfetti(80);
  }

  /* ---------------- input ---------------- */
  function hitCard(px, py) {
    for (let i = 0; i < 3; i++) {
      const c = cards[i];
      if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) return i;
    }
    return -1;
  }
  function tapCard(i) {
    if (state !== "play" || roundDone) return;
    if (round.options[i] === round.answer) {
      roundDone = true; beatT = CFG.NEXT_BEAT;
      stars++;
      sndCoin();
      const c = cards[i];
      burst(c.x + c.w / 2, c.y + c.h / 2, 22, ["#ffe14d", "#29faff", "#7dff5e"]);
    } else {
      wrongIdx = i; wiggleT = 0.45;
      sndBoop();
    }
  }
  function onDown(px, py) {
    if (state === "title") {
      const d = Math.hypot(px - playBtn.x, py - playBtn.y);
      if (d <= playBtn.r + 30) startGame();
      return;
    }
    if (state === "play") {
      const i = hitCard(px, py);
      if (i >= 0) tapCard(i);
      return;
    }
    if (state === "levelClear") {
      const d = Math.hypot(px - nextBtn.x, py - nextBtn.y);
      if (d <= nextBtn.r + 30) {
        if (level >= CFG.LEVELS) winGame();
        else startLevel(level + 1);
      }
      return;
    }
    if (state === "win") {
      const d = Math.hypot(px - playBtn.x, py - playBtn.y);
      if (d <= playBtn.r + 30) startGame();
    }
  }
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    onDown(e.clientX - r.left, e.clientY - r.top);
  });

  /* ---------------- update ---------------- */
  let lastT = 0;
  function step(dt) {
    if (wiggleT > 0) wiggleT -= dt;
    if (flash && flash.t > 0) flash.t -= dt;
    if (state === "play" && roundDone) {
      beatT -= dt;
      if (beatT <= 0) {
        roundInLevel++;
        if (roundInLevel >= CFG.ROUNDS_PER_LEVEL) levelClear();
        else newRound();
      }
    }
    if (state === "win") {
      winT += dt;
      if (Math.random() < dt * 1.6) {
        fireworks.push({ x: rnd(40, W - 40), y: rnd(60, PH * 0.5), t: 0, life: 0.9,
          c: ["#ffe14d", "#29faff", "#ff5e8a"][Math.floor(Math.random() * 3)] });
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
      if (p.t >= p.life) parts.splice(i, 1);
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i]; c.t += dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.vx += Math.sin(c.t * 9) * 22 * dt;
      if (c.t >= c.life) confetti.splice(i, 1);
    }
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const f = fireworks[i]; f.t += dt;
      if (f.t >= f.life) fireworks.splice(i, 1);
    }
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    step(dt);
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- drawing ---------------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawBill(x, y, w, h, amount) {
    // One green bill, big numeral — the money itself.
    ctx.fillStyle = "#1d7a3a";
    rr(x, y, w, h, 6); ctx.fill();
    ctx.fillStyle = "#a8e6a1";
    rr(x + 3, y + 3, w - 6, h - 6, 4); ctx.fill();
    ctx.fillStyle = "#145c2b";
    ctx.font = "bold " + Math.round(h * 0.42) + "px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$" + amount, x + w / 2, y + h / 2 + 1);
  }
  function drawCard(c, i) {
    let dx = 0;
    if (i === wrongIdx && wiggleT > 0) dx = Math.sin(wiggleT * 55) * 7;
    const x = c.x + dx;
    const hot = state === "play" && roundDone && c.amount === round.answer;
    ctx.fillStyle = hot ? "#ffe14d" : "#16202e";
    rr(x - 3, c.y - 3, c.w + 6, c.h + 6, 16); ctx.fill();
    ctx.fillStyle = "#0e1622";
    rr(x, c.y, c.w, c.h, 14); ctx.fill();
    ctx.strokeStyle = hot ? "#ffe14d" : "#29faff";
    ctx.lineWidth = hot ? 5 : 3;
    rr(x, c.y, c.w, c.h, 14); ctx.stroke();
    // The bills themselves — count them: $1 is one bill,
    // $2 two, $3 three, $4 four, $5 one big $5 bill.
    const bw = Math.min(64, (c.w - 24) / 4);
    const bh = 34;
    const by = c.y + 26;
    if (c.amount === 5) {
      drawBill(x + (c.w - bw * 1.6) / 2, by, bw * 1.6, bh + 8, 5);
    } else {
      const total = bw * c.amount + 6 * (c.amount - 1);
      let bx = x + (c.w - total) / 2;
      for (let b = 0; b < c.amount; b++) {
        drawBill(bx, by + b * 3, bw, bh, 1);
        bx += bw + 6;
      }
    }
    // The big numeral — the answer she is choosing.
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + Math.round(c.w * 0.30) + "px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$" + c.amount, x + c.w / 2, c.y + c.h - 42);
    if (hot) {
      ctx.font = Math.round(c.w * 0.34) + "px monospace";
      ctx.fillText("\u2605", x + c.w / 2, c.y + 22);
    }
  }
  function drawDots() {
    const n = CFG.ROUNDS_PER_LEVEL;
    const r = 9, gap = 26;
    const total = n * (r * 2) + (n - 1) * (gap - r * 2);
    let x = (W - total) / 2 + r;
    const y = PH - 26;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i < roundInLevel || (roundDone && i === roundInLevel) ? "#ffe14d" : "#2a3a4d";
      ctx.fill();
      ctx.strokeStyle = "#29faff"; ctx.lineWidth = 2; ctx.stroke();
      x += gap;
    }
  }
  function drawItem() {
    if (!round) return;
    const cy = PH * 0.38;
    // Shelf the thing sits on.
    ctx.fillStyle = "#16202e";
    rr(W * 0.12, cy + 78, W * 0.76, 14, 7); ctx.fill();
    ctx.font = Math.round(Math.min(150, W * 0.34)) + "px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(round.item.e, W / 2, cy);
    // The receipt, tilted like her worksheet's.
    ctx.save();
    ctx.translate(W / 2, cy + 128);
    ctx.rotate(-0.05);
    ctx.fillStyle = "#ffffff";
    rr(-78, -30, 156, 60, 6); ctx.fill();
    ctx.fillStyle = "#222222";
    ctx.font = "bold 30px 'Press Start 2P', monospace";
    ctx.fillText(fmtPrice(round.priceCents), 0, 2);
    ctx.restore();
  }
  function drawLevelDigit() {
    ctx.fillStyle = "#29faff";
    ctx.font = "bold 34px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("" + level, W / 2, 108);
    ctx.fillStyle = "#8fa8bf";
    ctx.font = "bold 11px 'Press Start 2P', monospace";
    ctx.fillText("LEVEL", W / 2, 142);
  }
  function drawBigButton(b, label, color) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, b.x, b.y + 2);
  }
  function drawParticles() {
    for (const p of parts) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const c of confetti) {
      ctx.globalAlpha = 1 - c.t / c.life;
      ctx.fillStyle = c.c;
      ctx.fillRect(c.x, c.y, c.s, c.s * 0.6);
    }
    ctx.globalAlpha = 1;
    for (const f of fireworks) {
      const k = f.t / f.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = f.c; ctx.lineWidth = 3;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + Math.cos(ang) * 46 * k, f.y + Math.sin(ang) * 46 * k);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  function render() {
    // Shop background: warm awning stripes up top, dark floor below.
    ctx.fillStyle = "#0a0a13";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#12303a";
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) ctx.fillRect((i * W) / 8, 0, W / 8, 96);
    }
    ctx.fillStyle = "#16202e";
    ctx.fillRect(0, PH, W, DECK_H);
    ctx.fillStyle = "#29faff";
    ctx.fillRect(0, PH - 3, W, 3);

    if (state === "title") {
      ctx.fillStyle = "#29faff";
      ctx.font = "bold " + Math.round(W * 0.11) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("DOLLAR", W / 2, PH * 0.30);
      ctx.fillText("UP!", W / 2, PH * 0.30 + Math.round(W * 0.13));
      ctx.font = Math.round(W * 0.20) + "px monospace";
      ctx.fillText("\u{1F32E} \u{1F4B5} \u{1F9C1}", W / 2, PH * 0.62);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }
    if (state === "play" || state === "levelClear") {
      drawLevelDigit();
      drawItem();
      drawDots();
      for (let i = 0; i < 3; i++) drawCard(cards[i], i);
      if (flash && flash.t > 0) {
        ctx.fillStyle = "#ffe14d";
        ctx.font = "bold " + Math.round(W * 0.09) + "px 'Press Start 2P', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(flash.text, W / 2, PH * 0.52);
      }
      if (state === "levelClear") {
        ctx.fillStyle = "rgba(6,10,18,0.55)";
        ctx.fillRect(0, 0, W, PH);
        ctx.fillStyle = "#ffe14d";
        ctx.font = "bold " + Math.round(W * 0.075) + "px 'Press Start 2P', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("LEVEL " + level + "!", W / 2, PH * 0.42);
        drawBigButton(nextBtn, "\u25B6", "#22a355");
      }
      drawParticles();
      return;
    }
    if (state === "win") {
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold " + Math.round(W * 0.085) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("YOU DID IT!", W / 2, PH * 0.32);
      ctx.font = Math.round(W * 0.24) + "px monospace";
      ctx.fillText("\u2605".repeat(3), W / 2, PH * 0.55);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }
  }

  /* ---------------- boot ---------------- */
  resize();
  render();
  requestAnimationFrame(frame);

  /* ---------------- test hook ---------------- */
  window.__duTest = {
    get state() { return state; },
    get level() { return level; },
    get stars() { return stars; },
    get round() { return round; },
    get roundInLevel() { return roundInLevel; },
    get roundDone() { return roundDone; },
    get cards() { return cards; },
    get deckTop() { return PH; },
    get music() { return MUSIC_CFG; },
    get items() { return ITEMS; },
    get bands() { return BANDS; },
    dollarUp: dollarUp,
    makeOptions: makeOptions,
    priceForLevel: priceForLevel,
    debug: {
      fresh: fresh,
      startGame: startGame,
      tapCard: tapCard,
      onDown: onDown,
      stepN: function (n) { for (let i = 0; i < n; i++) step(1 / 60); },
      render: render,
      setRound: function (priceCents) {
        round = {
          item: ITEMS[0],
          priceCents: priceCents,
          options: makeOptions(priceCents),
          answer: dollarUp(priceCents),
        };
        for (let i = 0; i < 3; i++) cards[i].amount = round.options[i];
        roundDone = false; beatT = 0; wrongIdx = -1; wiggleT = 0;
        state = "play";
      },
      levelClear: levelClear,
    },
  };
})();
