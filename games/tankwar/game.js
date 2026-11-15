/* ============================================================
   TANK WAR — SmoothDaddyG
   ------------------------------------------------------------
   Danny's 2026-11-15 call: "a little tank game" — two
   controls at the bottom of the screen, push both up to go
   forward, both down to go backwards, one up and one down
   to turn. An open arena, NOT a maze, with rocks, trees and
   barriers to hide behind. Drive out from cover, shoot, back
   up, push out again. Blow stuff up. 3 levels. Enemy tanks
   come after you trying to blow you up — a tank war. It
   takes a few hits to blow you up. V1: let's see how it
   feels.

   THE CONTROLS (his spec, literal) — classic dual-track
   tank steering, two big vertical drag levers in the bottom
   deck: left lever = left track, right lever = right track.
   Drag a lever up and that track drives forward; drag it
   down and that track reverses; let go and it springs back
   to center. Both up = forward, both down = reverse, one
   up and one down = spin in place. The pair is symmetric,
   so the same control works from either side — mirrored by
   construction. No FIRE button: the tank AUTO-FIRES straight
   ahead (barrel direction) on a short cooldown, so the two
   levers are the whole game, exactly as specified. Driving
   is aiming. Field touches do NOTHING during play — all
   control lives in the deck, thumbs never cover the action.
   A tap on a lever in the title screen starts the game and
   grabs that lever for the same finger.

   THE ARENA: open field, no maze walls — scattered rocks,
   trees and barriers that block BOTH movement and shells,
   so they work as cover. Hide behind a rock, back up, push
   out and boom boom boom. Enemy tanks chase you and shoot
   when they're lined up with a clear line of sight.
   3 levels, each with a new layout and a new enemy mix
   (escalation: new things to see, not just harder numbers).

   NO-GAME-OVER: 3 armor. A hit flashes you invulnerable
   for a beat. Destroyed = explosion, brief pause, respawn
   at the level start with progress intact (enemies you
   already blew up stay blown up). Never a game-over screen.
   NO READING: hearts, a level digit, enemy dots, stars —
   pictures only.
   MUSIC: an original march loop composed here (square lead,
   triangle bass at vol 0.2, noise drums, a harmony voice)
   — its own melody, never a re-skin of another game.
   ============================================================ */
