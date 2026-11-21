// Bigger! (#29) — his daughter's "Comparing Numbers" school worksheet
// as a game (worksheet rows: 45 vs 39, 91 vs 71, 53 vs 53, 16 vs 81,
// 28 vs 25, 97 vs 59 ...). Two-digit numbers, no words anywhere in the
// game — the numbers ARE the content.
//
// Each round: two BIG two-digit numbers (10-99) side by side. Tap the
// BIGGER one — or the SMALLER one on alternate rounds. The prompt is
// VISUAL only: a giant ▲ with an oversized "9" at top means pick the
// BIGGER number; a tiny ▼ with a small "1" means pick the SMALLER one.
// BIGGER and SMALLER rounds are mixed inside every level (2 + 2).
//
// Numbers get closer as levels rise: L1 gap >= 20, L2 >= 10, L3 >= 5,
// L4 >= 2, L5 gap of exactly 1 (e.g. 47 vs 48). Numbers are never
// equal in a round. 4 rounds per level. A wrong tap just wiggles the
// wrong number — no penalty, no game over, retry until right. Correct:
// star burst + ding, a progress dot lights up. The level clears only
// when the player taps the big ▶ button (never auto-advance). Clear
// L5 for the grand finale: fireworks + confetti until PLAY AGAIN
// restarts at L1.
//
// Escalation — each level adds something new to SEE, not just closer
// numbers: L1 plain big numbers; L2 numbers on coloured balls;
// L3 numbers on stars with a sparkle trail; L4 numbers on balloons;
// L5 golden numbers, with fireworks on every correct pick.
(function () {
  "use strict";

  const CFG = {
    VERSION: "1.0.0",
    MAX_LEVEL: 5,
    ROUNDS_PER_LEVEL: 4,
    // Minimum gap per level (index 0 = L1). L5 is exactly 1, enforced
    // in makePair, not here.
    MIN_GAP: [20, 10, 5, 2, 1],
    BEAT: 0.9,    // celebration beat after the last round is right
    WIGGLE_T: 0.5,
    PLAY_R: 46,
  };

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
  function sndBoop() { tone(220, 0.14, { type: "sine", vol: 0.10 }); }
  function sndWin() { arp([523, 659, 784, 1046, 1318], 0.11, "square", 0.10); }
  function sndFanfare() {
    // L5 golden fanfare on every correct pick: a rising brass-ish run.
    arp([392, 523, 659, 784, 1046], 0.07, "square", 0.09);
  }

  // ---- music: one ORIGINAL fanfare march loop -----------------------
  // A fanfare march in G major — a parade, not Dollar Up!'s cheerful
  // bounce: dotted march rhythm, a rising call in bar 1 answered in
  // bar 2, a lower call in bar 3, and a variation ending on the tonic
  // in bar 4. Bass marches root on the beat, fifth off it (a real
  // oom-pah march feel); kick on 1 and 3, snare on 2 and 4; harmony
  // a third under the lead (the NES second pulse channel).
  // 64 sixteenth steps at 132 BPM, bass LOUD at 0.2.
  const G2 = 98, D2 = 73.42, A2 = 110, C3 = 130.81, D3 = 146.83;
  const B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25,
        F5 = 698.46, G5 = 783.99, A5 = 880, B5 = 987.77, D6 = 1174.66;
  const MUSIC_CFG = {
    bpm: 132, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 8, 16, 24, 32, 40, 48, 56], snares: [4, 12, 20, 28, 36, 44, 52, 60], hats: "odd",
    bass: [G2,0,D3,0, G2,0,D3,0, G2,0,D3,0, G2,0,D3,0,
           D2,0,A2,0, D2,0,A2,0, D2,0,A2,0, D2,0,A2,0,
           C3,0,G2,0, C3,0,G2,0, C3,0,G2,0, C3,0,G2,0,
           G2,0,D3,0, D2,0,A2,0, G2,0,D3,0, G2,0,0,0],
    lead: [G5,0,0,0, B5,0,0,0, A5,0,G5,0, A5,0,0,0,
           B5,0,0,0, D6,0,B5,0, A5,0,G5,0, F5,0,0,0,
           G5,0,0,0, B5,0,0,0, A5,0,G5,0, E5,0,0,0,
           D5,0,E5,0, F5,0,G5,0, A5,0,0,0, G5,0,0,0],
    harmony: new Array(64).fill(0),
  };
  // Harmony: a third under the lead wherever the lead sings.
  (function () {
    const third = {};
    third[G5] = E5; third[A5] = F5; third[B5] = G5; third[D6] = B5;
    third[F5] = D5; third[E5] = C5; third[D5] = B4;
    for (let i = 0; i < 64; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }
  let musicStarted = false;
  function startMusic() {
    if (!musicStarted && MUSIC) {
      try { MUSIC.start(); } catch (e) {}
      musicStarted = true;
    }
  }

  // ---- canvas --------------------------------------------------------
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  let W = 400, H = 700, DPR = 1, DECK_H = 110, PH = 590;
  let numGeom = []; // {x, y, w, h} — the two big number pads
  let playBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  let nextBtn = { x: 200, y: 560, r: CFG.PLAY_R };
  // LAY: every font that scales with the screen is capped here.
  let LAY = { numFont: 80, promptFont: 44, promptSmall: 20, bigDigit: 120,
    levelFont: 30, dotsR: 9, titleNum: 80 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = 110;
    PH = H - DECK_H;
    // Two number pads side by side in the playfield, below the prompt
    // row (prompt lives y=104..~200) and above the deck. Mirrored:
    // both pads are the same size, either hand can reach either one.
    const gap = 16;
    const pw = Math.min((W - gap * 3) / 2, 340);
    const ph = Math.min(260, PH - 230);
    const gx = (W - (pw * 2 + gap)) / 2;
    const py = 210;
    numGeom = [0, 1].map((i) => ({
      x: gx + i * (pw + gap), y: py, w: pw, h: ph,
    }));
    playBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    nextBtn = { x: W / 2, y: PH + DECK_H / 2, r: CFG.PLAY_R };
    LAY = {
      numFont: Math.round(Math.min(pw * 0.42, PH * 0.22, 110)),
      promptFont: Math.round(Math.min(W * 0.11, 64)),
      promptSmall: Math.round(Math.min(W * 0.05, 28)),
      bigDigit: Math.round(Math.min(W * 0.30, 160)),
      levelFont: Math.round(Math.min(W * 0.075, 64)),
      dotsR: 9,
      titleNum: Math.round(Math.min(W * 0.20, 96)),
    };
  }

  // ---- game state ----------------------------------------------------
  let state = "title"; // title | play | levelClear | win
  let level = 1;
  let rounds = []; // {a, b, kind: "bigger"|"smaller"} — 4 per level
  let roundIdx = 0, done = 0; // done = rounds answered right (0..4)
  let beatT = 0;
  let wiggle = null; // {idx, t} — the wrong number wiggles
  let bounce = null; // {idx, t} — the right number pops
  let sparkleT = 0;

  function minGapFor(n) { return CFG.MIN_GAP[n - 1]; }

  function makePair(n) {
    // Two DISTINCT two-digit numbers with the level's gap.
    // L5: gap of exactly 1. L1-4: gap >= the level minimum.
    for (let tries = 0; tries < 200; tries++) {
      const a = 10 + Math.floor(Math.random() * 90);
      let gap;
      if (n >= CFG.MAX_LEVEL) {
        gap = 1;
      } else {
        const minGap = minGapFor(n);
        gap = minGap + Math.floor(Math.random() * (40 - minGap + 1));
      }
      const dir = Math.random() < 0.5 ? 1 : -1;
      const b = a + dir * gap;
      if (b >= 10 && b <= 99 && b !== a) return { a: a, b: b };
    }
    // Fallback (practically unreachable): a clean L5-style pair.
    return { a: 47, b: 48 };
  }
  function makeLevel(n) {
    // 4 rounds: 2 BIGGER + 2 SMALLER, shuffled — never all of one kind.
    const kinds = shuffle(["bigger", "bigger", "smaller", "smaller"]);
    return kinds.map((kind) => {
      const p = makePair(n);
      return { a: p.a, b: p.b, kind: kind };
    });
  }
  function current() { return rounds[roundIdx]; }
  function correctIdx() {
    const r = current();
    if (!r) return -1;
    if (r.kind === "bigger") return r.a > r.b ? 0 : 1;
    return r.a < r.b ? 0 : 1;
  }

  function startGame() {
    level = 1; roundIdx = 0; done = 0;
    beatT = 0; wiggle = null; bounce = null;
    rounds = makeLevel(1);
    state = "play";
    startMusic();
    if (window.SDGplays) window.SDGplays.played("bigger");
  }
  function nextLevel() {
    level++;
    roundIdx = 0; done = 0;
    beatT = 0; wiggle = null; bounce = null;
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
    confettiBurst();
  }

  // ---- answering -----------------------------------------------------
  function answer(i) {
    if (state !== "play") return;
    const r = current();
    if (!r) return;
    if (i === correctIdx()) {
      const g = numGeom[i];
      if (g) burst(g.x + g.w / 2, g.y + g.h / 2, level >= 5 ? "#ffe14d" : "#29faff");
      if (level >= 5) {
        sndFanfare();
        fireworks(g ? g.x + g.w / 2 : W / 2, g ? g.y + g.h / 2 : PH / 2);
      } else {
        sndDing();
      }
      bounce = { idx: i, t: 0.35 };
      done++;
      roundIdx++;
      if (done >= CFG.ROUNDS_PER_LEVEL) beatT = CFG.BEAT;
    } else {
      // Wrong number — it wiggles, nothing is lost, try again.
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
    // A gold star at the centre of the burst.
    parts.push({ x: x, y: y, vx: 0, vy: -30, life: 0.7, t: 0, color: "#ffe14d", r: 16, shape: "star" });
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
  function confettiBurst() {
    const colors = ["#ffe14d", "#29faff", "#ff6ec7", "#7dff5e", "#ff9f1c"];
    for (let i = 0; i < 60; i++) {
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120,
        life: 2.5 + Math.random() * 1.5, t: 0,
        color: colors[i % colors.length], r: 4 + Math.random() * 4, shape: "confetti" });
    }
  }
  function sparkle(x, y) {
    parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30,
      life: 0.6 + Math.random() * 0.4, t: 0, color: "#ffe14d", r: 3 + Math.random() * 3, shape: "star" });
  }
  function stepParticles(dt) {
    parts.forEach((p) => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.shape !== "confetti") p.vy += 260 * dt;
    });
    parts = parts.filter((p) => p.t < p.life);
  }
  function drawStar(cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
  function drawParticles() {
    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      if (p.shape === "star") {
        drawStar(p.x, p.y, p.r, p.color);
      } else if (p.shape === "confetti") {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 4, p.r, p.r / 2);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  // ---- drawing -------------------------------------------------------
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
    for (let i = 0; i < CFG.ROUNDS_PER_LEVEL; i++) {
      const x = W / 2 + (i - 1.5) * 26;
      const y = PH + DECK_H / 2;
      ctx.beginPath(); ctx.arc(x, y, LAY.dotsR, 0, Math.PI * 2);
      ctx.fillStyle = i < done ? "#ffe14d" : "#2a3a4d";
      ctx.fill();
      ctx.strokeStyle = "#29faff"; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  function drawLevelDigit() {
    ctx.fillStyle = "rgba(41,250,255,0.35)";
    ctx.font = "bold 44px 'Press Start 2P', monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(String(level), W - 18, PH + DECK_H / 2);
  }
  // The prompt, visual only: BIGGER = a giant ▲ + an oversized "9";
  // SMALLER = a tiny ▼ + a small "1". The SIZE is the message.
  function drawPrompt() {
    const r = current();
    if (!r) return;
    const cy = 152;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (r.kind === "bigger") {
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.moveTo(W / 2 - 52, cy + 34);
      ctx.lineTo(W / 2 + 52, cy + 34);
      ctx.lineTo(W / 2, cy - 44);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + LAY.promptFont + "px 'Press Start 2P', monospace";
      ctx.fillText("9", W / 2 + 92, cy);
    } else {
      ctx.fillStyle = "#29faff";
      ctx.beginPath();
      ctx.moveTo(W / 2 - 16, cy - 10);
      ctx.lineTo(W / 2 + 16, cy - 10);
      ctx.lineTo(W / 2, cy + 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + LAY.promptSmall + "px 'Press Start 2P', monospace";
      ctx.fillText("1", W / 2 + 44, cy);
    }
  }
  function drawBalloon(g, color) {
    // A balloon behind the number: ellipse + knot + string.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(g.x + g.w / 2, g.y + g.h * 0.42, g.w * 0.42, g.h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(g.x + g.w / 2 - 8, g.y + g.h * 0.78);
    ctx.lineTo(g.x + g.w / 2 + 8, g.y + g.h * 0.78);
    ctx.lineTo(g.x + g.w / 2, g.y + g.h * 0.88);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x + g.w / 2, g.y + g.h * 0.88);
    ctx.quadraticCurveTo(g.x + g.w / 2 + 10, g.y + g.h * 0.95, g.x + g.w / 2 - 4, g.y + g.h);
    ctx.stroke();
  }
  function drawPad(i) {
    const g = numGeom[i];
    const r = current();
    if (!g || !r) return;
    const n = i === 0 ? r.a : r.b;
    let x = g.x, y = g.y;
    if (wiggle && wiggle.idx === i) x += Math.sin(wiggle.t * 40) * 8;
    if (bounce && bounce.idx === i) y -= Math.sin((0.35 - bounce.t) * 18) * 6;
    const golden = level >= 5;
    const numColor = golden ? "#ffe14d" : "#ffffff";
    const border = golden ? "#ffe14d" : "#29faff";
    if (level === 2) {
      // Numbers on coloured balls.
      const ballColor = i === 0 ? "#ff6ec7" : "#29faff";
      ctx.fillStyle = ballColor;
      ctx.beginPath(); ctx.arc(x + g.w / 2, y + g.h / 2, Math.min(g.w, g.h) * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(x + g.w / 2 - 22, y + g.h / 2 - 26, 14, 0, Math.PI * 2); ctx.fill();
    } else if (level === 3) {
      // Numbers on stars.
      drawStar(x + g.w / 2, y + g.h / 2, Math.min(g.w, g.h) * 0.52, i === 0 ? "#ffe14d" : "#ff9f1c");
    } else if (level === 4) {
      // Numbers on balloons (they bob gently).
      const bob = Math.sin(Date.now() / 500 + i * 2) * 4;
      ctx.save();
      ctx.translate(0, bob);
      drawBalloon({ x: x, y: y, w: g.w, h: g.h }, i === 0 ? "#ff6ec7" : "#29faff");
      ctx.restore();
    } else {
      // L1 plain pads, L5 golden pads.
      ctx.fillStyle = golden ? "#2a2205" : "#101c2a";
      ctx.strokeStyle = border;
      ctx.lineWidth = golden ? 5 : 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, g.w, g.h, 16); else ctx.rect(x, y, g.w, g.h);
      ctx.fill(); ctx.stroke();
    }
    if (level === 2 || level === 3 || level === 4) {
      // A thin ring so the pad's tap area reads clearly on the ball/star/balloon.
      ctx.strokeStyle = border; ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, g.w, g.h, 16); else ctx.rect(x, y, g.w, g.h);
      ctx.stroke();
    }
    // The number itself — the whole game. Capped in LAY so it can
    // never burst out of its pad on a wide screen.
    ctx.fillStyle = numColor;
    ctx.font = "bold " + LAY.numFont + "px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n), x + g.w / 2, y + g.h / 2 + 2);
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
    // Deck: darker shelf with a cyan top edge — dots + level digit live here.
    ctx.fillStyle = "#0b141f";
    ctx.fillRect(0, PH, W, DECK_H);
    ctx.fillStyle = "#29faff";
    ctx.fillRect(0, PH, W, 3);

    if (state === "title") {
      // No words: two sample numbers with a giant ▲ between them,
      // and the ▶ button. The picture IS the instructions.
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.moveTo(W / 2 - 52, PH * 0.30 + 34);
      ctx.lineTo(W / 2 + 52, PH * 0.30 + 34);
      ctx.lineTo(W / 2, PH * 0.30 - 44);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + LAY.titleNum + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("47", W / 2 - 110, PH * 0.55);
      ctx.fillText("48", W / 2 + 110, PH * 0.55);
      ctx.fillStyle = "#29faff";
      ctx.font = "bold " + Math.round(LAY.titleNum * 0.5) + "px 'Press Start 2P', monospace";
      ctx.fillText("9", W / 2 + 92, PH * 0.30);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    if (state === "win") {
      // No words: three gold stars, fireworks + confetti keep going
      // until PLAY AGAIN (▶) restarts at L1.
      ctx.fillStyle = "#ffe14d";
      ctx.font = LAY.bigDigit + "px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u2605\u2605\u2605", W / 2, PH * 0.45);
      drawBigButton(playBtn, "\u25B6", "#22a355");
      drawParticles();
      return;
    }

    // play + levelClear: the prompt, the two numbers, the dots.
    drawPrompt();
    drawPad(0);
    drawPad(1);
    drawDots();
    drawLevelDigit();
    if (state === "levelClear") {
      ctx.fillStyle = "rgba(6,10,18,0.55)";
      ctx.fillRect(0, 0, W, PH);
      // No words: the big level digit + four gold stars.
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold " + LAY.bigDigit + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(level), W / 2, PH * 0.38);
      ctx.font = Math.round(LAY.bigDigit * 0.55) + "px monospace";
      ctx.fillText("\u2605\u2605\u2605\u2605", W / 2, PH * 0.62);
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
    if (MUSIC) MUSIC.tick(dt);
    if (wiggle) { wiggle.t -= dt; if (wiggle.t <= 0) wiggle = null; }
    if (bounce) { bounce.t -= dt; if (bounce.t <= 0) bounce = null; }
    if (beatT > 0) {
      beatT -= dt;
      if (beatT <= 0) {
        if (level >= CFG.MAX_LEVEL) winGame(); else levelClear();
      }
    }
    // L3 sparkle trail: gold sparks drift across the pads.
    if (state === "play" && level === 3) {
      sparkleT -= dt;
      if (sparkleT <= 0) {
        sparkleT = 0.12;
        const g = numGeom[Math.floor(Math.random() * 2)];
        if (g) sparkle(g.x + Math.random() * g.w, g.y + Math.random() * g.h);
      }
    }
    if (state === "win") {
      if (Math.random() < dt * 1.6) {
        fireworks(Math.random() * W, Math.random() * PH * 0.6 + 40);
      }
      if (Math.random() < dt * 0.8) confettiBurst();
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
    // play: tap either number pad.
    for (let i = 0; i < numGeom.length; i++) {
      const g = numGeom[i];
      if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
        answer(i);
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
  window.__bgTest = {
    get state() { return state; },
    get level() { return level; },
    get rounds() { return rounds; },
    get roundIdx() { return roundIdx; },
    get done() { return done; },
    get current() { return current(); },
    get correctIdx() { return correctIdx(); },
    get numGeom() { return numGeom; },
    get playBtn() { return playBtn; },
    get nextBtn() { return nextBtn; },
    get deckTop() { return PH; },
    get layout() { return LAY; },
    get screen() { return { W: W, H: H, PH: PH }; },
    get music() { return MUSIC_CFG; },
    get musicState() { return MUSIC ? { on: MUSIC.on, step: MUSIC.step } : null; },
    get minGap() { return CFG.MIN_GAP.slice(); },
    minGapFor: minGapFor,
    makePair: makePair,
    makeLevel: makeLevel,
    fresh: function () {
      state = "title"; level = 1; roundIdx = 0; done = 0;
      beatT = 0; wiggle = null; bounce = null; rounds = [];
    },
    startGame: startGame,
    setLevel: function (n) {
      level = n; rounds = makeLevel(n); roundIdx = 0; done = 0;
      beatT = 0; wiggle = null; bounce = null; state = "play";
    },
    answer: answer,
    levelClear: levelClear,
    winGame: winGame,
    onDown: onDown,
    render: render,
    resize: function (w, h) { window.innerWidth = w; window.innerHeight = h; resize(); },
    // Deal exact rounds for tests: [{a, b, kind}] — kind "bigger"|"smaller".
    deal: function (rs) {
      rounds = rs.map((r) => ({ a: r.a, b: r.b, kind: r.kind }));
      roundIdx = 0; done = 0;
      beatT = 0; wiggle = null; bounce = null;
      state = "play";
    },
    stepN: function (n) { for (let i = 0; i < n; i++) step(1 / 60); },
  };
})();
