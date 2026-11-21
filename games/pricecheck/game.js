// Price Check! — his daughter's school worksheets as a game.
//
// The worksheets ("Which Costs More?" / "Which Costs Less?", The
// Autism Vault) show TWO food items, each with a receipt price up
// to $10, and the job is to pick the one that costs MORE (or LESS).
// The real sheets run about $4.15-$9.83, and the closest pair on
// them is $9.82 vs $9.83 — one cent apart.
//
// So: two big food tiles side by side, each with a receipt-style
// price tag. The prompt is VISUAL only — a big gold coin at the
// top with an arrow: ⬆️ means pick the one that costs MORE,
// ⬇️ means pick the one that costs LESS. No words anywhere in
// the game, only numerals on the price tags. MORE and LESS rounds
// are mixed inside every level (two of each per level).
//
// Prices get closer as levels rise: L1 gaps of $2.00+, L2 $1.00+,
// L3 $0.50+, L4 $0.20+, L5 near-identical (gap $0.01-$0.09).
// Prices are never equal. A wrong tap just wiggles the wrong
// item — no penalty, retry until right. A right tap bursts stars
// and dings, and lights a progress dot. Four rounds clear a level,
// which waits for HER tap on NEXT; clear level 5 for the grand
// finale. No penalty, no game over, ever.
//
// Escalation is more than closer prices: every level brings a
// NEW set of treats, L2 brings a pink market awning, L3 turns
// the receipt tags GOLD, L4 adds a coin fountain on every right
// pick, L5 makes everything sparkle.
(function () {
  "use strict";

  const CFG = {
    VERSION: "1.0.0",
    MAX_LEVEL: 5,
    ROUNDS_PER_LEVEL: 4,
    PLAY_R: 46,
    BEAT: 0.75,   // pause after a right pick, before the next round
    WIGGLE_T: 0.5,
    BOUNCE_T: 0.3,
  };

  // 40 treats, 8 per level — every level looks different.
  const FOODS = [
    { e: "\u{1F354}", n: "burger", band: 1 },
    { e: "\u{1F355}", n: "pizza", band: 1 },
    { e: "\u{1F369}", n: "donut", band: 1 },
    { e: "\u{1F366}", n: "ice cream", band: 1 },
    { e: "\u{1F36A}", n: "cookie", band: 1 },
    { e: "\u{1F382}", n: "cake", band: 1 },
    { e: "\u{1F9C1}", n: "cupcake", band: 1 },
    { e: "\u{1F37F}", n: "popcorn", band: 1 },
    { e: "\u{1F32E}", n: "taco", band: 2 },
    { e: "\u{1F35C}", n: "noodles", band: 2 },
    { e: "\u{1F964}", n: "shake", band: 2 },
    { e: "\u{1F349}", n: "watermelon", band: 2 },
    { e: "\u{1F35F}", n: "fries", band: 2 },
    { e: "\u{1F32D}", n: "hot dog", band: 2 },
    { e: "\u{1F36C}", n: "candy", band: 2 },
    { e: "\u{1F353}", n: "strawberry", band: 2 },
    { e: "\u{1F34E}", n: "apple", band: 3 },
    { e: "\u{1F968}", n: "pretzel", band: 3 },
    { e: "\u{1F96A}", n: "sandwich", band: 3 },
    { e: "\u{1F347}", n: "grapes", band: 3 },
    { e: "\u{1F352}", n: "cherry", band: 3 },
    { e: "\u{1F351}", n: "peach", band: 3 },
    { e: "\u{1F34D}", n: "pineapple", band: 3 },
    { e: "\u{1F95D}", n: "kiwi", band: 3 },
    { e: "\u{1F965}", n: "coconut", band: 4 },
    { e: "\u{1F36B}", n: "chocolate", band: 4 },
    { e: "\u{1F36F}", n: "honey", band: 4 },
    { e: "\u{1F95B}", n: "milk", band: 4 },
    { e: "\u{1F9C3}", n: "juice box", band: 4 },
    { e: "\u{1F375}", n: "tea", band: 4 },
    { e: "\u{2615}", n: "coffee", band: 4 },
    { e: "\u{1F370}", n: "shortcake", band: 4 },
    { e: "\u{1F36E}", n: "pudding", band: 5 },
    { e: "\u{1F36D}", n: "lollipop", band: 5 },
    { e: "\u{1F361}", n: "dango", band: 5 },
    { e: "\u{1F362}", n: "oden", band: 5 },
    { e: "\u{1F95E}", n: "pancakes", band: 5 },
    { e: "\u{1F9C7}", n: "waffle", band: 5 },
    { e: "\u{1F953}", n: "bacon", band: 5 },
    { e: "\u{1F373}", n: "egg", band: 5 },
  ];

  // Price-gap bands in cents: [min, max] per level.
  // L5 is the worksheet's own $9.82 vs $9.83 — one cent apart.
  const GAPS = {
    1: [200, 350],
    2: [100, 250],
    3: [50, 150],
    4: [20, 80],
    5: [1, 9],
  };
  // Per-level accent colour (awning + prompt ring + dots).
  const ACCENTS = { 1: "#29faff", 2: "#ff6ec7", 3: "#ffe14d", 4: "#7dff5e", 5: "#b388ff" };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

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
  function sndCoin() {
    tone(1318, 0.08, { type: "square", vol: 0.09 });
    tone(1760, 0.14, { type: "square", vol: 0.08, when: 0.06 });
  }
  function sndBoop() { tone(220, 0.14, { type: "sine", vol: 0.10 }); }
  function sndWin() { arp([523, 659, 784, 1046, 1318], 0.11, "square", 0.10); }

  // ---- music: one original bouncy market-day loop, bass loud -------
  // An ORIGINAL bouncy market-day tune, composed here for Price
  // Check!: G major, walking bass that bounces root-fifth-root,
  // a singable lead full of off-beat hops and rests that breathe,
  // a variation at the end of the phrase, and a harmony voice a
  // third under the lead (the NES second pulse channel). Ghost
  // kicks hop into the next bar; snare on 2 and 4. 64 sixteenth
  // steps at 132 BPM, bass LOUD at 0.2. Distinct from Dollar Up!'s
  // cheerful C-major bounce: different key, faster, walking bass
  // instead of root-fifth thump, syncopated lead.
  const G2 = 98, A2 = 110, B2 = 123.47, C3 = 130.81, D3 = 146.83,
        E3 = 164.81, G3 = 196;
  const G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33,
        E5 = 659.25, F5s = 739.99, G5 = 783.99, A5 = 880, B5 = 987.77,
        D6 = 1174.66;
  const MUSIC_CFG = {
    bpm: 132, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 8, 14, 16, 24, 32, 40, 46, 48, 56], snares: [4, 12, 20, 28, 36, 44, 52, 60], hats: "odd",
    bass: [G2,0,D3,0, G2,0,D3,0, G2,0,D3,0, G2,0,B2,0,
           A2,0,E3,0, A2,0,E3,0, D3,0,A2,0, D3,0,G2,0,
           E3,0,B2,0, E3,0,B2,0, C3,0,G3,0, D3,0,A2,0,
           G2,0,D3,0, G2,0,D3,0, G2,0,D3,0, G2,0,0,0],
    lead: [G4,0,B4,0, D5,0,B4,0, G4,0,A4,0, B4,0,0,0,
           A4,0,C5,0, E5,0,C5,0, D5,0,B4,0, A4,0,G4,0,
           E5,0,D5,0, B4,0,G4,0, A4,0,B4,0, D5,0,B4,0,
           G5,0,D5,0, B4,0,G4,0, B4,0,0,A4, 0,G4,0,0],
    harmony: new Array(64).fill(0),
  };
  // Harmony: a third under the lead wherever the lead sings.
  (function () {
    const third = {};
    third[G4] = 329.63; third[A4] = 369.99; third[B4] = 392;
    third[C5] = 440; third[D5] = 493.88; third[E5] = 523.25;
    third[F5s] = 587.33; third[G5] = 659.25; third[A5] = 739.99;
    third[B5] = 783.99; third[D6] = 987.77;
    for (let i = 0; i < 64; i++) {
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
  let tileGeom = []; // {x, y, w, h} — the two food tiles, side by side
  let promptCoin = { x: 200, y: 152, r: 46 };
  let playBtn = { x: 200, y: 600, r: CFG.PLAY_R };
  let nextBtn = { x: 200, y: 600, r: CFG.PLAY_R };
  // LAY: every font that scales with the screen is capped here.
  let LAY = { emojiFont: 110, tagFont: 28, tagW: 150, tagH: 52,
    coinFont: 56, winStars: 96, levelFont: 30, flashFont: 36,
    titleEmoji: 80, titleCoin: 52 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.28, 190, 220));
    PH = H - DECK_H;
    // Prompt coin: top centre, below the 84px back button (ends y=98).
    promptCoin = { x: W / 2, y: 152, r: Math.round(Math.min(52, W * 0.13)) };
    // Two tiles side by side under the prompt coin, dots row below.
    const tGap = 14;
    const tw = Math.min((W - tGap * 3) / 2, 320);
    const th = PH - 208 - 56;
    const gx = (W - (tw * 2 + tGap)) / 2;
    tileGeom = [0, 1].map((i) => ({
      x: gx + i * (tw + tGap), y: 208, w: tw, h: th,
    }));
    playBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    nextBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    LAY = {
      emojiFont: Math.round(Math.min(tw * 0.55, PH * 0.22, 120)),
      tagFont: Math.round(Math.min(tw * 0.16, 34)),
      tagW: Math.round(Math.min(tw * 0.82, 170)),
      tagH: 52,
      coinFont: Math.round(Math.min(promptCoin.r * 1.15, 64)),
      winStars: Math.round(Math.min(W * 0.24, 150)),
      levelFont: Math.round(Math.min(W * 0.075, 64)),
      flashFont: Math.round(Math.min(W * 0.09, 72)),
      titleEmoji: Math.round(Math.min(W * 0.20, 110)),
      titleCoin: Math.round(Math.min(W * 0.13, 56)),
    };
  }

  // ---- game state ----------------------------------------------------
  let state = "title"; // title | play | levelClear | win
  let level = 1, roundIdx = 0, roundsDone = 0;
  // rounds: [{kind: "more"|"less", left: {item, priceCents},
  //           right: {item, priceCents}, correct: 0|1}]
  let rounds = [];
  let roundDone = false;
  let beatT = 0, flash = null;
  let wiggle = null; // {idx, t}
  let bounce = null; // {idx, t}

  // Deal one price pair for a level: gap inside the level's band,
  // both prices $1.00-$10.00, never equal. Returns [lo, hi] cents.
  function makePair(n) {
    const band = GAPS[n] || GAPS[5];
    const gap = band[0] + Math.floor(Math.random() * (band[1] - band[0] + 1));
    const lo = 100 + Math.floor(Math.random() * (1000 - band[1] - 100 + 1));
    return [lo, lo + gap];
  }
  function correctIdx(kind, a, b) {
    return kind === "more" ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
  }
  function makeLevel(n) {
    const kinds = shuffle(["more", "less", "more", "less"]);
    const pool = shuffle(FOODS.filter((it) => it.band === n).slice());
    const made = [];
    for (let r = 0; r < CFG.ROUNDS_PER_LEVEL; r++) {
      const pair = makePair(n);
      const foods = [pool[r * 2], pool[r * 2 + 1]];
      // Randomise which side holds the higher price.
      const hiFirst = Math.random() < 0.5;
      const left = { item: foods[0], priceCents: hiFirst ? pair[1] : pair[0] };
      const right = { item: foods[1], priceCents: hiFirst ? pair[0] : pair[1] };
      made.push({
        kind: kinds[r], left: left, right: right,
        correct: correctIdx(kinds[r], left.priceCents, right.priceCents),
      });
    }
    return made;
  }

  function startGame() {
    level = 1; roundIdx = 0; roundsDone = 0;
    roundDone = false; beatT = 0; flash = null; wiggle = null; bounce = null;
    rounds = makeLevel(1);
    state = "play";
    if (MUSIC) { try { MUSIC.start(); } catch (e) {} }
    if (window.SDGplays) window.SDGplays.played("pricecheck");
  }
  function nextLevel() {
    level++;
    roundIdx = 0; roundsDone = 0;
    roundDone = false; beatT = 0; flash = null; wiggle = null; bounce = null;
    rounds = makeLevel(level);
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
  function curRound() { return rounds[roundIdx]; }

  // ---- the picking ---------------------------------------------------
  function tapItem(i) {
    if (state !== "play" || roundDone) return;
    const r = curRound();
    if (!r) return;
    if (i === r.correct) {
      roundDone = true;
      roundsDone++;
      const g = tileGeom[i];
      burst(g.x + g.w / 2, g.y + g.h / 2, "#ffe14d");
      if (level >= 4) coinFountain(g.x + g.w / 2, g.y + g.h * 0.3);
      sndDing();
      if (level >= 4) sndCoin();
      beatT = CFG.BEAT;
    } else {
      // Wrong one — it wiggles, nothing is lost, try again.
      wiggle = { idx: i, t: CFG.WIGGLE_T };
      sndBoop();
    }
  }

  // ---- particles -----------------------------------------------------
  let parts = [];
  function burst(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 170;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.55 + Math.random() * 0.3, t: 0, color: color, r: 3 + Math.random() * 3, shape: "dot" });
    }
  }
  function coinFountain(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = 140 + Math.random() * 160;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.9 + Math.random() * 0.4, t: 0, color: "#ffe14d", r: 6 + Math.random() * 4, shape: "coin" });
    }
  }
  function sparkle(x, y) {
    parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 20, vy: 12 + Math.random() * 20,
      life: 0.9 + Math.random() * 0.6, t: 0, color: Math.random() < 0.5 ? "#ffffff" : "#ffe14d",
      r: 2 + Math.random() * 2.5, shape: "dot" });
  }
  function fireworks(x, y) {
    const colors = ["#ffe14d", "#29faff", "#ff6ec7", "#7dff5e"];
    for (let k = 0; k < 3; k++) {
      const c = colors[k % colors.length];
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + k, sp = 120 + Math.random() * 160;
        parts.push({ x: x + (Math.random() - 0.5) * 90, y: y + (Math.random() - 0.5) * 50,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: 0.8 + Math.random() * 0.5, t: 0, color: c, r: 3 + Math.random() * 3, shape: "dot" });
      }
    }
  }
  function stepParticles(dt) {
    parts.forEach((p) => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.shape === "coin" ? 420 * dt : 260 * dt;
    });
    parts = parts.filter((p) => p.t < p.life);
  }
  function drawParticles() {
    parts.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      if (p.shape === "coin") {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2; ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  // ---- drawing -------------------------------------------------------
  function accent() { return ACCENTS[level] || "#29faff"; }
  function drawPromptCoin() {
    const r = curRound();
    const arrow = r && r.kind === "more" ? "\u2B06\uFE0F" : "\u2B07\uFE0F";
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.arc(promptCoin.x, promptCoin.y, promptCoin.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = accent(); ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(promptCoin.x, promptCoin.y, promptCoin.r - 7, 0, Math.PI * 2); ctx.stroke();
    ctx.font = LAY.coinFont + "px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(arrow, promptCoin.x, promptCoin.y + 2);
  }
  function drawTile(side, i) {
    const g = tileGeom[i];
    if (!g) return;
    let x = g.x, y = g.y;
    if (wiggle && wiggle.idx === i) x += Math.sin(wiggle.t * 40) * 6;
    if (bounce && bounce.idx === i) y += Math.sin(bounce.t * 30) * 3;
    const picked = roundDone && curRound() && curRound().correct === i;
    ctx.fillStyle = picked ? "#1d3a2a" : "#101c2a";
    ctx.strokeStyle = picked ? "#ffe14d" : accent();
    ctx.lineWidth = picked ? 4 : 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, g.w, g.h, 16); else ctx.rect(x, y, g.w, g.h);
    ctx.fill(); ctx.stroke();
    // The treat.
    ctx.font = LAY.emojiFont + "px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(side.item.e, x + g.w / 2, y + g.h * 0.34);
    // Its receipt price tag — gold from level 3 on.
    const tw = LAY.tagW, th = LAY.tagH;
    const px = x + (g.w - tw) / 2, py = y + g.h * 0.62;
    ctx.fillStyle = level >= 3 ? "#ffe14d" : "#ffffff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, tw, th, 8); else ctx.rect(px, py, tw, th);
    ctx.fill();
    // Folded corner on the tag.
    ctx.fillStyle = level >= 3 ? "#e6c200" : "#d8d8d8";
    ctx.beginPath();
    ctx.moveTo(px + tw - 18, py); ctx.lineTo(px + tw, py + 18);
    ctx.lineTo(px + tw, py); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.font = "bold " + LAY.tagFont + "px monospace";
    ctx.fillText("$" + (side.priceCents / 100).toFixed(2), x + g.w / 2, py + th / 2 + 1);
    if (picked) {
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold 34px monospace";
      ctx.fillText("\u2605", x + g.w - 24, y + 26);
    }
  }
  function drawDots() {
    for (let i = 0; i < CFG.ROUNDS_PER_LEVEL; i++) {
      const x = W / 2 + (i - 1.5) * 26;
      const y = PH - 26;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < roundsDone ? "#ffe14d" : "#2a3a4d";
      ctx.fill();
      ctx.strokeStyle = accent(); ctx.lineWidth = 2; ctx.stroke();
    }
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
  function drawLevelDigit() {
    ctx.fillStyle = "rgba(41,250,255,0.35)";
    ctx.font = "bold 44px 'Press Start 2P', monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(String(level), W - 18, PH - 34);
  }
  function drawArrowCoin(x, y, r, arrow) {
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = Math.round(r * 1.1) + "px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(arrow, x, y + 2);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    // Playfield: deep teal with a retro awning stripe on top.
    // L2's awning turns pink — the level's new thing to see.
    ctx.fillStyle = "#0a1a24";
    ctx.fillRect(0, 0, W, PH);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2
        ? (level >= 2 ? "#3a1030" : "#0d2436")
        : (level >= 2 ? "#4d153f" : "#12303a");
      ctx.fillRect((W / 8) * i, 0, W / 8, 96);
    }
    // Deck: darker shelf with an accent top edge.
    ctx.fillStyle = "#0b141f";
    ctx.fillRect(0, PH, W, DECK_H);
    ctx.fillStyle = accent();
    ctx.fillRect(0, PH, W, 3);

    if (state === "title") {
      // No words on the title — two arrow coins, three treats, ▶.
      drawArrowCoin(W / 2 - 78, PH * 0.28, LAY.titleCoin, "\u2B06\uFE0F");
      drawArrowCoin(W / 2 + 78, PH * 0.28, LAY.titleCoin, "\u2B07\uFE0F");
      ctx.font = LAY.titleEmoji + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u{1F354} \u{1F355} \u{1F369}", W / 2, PH * 0.58);
      ctx.font = Math.round(Math.min(W * 0.09, 44)) + "px monospace";
      ctx.fillText("\u{1F4B0}", W / 2, PH * 0.76);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    if (state === "win") {
      ctx.font = LAY.winStars + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u2605".repeat(3), W / 2, PH * 0.32);
      ctx.font = LAY.titleEmoji + "px monospace";
      ctx.fillText("\u{1F389} \u{1F4B0} \u{1F389}", W / 2, PH * 0.55);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    // play + levelClear: the prompt coin and the two treats.
    if (curRound()) {
      drawPromptCoin();
      drawTile(curRound().left, 0);
      drawTile(curRound().right, 1);
    }
    drawDots();
    drawLevelDigit();
    if (state === "levelClear") {
      ctx.fillStyle = "rgba(6,10,18,0.55)";
      ctx.fillRect(0, 0, W, PH);
      // Stars + the level numeral — no words.
      ctx.font = LAY.winStars + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u2605".repeat(4), W / 2, PH * 0.30);
      ctx.fillStyle = "#ffe14d";
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
    if (bounce) { bounce.t -= dt; if (bounce.t <= 0) bounce = null; }
    // L5: everything sparkles, all the time.
    if (level >= 5 && state === "play" && Math.random() < dt * 6) {
      sparkle(Math.random() * W, 104 + Math.random() * (PH - 104));
    }
    if (beatT > 0) {
      beatT -= dt;
      if (beatT <= 0) {
        roundDone = false;
        if (roundsDone >= CFG.ROUNDS_PER_LEVEL) {
          if (level >= CFG.MAX_LEVEL) winGame(); else levelClear();
        } else {
          roundIdx++;
        }
      }
    }
    if (state === "win" && Math.random() < dt * 1.6) {
      fireworks(Math.random() * W, Math.random() * PH * 0.6 + 40);
    }
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
    // play: tap one of the two treats.
    for (let i = 0; i < tileGeom.length; i++) {
      const g = tileGeom[i];
      if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
        tapItem(i);
        return;
      }
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
  window.__pcTest = {
    get state() { return state; },
    get level() { return level; },
    get roundIdx() { return roundIdx; },
    get roundsDone() { return roundsDone; },
    get rounds() { return rounds; },
    get round() { return curRound(); },
    get tileGeom() { return tileGeom; },
    get promptCoin() { return promptCoin; },
    get playBtn() { return playBtn; },
    get nextBtn() { return nextBtn; },
    get deckTop() { return PH; },
    get layout() { return LAY; },
    get screen() { return { W: W, H: H, PH: PH }; },
    get music() { return MUSIC_CFG; },
    get musicState() { return MUSIC ? { on: MUSIC.on, step: MUSIC.step } : null; },
    get foods() { return FOODS; },
    get gaps() { return GAPS; },
    gapFor: function (n) { return GAPS[n].slice(); },
    pair: makePair,
    fresh: function () {
      state = "title"; level = 1; roundIdx = 0; roundsDone = 0;
      roundDone = false; beatT = 0; flash = null;
      wiggle = null; bounce = null; rounds = [];
    },
    startGame: startGame,
    nextLevel: nextLevel,
    levelClear: levelClear,
    winGame: winGame,
    tapItem: tapItem,
    onDown: onDown,
    render: render,
    resize: function (w, h) { window.innerWidth = w; window.innerHeight = h; resize(); },
    // Deal exact rounds for tests: [{kind, a, b, foods:[i, j]}]
    // a = left price (cents), b = right price (cents).
    deal: function (specs) {
      rounds = specs.map((s) => ({
        kind: s.kind,
        left: { item: FOODS[s.foods[0]], priceCents: s.a },
        right: { item: FOODS[s.foods[1]], priceCents: s.b },
        correct: correctIdx(s.kind, s.a, s.b),
      }));
      roundIdx = 0; roundsDone = 0; roundDone = false;
      beatT = 0; flash = null; wiggle = null; bounce = null;
      state = "play";
    },
    stepN: function (n) { for (let i = 0; i < n; i++) step(1 / 60); },
  };
})();
