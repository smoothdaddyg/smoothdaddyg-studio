/* ============================================================
   CRAZY TRAFFIC — SmoothDaddyG
   ------------------------------------------------------------
   An Odyssey-style traffic dodger, Juan's 2026-10-22 spec: you
   are the car at the BOTTOM of the screen; traffic falls toward
   you and you weave through it. Some cars RICOCHET — they drift
   sideways and bounce off the road edges. Silly things wander
   onto the road: oil slicks, banana peels, a unicorn crossing,
   a chicken, a runaway beach ball — and sometimes a PLANE comes
   down the road. Grab the star blaster and ZAP the car ahead.

   THE CONTROL (his playtest fix, 2026-10-22): the bottom
   strip of the screen is a CONTROL DECK — empty of gameplay,
   just for your thumb, so your finger never covers your car
   (same lesson as Time Wings). Touch in the deck: drag
   RIGHT/LEFT to steer, UP to go faster, DOWN to slow down.
   The deck spans the full width, so either hand works (his
   daughter is left-handed — no fixed-side controls, ever;
   the old Race game died on exactly that).

   MUSIC: a groovy funk loop runs under the play (his rule:
   video games need background music — every game, going
   forward). And it's Beach-Buggy wacky: jump ramps that launch
   you OVER traffic, a cow standing in the road, crabs,
   seagulls, tumbleweeds, a sunbather set up in the fast lane,
   and a skateboarder weaving through it all.

   5 LEVELS, A NEW CAR EACH LEVEL (the reward: you earn the
   next ride). Each level is a distance — drive the miles on
   the progress bar to the checkered flag. Crashes spin you
   out for a second and NEVER cost progress (no-game-over rule).
   ============================================================ */