"use strict";
(function () {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  /* ---------------- config ---------------- */
  const CFG = {
    PLAYER_R: 16, PLAYER_SPEED: 150, TURN_MAX: 3.2, // units/sec, rad/sec
    FIRE_CD: 0.5, SHELL_SPEED: 420, SHELL_LIFE: 1.0, SHELL_R: 4,
    ESHELL_SPEED: 300, ESHELL_LIFE: 1.4, ESHELL_R: 4,
    ARMOR_MAX: 3, INVULN_T: 1.2, RESPAWN_T: 1.2, CELEB_T: 2.2,
    LEVER_R: 34, SLOT_W: 76,
  };
  const ENEMY_TYPES = {
    scout:  { r: 15, hp: 1, speed: 55, turn: 2.4, cd: 1.6, color: "#ff3b30" },
    gunner: { r: 16, hp: 2, speed: 62, turn: 2.2, cd: 1.3, color: "#ff9f2e" },
    brute:  { r: 20, hp: 3, speed: 42, turn: 1.6, cd: 2.0, color: "#c86bff" },
  };
  // Levels: open arena, obstacles as fractions of the arena
  // (x, y in 0..1 of arena width/height; r in fractions of the
  // smaller arena side; barriers w/h in fractions of arena w/h).
  // Enemies spawn as fractions too. Player always starts at
  // (0.5, 0.86), facing up. Layouts are hand-checked: spawns
  // are clear of obstacles and no obstacle seals the arena.
  const LEVELS = [
    { // L1 — two slow scouts, a few rocks and trees to learn cover
      enemies: [
        { type: "scout", x: 0.25, y: 0.20 },
        { type: "scout", x: 0.75, y: 0.22 },
      ],
      obstacles: [
        { kind: "rock", x: 0.30, y: 0.45, r: 0.055 },
        { kind: "rock", x: 0.70, y: 0.50, r: 0.060 },
        { kind: "tree", x: 0.50, y: 0.30, r: 0.050 },
        { kind: "tree", x: 0.85, y: 0.35, r: 0.045 },
        { kind: "barrier", x: 0.15, y: 0.65, w: 0.16, h: 0.05 },
        { kind: "barrier", x: 0.72, y: 0.68, w: 0.16, h: 0.05 },
      ],
    },
    { // L2 — + a gunner (2 hits, faster fire) and more cover
      enemies: [
        { type: "scout", x: 0.20, y: 0.18 },
        { type: "scout", x: 0.80, y: 0.18 },
        { type: "gunner", x: 0.50, y: 0.14 },
      ],
      obstacles: [
        { kind: "rock", x: 0.22, y: 0.40, r: 0.060 },
        { kind: "rock", x: 0.78, y: 0.42, r: 0.060 },
        { kind: "rock", x: 0.50, y: 0.55, r: 0.050 },
        { kind: "tree", x: 0.35, y: 0.25, r: 0.050 },
        { kind: "tree", x: 0.65, y: 0.28, r: 0.050 },
        { kind: "tree", x: 0.50, y: 0.72, r: 0.050 },
        { kind: "barrier", x: 0.10, y: 0.60, w: 0.18, h: 0.05 },
        { kind: "barrier", x: 0.75, y: 0.62, w: 0.18, h: 0.05 },
      ],
    },
    { // L3 — + a 3-hit brute in the middle, cover everywhere
      enemies: [
        { type: "scout", x: 0.15, y: 0.15 },
        { type: "scout", x: 0.85, y: 0.15 },
        { type: "gunner", x: 0.50, y: 0.12 },
        { type: "brute", x: 0.50, y: 0.30 },
      ],
      obstacles: [
        { kind: "rock", x: 0.25, y: 0.35, r: 0.060 },
        { kind: "rock", x: 0.75, y: 0.38, r: 0.060 },
        { kind: "rock", x: 0.50, y: 0.50, r: 0.055 },
        { kind: "rock", x: 0.08, y: 0.30, r: 0.050 },
        { kind: "rock", x: 0.92, y: 0.30, r: 0.050 },
        { kind: "tree", x: 0.15, y: 0.55, r: 0.050 },
        { kind: "tree", x: 0.85, y: 0.58, r: 0.050 },
        { kind: "tree", x: 0.50, y: 0.20, r: 0.045 },
        { kind: "barrier", x: 0.32, y: 0.65, w: 0.16, h: 0.05 },
        { kind: "barrier", x: 0.55, y: 0.68, w: 0.16, h: 0.05 },
      ],
    },
  ];

  /* ---------------- helpers ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /* ---------------- audio ---------------- */
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  function sndShoot() { tone(700, 0.10, { type: "square", vol: 0.08, slideTo: 180 }); }
  function sndEShoot() { tone(320, 0.12, { type: "square", vol: 0.06, slideTo: 120 }); }
  function sndHit() { noiseS(0.12, { filter: "bandpass", freq: 1200, vol: 0.12 }); }
  function sndHurt() { tone(300, 0.3, { type: "sawtooth", vol: 0.12, slideTo: 80 }); }
  function sndBoom() {
    noiseS(0.5, { filter: "lowpass", freq: 900, vol: 0.2, slideTo: 100 });
    tone(150, 0.4, { type: "triangle", vol: 0.14, slideTo: 40 });
  }
  function sndKill() { arp([523, 659, 784, 1046], 0.06, "square", 0.10); sndBoom(); }
  function sndRespawn() { arp([392, 523, 659, 784, 1046], 0.07, "square", 0.10); }
  function sndFanfare() { arp([523, 659, 784, 1046, 784, 1046, 1318], 0.11, "square", 0.10); }
  function sndFinale() { arp([523, 659, 784, 1046, 1318, 1568, 2093, 2637], 0.12, "square", 0.11); noiseS(0.9, { filter: "highpass", freq: 3000, vol: 0.05, when: 0.3 }); }

  /* ---------------- background music ----------------
     An ORIGINAL march loop, composed here for Tank War: a
     D-minor tank march — short singable phrase, rests that
     breathe, a variation at the end of the phrase, and a
     harmony voice a third under the lead (the NES second
     pulse channel). Driving eighth-note bass (D pedal, then
     F-A walk, G-Bb lift, back to D) and a march drum feel
     (kick on 1 and 3, snare on 2 and 4). 64 sixteenth
     steps at 126 BPM, bass LOUD at 0.2. */
  const D2 = 73.42, F2 = 87.31, G2 = 98, A2 = 110, Bb2 = 116.54, C3 = 130.81;
  const D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, Bb5 = 932.33, C6 = 1046.5;
  const MUSIC_CFG = {
    bpm: 126, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 8, 16, 24, 32, 40, 48, 56], snares: [4, 12, 20, 28, 36, 44, 52, 60], hats: "odd",
    bass: [D2,0,D2,0, D2,0,A2,0, D2,0,D2,0, D2,0,A2,0,
           D2,0,D2,0, F2,0,A2,0, D2,0,D2,0, F2,0,A2,0,
           G2,0,G2,0, Bb2,0,G2,0, G2,0,G2,0, Bb2,0,G2,0,
           D2,0,D2,0, A2,0,A2,0, D2,0,C3,0, D2,0,0,0],
    lead: [D5,0,F5,0, A5,0,G5,F5, F5,0,E5,0, D5,0,0,0,
           D5,0,F5,0, A5,0,C6,0, A5,0,G5,0, F5,0,E5,0,
           G5,0,A5,0, Bb5,0,A5,0, G5,0,F5,0, E5,0,D5,0,
           D5,0,F5,0, A5,0,G5,0, F5,0,E5,0, D5,0,0,0],
    harmony: new Array(64).fill(0),
  };
  // Harmony: a third under the lead wherever the lead sings.
  (function () {
    const third = {};
    third[D5] = 466.16; third[E5] = 523.25; third[F5] = 587.33;
    third[G5] = 659.25; third[A5] = 698.46; third[Bb5] = 783.99; third[C6] = 880;
    for (let i = 0; i < 64; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }

  /* ---------------- layout ----------------
     Physics runs in "units": 1 unit = U px, where
     U = min(W, PH) / 400, so the arena is always the full
     playfield and layouts scale to any screen. */
  let W = 400, H = 700, DPR = 1, DECK_H = 190, PH = 510, U = 1;
  let arenaW = 400, arenaH = 510, deckTop = 510;
  let leverL = { x: 96, cy: 0, half: 60 }, leverR = { x: 304, cy: 0, half: 60 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.26, 170, 210));
    PH = H - DECK_H; deckTop = PH;
    U = Math.min(W, PH) / 400;
    arenaW = W / U; arenaH = PH / U;
    const slotH = DECK_H - 44, half = slotH / 2 - CFG.LEVER_R;
    leverL = { x: Math.round(W * 0.24), cy: deckTop + DECK_H / 2, half: half };
    leverR = { x: Math.round(W * 0.76), cy: deckTop + DECK_H / 2, half: half };
    if (level) buildLevel(level); // keep layouts fitted after a rotate
  }
  window.addEventListener("resize", resize);
  // Unit-space helpers for rendering (px = u * U, y in the playfield).
  const px = (u) => u * U;
  const py = (u) => u * U;

  /* ---------------- state ---------------- */
  let state = "title"; // title | play | dead | levelup | win
  let level = 1, hearts = CFG.ARMOR_MAX, kills = 0;
  let time = 0, deadT = 0, celebT = 0, fireCd = 0;
  let obstacles = [], enemies = [], bullets = [], ebullets = [], parts = [], rings = [];
  let killFlash = null; // {x, y, t} — big gold star where a tank blew up
  const player = { x: 200, y: 400, angle: -Math.PI / 2, invuln: 0 };

  function buildLevel(n) {
    const def = LEVELS[n - 1];
    const m = Math.min(arenaW, arenaH);
    obstacles = def.obstacles.map((o) => {
      if (o.kind === "barrier") {
        return { kind: "barrier", x: o.x * arenaW, y: o.y * arenaH, w: o.w * arenaW, h: o.h * arenaH };
      }
      return { kind: o.kind, x: o.x * arenaW, y: o.y * arenaH, r: o.r * m };
    });
    enemies = def.enemies.map((e) => {
      const t = ENEMY_TYPES[e.type];
      return { type: e.type, x: e.x * arenaW, y: e.y * arenaH, angle: Math.PI / 2,
        hp: t.hp, maxHp: t.hp, r: t.r, alive: true, cd: 1 + e.x, stuckT: 0 };
    });
    bullets = []; ebullets = []; parts = []; rings = []; killFlash = null;
    placeAtStart();
    player.angle = -Math.PI / 2; player.invuln = 1.0; fireCd = 0.3;
  }
  function placeAtStart() {
    player.x = arenaW * 0.5; player.y = arenaH * 0.86;
    collideCircle(player, CFG.PLAYER_R);
  }
  function startLevel(n) { level = n; buildLevel(n); }
  function startGame() {
    level = 1; hearts = CFG.ARMOR_MAX; kills = 0;
    startLevel(1); state = "play";
    if (MUSIC) MUSIC.start();
    if (window.SDGplays) window.SDGplays.played("tankwar");
  }

  /* ---------------- collision ----------------
     Circles (tanks, shells, rocks, trees) and rects
     (barriers). Obstacles block movement AND shells, so
     they work as cover. */
  function collideCircle(ent, r) {
    for (const o of obstacles) {
      if (o.kind === "barrier") {
        const nx = clamp(ent.x, o.x, o.x + o.w), ny = clamp(ent.y, o.y, o.y + o.h);
        const dx = ent.x - nx, dy = ent.y - ny, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 === 0) {
          // Centre inside the rect: push out the nearest side.
          const dl = ent.x - o.x, dr = o.x + o.w - ent.x;
          const dt = ent.y - o.y, db = o.y + o.h - ent.y;
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) ent.x = o.x - r;
          else if (m === dr) ent.x = o.x + o.w + r;
          else if (m === dt) ent.y = o.y - r;
          else ent.y = o.y + o.h + r;
          continue;
        }
        const d = Math.sqrt(d2), push = (r - d) / d;
        ent.x += dx * push; ent.y += dy * push;
      } else {
        const dx = ent.x - o.x, dy = ent.y - o.y, rr = r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) {
          if (d2 === 0) { ent.x = o.x + rr; }
          continue;
        }
        const d = Math.sqrt(d2), push = (rr - d) / d;
        ent.x += dx * push; ent.y += dy * push;
      }
    }
    ent.x = clamp(ent.x, r, arenaW - r);
    ent.y = clamp(ent.y, r, arenaH - r);
  }
  function pointBlocked(x, y) {
    for (const o of obstacles) {
      if (o.kind === "barrier") {
        if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return true;
      } else if (dist(x, y, o.x, o.y) < o.r) return true;
    }
    return false;
  }
  // Line of sight: true when no obstacle sits between the two points.
  function segBlocked(x1, y1, x2, y2) {
    for (const o of obstacles) {
      if (o.kind === "barrier") {
        // Liang–Barsky slab test for the segment vs the rect.
        const dx = x2 - x1, dy = y2 - y1;
        let t0 = 0, t1 = 1;
        const p = [-dx, dx, -dy, dy];
        const q = [x1 - o.x, o.x + o.w - x1, y1 - o.y, o.y + o.h - y1];
        let hit = true;
        for (let i = 0; i < 4; i++) {
          if (p[i] === 0) { if (q[i] < 0) { hit = false; break; } }
          else {
            const t = q[i] / p[i];
            if (p[i] < 0) { if (t > t1) { hit = false; break; } if (t > t0) t0 = t; }
            else { if (t < t0) { hit = false; break; } if (t < t1) t1 = t; }
          }
        }
        if (hit) return true;
      } else {
        // Distance from the circle centre to the segment.
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((o.x - x1) * dx + (o.y - y1) * dy) / len2;
        t = clamp(t, 0, 1);
        const cx = x1 + t * dx, cy = y1 + t * dy;
        if (dist(cx, cy, o.x, o.y) < o.r) return true;
      }
    }
    return false;
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < (n || 12); i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(0.5, speed || 3);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s * 40, vy: Math.sin(a) * s * 40,
        t: 0, life: rnd(0.4, 0.8), color: color, size: rnd(2, 5), star: false });
    }
  }
  function starBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rnd(-0.2, 0.2), s = rnd(50, 110);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, life: rnd(0.5, 0.9), color: "#ffe14d", size: rnd(4, 7), star: true });
    }
    rings.push({ x: x, y: y, t: 0, life: 0.5, maxR: 46, color: "#ffe14d" });
    killFlash = { x: x, y: y, t: 0.7 };
  }

  /* ---------------- input: the two levers ----------------
     Left half of the deck grabs the left lever, right half
     grabs the right one — the whole deck half is the grab
     zone, so a finger never misses. The lever value follows
     the finger's height in the slot and springs back to
     center on release. Two pointers can hold both levers at
     once. Field touches are ignored during play. */
  const levers = { L: 0, R: 0 };
  const leverGrab = { L: null, R: null }; // pointerId holding each lever
  let testLever = null; // test hooks only: {L, R} overrides live levers
  function leverValue(lever, y) {
    const v = clamp((lever.cy - y) / lever.half, -1, 1);
    return Math.abs(v) < 0.12 ? 0 : v;
  }
  function grabLever(x, y, id) {
    const side = x < W / 2 ? "L" : "R";
    leverGrab[side] = id;
    levers[side] = leverValue(side === "L" ? leverL : leverR, y);
    return side;
  }
  function onDown(x, y, id) {
    if (state === "title") startGame();
    else if (state === "win" && celebT > 1.5) startGame();
    if (state !== "play") return;
    if (y >= deckTop) grabLever(x, y, id);
    // Field touches: deliberately ignored — the deck is the control.
  }
  function onMove(x, y, id) {
    if (leverGrab.L === id) levers.L = leverValue(leverL, y);
    else if (leverGrab.R === id) levers.R = leverValue(leverR, y);
  }
  function onUp(id) {
    if (leverGrab.L === id) { leverGrab.L = null; levers.L = 0; }
    if (leverGrab.R === id) { leverGrab.R = null; levers.R = 0; }
  }
  function ptrPos(e) {
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) || e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); const p = ptrPos(e); onDown(p.x, p.y, e.pointerId); });
  canvas.addEventListener("pointermove", function (e) { e.preventDefault(); const p = ptrPos(e); onMove(p.x, p.y, e.pointerId); });
  canvas.addEventListener("pointerup", function (e) { e.preventDefault(); onUp(e.pointerId); });
  canvas.addEventListener("pointercancel", function (e) { e.preventDefault(); onUp(e.pointerId); });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function hurtPlayer(sx, sy) {
    if (player.invuln > 0 || state !== "play") return;
    hearts -= 1;
    player.invuln = CFG.INVULN_T;
    sndHurt();
    const d = Math.hypot(player.x - sx, player.y - sy) || 1;
    player.x += (player.x - sx) / d * 14; player.y += (player.y - sy) / d * 14;
    collideCircle(player, CFG.PLAYER_R);
    burst(player.x, player.y, "#ff3b30", 10, 2);
    rings.push({ x: player.x, y: player.y, t: 0, life: 0.4, maxR: 40, color: "#ff3b30" });
    if (hearts <= 0) {
      state = "dead"; deadT = 0;
      burst(player.x, player.y, "#29faff", 30, 3);
      rings.push({ x: player.x, y: player.y, t: 0, life: 0.6, maxR: 70, color: "#29faff" });
      sndBoom();
    }
  }
  function tickPlayer(dt) {
    const L = testLever ? testLever.L : levers.L;
    const R = testLever ? testLever.R : levers.R;
    // Dual-track steering: forward speed is the average of the
    // two tracks, turn rate is their difference. Both up =
    // forward, both down = reverse, one up one down = spin.
    const v = (L + R) / 2 * CFG.PLAYER_SPEED;
    const w = (R - L) / 2 * CFG.TURN_MAX;
    player.angle += w * dt;
    player.x += Math.cos(player.angle) * v * dt;
    player.y += Math.sin(player.angle) * v * dt;
    collideCircle(player, CFG.PLAYER_R);
    if (player.invuln > 0) player.invuln -= dt;
    // Auto-fire straight ahead (barrel direction) — driving is aiming.
    fireCd -= dt;
    if (fireCd <= 0) {
      fireCd = CFG.FIRE_CD;
      bullets.push({ x: player.x + Math.cos(player.angle) * (CFG.PLAYER_R + 6),
        y: player.y + Math.sin(player.angle) * (CFG.PLAYER_R + 6),
        vx: Math.cos(player.angle) * CFG.SHELL_SPEED, vy: Math.sin(player.angle) * CFG.SHELL_SPEED,
        life: CFG.SHELL_LIFE, color: "#ffe14d" });
      sndShoot();
    }
  }
  function tickEnemies(dt) {
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      const t = ENEMY_TYPES[e.type];
      // Turn toward the player at a limited rate, then drive.
      const diff = angDiff(want, e.angle);
      const turn = clamp(diff, -t.turn * dt, t.turn * dt);
      e.angle += turn;
      const ox = e.x, oy = e.y;
      e.x += Math.cos(e.angle) * t.speed * dt;
      e.y += Math.sin(e.angle) * t.speed * dt;
      collideCircle(e, e.r);
      // Stuck against cover? After a beat, back up and swing around.
      if (dist(e.x, e.y, ox, oy) < t.speed * dt * 0.25) {
        e.stuckT += dt;
        if (e.stuckT > 0.6) {
          e.angle += Math.PI * 0.7;
          e.x += Math.cos(e.angle) * t.speed * dt * 2;
          e.y += Math.sin(e.angle) * t.speed * dt * 2;
          collideCircle(e, e.r);
          e.stuckT = 0;
        }
      } else e.stuckT = 0;
      // Shoot when roughly lined up with a clear line of sight.
      e.cd -= dt;
      if (e.cd <= 0 && state === "play" && d < 420 &&
          Math.abs(angDiff(want, e.angle)) < 0.22 &&
          !segBlocked(e.x, e.y, player.x, player.y)) {
        e.cd = t.cd;
        ebullets.push({ x: e.x + Math.cos(e.angle) * (e.r + 6),
          y: e.y + Math.sin(e.angle) * (e.r + 6),
          vx: Math.cos(e.angle) * CFG.ESHELL_SPEED, vy: Math.sin(e.angle) * CFG.ESHELL_SPEED,
          life: CFG.ESHELL_LIFE, color: "#ff3b30" });
        sndEShoot();
      }
    }
    // Keep enemy tanks from stacking on one spot.
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (!a.alive || !b.alive) continue;
      const d = dist(a.x, a.y, b.x, b.y), min = a.r + b.r;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2 / d;
        a.x -= (b.x - a.x) * push; a.y -= (b.y - a.y) * push;
        b.x += (b.x - a.x) * push; b.y += (b.y - a.y) * push;
      }
    }
    // Ramming hurts — a tank driving into you costs armor.
    if (state === "play") {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (dist(player.x, player.y, e.x, e.y) < e.r + CFG.PLAYER_R) {
          const d = dist(player.x, player.y, e.x, e.y) || 1;
          e.x += (e.x - player.x) / d * 10; e.y += (e.y - player.y) / d * 10;
          hurtPlayer(e.x, e.y);
        }
      }
    }
  }
  function tickBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > arenaW || b.y > arenaH || pointBlocked(b.x, b.y)) {
        if (b.life > 0) burst(b.x, b.y, b.color, 4, 1);
        bullets.splice(i, 1); continue;
      }
      let dead = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + CFG.SHELL_R) {
          e.hp -= 1;
          burst(e.x, e.y, "#ff9f2e", 8, 2); sndHit();
          if (e.hp <= 0) {
            e.alive = false; kills += 1;
            starBurst(e.x, e.y); sndKill();
          }
          dead = true; break;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > arenaW || b.y > arenaH || pointBlocked(b.x, b.y)) {
        ebullets.splice(i, 1); continue;
      }
      if (state === "play" && dist(b.x, b.y, player.x, player.y) < CFG.PLAYER_R + CFG.ESHELL_R) {
        ebullets.splice(i, 1);
        hurtPlayer(b.x, b.y);
      }
    }
    // Level cleared once every enemy tank is blown up.
    if (state === "play" && enemies.length > 0 && enemies.every((e) => !e.alive)) {
      state = "levelup"; celebT = 0; sndFanfare();
      burst(arenaW / 2, arenaH / 2, "#ffe14d", 40, 4);
    }
  }
  function tick(dt) {
    time += dt;
    if (killFlash) { killFlash.t -= dt; if (killFlash.t <= 0) killFlash = null; }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - dt * 1.5); p.vy *= (1 - dt * 1.5);
      if (p.t >= p.life) parts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].t += dt;
      if (rings[i].t >= rings[i].life) rings.splice(i, 1);
    }
    if (state === "play") { tickPlayer(dt); tickEnemies(dt); tickBullets(dt); }
    else if (state === "dead") {
      deadT += dt;
      if (deadT >= CFG.RESPAWN_T) {
        // Respawn with ALL progress intact: level kept, kills kept,
        // enemies already blown up stay blown up. Armor refills.
        placeAtStart();
        player.angle = -Math.PI / 2;
        hearts = CFG.ARMOR_MAX; player.invuln = 1.5;
        bullets = []; ebullets = [];
        sndRespawn(); state = "play";
      }
    } else if (state === "levelup") {
      celebT += dt;
      if (Math.random() < dt * 8) parts.push({ x: rnd(20, arenaW - 20), y: rnd(10, 60), vx: rnd(-20, 20), vy: rnd(40, 100), t: 0, life: rnd(0.8, 1.4), color: ["#ffe14d", "#29faff", "#ff3df0", "#3dff7a"][Math.floor(rnd(0, 4))], size: rnd(3, 6), star: Math.random() < 0.5 });
      if (celebT >= CFG.CELEB_T) {
        if (level >= 3) { state = "win"; celebT = 0; sndFinale(); }
        else { startLevel(level + 1); state = "play"; }
      }
    } else if (state === "win") {
      celebT += dt;
      if (Math.random() < dt * 10) parts.push({ x: rnd(20, arenaW - 20), y: rnd(10, 60), vx: rnd(-20, 20), vy: rnd(40, 100), t: 0, life: rnd(0.8, 1.4), color: ["#ffe14d", "#29faff", "#ff3df0", "#3dff7a"][Math.floor(rnd(0, 4))], size: rnd(3, 6), star: Math.random() < 0.5 });
    }
  }

  /* ---------------- render ---------------- */
  function drawHeart(cx, cy, s, filled) {
    ctx.fillStyle = filled ? "#ff3b30" : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.2, cy, cx - s * 0.6, cy - s * 0.9, cx, cy - s * 0.3);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 0.9, cx + s * 1.2, cy, cx, cy + s * 0.9);
    ctx.fill();
  }
  function drawStar(cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 4;
      const rr = i % 2 ? r * 0.42 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  function drawTank(x, y, angle, r, body, hp, maxHp) {
    const cx = px(x), cy = py(y), pr = r * U;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    // Tracks: two dark treads on the sides.
    ctx.fillStyle = "#14141f";
    ctx.fillRect(-pr * 0.95, -pr * 1.05, pr * 1.9, pr * 0.42);
    ctx.fillRect(-pr * 0.95, pr * 0.63, pr * 1.9, pr * 0.42);
    // Hull.
    ctx.fillStyle = body;
    ctx.fillRect(-pr * 0.85, -pr * 0.7, pr * 1.7, pr * 1.4);
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2;
    ctx.strokeRect(-pr * 0.85, -pr * 0.7, pr * 1.7, pr * 1.4);
    // Barrel + turret.
    ctx.strokeStyle = body; ctx.lineWidth = Math.max(3, pr * 0.28);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(pr * 1.7, 0); ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, pr * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); ctx.arc(0, 0, pr * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Armor pips over tough tanks — pictures, not numbers.
    if (maxHp > 1) {
      for (let i = 0; i < maxHp; i++) {
        ctx.fillStyle = i < hp ? "#ffe14d" : "rgba(255,255,255,0.2)";
        ctx.beginPath(); ctx.arc(cx + (i - (maxHp - 1) / 2) * 12, cy - pr - 12, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function drawLever(lever, value) {
    const x = lever.x, cy = lever.cy, half = lever.half;
    const top = cy - half - CFG.LEVER_R, bot = cy + half + CFG.LEVER_R;
    // Slot.
    ctx.fillStyle = "#0a0a13";
    ctx.fillRect(x - CFG.SLOT_W / 2, top, CFG.SLOT_W, bot - top);
    ctx.strokeStyle = "rgba(41,250,255,0.5)"; ctx.lineWidth = 3;
    ctx.strokeRect(x - CFG.SLOT_W / 2, top, CFG.SLOT_W, bot - top);
    // Chevrons: up at the top, down at the bottom — no words.
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath(); ctx.moveTo(x, top + 8); ctx.lineTo(x - 12, top + 22); ctx.lineTo(x + 12, top + 22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, bot - 8); ctx.lineTo(x - 12, bot - 22); ctx.lineTo(x + 12, bot - 22); ctx.closePath(); ctx.fill();
    // Handle follows the finger; springs back to center on release.
    const hy = cy - value * half;
    ctx.fillStyle = value !== 0 ? "#29faff" : "#1d7f8a";
    ctx.beginPath(); ctx.arc(x, hy, CFG.LEVER_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, hy, CFG.LEVER_R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 16, hy); ctx.lineTo(x + 16, hy); ctx.stroke();
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0a13"; ctx.fillRect(0, 0, W, H);
    // Floor: olive field, subtle checker so the arena reads.
    for (let y = 0; y < arenaH; y += 40) for (let x = 0; x < arenaW; x += 40) {
      ctx.fillStyle = ((x / 40 + y / 40) % 2) ? "#262b18" : "#202512";
      ctx.fillRect(px(x), py(y), Math.min(40 * U, W - px(x)), Math.min(40 * U, PH - py(y)));
    }
    // Obstacles: rocks, trees, barriers.
    for (const o of obstacles) {
      if (o.kind === "rock") {
        ctx.fillStyle = "#8a8a9e";
        ctx.beginPath(); ctx.arc(px(o.x), py(o.y), o.r * U, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6a6a7e";
        ctx.beginPath(); ctx.arc(px(o.x) - o.r * U * 0.25, py(o.y) - o.r * U * 0.25, o.r * U * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(px(o.x) - o.r * U * 0.3, py(o.y) - o.r * U * 0.35, o.r * U * 0.22, 0, Math.PI * 2); ctx.fill();
      } else if (o.kind === "tree") {
        ctx.fillStyle = "#3dff7a";
        ctx.beginPath(); ctx.arc(px(o.x), py(o.y), o.r * U, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2bb85e";
        ctx.beginPath(); ctx.arc(px(o.x) + o.r * U * 0.3, py(o.y) + o.r * U * 0.3, o.r * U * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#7a5230";
        ctx.beginPath(); ctx.arc(px(o.x), py(o.y), o.r * U * 0.22, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#b5893c";
        ctx.fillRect(px(o.x), py(o.y), o.w * U, o.h * U);
        ctx.strokeStyle = "#7a5c22"; ctx.lineWidth = 3;
        ctx.strokeRect(px(o.x), py(o.y), o.w * U, o.h * U);
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px(o.x) + 6, py(o.y) + o.h * U - 4);
        ctx.lineTo(px(o.x) + o.w * U - 6, py(o.y) + 4);
        ctx.stroke();
      }
    }
    // Enemy tanks.
    for (const e of enemies) {
      if (!e.alive) continue;
      drawTank(e.x, e.y, e.angle, e.r, ENEMY_TYPES[e.type].color, e.hp, e.maxHp);
    }
    // Player tank (blinks while invulnerable).
    if (state !== "win") {
      const blink = player.invuln > 0 && state === "play" && Math.floor(time * 12) % 2 === 0;
      ctx.globalAlpha = blink ? 0.4 : 1;
      drawTank(player.x, player.y, player.angle, CFG.PLAYER_R, "#29faff", hearts, 0);
      ctx.globalAlpha = 1;
    }
    // Shells.
    for (const b of bullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(px(b.x), py(b.y), Math.max(3, CFG.SHELL_R * U), 0, Math.PI * 2); ctx.fill();
    }
    for (const b of ebullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(px(b.x), py(b.y), Math.max(3, CFG.ESHELL_R * U), 0, Math.PI * 2); ctx.fill();
    }
    // Particles + shockwave rings + kill star.
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      if (p.star) drawStar(px(p.x), py(p.y), p.size * U, p.color);
      else { ctx.fillStyle = p.color; ctx.fillRect(px(p.x) - p.size * U / 2, py(p.y) - p.size * U / 2, p.size * U, p.size * U); }
    }
    ctx.globalAlpha = 1;
    for (const r of rings) {
      ctx.globalAlpha = Math.max(0, 1 - r.t / r.life);
      ctx.strokeStyle = r.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px(r.x), py(r.y), (r.t / r.life) * r.maxR * U, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (killFlash) drawStar(px(killFlash.x), py(killFlash.y), 34 * (killFlash.t / 0.7), "#ffe14d");
    // HUD: armor hearts top-centre (clear of the 84px back button),
    // kill stars under them, level digit top-right, and enemy dots
    // along the BOTTOM of the playfield — the top-left corner
    // belongs to the 84px back button, so nothing lives there.
    if (state !== "title") {
      for (let i = 0; i < CFG.ARMOR_MAX; i++) drawHeart(W / 2 + (i - 1) * 34, 22, 11, i < hearts);
      for (let i = 0; i < kills; i++) drawStar(W / 2 + (i - (kills - 1) / 2) * 18, 46, 7, "#ffe14d");
      enemies.forEach((e, i) => {
        if (!e.alive) return;
        ctx.fillStyle = ENEMY_TYPES[e.type].color;
        ctx.beginPath(); ctx.arc(24 + i * 22, PH - 26, 7, 0, Math.PI * 2); ctx.fill();
      });
      if (typeof drawPixelNumber === "function") drawPixelNumber(ctx, level, W - 40, 14, 6, "rgba(255,255,255,0.55)", false);
    }
    // ---- the bottom control deck (never gameplay, only controls) ----
    ctx.fillStyle = "#12121f"; ctx.fillRect(0, deckTop, W, DECK_H);
    ctx.fillStyle = "#29faff"; ctx.fillRect(0, deckTop, W, 3);
    const lvL = testLever ? testLever.L : levers.L;
    const lvR = testLever ? testLever.R : levers.R;
    drawLever(leverL, lvL);
    drawLever(leverR, lvR);
    // Overlays: title / level-up / win — pictures first, one big digit.
    if (state === "title") {
      ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, W, PH);
      ctx.fillStyle = "#29faff"; ctx.font = Math.min(44, W / 9) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("TANK", W / 2, PH * 0.3);
      ctx.fillText("WAR", W / 2, PH * 0.3 + 52);
      drawTank(arenaW / 2, arenaH * 0.55, -Math.PI / 2, 26, "#29faff", 0, 0);
      // Two lever hints: up chevrons over the deck slots.
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.moveTo(leverL.x, deckTop - 34); ctx.lineTo(leverL.x - 14, deckTop - 14); ctx.lineTo(leverL.x + 14, deckTop - 14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(leverR.x, deckTop - 34); ctx.lineTo(leverR.x - 14, deckTop - 14); ctx.lineTo(leverR.x + 14, deckTop - 14); ctx.closePath(); ctx.fill();
    } else if (state === "levelup") {
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, PH);
      drawStar(W / 2, PH * 0.4, 54, "#ffe14d");
    } else if (state === "win") {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, PH);
      drawStar(W / 2, PH * 0.4, 80, "#ffe14d");
      ctx.fillStyle = "#29faff"; ctx.font = Math.min(30, W / 12) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("YOU WIN", W / 2, PH * 0.62);
    }
  }

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (MUSIC) MUSIC.tick(dt);
    tick(dt);
    render();
  }
  resize();
  buildLevel(1);
  requestAnimationFrame(frame);

  /* Test hook (test-only, never used by the game). */
  window.__tankTest = {
    get state() { return state; },
    get level() { return level; },
    get hearts() { return hearts; },
    get kills() { return kills; },
    get enemies() { return enemies; },
    get obstacles() { return obstacles; },
    get player() { return player; },
    get bullets() { return bullets; },
    get ebullets() { return ebullets; },
    get levels() { return LEVELS; },
    get levers() { return { L: testLever ? testLever.L : levers.L, R: testLever ? testLever.R : levers.R }; },
    get cfg() { return { DECK_H: DECK_H, deckTop: deckTop, leverL: leverL, leverR: leverR, arenaW: arenaW, arenaH: arenaH, U: U }; },
    get music() { return MUSIC_CFG; },
    start: function () { startGame(); },
    toTitle: function () { state = "title"; },
    step: function (dt) { tick(dt || 0.016); },
    debug: {
      setLever: function (side, v) { testLever = testLever || { L: 0, R: 0 }; testLever[side] = v; },
      clearLevers: function () { testLever = null; levers.L = 0; levers.R = 0; },
      placePlayer: function (x, y, angle) { player.x = x; player.y = y; if (angle != null) player.angle = angle; },
      placeEnemy: function (i, x, y) { enemies[i].x = x; enemies[i].y = y; },
      setEnemyAngle: function (i, a) { enemies[i].angle = a; },
      setEnemyCd: function (i, v) { enemies[i].cd = v; },
      forceLevel: function (n) { level = n; buildLevel(n); state = "play"; },
      setHearts: function (n) { hearts = n; },
      clearInvuln: function () { player.invuln = 0; },
      forceDamage: function () { hurtPlayer(player.x + 1, player.y); },
      // A tap in the playfield during play — must change nothing.
      fieldTap: function (x, y) { onDown(x, y, 999); onUp(999); },
      deckTap: function (x, y) { onDown(x, y, 998); },
      deckMove: function (x, y) { onMove(x, y, 998); },
      deckRelease: function () { onUp(998); },
      leverState: function () { return { L: levers.L, R: levers.R, grabL: leverGrab.L, grabR: leverGrab.R }; },
      render: function () { render(); },
    },
  };
})();
