// Dollar Up! — his daughter's school worksheet as a game.
//
// The worksheet ("Dollar Up to $5", The Autism Vault) gives FOUR items
// with receipt prices and FOUR whole-dollar amounts, and the job is to
// buy them ALL: match each amount to an item it covers. Any bill that
// covers a price CAN buy that item — a $5 bill buys a $2 juice just
// fine — but you only have each bill once, so spending the $5 on the
// juice leaves the $4.63 cupcake with nothing that covers it. The
// thinking is the allocation: which bill goes where so everything
// gets bought. (v1 got this wrong — it demanded the single smallest
// amount per item. Danny corrected it 2026-11-19: the game is the
// matching, not the exact answer.)
//
// So: four items in a 2x2 grid up top (big picture + receipt price),
// four money cards in the bottom deck. Tap a money card to pick it
// up, tap an item to spend it there. A bill that covers the price
// sticks (star + ding); a bill too small just wiggles — try another.
// Tap an item that already has money to take it back and rearrange.
// Buy all four and the level clears (waits for HER tap on NEXT);
// clear level 5 for the grand finale. No penalty, no game over, ever.
//
// The puzzle is always uniquely solvable: each level deals four
// DISTINCT whole-dollar amounts, and each price sits strictly inside
// one dollar band, so the intended match is the only full allocation
// (the biggest item can only be bought by the biggest bill, then the
// next, and so on — proved by the brute-force test).
(function () {
  "use strict";

  const CFG = {
    VERSION: "1.1.0",
    MAX_LEVEL: 5,
    ITEMS_PER_LEVEL: 4,
    DECK_H_MIN: 190,
    DECK_H_MAX: 220,
    CARD_H: 150,
    PLAY_R: 46,
    BEAT: 0.9,    // celebration beat after the last item is bought
    WIGGLE_T: 0.5,
    BOUNCE_T: 0.3,
  };

  // 24 things to buy, in four bands — each level brings new things.
  const ITEMS = [
    { e: "\u{1F32E}", n: "taco", band: 1 },
    { e: "\u{1F366}", n: "ice cream", band: 1 },
    { e: "\u{1F9C3}", n: "juice box", band: 1 },
    { e: "\u{1F9C1}", n: "cupcake", band: 1 },
    { e: "\u{1F36A}", n: "cookie", band: 1 },
    { e: "\u{1F34E}", n: "apple", band: 1 },
    { e: "\u{1F355}", n: "pizza", band: 2 },
    { e: "\u{1F369}", n: "donut", band: 2 },
    { e: "\u{1F964}", n: "soda", band: 2 },
    { e: "\u{1F353}", n: "strawberry", band: 2 },
    { e: "\u{1F37F}", n: "popcorn", band: 2 },
    { e: "\u{1F36C}", n: "candy", band: 2 },
    { e: "\u{1F388}", n: "balloon", band: 3 },
    { e: "\u{1F9F8}", n: "teddy bear", band: 3 },
    { e: "\u{26BD}", n: "ball", band: 3 },
    { e: "\u{1FA80}", n: "yo-yo", band: 3 },
    { e: "\u{1FA81}", n: "kite", band: 3 },
    { e: "\u{1F986}", n: "duck", band: 3 },
    { e: "\u{1F697}", n: "toy car", band: 4 },
    { e: "\u{1F381}", n: "gift", band: 4 },
    { e: "\u{1F680}", n: "rocket", band: 4 },
    { e: "\u{1F3B8}", n: "guitar", band: 4 },
    { e: "\u{1F451}", n: "crown", band: 4 },
    { e: "\u{1F6B2}", n: "bike", band: 4 },
  ];

  // Four DISTINCT whole-dollar amounts per level. Distinctness is
  // what makes the puzzle work: with a duplicate amount any
  // allocation covers everything and there is nothing to figure out.
  const LEVEL_AMOUNTS = {
    1: [1, 2, 3, 4],
    2: [1, 2, 4, 5],
    3: [1, 3, 4, 5],
    4: [2, 3, 4, 5],
    5: null, // any 4 of 1..5, shuffled
  };

  function dollarUp(cents) { return Math.ceil(cents / 100); }
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
  function sndPop() {
    tone(520, 0.09, { type: "triangle", vol: 0.10 });
    tone(780, 0.12, { type: "triangle", vol: 0.08, when: 0.05 });
  }
  function sndBoop() { tone(220, 0.14, { type: "sine", vol: 0.10 }); }
  function sndWin() { arp([523, 659, 784, 1046, 1318], 0.11, "square", 0.10); }

  // ---- music: one original cheerful loop, bass loud -----------------
  // An ORIGINAL cheerful bounce, composed here for Dollar Up!:
  // C major, short singable phrases with a variation at the end,
  // rests that breathe, and a harmony voice a third under the lead
  // (the NES second pulse channel). Bouncy bass (root on the beat,
  // fifth off it) and a clap-along drum feel (kick on 1 and 3,
  // snare on 2 and 4). 64 sixteenth steps at 120 BPM, bass LOUD
  // at 0.2.
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

  // ---- canvas --------------------------------------------------------
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  let W = 400, H = 700, DPR = 1, DECK_H = 200, PH = 500;
  let cards = [];    // {x, y, w, h, amount} — the four money cards
  let tileGeom = []; // {x, y, w, h} — the four item tiles, 2x2
  let playBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  let nextBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  // LAY: every font that scales with the screen is capped here.
  // (Live-check fix 2026-11-19: at 1919px wide the title font hit
  // 211px and "UP!" landed on the emoji row, and the card numeral
  // hit 186px and burst out of its 150px card. Width scaling is
  // for the portrait phone, not a desktop monitor.)
  let LAY = { titleFont: 44, titleGap: 55, emojiFont: 80, cardFont: 34,
    cardStar: 38, winTitle: 34, winStars: 96, levelFont: 30, flashFont: 36,
    tileEmoji: 72 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.28, CFG.DECK_H_MIN, CFG.DECK_H_MAX));
    PH = H - DECK_H;
    const gap = 10, cw = Math.min((W - gap * 5) / 4, 220);
    const totalW = cw * 4 + gap * 3;
    const startX = (W - totalW) / 2;
    const cy = PH + (DECK_H - CFG.CARD_H) / 2;
    cards = [0, 1, 2, 3].map((i) => ({
      x: startX + i * (cw + gap), y: cy, w: cw, h: CFG.CARD_H, amount: 0,
    }));
    // Item tiles: 2x2 grid in the playfield, dots row below them.
    // The grid starts at y=104: the site-wide 84px HTML back button
    // sits top-left (14px padding + 84px button = down to y=98),
    // and nothing may hide under it — the Coloring Book lesson.
    const tGap = 14;
    const tw = Math.min((W - tGap * 3) / 2, 320);
    const th = (PH - 104 - 40 - tGap) / 2;
    const gx = (W - (tw * 2 + tGap)) / 2;
    tileGeom = [0, 1, 2, 3].map((i) => ({
      x: gx + (i % 2) * (tw + tGap),
      y: 104 + Math.floor(i / 2) * (th + tGap),
      w: tw, h: th,
    }));
    playBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    nextBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    LAY = {
      titleFont: Math.round(Math.min(W * 0.11, 96)),
      titleGap: 0, // filled below, from the capped font
      emojiFont: Math.round(Math.min(W * 0.20, PH * 0.24, 150)),
      cardFont: Math.round(Math.min(cw * 0.30, 44)),
      cardStar: Math.round(Math.min(cw * 0.34, 48)),
      winTitle: Math.round(Math.min(W * 0.085, 72)),
      winStars: Math.round(Math.min(W * 0.24, 150)),
      levelFont: Math.round(Math.min(W * 0.075, 64)),
      flashFont: Math.round(Math.min(W * 0.09, 72)),
      tileEmoji: Math.round(Math.min(W * 0.18, 96)),
    };
    LAY.titleGap = Math.round(LAY.titleFont * 1.25);
  }

  // ---- game state ----------------------------------------------------
  let state = "title"; // title | play | levelClear | win
  let level = 1, stars = 0; // stars = items bought (0..4)
  let tiles = []; // {item, priceCents, need, placed} — placed = amount or 0
  let deck = [];  // {amount, placed} — one card per bill
  let selected = 0, selIdx = -1; // the money card picked up, 0 = none
  let beatT = 0, flash = null;
  let wiggle = null; // {kind: "card"|"tile", idx, t}
  let bounce = null; // {kind: "tile", idx, t}

  function makeLevel(n) {
    const amounts = LEVEL_AMOUNTS[n]
      ? LEVEL_AMOUNTS[n].slice()
      : shuffle([1, 2, 3, 4, 5]).slice(0, 4);
    const pool = ITEMS.filter((it) => it.band <= Math.min(n, 4));
    const pics = shuffle(pool.slice()).slice(0, CFG.ITEMS_PER_LEVEL);
    const pairing = shuffle(amounts.slice());
    const made = pics.map((it, i) => {
      const a = pairing[i];
      // Price strictly inside the dollar band (a-1, a): never whole,
      // and its dollar-up IS a — so the intended match is exact.
      const price = (a - 1) * 100 + 5 + Math.floor(Math.random() * 90);
      return { item: it, priceCents: price, need: a, placed: 0 };
    });
    shuffle(made);
    return {
      tiles: made,
      deck: shuffle(amounts.slice()).map((a) => ({ amount: a, placed: false })),
    };
  }

  function startGame() {
    level = 1; stars = 0; selected = 0; selIdx = -1;
    beatT = 0; flash = null; wiggle = null; bounce = null;
    const lv = makeLevel(1);
    tiles = lv.tiles; deck = lv.deck;
    state = "play";
    if (window.SDGplays) window.SDGplays.played("dollarup");
  }
  function nextLevel() {
    level++;
    stars = 0; selected = 0; selIdx = -1;
    beatT = 0; flash = null; wiggle = null; bounce = null;
    const lv = makeLevel(level);
    tiles = lv.tiles; deck = lv.deck;
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

  // ---- the matching --------------------------------------------------
  function selectDeck(i) {
    const d = deck[i];
    if (!d || d.placed) return;
    if (selIdx === i) { selIdx = -1; selected = 0; sndTick(); return; }
    selIdx = i; selected = d.amount;
    sndTick();
  }
  function placeOnTile(ti) {
    const t = tiles[ti];
    if (!t) return;
    if (t.placed) {
      // Tap an item that already has money: take it back so she can
      // rearrange. No penalty — rearranging IS the game.
      const d = deck.find((x) => x.amount === t.placed);
      if (d) d.placed = false;
      t.placed = 0; stars--;
      sndPop();
      return;
    }
    if (!selected) {
      // Nothing picked up: a little bounce says "pick money first".
      bounce = { kind: "tile", idx: ti, t: CFG.BOUNCE_T };
      sndTick();
      return;
    }
    if (selected * 100 >= t.priceCents) {
      // It covers the price — it buys the item, even when it is more
      // than the smallest amount that would do. A $5 buys a $2 juice.
      t.placed = selected;
      const d = deck[selIdx];
      if (d) d.placed = true;
      selIdx = -1; selected = 0;
      stars++;
      const g = tileGeom[ti];
      burst(g.x + g.w / 2, g.y + g.h / 2, "#ffe14d");
      sndDing();
      if (stars >= CFG.ITEMS_PER_LEVEL) {
        beatT = CFG.BEAT;
        flash = { text: "ALL BOUGHT!", t: CFG.BEAT };
      }
    } else {
      // Too little to buy it — the card wiggles, nothing is lost.
      wiggle = { kind: "card", idx: selIdx, t: CFG.WIGGLE_T };
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
  function money(n) {
    return n === 5 ? "$5" : "$" + n;
  }
  function drawBills(cx, y, n, bw) {
    // A fan of n green bills, each bw wide — count them to check.
    const bh = 30, gap = 4;
    const total = n * bw + (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const bx = cx - total / 2 + i * (bw + gap);
      ctx.fillStyle = i % 2 ? "#5cb85c" : "#4caf50";
      ctx.fillRect(bx, y, bw, bh);
      ctx.strokeStyle = "#2e7d32"; ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, y + 1, bw - 2, bh - 2);
      ctx.fillStyle = "#2e7d32";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("$", bx + bw / 2, y + bh / 2);
    }
  }
  function drawCard(c, i) {
    const d = deck[i];
    if (!d || d.placed) return; // spent bills leave the deck
    let x = c.x, y = c.y;
    if (selIdx === i) y -= 10; // picked up: it lifts
    if (wiggle && wiggle.kind === "card" && wiggle.idx === i) {
      x += Math.sin(wiggle.t * 40) * 6;
    }
    ctx.fillStyle = selIdx === i ? "#1d3a2a" : "#14202e";
    ctx.strokeStyle = selIdx === i ? "#ffe14d" : "#29faff";
    ctx.lineWidth = selIdx === i ? 4 : 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, c.w, c.h, 14); else ctx.rect(x, y, c.w, c.h);
    ctx.fill(); ctx.stroke();
    // The bills, fanned: $1 = one bill, $2 = two, $5 = one $5 bill.
    const n = d.amount === 5 ? 1 : d.amount;
    const bw = Math.min(64, (c.w - 12) / n);
    drawBills(x + c.w / 2, y + 34, n, bw);
    if (d.amount === 5) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("FIVE", x + c.w / 2, y + 34 + 44);
    }
    // The big numeral — the amount she is choosing. Capped in LAY
    // so it can never burst out of the card on a wide screen.
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + LAY.cardFont + "px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(money(d.amount), x + c.w / 2, y + c.h - 42);
  }
  function drawTile(t, i) {
    const g = tileGeom[i];
    if (!g) return;
    let x = g.x, y = g.y;
    if (bounce && bounce.kind === "tile" && bounce.idx === i) {
      y += Math.sin(bounce.t * 30) * 3;
    }
    ctx.fillStyle = t.placed ? "#1d3a2a" : "#101c2a";
    ctx.strokeStyle = t.placed ? "#ffe14d" : "#29faff";
    ctx.lineWidth = t.placed ? 4 : 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, g.w, g.h, 16); else ctx.rect(x, y, g.w, g.h);
    ctx.fill(); ctx.stroke();
    // The thing to buy.
    ctx.font = LAY.tileEmoji + "px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t.item.e, x + g.w / 2, y + g.h * 0.32);
    // Its receipt price.
    const pw = 118, ph = 38;
    const px = x + (g.w - pw) / 2, py = y + g.h * 0.55;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 8); else ctx.rect(px, py, pw, ph);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.font = "bold 16px monospace";
    ctx.fillText("$" + (t.priceCents / 100).toFixed(2), x + g.w / 2, py + ph / 2 + 1);
    if (t.placed) {
      // The money spent on it, stuck to the tile — tap it to take back.
      const n = t.placed === 5 ? 1 : t.placed;
      const bw = Math.min(48, (g.w - 40) / n);
      drawBills(x + g.w / 2, y + g.h - 52, n, bw);
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold 30px monospace";
      ctx.fillText("\u2605", x + g.w - 22, y + 24);
    }
  }
  function drawDots() {
    for (let i = 0; i < CFG.ITEMS_PER_LEVEL; i++) {
      const x = W / 2 + (i - 1.5) * 26;
      const y = PH - 26;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < stars ? "#ffe14d" : "#2a3a4d";
      ctx.fill();
      ctx.strokeStyle = "#29faff"; ctx.lineWidth = 2; ctx.stroke();
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
      ctx.fillStyle = "#29faff";
      ctx.font = "bold " + LAY.titleFont + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("DOLLAR", W / 2, PH * 0.30);
      ctx.fillText("UP!", W / 2, PH * 0.30 + LAY.titleGap);
      ctx.font = LAY.emojiFont + "px monospace";
      ctx.fillText("\u{1F32E} \u{1F4B5} \u{1F9C1}", W / 2, PH * 0.68);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    if (state === "win") {
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold " + LAY.winTitle + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("YOU DID IT!", W / 2, PH * 0.32);
      ctx.font = LAY.winStars + "px monospace";
      ctx.fillText("\u2605".repeat(3), W / 2, PH * 0.55);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    // play + levelClear: the four things and the four bills.
    tiles.forEach((t, i) => drawTile(t, i));
    drawDots();
    drawLevelDigit();
    cards.forEach((c, i) => drawCard(c, i));
    if (flash && flash.t > 0) {
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold " + LAY.flashFont + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(flash.text, W / 2, PH * 0.52);
    }
    if (state === "levelClear") {
      ctx.fillStyle = "rgba(6,10,18,0.55)";
      ctx.fillRect(0, 0, W, PH);
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold " + LAY.levelFont + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("LEVEL " + level + "!", W / 2, PH * 0.42);
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
    stepParticles(dt);
    if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
    if (wiggle) { wiggle.t -= dt; if (wiggle.t <= 0) wiggle = null; }
    if (bounce) { bounce.t -= dt; if (bounce.t <= 0) bounce = null; }
    if (beatT > 0) {
      beatT -= dt;
      if (beatT <= 0) {
        if (level >= CFG.MAX_LEVEL) winGame(); else levelClear();
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
    // play: money cards first, then the things.
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y - 12 && y <= c.y + c.h) {
        selectDeck(i);
        return;
      }
    }
    for (let i = 0; i < tileGeom.length; i++) {
      const g = tileGeom[i];
      if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
        placeOnTile(i);
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
  window.__duTest = {
    get state() { return state; },
    get level() { return level; },
    get stars() { return stars; },
    get tiles() { return tiles; },
    get deck() { return deck; },
    get selected() { return selected; },
    get selIdx() { return selIdx; },
    get cards() { return cards; },
    get tileGeom() { return tileGeom; },
    get playBtn() { return playBtn; },
    get nextBtn() { return nextBtn; },
    get deckTop() { return PH; },
    get layout() { return LAY; },
    get screen() { return { W: W, H: H, PH: PH }; },
    get music() { return MUSIC_CFG; },
    get items() { return ITEMS; },
    dollarUp: dollarUp,
    fresh: function () {
      state = "title"; level = 1; stars = 0;
      selected = 0; selIdx = -1; beatT = 0; flash = null;
      wiggle = null; bounce = null; tiles = []; deck = [];
    },
    startGame: startGame,
    selectDeck: selectDeck,
    placeOnTile: placeOnTile,
    levelClear: levelClear,
    winGame: winGame,
    onDown: onDown,
    render: render,
    resize: function (w, h) { window.innerWidth = w; window.innerHeight = h; resize(); },
    // Deal an exact level for tests: amounts, prices (cents) and
    // item indexes line up by position; deck keeps the given order.
    deal: function (amounts, prices, idxs) {
      const pics = (idxs || [0, 1, 2, 3]).map((i) => ITEMS[i]);
      tiles = pics.map((it, i) => ({
        item: it, priceCents: prices[i], need: dollarUp(prices[i]), placed: 0,
      }));
      deck = amounts.slice().map((a) => ({ amount: a, placed: false }));
      stars = 0; selected = 0; selIdx = -1;
      beatT = 0; flash = null; wiggle = null; bounce = null;
      state = "play";
    },
    stepN: function (n) { for (let i = 0; i < n; i++) step(1 / 60); },
  };
})();