"use strict";
(function () {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  /* ---------------- config ---------------- */
  const CFG = {
    CRUISE: 0.45,        // speed the car settles to with no finger down
    WORLD_MIN: 70,       // world scroll px/s at speed 0 — slow means SLOW
    WORLD_ADD: 640,      // + this * speed01 — fast means REALLY fast (710)
    STEER_MAX: 460,      // lateral px/s at a full stick tilt
    STICK_R: 62,         // stick travel radius, px
    MILES_RATE: 0.034,   // miles/sec at (0.35 + speed01)
    GHOST_T: 2.0,        // invincibility seconds after a crash
    SPIN_T: 0.9,         // crash spin-out seconds
    OIL_SPIN_T: 0.7,     // oil/banana spin seconds
    BLASTER_T: 6,        // seconds of zapping per star pickup
    ZAP_EVERY: 0.26,     // zap cadence while the blaster is live
    ZAP_RANGE: 430,      // how far ahead the blaster reaches
    PLAYER_W: 58, PLAYER_H: 96,
    CAR_W: 56, CAR_H: 92,
  };
  // per-level: miles to drive, traffic cap, spawn gap, event gap
  const LEVELS = [
    { miles: 1.5, cars: 3, spawn: 1.55, event: 6.5 },
    { miles: 2.0, cars: 4, spawn: 1.30, event: 5.6 },
    { miles: 2.5, cars: 5, spawn: 1.10, event: 4.8 },
    { miles: 3.0, cars: 6, spawn: 0.95, event: 4.2 },
    { miles: 3.5, cars: 7, spawn: 0.82, event: 3.6 },
  ];
  // roadside palettes per level (day -> sand -> dusk -> purple -> night)
  const SIDE_COLORS = ["#3f9e4d", "#c9a86a", "#b06a3b", "#5b4a8a", "#1d2a52"];
  const SIDE_DARK = ["#357f40", "#b3945c", "#9a5a32", "#4a3c70", "#162040"];
  const CAR_COLORS = ["#e74c3c", "#3498db", "#f39c12", "#9b59b6", "#1abc9c",
                      "#e67e22", "#fd79a8", "#00cec9", "#fdcb6e", "#6c5ce7"];
  const PROPS = ["pizza", "surf", "tree", "gift", "balloons", "icecream"];

  /* ---------------- helpers ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh, shrink) {
    const s = shrink || 0.72;
    return Math.abs(ax - bx) < (aw + bw) * 0.5 * s &&
           Math.abs(ay - by) < (ah + bh) * 0.5 * s;
  }

  /* ---------------- audio ---------------- */
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  function sndHonk() { tone(392, 0.14, { type: "square", vol: 0.10 }); tone(494, 0.14, { type: "square", vol: 0.08 }); }
  function sndCrash() {
    noiseS(0.35, { filter: "lowpass", freq: 900, vol: 0.22 });
    tone(280, 0.4, { type: "sawtooth", vol: 0.12, slideTo: 55 });
  }
  function sndSpin() { tone(500, 0.55, { type: "sine", vol: 0.13, slideTo: 1400 }); tone(1400, 0.3, { type: "sine", vol: 0.08, when: 0.5, slideTo: 700 }); }
  function sndZap() { tone(1500, 0.16, { type: "sawtooth", vol: 0.10, slideTo: 120 }); noiseS(0.1, { filter: "highpass", freq: 2000, vol: 0.08 }); }
  function sndPickup() { arp([660, 880, 1100, 1320], 0.06, "square", 0.09); }
  function sndNeigh() { tone(880, 0.3, { type: "sawtooth", vol: 0.09, slideTo: 440 }); arp([1320, 1760, 2200], 0.05, "sine", 0.05); }
  function sndCluck() { tone(300, 0.07, { type: "square", vol: 0.1 }); tone(260, 0.09, { type: "square", vol: 0.1, when: 0.1 }); }
  function sndBoing() { tone(180, 0.25, { type: "sine", vol: 0.13, slideTo: 620 }); }
  function sndWhoosh() { noiseS(0.22, { filter: "bandpass", freq: 700, vol: 0.10, slideTo: 1800 }); }
  function sndFanfare() { arp([523, 659, 784, 1046, 784, 1046, 1318], 0.11, "square", 0.10); }
  function sndFinale() { arp([523, 659, 784, 1046, 1318, 1568, 2093], 0.12, "square", 0.11); noiseS(0.8, { filter: "highpass", freq: 3000, vol: 0.05, when: 0.3 }); }

  /* ---------------- background music ----------------
     A groovy little funk loop — his rule (2026-10-22): "video
     games need background music." A step sequencer under the
     SFX: triangle bass, kick, hats, and a lazy pentatonic lead.
     32 steps at 106 BPM, scheduled a step at a time from tick. */
  const MUSIC = {
    on: false, step: 0, t: 0,
    STEP_DUR: 60 / 106 / 2,
    BASS: [110, 0, 0, 110, 0, 0, 130.81, 0, 98, 0, 0, 98, 0, 0, 146.83, 0,
           110, 0, 0, 110, 0, 0, 130.81, 0, 164.81, 0, 146.83, 0, 130.81, 0, 98, 0],
    LEAD: [0, 0, 440, 0, 523.25, 0, 440, 0, 0, 392, 0, 0, 329.63, 0, 0, 0,
           0, 0, 440, 0, 659.25, 0, 523.25, 0, 440, 0, 392, 0, 329.63, 0, 0, 0],
  };
  function tickMusic(dt) {
    if (!MUSIC.on) return;
    MUSIC.t += dt;
    while (MUSIC.t >= MUSIC.STEP_DUR) {
      MUSIC.t -= MUSIC.STEP_DUR;
      const s = MUSIC.step % 32;
      MUSIC.step++;
      const b = MUSIC.BASS[s];
      if (b) tone(b, 0.22, { type: "triangle", vol: 0.15 });
      const l = MUSIC.LEAD[s];
      if (l) tone(l, 0.2, { type: "square", vol: 0.032 });
      if (s % 8 === 0) tone(130, 0.12, { type: "sine", vol: 0.18, slideTo: 42 });
      if (s % 8 === 4) noiseS(0.09, { filter: "bandpass", freq: 1800, vol: 0.045 });
      if (s % 2 === 1) noiseS(0.03, { filter: "highpass", freq: 6500, vol: 0.022 });
    }
  }

  /* ---------------- state ---------------- */
  let W = 400, H = 700, DPR = 1;
  let roadL = 30, roadR = 370;
  let stripH = 154;           // the control deck at the bottom
  let PH = 546;               // play-field height = H - stripH
  let state = "title";        // title | play | levelup | win
  let time = 0;
  let level = 1;              // 1..5
  let dist = 0;               // miles driven this level
  let speed01 = CFG.CRUISE;
  let scrollY = 0;            // total px scrolled (drives dashes + scenery)
  let shake = 0;
  let celebT = 0;             // time in the levelup/win celebration
  let finishY = -80;          // the checkered band sweeping down
  let spawnT = 1, eventT = 5, zapT = 0, honkT = 2;

  const player = {
    x: 200, y: 550, vx: 0, tilt: 0,
    spinT: 0, spinA: 0, ghost: 0, blasterT: 0, jumpT: 0,
  };
  let cars = [];    // traffic
  let things = [];  // obstacles + events + pickups
  let parts = [];   // particles
  let bolts = [];   // blaster bolts {x1,y1,x2,y2,t}

  /* ---------------- the thumb stick (in the deck) ----------------
     The bottom strip of the screen is a CONTROL DECK — empty of
     gameplay, just for your thumb, so your finger never covers
     your car (his playtest fix, same lesson as Time Wings). The
     circle idles in the deck; touch there and drag RIGHT/LEFT to
     steer, UP to go faster, DOWN to slow down. Release: the car
     settles back to cruise. The deck spans the whole width, so
     either hand works. */
  const stick = { on: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };

  function ptrPos(e) {
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) || e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  function onDown(e) {
    const p = ptrPos(e);
    if (state === "title") { startGame(); return; }
    if (state === "levelup" && celebT > 1.6) { nextLevel(); return; }
    if (state === "win" && celebT > 1.6) { startGame(); return; }
    if (state !== "play") return;
    // THE DECK RULE (his playtest): your thumb lives in the control
    // deck at the bottom, never on top of your car. Touches on the
    // field do nothing; the stick only wakes up in the deck.
    if (p.y < PH - 6) return;
    stick.on = true; stick.id = e.pointerId != null ? e.pointerId : null;
    stick.ox = p.x; stick.oy = clamp(p.y, PH + 14, H - 14); stick.dx = 0; stick.dy = 0;
    if (e.preventDefault) e.preventDefault();
  }
  function onMove(e) {
    if (!stick.on) return;
    const p = ptrPos(e);
    let dx = p.x - stick.ox, dy = p.y - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > CFG.STICK_R) { dx = dx / d * CFG.STICK_R; dy = dy / d * CFG.STICK_R; }
    stick.dx = dx; stick.dy = dy;
    if (e.preventDefault) e.preventDefault();
  }
  function onUp() { stick.on = false; stick.dx = 0; stick.dy = 0; }

  /* ---------------- flow ---------------- */
  function resetPlayer() {
    player.x = (roadL + roadR) / 2; player.y = PH - 120;
    player.vx = 0; player.tilt = 0;
    player.spinT = 0; player.spinA = 0; player.ghost = 0; player.blasterT = 0; player.jumpT = 0;
  }
  function startGame() {
    level = 1; dist = 0; celebT = 0; finishY = -80;
    cars = []; things = []; parts = []; bolts = [];
    spawnT = 1.2; eventT = 4; speed01 = CFG.CRUISE;
    resetPlayer();
    state = "play";
    MUSIC.on = true;
    if (window.SDGplays) window.SDGplays.played("crazytraffic");
    arp([392, 523, 659], 0.07, "square", 0.09);
  }
  function nextLevel() {
    level++; dist = 0; celebT = 0; finishY = -80;
    cars = []; things = []; bolts = [];
    spawnT = 1.2; eventT = 3.5;
    player.blasterT = 0; player.ghost = 1;
    state = "play";
    arp([392, 523, 659, 784], 0.07, "square", 0.09);
  }
  function levelDone() {
    state = level >= 5 ? "win" : "levelup";
    celebT = 0; finishY = -90;
    cars = []; things = []; bolts = [];
    if (state === "win") sndFinale(); else sndFanfare();
    confettiBlast(W / 2, H * 0.35, 130);
  }

  /* ---------------- spawning ---------------- */
  function spawnCar() {
    const L = LEVELS[level - 1];
    if (cars.length >= L.cars) return;
    const w = CFG.CAR_W;
    let x = rnd(roadL + w / 2 + 6, roadR - w / 2 - 6);
    // don't stack a fresh car on top of one that just spawned
    for (const c of cars) {
      if (c.y < 130 && Math.abs(c.x - x) < 86) x = clamp(roadL + roadR - x, roadL + w / 2 + 6, roadR - w / 2 - 6);
    }
    const ricochet = Math.random() < 0.38;
    cars.push({
      x: x, y: -70,
      rel: rnd(0.40, 0.64),                 // falls at this fraction of world speed
      vx: ricochet ? rnd(45, 105) * (Math.random() < 0.5 ? -1 : 1) : rnd(-8, 8),
      color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
      prop: Math.random() < 0.42 ? PROPS[(Math.random() * PROPS.length) | 0] : null,
      wob: rnd(0, 6.28), knocked: 0, honked: false, passed: false,
    });
  }
  function spawnEvent() {
    const opts = ["oil", "banana", "unicorn", "chicken", "ball", "ramp", "cow", "gull"];
    if (level >= 2) opts.push("blaster", "blaster", "crab", "tumbleweed", "sunbather");
    if (level >= 3) opts.push("plane", "skater");
    const kind = opts[(Math.random() * opts.length) | 0];
    if (kind === "oil" || kind === "banana" || kind === "blaster" || kind === "ramp") {
      const w = kind === "oil" ? 72 : kind === "ramp" ? 84 : 36;
      things.push({ kind: kind, x: rnd(roadL + 55, roadR - 55), y: -50, w: w, h: kind === "oil" ? 34 : kind === "ramp" ? 40 : 22, t: 0 });
    } else if (kind === "cow" || kind === "sunbather") {
      things.push({ kind: kind, x: rnd(roadL + 60, roadR - 60), y: -70, w: kind === "cow" ? 78 : 66, h: kind === "cow" ? 54 : 66, t: 0 });
    } else if (kind === "unicorn" || kind === "chicken" || kind === "crab") {
      const fromLeft = Math.random() < 0.5;
      const spd = kind === "unicorn" ? 58 : kind === "chicken" ? 92 : 150;
      things.push({
        kind: kind, x: fromLeft ? roadL - 60 : roadR + 60, y: rnd(60, PH * 0.42),
        vx: (fromLeft ? 1 : -1) * spd,
        w: kind === "unicorn" ? 68 : kind === "chicken" ? 36 : 44, h: kind === "unicorn" ? 46 : kind === "chicken" ? 32 : 28, t: 0, leapt: 0,
      });
    } else if (kind === "gull") {
      const fromLeft = Math.random() < 0.5;
      things.push({ kind: kind, x: fromLeft ? roadL - 50 : roadR + 50, y: rnd(70, PH * 0.3), vx: (fromLeft ? 1 : -1) * rnd(160, 220), w: 52, h: 24, t: 0 });
      tone(1200, 0.28, { type: "sawtooth", vol: 0.05, slideTo: 700 }); // squawk!
    } else if (kind === "ball" || kind === "tumbleweed") {
      things.push({ kind: kind, x: rnd(roadL + 40, roadR - 40), y: -40, vx: rnd(90, 170) * (Math.random() < 0.5 ? -1 : 1), w: 46, h: 46, t: 0, spin: 0 });
    } else if (kind === "skater") {
      things.push({ kind: kind, x: rnd(roadL + 60, roadR - 60), y: -60, w: 32, h: 54, t: 0, baseX: 0 });
      things[things.length - 1].baseX = things[things.length - 1].x;
    } else if (kind === "plane") {
      const leftSide = Math.random() < 0.5;
      things.push({ kind: kind, x: leftSide ? roadL + 118 : roadR - 118, y: -190, w: 224, h: 168, t: 0, sway: rnd(0, 6.28) });
      tone(98, 0.9, { type: "sawtooth", vol: 0.07, slideTo: 130 });
    }
  }

  /* ---------------- particles ---------------- */
  function burst(x, y, n, hue, speed, size) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), s = rnd(speed * 0.3, speed);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
                   life: rnd(0.4, 0.9), t: 0, hue: hue, size: rnd(3, size || 8), confetti: false });
    }
  }
  function confettiBlast(x, y, n) {
    const hues = [45, 190, 315, 150, 265, 0, 95];
    for (let i = 0; i < n; i++) {
      parts.push({ x: x + rnd(-70, 70), y: y + rnd(-30, 30),
                   vx: rnd(-160, 160), vy: rnd(-320, -40),
                   life: rnd(0.9, 1.9), t: 0, hue: hues[(Math.random() * hues.length) | 0],
                   size: rnd(6, 12), confetti: true, rot: rnd(0, 6.28), vr: rnd(-7, 7) });
    }
  }
  function tickParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += (p.confetti ? 260 : 420) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot != null) p.rot += p.vr * dt;
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      bolts[i].t += dt;
      if (bolts[i].t > 0.13) bolts.splice(i, 1);
    }
    if (parts.length > 700) parts.splice(0, parts.length - 700);
  }

  /* ---------------- crashes & spins (never cost progress) ---------------- */
  function crashInto(car) {
    sndCrash();
    burst(player.x, player.y - 20, 30, 45, 300, 9);
    shake = 14;
    player.spinT = CFG.SPIN_T; player.spinA = 0;
    player.ghost = CFG.SPIN_T + CFG.GHOST_T;
    speed01 = Math.min(speed01, 0.14);
    // the car you hit spins off the road — slapstick, and it clears your path
    car.knocked = 1.6;
    car.vx = (car.x < player.x ? -1 : 1) * rnd(240, 340);
  }
  function spinOut(t) {
    if (player.spinT > 0) return;
    sndSpin();
    player.spinT = t; player.spinA = 0;
    player.ghost = Math.max(player.ghost, t + 1.0);
    speed01 = Math.min(speed01, 0.18);
  }

  /* ---------------- update ---------------- */
  function worldSpeed() { return CFG.WORLD_MIN + speed01 * CFG.WORLD_ADD; }

  function tickPlayer(dt) {
    const spinning = player.spinT > 0;
    // speed: stick up = faster, down = slower; no stick = cruise
    let target = CFG.CRUISE;
    if (stick.on && !spinning) target = clamp(CFG.CRUISE - (stick.dy / CFG.STICK_R) * 0.62, 0, 1);
    if (spinning) target = 0.12;
    if (player.jumpT > 0) { player.jumpT -= dt; target = Math.max(target, 0.65); } // airtime = fast
    speed01 += clamp(target - speed01, -dt * 1.4, dt * 1.1);
    // steering
    let wantVx = 0;
    if (stick.on && !spinning) wantVx = (stick.dx / CFG.STICK_R) * CFG.STEER_MAX;
    player.vx += clamp(wantVx - player.vx, -dt * 2600, dt * 2600);
    if (!spinning) {
      player.x += player.vx * dt;
      player.x = clamp(player.x, roadL + CFG.PLAYER_W / 2 + 2, roadR - CFG.PLAYER_W / 2 - 2);
    }
    player.tilt = lerp(player.tilt, clamp(player.vx * 0.00085, -0.30, 0.30), 0.25);
    if (spinning) {
      player.spinT -= dt;
      player.spinA += dt * 11;
      if (player.spinT <= 0) { player.spinT = 0; player.spinA = 0; }
    }
    if (player.ghost > 0) player.ghost -= dt;
    if (player.blasterT > 0) {
      player.blasterT -= dt;
      zapT -= dt;
      if (zapT <= 0) { zapT = CFG.ZAP_EVERY; tryZap(); }
    }
  }
  function tryZap() {
    let best = null, bd = 1e9;
    for (const c of cars) {
      if (c.knocked > 0) continue;
      const dy = player.y - c.y;
      if (dy > 60 && dy < CFG.ZAP_RANGE && Math.abs(c.x - player.x) < 52 && dy < bd) { bd = dy; best = c; }
    }
    if (!best) return;
    bolts.push({ x1: player.x, y1: player.y - CFG.PLAYER_H / 2, x2: best.x, y2: best.y + 20, t: 0 });
    burst(best.x, best.y, 22, 50, 260, 8);
    confettiBlast(best.x, best.y, 10);
    cars.splice(cars.indexOf(best), 1);
    sndZap();
  }
  function tickCars(dt) {
    const ws = worldSpeed();
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.wob += dt * 3;
      if (c.knocked > 0) {
        c.knocked -= dt;
        c.x += c.vx * dt;
        c.y += ws * 0.25 * dt;
        c.wob += dt * 9;
        if (c.x < roadL - 90 || c.x > roadR + 90 || c.knocked <= 0) cars.splice(i, 1);
        continue;
      }
      c.y += ws * c.rel * dt;
      c.x += c.vx * dt;
      // ricochet: bounce off the road edges
      const hw = CFG.CAR_W / 2;
      if (c.x < roadL + hw + 2) { c.x = roadL + hw + 2; c.vx = Math.abs(c.vx); }
      if (c.x > roadR - hw - 2) { c.x = roadR - hw - 2; c.vx = -Math.abs(c.vx); }
      if (c.y > PH + 110) {
        // slipped past you — whoosh if it was close
        if (!c.passed && Math.abs(c.x - player.x) < 66 && player.spinT <= 0) sndWhoosh();
        cars.splice(i, 1);
        continue;
      }
      // a honk when a car looms up close behind... er, ahead of you
      if (!c.honked && player.y - c.y < 240 && player.y - c.y > 60 && Math.abs(c.x - player.x) < 90) {
        c.honked = true; if (Math.random() < 0.5) sndHonk();
      }
      if (player.ghost <= 0 && player.spinT <= 0 && player.jumpT <= 0 &&
          overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, c.x, c.y, CFG.CAR_W, CFG.CAR_H, 0.70)) {
        crashInto(c);
      }
    }
  }
  function tickThings(dt) {
    const ws = worldSpeed();
    for (let i = things.length - 1; i >= 0; i--) {
      const t = things[i];
      t.t += dt;
      let dead = false;
      if (t.kind === "oil" || t.kind === "banana" || t.kind === "blaster" ||
          t.kind === "ramp" || t.kind === "cow" || t.kind === "sunbather") {
        t.y += ws * dt;
        if (t.startled) t.startled = Math.max(0, t.startled - dt * 0.7);
        if (t.y > PH + 80) dead = true;
      } else if (t.kind === "unicorn" || t.kind === "chicken" || t.kind === "crab") {
        if (t.leapt > 0) {
          t.leapt -= dt;
          t.x += t.vx * 2.6 * dt;
          t.y += (ws * 0.4 - 260) * dt;
          if (t.leapt <= 0) dead = true;
        } else {
          t.x += t.vx * dt;
          t.y += ws * 0.94 * dt;
          if (t.x < roadL - 90 || t.x > roadR + 90 || t.y > PH + 70) dead = true;
        }
      } else if (t.kind === "gull") {
        t.x += t.vx * dt;
        t.y += ws * 0.22 * dt;
        if (t.x < roadL - 80 || t.x > roadR + 80) dead = true;
      } else if (t.kind === "ball" || t.kind === "tumbleweed") {
        t.spin += dt * (t.kind === "ball" ? 6 : 10);
        t.x += t.vx * dt;
        t.y += ws * (t.kind === "ball" ? 0.8 : 0.86) * dt;
        const hw = 24;
        if (t.x < roadL + hw) { t.x = roadL + hw; t.vx = Math.abs(t.vx); }
        if (t.x > roadR - hw) { t.x = roadR - hw; t.vx = -Math.abs(t.vx); }
        if (t.y > PH + 60) dead = true;
      } else if (t.kind === "skater") {
        if (t.knocked) {
          t.x += t.kvx * dt;
          t.y += ws * 0.3 * dt;
          if (t.x < roadL - 70 || t.x > roadR + 70) dead = true;
        } else {
          t.y += ws * 0.48 * dt;
          t.x = t.baseX + Math.sin(t.t * 2.6) * 34;
          if (t.y > PH + 70) dead = true;
        }
      } else if (t.kind === "plane") {
        t.sway += dt * 1.4;
        t.y += ws * 0.52 * dt;
        t.x += Math.sin(t.sway) * 12 * dt;
        if (t.y > PH + 220) dead = true;
      }
      if (dead) { things.splice(i, 1); continue; }
      // interactions — airborne (jump), ghosted, or spinning: nothing touches you
      if (player.ghost > 0 || player.spinT > 0 || player.jumpT > 0) continue;
      if (t.kind === "blaster") {
        if (overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, 52, 52, 0.9)) {
          player.blasterT = CFG.BLASTER_T;
          sndPickup();
          burst(t.x, t.y, 16, 50, 200, 7);
          things.splice(i, 1);
        }
      } else if (t.kind === "ramp") {
        if (overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.85)) {
          player.jumpT = 0.8;
          sndBoing();
          arp([523, 659, 784], 0.05, "square", 0.08);
          burst(t.x, t.y + 10, 10, 200, 150, 6);
        }
      } else if (t.kind === "oil" || t.kind === "banana") {
        if (overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.8)) {
          things.splice(i, 1);
          spinOut(CFG.OIL_SPIN_T);
        }
      } else if (t.kind === "cow") {
        if (overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.7)) {
          tone(160, 0.4, { type: "sawtooth", vol: 0.14, slideTo: 90 }); // MOOO
          sndCrash();
          burst(player.x, player.y - 20, 26, 45, 280, 9);
          shake = 13;
          player.spinT = CFG.SPIN_T; player.spinA = 0;
          player.ghost = CFG.SPIN_T + CFG.GHOST_T;
          speed01 = Math.min(speed01, 0.14);
          t.startled = 1; // the cow barely cares
        }
      } else if (t.kind === "sunbather") {
        if (overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.66)) {
          t.startled = 1;
          noiseS(0.2, { filter: "bandpass", freq: 1200, vol: 0.1 });
          spinOut(0.6);
        }
      } else if (t.kind === "unicorn" || t.kind === "chicken" || t.kind === "crab") {
        if (t.leapt <= 0 && overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.66)) {
          t.leapt = 0.55;
          if (t.kind === "unicorn") { sndNeigh(); burst(t.x, t.y - 10, 14, 300, 160, 6); spinOut(0.5); }
          else if (t.kind === "chicken") { sndCluck(); burst(t.x, t.y, 12, 0, 150, 5); }
          else { tone(900, 0.06, { type: "square", vol: 0.08 }); tone(1100, 0.06, { type: "square", vol: 0.08, when: 0.07 }); burst(t.x, t.y, 8, 30, 130, 5); }
        }
      } else if (t.kind === "ball" || t.kind === "tumbleweed") {
        if (overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.8)) {
          t.vx = (t.x < player.x ? -1 : 1) * rnd(200, 280);
          sndBoing();
        }
      } else if (t.kind === "skater") {
        if (!t.knocked && overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.66)) {
          t.knocked = 1; t.kvx = (t.x < player.x ? -1 : 1) * 260;
          sndCrash();
          burst(player.x, player.y - 20, 22, 45, 260, 8);
          shake = 11;
          player.spinT = CFG.SPIN_T; player.spinA = 0;
          player.ghost = CFG.SPIN_T + CFG.GHOST_T;
          speed01 = Math.min(speed01, 0.14);
        }
      } else if (t.kind === "plane") {
        if (overlap(player.x, player.y, CFG.PLAYER_W, CFG.PLAYER_H, t.x, t.y, t.w, t.h, 0.62)) {
          sndCrash();
          burst(player.x, player.y - 20, 34, 45, 320, 9);
          shake = 16;
          player.spinT = CFG.SPIN_T; player.spinA = 0;
          player.ghost = CFG.SPIN_T + CFG.GHOST_T;
          speed01 = Math.min(speed01, 0.14);
          t.y += 130; // the plane lumbers on past
        }
      }
    }
  }

  function tick(dt) {
    time += dt;
    tickMusic(dt);
    if (shake > 0) shake = Math.max(0, shake - dt * 26);
    tickParts(dt);
    if (state === "play") {
      const L = LEVELS[level - 1];
      const ws = worldSpeed();
      scrollY += ws * dt;
      dist += dt * CFG.MILES_RATE * (0.35 + speed01);
      tickPlayer(dt);
      // spawns
      spawnT -= dt * (1.18 - speed01 * 0.45);
      if (spawnT <= 0) { spawnCar(); spawnT = L.spawn * rnd(0.7, 1.3); }
      eventT -= dt;
      if (eventT <= 0) { spawnEvent(); eventT = L.event * rnd(0.7, 1.35); }
      tickCars(dt);
      tickThings(dt);
      if (dist >= L.miles) levelDone();
    } else if (state === "levelup" || state === "win") {
      celebT += dt;
      speed01 += clamp(0.5 - speed01, -dt, dt);
      scrollY += worldSpeed() * dt;
      finishY += worldSpeed() * dt * 1.15;
      player.x += clamp(((roadL + roadR) / 2 - player.x), -dt * 160, dt * 160);
      player.tilt = lerp(player.tilt, 0, 0.1);
      if (state === "win" && Math.random() < dt * 2.4) {
        confettiBlast(rnd(50, W - 50), rnd(60, PH * 0.5), 40);
        if (Math.random() < 0.4) sndZap();
      }
      if (Math.random() < dt * 6) confettiBlast(rnd(40, W - 40), -10, 3);
    } else {
      // title: gentle scroll behind the card
      scrollY += 130 * dt;
      speed01 = CFG.CRUISE;
    }
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
  function drawStar(x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawRoad() {
    const li = clamp(level - 1, 0, 4);
    // roadsides
    ctx.fillStyle = SIDE_COLORS[li];
    ctx.fillRect(0, 0, roadL, PH);
    ctx.fillRect(roadR, 0, W - roadR, PH);
    // scrolling scenery: trees / cacti / rocks by deterministic hash bands
    const band = 110;
    const n0 = Math.floor(scrollY / band) - 1;
    const nCount = Math.ceil(PH / band) + 3;
    for (let n = n0; n < n0 + nCount; n++) {
      const y = n * band - scrollY;
      const h1 = hash(n * 2 + 1), h2 = hash(n * 2 + 2);
      drawScenery(roadL - 16 - h1 * 8, y + h1 * 40, li, h1);
      drawScenery(roadR + 16 + h2 * 8, y + h2 * 40, li, h2);
    }
    // asphalt
    ctx.fillStyle = "#3a3f4a";
    ctx.fillRect(roadL, 0, roadR - roadL, PH);
    ctx.fillStyle = "#343945";
    for (let y = -80 + (scrollY % 160); y < PH; y += 160) ctx.fillRect(roadL, y, roadR - roadL, 3);
    // edge lines
    ctx.fillStyle = "#f5f6fa";
    ctx.fillRect(roadL + 4, 0, 5, PH);
    ctx.fillRect(roadR - 9, 0, 5, PH);
    ctx.fillStyle = "rgba(245,80,60,0.75)";
    ctx.fillRect(roadL + 11, 0, 3, PH);
    ctx.fillRect(roadR - 14, 0, 3, PH);
    // center dashes (two-lane road)
    ctx.fillStyle = "#ffd23f";
    const dashH = 44, gap = 36;
    for (let y = -dashH + (scrollY % (dashH + gap)); y < PH; y += dashH + gap) {
      ctx.fillRect((roadL + roadR) / 2 - 4, y, 8, dashH);
    }
    // speed streaks when you're flying
    if (state === "play" && speed01 > 0.78) {
      ctx.strokeStyle = "rgba(255,255,255," + ((speed01 - 0.78) * 2.4).toFixed(2) + ")";
      ctx.lineWidth = 3; ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const sx = roadL + 12 + hash(i * 31 + ((time * 3) | 0)) * (roadR - roadL - 24);
        const sy = (hash(i * 77 + ((time * 5) | 0)) * PH);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 46 + speed01 * 40); ctx.stroke();
      }
    }
  }
  function drawScenery(x, y, li, h) {
    if (h < 0.35) return; // sparse
    ctx.save();
    ctx.translate(x, y);
    if (li === 1) { // sand level: cactus
      ctx.fillStyle = "#2e7d32";
      rr(-5, -16, 10, 32, 5); ctx.fill();
      rr(-13, -8, 7, 14, 3); ctx.fill();
      rr(6, -12, 7, 16, 3); ctx.fill();
    } else if (li === 4) { // night: little star dots handled by color blobs
      ctx.fillStyle = "#2c3e70";
      ctx.beginPath(); ctx.arc(0, 0, 9 + h * 5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.arc(3, -4, 2, 0, 6.2832); ctx.fill();
    } else { // tree
      ctx.fillStyle = "#6d4c41";
      ctx.fillRect(-3, 4, 6, 10);
      ctx.fillStyle = SIDE_DARK[li];
      ctx.beginPath(); ctx.arc(0, -4, 13 + h * 5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath(); ctx.arc(-4, -8, 6, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  /* a generic top-down car. dir: +1 faces DOWN (traffic), -1 faces UP (you) */
  function drawCarBody(x, y, w, h, color, dir, prop) {
    ctx.save();
    ctx.translate(x, y);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    rr(-w / 2 + 3, -h / 2 + 5, w, h, 13); ctx.fill();
    // wheels
    ctx.fillStyle = "#14161c";
    const ww = 9, wh = 20;
    rr(-w / 2 - 3, -h / 2 + 10, ww, wh, 3); ctx.fill();
    rr(w / 2 - ww + 3, -h / 2 + 10, ww, wh, 3); ctx.fill();
    rr(-w / 2 - 3, h / 2 - 10 - wh, ww, wh, 3); ctx.fill();
    rr(w / 2 - ww + 3, h / 2 - 10 - wh, ww, wh, 3); ctx.fill();
    // body
    ctx.fillStyle = color;
    rr(-w / 2, -h / 2, w, h, 13); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    rr(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.3, 9); ctx.fill();
    // windshield + roof + rear window (front = dir side)
    ctx.fillStyle = "#bfe8ff";
    rr(-w / 2 + 8, dir > 0 ? h * 0.08 : -h * 0.30, w - 16, h * 0.20, 6); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    rr(-w / 2 + 7, dir > 0 ? -h * 0.28 : -h * 0.06, w - 14, h * 0.34, 7); ctx.fill();
    ctx.fillStyle = "#9fd4f2";
    rr(-w / 2 + 9, dir > 0 ? -h * 0.44 : h * 0.30, w - 18, h * 0.12, 5); ctx.fill();
    // headlights at the front, taillights at the back
    ctx.fillStyle = "#fff7ae";
    const fy = dir > 0 ? h / 2 - 7 : -h / 2 + 3;
    ctx.beginPath(); ctx.arc(-w / 2 + 10, fy, 4.4, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2 - 10, fy, 4.4, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#ff5252";
    const by = dir > 0 ? -h / 2 + 3 : h / 2 - 7;
    ctx.fillRect(-w / 2 + 5, by, 9, 4);
    ctx.fillRect(w / 2 - 14, by, 9, 4);
    if (prop) drawProp(prop, w, h, dir);
    ctx.restore();
  }
  function drawProp(prop, w, h, dir) {
    ctx.save();
    if (prop === "pizza") {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? "#e8c07a" : "#d9a75e";
        rr(-13, -8 - i * 6, 26, 6, 2); ctx.fill();
      }
      ctx.fillStyle = "#c0392b";
      ctx.beginPath(); ctx.arc(0, -10, 3, 0, 6.2832); ctx.fill();
    } else if (prop === "surf") {
      ctx.fillStyle = "#ff7675";
      ctx.save(); ctx.rotate(0.5); rr(-5, -h / 2 - 8, 10, h * 0.8, 5); ctx.fill(); ctx.restore();
    } else if (prop === "tree") {
      ctx.fillStyle = "#27ae60";
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 - 14); ctx.lineTo(12, 2); ctx.lineTo(-12, 2); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 - 4); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
    } else if (prop === "gift") {
      ctx.fillStyle = "#e84393";
      rr(-12, -12, 24, 20, 3); ctx.fill();
      ctx.fillStyle = "#ffe45e";
      ctx.fillRect(-3, -12, 6, 20); ctx.fillRect(-12, -4, 24, 5);
    } else if (prop === "balloons") {
      const cols = ["#ff6b6b", "#4ecdc4", "#ffe45e"];
      for (let i = 0; i < 3; i++) {
        const bx = (i - 1) * 13, by = -h / 2 - 16 - (i % 2) * 6;
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, -h / 2 + 4); ctx.lineTo(bx, by + 8); ctx.stroke();
        ctx.fillStyle = cols[i];
        ctx.beginPath(); ctx.arc(bx, by, 8, 0, 6.2832); ctx.fill();
      }
    } else if (prop === "icecream") {
      ctx.fillStyle = "#e0a458";
      ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(7, -4); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fd79a8";
      ctx.beginPath(); ctx.arc(0, -10, 9, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(-3, -13, 3, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  /* YOUR car — a new ride every level */
  function drawPlayerCar() {
    const li = clamp(level - 1, 0, 4);
    const ghostBlink = player.ghost > 0 && ((time * 9) | 0) % 2 === 0 && state === "play";
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.jumpT > 0) {
      // airborne off the ramp: rise, swell, hang — you're FLYING
      const prog = 1 - player.jumpT / 0.8;
      const air = Math.sin(clamp(prog, 0, 1) * Math.PI);
      ctx.translate(0, -air * 30);
      const sc = 1 + air * 0.24;
      ctx.scale(sc, sc);
    }
    ctx.rotate(player.spinT > 0 ? player.spinA : player.tilt);
    if (ghostBlink) ctx.globalAlpha = 0.35;
    const w = CFG.PLAYER_W, h = CFG.PLAYER_H;
    if (li === 4) {
      // rainbow trail
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = ["#ff5252", "#ff9f43", "#ffd23f", "#2ed573", "#54a0ff"][i];
        ctx.globalAlpha = 0.35;
        rr(-w / 2 + i * 3, h / 2 + 6 + i * 9 + Math.sin(time * 9 + i) * 3, w - i * 6, 7, 3); ctx.fill();
      }
      ctx.globalAlpha = ghostBlink ? 0.35 : 1;
    }
    const colors = ["#e84118", "#273c75", "#fbc531", "#8e44ad", "#f5f6fa"];
    drawCarBody(0, 0, w, h, colors[li], -1, null);
    // level flavor
    if (li === 0) { // convertible: open top, two heads
      ctx.fillStyle = "#f6d3a8";
      ctx.beginPath(); ctx.arc(-9, 6, 6, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(9, 6, 6, 0, 6.2832); ctx.fill();
    } else if (li === 1) { // pickup bed
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      rr(-w / 2 + 6, h * 0.14, w - 12, h * 0.30, 5); ctx.fill();
      ctx.fillStyle = "#e1b12c";
      ctx.beginPath(); ctx.arc(-8, h * 0.28, 6, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(9, h * 0.24, 5, 0, 6.2832); ctx.fill();
    } else if (li === 2) { // taxi: checker stripe + roof light
      ctx.fillStyle = "#2d3436";
      for (let i = 0; i < 5; i++) { if (i % 2 === 0) ctx.fillRect(-w / 2 + 3 + i * 10, h * 0.16, 10, 8); }
      ctx.fillStyle = "#ffe45e";
      rr(-11, -8, 22, 13, 4); ctx.fill();
      ctx.fillStyle = "#e84118";
      ctx.beginPath(); ctx.arc(0, -1, 3.4, 0, 6.2832); ctx.fill();
    } else if (li === 3) { // hot rod: engine + flames
      ctx.fillStyle = "#dfe6e9";
      rr(-10, -h / 2 + 2, 20, 15, 4); ctx.fill();
      ctx.fillStyle = "#636e72";
      ctx.fillRect(-3, -h / 2 - 3, 6, 8);
      ctx.fillStyle = "#ff9f43";
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 2, 16); ctx.quadraticCurveTo(-w / 2 - 6, 2, -w / 2 + 3, -8);
      ctx.quadraticCurveTo(-w / 2 + 8, 4, -w / 2 + 3, 16); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 2, 16); ctx.quadraticCurveTo(w / 2 + 6, 2, w / 2 - 3, -8);
      ctx.quadraticCurveTo(w / 2 - 8, 4, w / 2 - 3, 16); ctx.closePath(); ctx.fill();
    } else if (li === 4) { // rocket car: fins + nose glow
      ctx.fillStyle = "#dfe6e9";
      ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.22); ctx.lineTo(-w / 2 - 12, h / 2); ctx.lineTo(-w / 2 + 8, h / 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.22); ctx.lineTo(w / 2 + 12, h / 2); ctx.lineTo(w / 2 - 8, h / 2); ctx.closePath(); ctx.fill();
      const flick = 8 + Math.sin(time * 31) * 3;
      ctx.fillStyle = "#ffb84d";
      ctx.beginPath(); ctx.arc(0, h / 2 + flick, 7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#ffe45e";
      ctx.beginPath(); ctx.arc(0, h / 2 + flick, 3.6, 0, 6.2832); ctx.fill();
    }
    // the blaster, when you've got it
    if (player.blasterT > 0) {
      ctx.fillStyle = "#ffe45e";
      rr(-5, -h / 2 - 12, 10, 14, 3); ctx.fill();
      drawStar(0, -h / 2 - 12, 9, "#fff3a0", time * 4);
    }
    ctx.restore();
    // blaster time ring
    if (player.blasterT > 0 && state === "play") {
      const k = player.blasterT / CFG.BLASTER_T;
      ctx.save();
      ctx.strokeStyle = "rgba(255,228,94,0.85)";
      ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(player.x, player.y, CFG.PLAYER_W + 16, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawThing(t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    if (t.kind === "oil") {
      ctx.fillStyle = "rgba(12,12,26,0.88)";
      ctx.beginPath(); ctx.ellipse(0, 0, t.w / 2, t.h / 2, 0, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "rgba(140,120,255,0.55)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, t.w / 2 - 7, t.h / 2 - 5, 0, 3.6, 5.4); ctx.stroke();
      ctx.strokeStyle = "rgba(80,220,255,0.4)";
      ctx.beginPath(); ctx.ellipse(0, 0, t.w / 2 - 13, t.h / 2 - 8, 0, 3.8, 5.2); ctx.stroke();
    } else if (t.kind === "banana") {
      ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, -4, 14, 0.5, 2.6); ctx.stroke();
      ctx.strokeStyle = "#e1b12c"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -4, 14, 0.5, 2.6); ctx.stroke();
      ctx.fillStyle = "#6d4c41";
      ctx.fillRect(-2, -20, 4, 6);
    } else if (t.kind === "blaster") {
      const pulse = 1 + Math.sin(time * 6) * 0.13;
      ctx.fillStyle = "rgba(255,228,94,0.22)";
      ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, 6.2832); ctx.fill();
      drawStar(0, 0, 21 * pulse, "#ffe45e", Math.sin(time * 3) * 0.3);
      drawStar(0, 0, 10 * pulse, "#fff6bf", Math.sin(time * 3) * 0.3);
    } else if (t.kind === "unicorn") {
      const dir = t.vx > 0 ? 1 : -1;
      const trot = Math.sin(t.t * 14) * 4;
      ctx.scale(dir, 1);
      if (t.leapt > 0) ctx.rotate(-0.3);
      // legs
      ctx.strokeStyle = "#f5f6fa"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-14, 8); ctx.lineTo(-14 + trot, 22);
      ctx.moveTo(12, 8); ctx.lineTo(12 - trot, 22);
      ctx.stroke();
      // body
      ctx.fillStyle = "#ffffff";
      rr(-24, -12, 48, 24, 11); ctx.fill();
      // head + horn + rainbow mane
      ctx.beginPath(); ctx.arc(26, -12, 11, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.moveTo(28, -22); ctx.lineTo(38, -34); ctx.lineTo(33, -19); ctx.closePath(); ctx.fill();
      const mane = ["#ff5252", "#ff9f43", "#ffd23f", "#2ed573", "#54a0ff"];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = mane[i];
        ctx.fillRect(12 + i * 2, -20 + i * 3, 5, 9);
        ctx.fillRect(-26 - i, -8 + i * 4, 6, 8); // tail
      }
      ctx.fillStyle = "#2d3436";
      ctx.beginPath(); ctx.arc(29, -14, 2.2, 0, 6.2832); ctx.fill();
      if (Math.random() < 0.3) parts.push({ x: t.x - dir * 26, y: t.y + rnd(-8, 10), vx: -dir * 20, vy: rnd(-16, 16), life: 0.5, t: 0, hue: 300, size: 4, confetti: false });
    } else if (t.kind === "chicken") {
      const hop = Math.abs(Math.sin(t.t * 10)) * 7;
      const dir = t.vx > 0 ? 1 : -1;
      ctx.scale(dir, 1);
      ctx.translate(0, -hop);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(13, -9, 8, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#ff5252";
      ctx.beginPath(); ctx.arc(12, -18, 3.4, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(16, -17, 3, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#ff9f43";
      ctx.beginPath(); ctx.moveTo(19, -9); ctx.lineTo(26, -6); ctx.lineTo(19, -3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2d3436";
      ctx.beginPath(); ctx.arc(14, -10, 1.8, 0, 6.2832); ctx.fill();
      // tail feathers
      ctx.strokeStyle = "#dfe6e9"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-21, -9); ctx.moveTo(-14, 1); ctx.lineTo(-22, 0); ctx.stroke();
    } else if (t.kind === "ball") {
      ctx.rotate(t.spin);
      const cols = ["#ff5252", "#f5f6fa", "#54a0ff", "#f5f6fa", "#ffd23f", "#f5f6fa"];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 23, (i / 6) * 6.2832, ((i + 1) / 6) * 6.2832);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#f5f6fa";
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.2832); ctx.fill();
    } else if (t.kind === "tumbleweed") {
      ctx.rotate(t.spin);
      ctx.strokeStyle = "#a67c52"; ctx.lineWidth = 3; ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * 6.2832;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8, 13, a, a + 3.6);
        ctx.stroke();
      }
      ctx.strokeStyle = "#8d6544";
      ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.2832); ctx.stroke();
    } else if (t.kind === "ramp") {
      // a chunky orange ramp with chevrons — hit it and FLY
      ctx.fillStyle = "#e67e22";
      ctx.beginPath();
      ctx.moveTo(-t.w / 2, t.h / 2); ctx.lineTo(t.w / 2, t.h / 2); ctx.lineTo(t.w / 2, -t.h / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f5f6fa";
      ctx.beginPath();
      ctx.moveTo(-t.w / 2, t.h / 2); ctx.lineTo(-t.w / 2 + 16, t.h / 2); ctx.lineTo(t.w / 2, -t.h / 2 + 16); ctx.lineTo(t.w / 2, -t.h / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#14161c";
      for (let i = 0; i < 3; i++) {
        const cy = t.h / 2 - 8 - i * 11;
        ctx.beginPath();
        ctx.moveTo(-8 + i * 10, cy); ctx.lineTo(2 + i * 10, cy - 8); ctx.lineTo(12 + i * 10, cy); ctx.lineTo(6 + i * 10, cy + 4); ctx.lineTo(2 + i * 10, cy - 1); ctx.lineTo(-2 + i * 10, cy + 4); ctx.closePath(); ctx.fill();
      }
    } else if (t.kind === "cow") {
      // a cow. standing in the road. chewing. it does not move for you.
      const chew = Math.sin(t.t * 5) * 2;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath(); ctx.ellipse(2, 22, 38, 9, 0, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "#f5f6fa"; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-22, 10); ctx.lineTo(-22, 24); ctx.moveTo(20, 10); ctx.lineTo(20, 24);
      ctx.moveTo(-10, 10); ctx.lineTo(-10, 24); ctx.moveTo(30, 10); ctx.lineTo(30, 24);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      rr(-36, -18, 72, 32, 13); ctx.fill();
      ctx.fillStyle = "#2d3436"; // patches
      ctx.beginPath(); ctx.ellipse(-14, -6, 13, 9, 0.4, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(16, 2, 10, 7, -0.3, 0, 6.2832); ctx.fill();
      // head (front, toward you) + ears + horns
      ctx.fillStyle = "#ffffff";
      rr(-14, 8, 28, 22, 9); ctx.fill();
      ctx.fillStyle = "#fd79a8";
      ctx.beginPath(); ctx.ellipse(-19, 12, 7, 4.5, -0.5, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(19, 12, 7, 4.5, 0.5, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "#e8dcc0"; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(-13, 8, 6, 3.4, 5.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(13, 8, 6, 4.2, 6.0); ctx.stroke();
      // muzzle, chewing sideways
      ctx.fillStyle = "#f8a5c2";
      rr(-11 + chew * 0.4, 20, 22, 11, 5); ctx.fill();
      ctx.fillStyle = "#c44569";
      ctx.beginPath(); ctx.arc(-4 + chew * 0.4, 25, 2, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(5 + chew * 0.4, 25, 2, 0, 6.2832); ctx.fill();
      // eyes: unbothered... until startled
      ctx.fillStyle = "#2d3436";
      const ey = t.startled > 0 ? 14 : 16;
      ctx.beginPath(); ctx.arc(-7, ey, t.startled > 0 ? 3 : 2.2, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(7, ey, t.startled > 0 ? 3 : 2.2, 0, 6.2832); ctx.fill();
      // tail swish
      ctx.strokeStyle = "#f5f6fa"; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(34, -14); ctx.quadraticCurveTo(42, -4, 38 + Math.sin(t.t * 3) * 5, 6); ctx.stroke();
    } else if (t.kind === "crab") {
      const dir = t.vx > 0 ? 1 : -1;
      const scut = Math.sin(t.t * 18) * 3;
      ctx.scale(dir, 1);
      ctx.strokeStyle = "#e84118"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath(); ctx.moveTo(-8 + s * 9, 6); ctx.lineTo(-13 + s * 10, 13 + (s === 0 ? scut : -scut)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8 + s * 9, 6); ctx.lineTo(13 + s * 10, 13 + (s === 0 ? -scut : scut)); ctx.stroke();
      }
      ctx.fillStyle = "#ff6b35";
      ctx.beginPath(); ctx.ellipse(0, 0, 17, 12, 0, 0, 6.2832); ctx.fill();
      // claws
      ctx.beginPath(); ctx.arc(-19, -8, 7, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(19, -8, 7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#d63031";
      ctx.beginPath(); ctx.moveTo(-19, -14); ctx.lineTo(-15, -8); ctx.lineTo(-23, -8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(19, -14); ctx.lineTo(23, -8); ctx.lineTo(15, -8); ctx.closePath(); ctx.fill();
      // eyes on stalks
      ctx.strokeStyle = "#e84118"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-6, -17); ctx.moveTo(5, -10); ctx.lineTo(6, -17); ctx.stroke();
      ctx.fillStyle = "#14161c";
      ctx.beginPath(); ctx.arc(-6, -18, 2.6, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -18, 2.6, 0, 6.2832); ctx.fill();
    } else if (t.kind === "gull") {
      // shadow on the road, then the gull itself up high
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath(); ctx.ellipse(6, 34, 20, 6, 0, 0, 6.2832); ctx.fill();
      const dir = t.vx > 0 ? 1 : -1;
      const flap = Math.sin(t.t * 13) * 0.55;
      ctx.scale(dir, 1);
      ctx.translate(0, -16);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 7, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -3, 5.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#ff9f43";
      ctx.beginPath(); ctx.moveTo(18, -3); ctx.lineTo(25, -1); ctx.lineTo(18, 1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#f5f6fa"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(-14, -12 - flap * 10, -26, -6 - flap * 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -2); ctx.quadraticCurveTo(10, -13 - flap * 10, 20, -8 - flap * 15); ctx.stroke();
      ctx.fillStyle = "#dfe6e9";
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-22, -4); ctx.lineTo(-21, 3); ctx.closePath(); ctx.fill();
    } else if (t.kind === "sunbather") {
      // somebody set up a whole beach day IN THE ROAD
      ctx.fillStyle = "#fd79a8";
      rr(-30, -30, 60, 60, 8); ctx.fill();
      ctx.fillStyle = "#f5f6fa";
      for (let i = 0; i < 3; i++) ctx.fillRect(-30, -18 + i * 20, 60, 8);
      // the sunbather
      ctx.fillStyle = "#f6d3a8";
      ctx.beginPath(); ctx.ellipse(2, 8, 9, 20, 0.25, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(-4, -13, 7.5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#6d3b1f"; // hair
      ctx.beginPath(); ctx.arc(-5, -16, 6.4, 3.1, 6.4); ctx.fill();
      ctx.fillStyle = "#00cec9"; // swimsuit
      ctx.beginPath(); ctx.ellipse(3, 6, 7.4, 12, 0.25, 0, 6.2832); ctx.fill();
      if (t.startled > 0) { // sits bolt upright!
        ctx.fillStyle = "#f6d3a8";
        ctx.beginPath(); ctx.ellipse(0, -2, 8, 13, 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = "#14161c";
        ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("!", 14, -18);
      }
      // umbrella
      ctx.strokeStyle = "#dfe6e9"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-24, 20); ctx.lineTo(-8, -16); ctx.stroke();
      ctx.fillStyle = "#e84118";
      ctx.beginPath(); ctx.moveTo(-30, -14); ctx.quadraticCurveTo(-8, -34, 14, -14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.moveTo(-19, -15.5); ctx.quadraticCurveTo(-8, -30, 3, -15.5); ctx.closePath(); ctx.fill();
    } else if (t.kind === "skater") {
      if (t.knocked) ctx.rotate(t.t * 7);
      const kick = Math.sin(t.t * 7) * 5;
      // board
      ctx.fillStyle = "#e67e22";
      rr(-6, 12, 12, 30, 5); ctx.fill();
      ctx.fillStyle = "#14161c";
      ctx.beginPath(); ctx.arc(0, 18, 3, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 36, 3, 0, 6.2832); ctx.fill();
      // rider
      ctx.strokeStyle = "#2d3436"; ctx.lineWidth = 5.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-4, 14); ctx.moveTo(0, 2); ctx.lineTo(5, 13 + kick * 0.3); ctx.stroke();
      ctx.fillStyle = "#54a0ff";
      rr(-7, -16, 14, 20, 6); ctx.fill();
      ctx.strokeStyle = "#f6d3a8"; ctx.lineWidth = 4.6;
      ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-13, 0 + kick * 0.2); ctx.moveTo(5, -10); ctx.lineTo(13, -2 - kick * 0.2); ctx.stroke();
      ctx.fillStyle = "#f6d3a8";
      ctx.beginPath(); ctx.arc(0, -23, 7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#e84118"; // cap
      ctx.beginPath(); ctx.arc(0, -26, 7, 3.3, 6.1); ctx.fill();
      ctx.fillRect(-2, -28, 12, 3.4);
    } else if (t.kind === "plane") {
      // the PLANE — it drives down the road like it owns it
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.ellipse(4, 10, 118, 74, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#dfe6e9";
      rr(-26, -84, 52, 168, 24); ctx.fill();           // fuselage (nose down)
      ctx.fillStyle = "#b2bec3";
      rr(-112, -18, 224, 42, 16); ctx.fill();          // wings
      rr(-58, 58, 116, 26, 12); ctx.fill();            // tail wing
      ctx.fillStyle = "#54a0ff";
      rr(-16, 44, 32, 30, 8); ctx.fill();              // cockpit
      ctx.fillStyle = "#2d3436";
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-9 + (i % 2) * 18, -58 + ((i / 2) | 0) * 26, 3.4, 0, 6.2832); ctx.fill(); }
      // spinning props
      ctx.strokeStyle = "rgba(45,52,54,0.65)"; ctx.lineWidth = 5; ctx.lineCap = "round";
      const pa = time * 40;
      for (const px of [-84, 84]) {
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(pa) * 17, 3 + Math.sin(pa) * 17);
        ctx.lineTo(px - Math.cos(pa) * 17, 3 - Math.sin(pa) * 17);
        ctx.stroke();
      }
      ctx.fillStyle = "#e84118";
      ctx.beginPath(); ctx.arc(0, 86, 8, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  function drawParts() {
    for (const b of bolts) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,244,160," + (1 - b.t / 0.13).toFixed(2) + ")";
      ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      const mx = (b.x1 + b.x2) / 2 + rnd(-9, 9), my = (b.y1 + b.y2) / 2;
      ctx.lineTo(mx, my); ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of parts) {
      const k = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = clamp(k, 0, 1);
      ctx.fillStyle = "hsl(" + p.hue + ",90%,62%)";
      if (p.confetti) {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFinishBand() {
    if (finishY < -90 || finishY > PH + 90) return;
    const sq = 18;
    for (let x = roadL; x < roadR; x += sq) {
      for (let rI = 0; rI < 2; rI++) {
        ctx.fillStyle = ((x / sq + rI) % 2 === 0) ? "#f5f6fa" : "#14161c";
        ctx.fillRect(x, finishY + rI * sq, Math.min(sq, roadR - x), sq);
      }
    }
  }

  function drawHUD() {
    // distance progress: fill the bar, reach the flag
    const bw = W - 84, bx = 42, by = 16;
    ctx.fillStyle = "rgba(10,12,22,0.55)";
    rr(bx - 6, by - 6, bw + 12, 30, 10); ctx.fill();
    ctx.fillStyle = "#22283a";
    rr(bx, by, bw, 18, 9); ctx.fill();
    const L = LEVELS[level - 1];
    const k = clamp(dist / L.miles, 0, 1);
    ctx.fillStyle = "#29faff";
    if (k > 0.02) { rr(bx, by, bw * k, 18, 9); ctx.fill(); }
    // your little car on the bar
    const cxp = bx + bw * k;
    ctx.fillStyle = "#e84118";
    rr(cxp - 8, by + 3, 16, 12, 3); ctx.fill();
    ctx.fillStyle = "#bfe8ff";
    ctx.fillRect(cxp - 4, by + 5, 8, 5);
    // checkered flag at the end
    ctx.fillStyle = "#f5f6fa";
    ctx.fillRect(bx + bw + 4, by - 4, 3, 24);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? "#f5f6fa" : "#14161c";
      ctx.fillRect(bx + bw + 7 + i * 6, by - 4 + j * 6, 6, 6);
    }
    // level pips
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < level ? "#ffd23f" : "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(bx + 10 + i * 22, by + 40, 6, 0, 6.2832); ctx.fill();
    }
  }

  /* THE CONTROL DECK — the bottom strip is for your thumb only.
     The stick idles here (a circle with a knob); your speed shows
     as a big bar. Nothing from the game ever enters the deck, and
     your thumb never has to cover your car. */
  function drawDeck() {
    // panel
    ctx.fillStyle = "#11141f";
    ctx.fillRect(0, PH, W, stripH);
    ctx.fillStyle = "#29faff";
    ctx.fillRect(0, PH, W, 3);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, PH + 3, W, 2);
    const cy = PH + stripH / 2;
    // speed bar (left portion): empty = crawl, full = flying
    const bw = Math.min(W * 0.30, 190), bx = 18, bh = 20;
    ctx.fillStyle = "#22283a";
    rr(bx, cy - bh / 2, bw, bh, 10); ctx.fill();
    if (speed01 > 0.02) {
      ctx.fillStyle = speed01 > 0.8 ? "#ff9f43" : "#29faff";
      rr(bx, cy - bh / 2, Math.max(18, bw * speed01), bh, 10); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 1; i < 4; i++) ctx.fillRect(bx + (bw / 4) * i - 1, cy - bh / 2 + 3, 2, bh - 6);
    // the stick: idles center-right in the deck; follows your thumb
    const homeX = W - Math.min(W * 0.24, 130), homeY = cy;
    const ox = stick.on ? stick.ox : homeX;
    const oy = stick.on ? stick.oy : homeY;
    const dx = stick.on ? stick.dx : 0, dy = stick.on ? stick.dy : 0;
    ctx.save();
    ctx.globalAlpha = stick.on ? 0.95 : 0.6;
    ctx.fillStyle = "#1d2334";
    ctx.beginPath(); ctx.arc(ox, oy, 52, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ox, oy, 52, 0, 6.2832); ctx.stroke();
    // direction ticks on the base: left / right / fast / slow zones
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath(); ctx.moveTo(ox - 46, oy); ctx.lineTo(ox - 36, oy - 6); ctx.lineTo(ox - 36, oy + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ox + 46, oy); ctx.lineTo(ox + 36, oy - 6); ctx.lineTo(ox + 36, oy + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ox, oy - 46); ctx.lineTo(ox - 6, oy - 36); ctx.lineTo(ox + 6, oy - 36); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ox, oy + 46); ctx.lineTo(ox - 6, oy + 36); ctx.lineTo(ox + 6, oy + 36); ctx.closePath(); ctx.fill();
    const pulse = stick.on ? 1 : 1 + Math.sin(time * 3.2) * 0.05;
    ctx.fillStyle = "#29faff";
    ctx.beginPath(); ctx.arc(ox + dx, oy + dy, 25 * pulse, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath(); ctx.arc(ox + dx - 6, oy + dy - 7, 8, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function drawTitle() {
    drawRoad();
    ctx.fillStyle = "rgba(6,8,18,0.45)";
    ctx.fillRect(0, 0, W, PH);
    // demo traffic + your car, posing
    drawCarBody(W * 0.30, PH * 0.34, CFG.CAR_W, CFG.CAR_H, "#3498db", 1, "pizza");
    drawCarBody(W * 0.72, PH * 0.27, CFG.CAR_W, CFG.CAR_H, "#f39c12", 1, "balloons");
    ctx.save();
    ctx.translate(W / 2, PH * 0.50);
    ctx.scale(1.5, 1.5);
    drawCarBody(0, 0, CFG.PLAYER_W, CFG.PLAYER_H, "#e84118", -1, null);
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#29faff";
    ctx.font = "34px 'Press Start 2P', monospace";
    ctx.fillText("CRAZY", W / 2, PH * 0.15);
    ctx.fillStyle = "#ffd23f";
    ctx.fillText("TRAFFIC", W / 2, PH * 0.15 + 44);
    // big play button
    const pulse = 1 + Math.sin(time * 4) * 0.06;
    ctx.save();
    ctx.translate(W / 2, PH * 0.76);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.arc(0, 0, 52, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#14161c";
    ctx.beginPath();
    ctx.moveTo(-14, -20); ctx.lineTo(22, 0); ctx.lineTo(-14, 20); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.textAlign = "left";
  }

  function drawCeleb() {
    // the road + your NEW car, center stage
    drawRoad();
    drawFinishBand();
    drawParts();
    ctx.save();
    ctx.translate(W / 2, PH * 0.52);
    ctx.scale(1.6, 1.6);
    drawPlayerCarAtOrigin();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd23f";
    ctx.font = "26px 'Press Start 2P', monospace";
    if (state === "win") {
      ctx.fillText("YOU WIN!", W / 2, PH * 0.20);
      ctx.fillStyle = "#29faff";
      ctx.font = "15px 'Press Start 2P', monospace";
      ctx.fillText("ALL 5 LEVELS!", W / 2, PH * 0.20 + 36);
    } else {
      ctx.fillText("LEVEL " + level + " DONE!", W / 2, PH * 0.20);
      ctx.fillStyle = "#29faff";
      ctx.font = "15px 'Press Start 2P', monospace";
      ctx.fillText("NEW CAR!", W / 2, PH * 0.20 + 36);
    }
    if (celebT > 1.6) {
      const pulse = 1 + Math.sin(time * 4) * 0.06;
      ctx.save();
      ctx.translate(W / 2, PH * 0.82);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#14161c";
      ctx.beginPath();
      ctx.moveTo(-12, -18); ctx.lineTo(20, 0); ctx.lineTo(-12, 18); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.textAlign = "left";
  }
  // draws your car centered on the current origin (for the celeb stage)
  function drawPlayerCarAtOrigin() {
    const li = state === "win" ? 4 : clamp(level, 0, 4); // next level's car on levelup
    const w = CFG.PLAYER_W, h = CFG.PLAYER_H;
    const colors = ["#e84118", "#273c75", "#fbc531", "#8e44ad", "#f5f6fa"];
    drawCarBody(0, 0, w, h, colors[li], -1, null);
    if (li === 2) {
      ctx.fillStyle = "#2d3436";
      for (let i = 0; i < 5; i++) { if (i % 2 === 0) ctx.fillRect(-w / 2 + 3 + i * 10, h * 0.16, 10, 8); }
      ctx.fillStyle = "#ffe45e";
      rr(-11, -8, 22, 13, 4); ctx.fill();
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-shake, shake) * 0.4, rnd(-shake, shake) * 0.4);
    if (state === "title") {
      drawTitle();
    } else if (state === "levelup" || state === "win") {
      drawCeleb();
    } else {
      drawRoad();
      drawFinishBand();
      for (const t of things) drawThing(t);
      const sorted = cars.slice().sort((a, b) => a.y - b.y);
      for (const c of sorted) {
        ctx.save();
        if (c.knocked > 0) { ctx.translate(c.x, c.y); ctx.rotate(c.wob * 2); ctx.translate(-c.x, -c.y); }
        drawCarBody(c.x, c.y + Math.sin(c.wob) * 1.5, CFG.CAR_W, CFG.CAR_H, c.color, 1, c.prop);
        ctx.restore();
      }
      drawPlayerCar();
      drawParts();
      drawHUD();
    }
    ctx.restore();
    drawDeck();
  }

  /* ---------------- resize + loop ---------------- */
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const roadW = Math.min(W - 36, 360);
    roadL = (W - roadW) / 2; roadR = roadL + roadW;
    // the deck takes the bottom strip; the game lives above it
    stripH = clamp(Math.round(H * 0.22), 120, 190);
    PH = H - stripH;
    player.y = PH - 120;
    player.x = clamp(player.x, roadL + CFG.PLAYER_W / 2 + 2, roadR - CFG.PLAYER_W / 2 - 2);
  }
  window.addEventListener("resize", resize);
  resize();

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("touchstart", function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    tick(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------- test hook ---------------- */
  window.__trafficTest = {
    get state() { return state; },
    get level() { return level; },
    get dist() { return dist; },
    get speed01() { return speed01; },
    get cfg() { return CFG; },
    get levels() { return LEVELS; },
    get musicStep() { return MUSIC.step; },
    get musicOn() { return MUSIC.on; },
    start: function () { startGame(); },
    step: function (dt) { tick(dt || 0.016); draw(); },
    debug: {
      player: function () { return player; },
      cars: function () { return cars; },
      things: function () { return things; },
      stick: function () { return stick; },
      road: function () { return { l: roadL, r: roadR, w: W, h: H, ph: PH, stripH: stripH }; },
      worldSpeed: function () { return worldSpeed(); },
      setStick: function (dx, dy) { stick.on = true; stick.ox = player.x; stick.oy = player.y; stick.dx = dx; stick.dy = dy; },
      release: function () { onUp(); },
      placeCar: function (x, y, opts) {
        const c = Object.assign({ x: x, y: y, rel: 0.5, vx: 0, color: "#ffffff", prop: null, wob: 0, knocked: 0, honked: true, passed: false }, opts || {});
        cars.push(c); return c;
      },
      placeThing: function (kind, x, y, opts) {
        const t = Object.assign({ kind: kind, x: x, y: y, vx: 0, w: 40, h: 30, t: 0, leapt: 0, spin: 0, sway: 0, baseX: x, knocked: 0 }, opts || {});
        things.push(t); return t;
      },
      setDist: function (m) { dist = m; },
      setLevel: function (n) { level = n; },
      setSpeed: function (s) { speed01 = s; },
      tap: function () { onDown({ clientX: W / 2, clientY: H / 2, preventDefault: function () {} }); },
    },
  };
})();
