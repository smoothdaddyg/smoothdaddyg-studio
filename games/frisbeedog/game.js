/* ============================================================
   FRISBEE DOG v3 — SmoothDaddyG ("lead him")
   Real-world frisbee-dog rules. The dog lines up, the whistle
   blows, and he RUNS — no fixed route, just a random heading
   (usually upfield) with a lively weave. You throw the disc
   AHEAD of him; he spots it after a beat, SPRINTS to the landing
   spot, and — if you judged the lead right — leaps for the catch.
   The gold ring shows his sprint reach: land the disc inside it.
   Four paw dots ahead of him show his current intent, live.
   ONE interaction: tap below the top strip to throw. One throw
   per round, no losing — first to 10 catches wins the treat shower.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- tuning (all gameplay numbers live here) ---------------- */
  const CFG = {
    WIN_CATCHES: 10,    // first to this many catches wins
    DOG_R: 32,          // dog body size (px) — smaller now, more field room
    CATCH_R: 68,        // generous catch radius — be kind
    DOG_SPEED: 130,     // starting run speed px/s — moderate, predictable
    DOG_SPEED_UP: 12,   // +px/s every SPEED_EVERY catches (gentle ramp)
    SPEED_EVERY: 2,
    DOG_SPEED_MAX: 230, // cap — stays super simple
    SPRINT_MULT: 1.5,   // sprint speed multiplier once he spots the disc
    FLIGHT_T: 0.9,      // frisbee flight seconds — ease-out cubic, dies at the end
    REACT_T: 0.25,      // beat before the dog locks onto the landing point
    SLOW_REACT_T: 0.55, // 10% "slow read" — the dang-it moment
    SLOW_REACT_CHANCE: 0.1,
    STRIP_H: 120,       // top UI strip: taps, targets and the dog stay below it
    RUN_T: 4.5,         // max free-run seconds with no throw before a quiet reset
    RESOLVE_T: 1.3,     // celebration beat after catch / miss (longer so the outcome reads)
    READY_T: 0.8,       // "ready" beat: eager bounce, then the whistle
    JOG_SPEED: 260,     // jog back to the lineup between rounds
    LINEUP_Y: 90,       // dog lines up this far from the bottom
  };

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  // state: 'title' | 'play' | 'win'
  let state = "title";
  let catches = 0;

  // the dog: {x,y,angle,speed,phase,flipT,shakeT}
  // angle = facing direction (radians, 0 = +x). Top-down: he rotates to
  // face wherever he's going. heading = his free-run direction;
  // baseX/baseY = weave-free position; base = run speed before sprinting.
  let dog = null;

  // round phases: 'ready' (eager bounce) -> 'running' (dog runs free,
  // one tap allowed) -> 'resolve' (catch/miss beat) -> 'return'
  // (dog jogs back to the lineup) -> 'ready' with a fresh heading.
  let round = { phase: "ready", t: 0, thrown: false, result: null,
                reactT: 0, reacting: false };

  // frisbee modes: 'ready' | 'flying' | 'caught' | 'landed'
  // top-down: straight flat flight, spinning disc + gold trail, no arc.
  // 'caught' = disc in the dog's mouth (THE catch signal);
  // 'landed' = disc lying on the grass where it fell (THE miss signal).
  let frisbee = null;

  let parts = [];   // particles {x,y,vx,vy,t,life,hue,r}
  let rings = [];   // expanding rings {x,y,r,t,life,hue}
  let treats = [];  // win-state falling treats {x,y,vy,rot,vr}

  let playBtn = { x: 0, y: 0, w: 0, h: 0 };

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

  function dogSpeed() {
    return Math.min(CFG.DOG_SPEED_MAX,
      CFG.DOG_SPEED + Math.floor(catches / CFG.SPEED_EVERY) * CFG.DOG_SPEED_UP);
  }

  function addPart(p) {
    if (parts.length < 420) parts.push(p);
  }

  function burst(x, y, hue, n, spd) {
    n = n || 18; spd = spd || 260;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const s = rnd(spd * 0.4, spd);
      addPart({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                t: 0, life: rnd(0.4, 0.9), hue: hue, r: rnd(2.5, 5) });
    }
  }

  function confettiBlast(x, y, n) {
    n = n || 90;
    const hues = [45, 190, 315, 150, 265, 0];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const s = rnd(140, 420);
      addPart({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140,
                t: 0, life: rnd(0.8, 1.6),
                hue: hues[(Math.random() * hues.length) | 0], r: rnd(3, 6) });
    }
    for (let k = 0; k < 3; k++) {
      rings.push({ x: x, y: y, r: 16 + k * 10, t: -k * 0.09, life: 0.7, hue: 45 });
    }
  }

  /* ---------------- sounds (always on, no toggle — studio rule) ---------------- */
  function sndThrow() {
    audio.tone(280, 0.2, { type: "sine", vol: 0.09, slideTo: 720 }); // whoosh up
  }
  function sndWhistle() {
    // sharp two-tone whistle: the release!
    audio.tone(1500, 0.12, { type: "sine", vol: 0.10, slideTo: 2200 });
    audio.tone(2200, 0.16, { type: "sine", vol: 0.10, slideTo: 1500, when: 0.13 });
  }
  function sndBark() {
    // happy double-yip
    audio.tone(740, 0.09, { type: "square", vol: 0.12, slideTo: 380 });
    audio.tone(880, 0.09, { type: "square", vol: 0.12, slideTo: 420, when: 0.11 });
  }
  function sndOops() {
    // gentle "oops" — two soft descending tones. Forgiving, never sad.
    audio.tone(392, 0.14, { type: "triangle", vol: 0.10, slideTo: 330 });
    audio.tone(330, 0.18, { type: "triangle", vol: 0.10, slideTo: 262, when: 0.15 });
  }
  function sndWin() {
    audio.arp([523, 659, 784, 1047, 880, 1047, 1319, 1568], 0.1, "square", 0.12);
  }

  /* ---------------- free run ----------------
     No fixed route. Each round the dog takes off on a random heading —
     85% upfield (straight-up ± 50°), 15% wide (± 50–80°) — with a gentle
     perpendicular weave so he feels alive. The player reads the heading
     from the intent dots and the sprint-reach ring, then leads him. */
  function pickHeading() {
    const up = -Math.PI / 2;
    if (Math.random() < 0.85) return up + rnd(-0.87, 0.87); // ±50° upfield
    const s = Math.random() < 0.5 ? -1 : 1;
    return up + s * rnd(0.87, 1.40);                        // wide: ±50–80°
  }

  // sprint reach: how far he can get once he spots the disc —
  // sprint speed × the flight time left after his reaction beat.
  function zoneReach() {
    return CFG.SPRINT_MULT * dog.base * (CFG.FLIGHT_T - CFG.REACT_T);
  }

  // advance the free run one step: straight along the heading with a
  // sinusoidal lateral weave (0.8 Hz, ~10px). Clamped to the field and
  // below the top UI strip; clampedT tracks time spent pinned.
  function moveFreeRun(dt) {
    const h = dog.heading;
    dog.weaveT += dt;
    const w = 2 * Math.PI * 0.8;
    const A = 10;
    dog.baseX += Math.cos(h) * dog.speed * dt;
    dog.baseY += Math.sin(h) * dog.speed * dt;
    const px = -Math.sin(h), py = Math.cos(h); // perpendicular
    const off = A * Math.sin(w * dog.weaveT);
    const nx = dog.baseX + px * off;
    const ny = dog.baseY + py * off;
    const x0 = 40, x1 = W - 40, y0 = CFG.STRIP_H + 40, y1 = H - 40;
    const cx = clamp(nx, x0, x1), cy = clamp(ny, y0, y1);
    dog.clampedT = (cx !== nx || cy !== ny) ? dog.clampedT + dt : 0;
    dog.baseX += cx - nx; dog.baseY += cy - ny; // don't accumulate outside
    dog.x = cx; dog.y = cy;
    // face along the true velocity (heading + weave tilt)
    const latV = A * w * Math.cos(w * dog.weaveT);
    dog.angle = h + Math.atan2(latV, dog.speed);
  }

  /* ---------------- round flow ---------------- */
  function resetDog() {
    dog = { x: W / 2, y: H - CFG.LINEUP_Y, angle: -Math.PI / 2,
            speed: dogSpeed(), base: dogSpeed(), phase: 0,
            flipT: 0, shakeT: 0, heading: -Math.PI / 2,
            baseX: W / 2, baseY: H - CFG.LINEUP_Y,
            weaveT: rnd(0, 6.28), clampedT: 0 };
  }

  function resetFrisbee() {
    frisbee = { mode: "ready", x: 0, y: 0, sx: 0, sy: 0,
                tx: 0, ty: 0, t: 0, dur: CFG.FLIGHT_T, spin: 0, trail: [] };
  }

  function newRound(forceHeading, skipReady) {
    const sy = H - CFG.LINEUP_Y;
    dog.x = W / 2; dog.y = sy;
    dog.baseX = dog.x; dog.baseY = dog.y;
    dog.heading = (forceHeading !== undefined && forceHeading !== null)
      ? forceHeading : pickHeading();
    dog.angle = dog.heading; // facing upfield
    dog.base = dogSpeed();
    dog.speed = dog.base;
    dog.weaveT = rnd(0, 6.28);
    dog.clampedT = 0;
    dog.flipT = 0; dog.shakeT = 0;
    round.phase = skipReady ? "running" : "ready";
    round.t = 0;
    round.thrown = false;
    round.result = null;
    round.reactT = 0;
    round.reacting = false;
    resetFrisbee();
  }

  function startGame() {
    catches = 0;
    parts = []; rings = []; treats = [];
    resetDog();
    newRound();
    state = "play";
    if (window.SDGplays) window.SDGplays.played("frisbeedog");
    audio.arp([392, 523, 659], 0.08, "square", 0.10);
  }

  function winGame() {
    state = "win";
    sndWin();
    confettiBlast(W / 2, H * 0.35, 130);
  }

  /* ---------------- throwing & catching ---------------- */
  function throwFrisbee(x, y) {
    const f = frisbee;
    f.mode = "flying";
    f.sx = W / 2; f.sy = H - 24;               // launches from bottom center
    f.tx = clamp(x, 24, W - 24);
    f.ty = clamp(y, CFG.STRIP_H + 40, H - 40); // never above the UI strip
    f.t = 0; f.dur = CFG.FLIGHT_T; f.spin = 0; f.trail = [];
    f.x = f.sx; f.y = f.sy;
    round.thrown = true;
    // his read beat: usually quick, sometimes a slow "dang-it" read
    round.reactT = (Math.random() < CFG.SLOW_REACT_CHANCE)
      ? CFG.SLOW_REACT_T : CFG.REACT_T;
    round.reacting = false;
    sndThrow();
  }

  function doCatch() {
    // UNMISTAKABLE: the disc ends up in his mouth (drawn there — see
    // drawFrisbee), big star explosion, happy fanfare, big gold ring.
    catches++;
    dog.speed = dogSpeed();
    dog.flipT = 0.55;                       // joyful spin
    frisbee.mode = "caught";
    sndBark();
    audio.arp([523, 659, 784, 1047], 0.09, "square", 0.12); // happy fanfare
    confettiBlast(dog.x, dog.y - 50, 60);
    rings.push({ x: dog.x, y: dog.y - 30, r: 30, t: 0, life: 0.8, hue: 45 });
    if (catches >= CFG.WIN_CATCHES) winGame();
  }

  function doMiss(x, y) {
    // CLEAR but forgiving: the disc STAYS on the grass where it landed
    // (drawn there — see drawFrisbee), the dog looks at it and does a
    // soft head-shake. Nothing lost — no penalty, no streak reset,
    // no sad sounds.
    frisbee.mode = "landed";
    frisbee.x = x; frisbee.y = y;
    dog.angle = Math.atan2(y - dog.y, x - dog.x); // look at the missed disc
    dog.shakeT = 0.9;
    sndOops();
    for (let i = 0; i < 14; i++) {
      addPart({ x: x + rnd(-10, 10), y: y + rnd(-5, 5),
                vx: rnd(-90, 90), vy: rnd(-90, -20),
                t: 0, life: rnd(0.4, 0.8), hue: 100, r: rnd(2, 5) });
    }
    rings.push({ x: x, y: y, r: 14, t: 0, life: 0.6, hue: 100 }); // dust ring
  }

  function onTap(x, y) {
    if (audio.unlock) audio.unlock();
    if (state === "title") { startGame(); return; }
    if (state === "win") {
      if (x >= playBtn.x && x <= playBtn.x + playBtn.w &&
          y >= playBtn.y && y <= playBtn.y + playBtn.h) startGame();
      return;
    }
    if (state !== "play") return;
    if (round.phase !== "running") return; // throw only on a live run
    if (frisbee.mode !== "ready") return;  // one throw per round
    if (y < CFG.STRIP_H) return;           // top strip is UI — taps there don't throw
    throwFrisbee(x, y);
  }
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    onTap(e.clientX, e.clientY);
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function tickRound(dt) {
    round.t += dt;
    const ph = round.phase;
    if (ph === "ready") {
      // eager bounce at the lineup; the whistle sends him off
      if (round.t >= CFG.READY_T) {
        round.phase = "running";
        round.t = 0;
        sndWhistle(); // release!
      }
    } else if (ph === "running") {
      const f = frisbee;
      if (!round.thrown) {
        // free run: no throw yet — he just runs his heading
        moveFreeRun(dt);
        if (round.t >= CFG.RUN_T || dog.clampedT > 0.5) {
          // never threw: quiet reset, no penalty
          round.result = "runoff";
          round.phase = "return";
          round.t = 0;
        }
      } else if (!round.reacting) {
        // he keeps running his line while he "reads" the throw...
        moveFreeRun(dt);
        round.reactT -= dt;
        if (round.reactT <= 0) {
          // ...then locks onto the landing point and SPRINTS
          round.reacting = true;
          dog.speed = dog.base * CFG.SPRINT_MULT;
        }
      } else {
        // sprint straight at the landing point; wait there if early
        const dx = f.tx - dog.x, dy = f.ty - dog.y;
        const d = Math.hypot(dx, dy);
        if (d > 4) {
          const step = Math.min(d, dog.speed * dt);
          dog.x += dx / d * step;
          dog.y += dy / d * step;
          dog.angle = Math.atan2(dy, dx);
        }
        dog.baseX = dog.x; dog.baseY = dog.y;
      }
      if (f.mode === "flying") {
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        // ease-out cubic: fast off the hand, dying at the end
        const e = 1 - Math.pow(1 - k, 3);
        f.x = f.sx + (f.tx - f.sx) * e;
        f.y = f.sy + (f.ty - f.sy) * e;
        f.spin += (14 - 12 * e) * dt; // spin decays through the flight
        f.trail.push({ x: f.x, y: f.y, t: 0 });
        if (f.trail.length > 12) f.trail.shift();
        for (const tr of f.trail) tr.t += dt;
        if (k >= 1) {
          // landing: did he get there in time?
          if (dist(dog.x, dog.y, f.tx, f.ty) < CFG.CATCH_R) {
            round.result = "catch";
            doCatch(); // sets f.mode = "caught"
          } else {
            round.result = "miss";
            doMiss(f.tx, f.ty); // sets f.mode = "landed"
          }
          if (state === "play") { round.phase = "resolve"; round.t = 0; }
        }
      }
    } else if (ph === "resolve") {
      if (round.t >= CFG.RESOLVE_T) {
        round.phase = "return";
        round.t = 0;
      }
    } else if (ph === "return") {
      // jog back to the lineup, then a fresh heading
      const hx = W / 2, hy = H - CFG.LINEUP_Y;
      const d = dist(dog.x, dog.y, hx, hy);
      if (d < 12) {
        newRound();
      } else {
        const step = Math.min(d, CFG.JOG_SPEED * dt);
        dog.angle = Math.atan2(hy - dog.y, hx - dog.x);
        dog.x += (hx - dog.x) / d * step;
        dog.y += (hy - dog.y) / d * step;
      }
    }
  }

  function tick(dt) {
    time += dt;

    if (dog) {
      dog.phase += dt * (6 + dog.speed * 0.045);
      if (dog.flipT > 0) dog.flipT -= dt;
      if (dog.shakeT > 0) dog.shakeT -= dt;
      // victory spins keep coming in the win state
      if (state === "win" && dog.flipT <= 0 && Math.random() < dt * 1.6) dog.flipT = 0.55;
    }

    if (state === "play") tickRound(dt);

    // win-state treat shower
    if (state === "win") {
      if (treats.length < 130 && Math.random() < dt * 22) {
        treats.push({ x: rnd(0, W), y: -30, vy: rnd(130, 230),
                      rot: rnd(0, 6.28), vr: rnd(-4, 4) });
      }
    }
    for (let i = treats.length - 1; i >= 0; i--) {
      const t = treats[i];
      t.y += t.vy * dt; t.rot += t.vr * dt;
      if (t.y > H + 40) treats.splice(i, 1);
    }

    // particles + rings
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) rings.splice(i, 1);
    }
  }

  /* ---------------- drawing: top-down football field ---------------- */
  function drawField() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4da862");
    g.addColorStop(1, "#357a44");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // mow stripes
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    const band = H / 16;
    for (let i = 0; i < 16; i += 2) ctx.fillRect(0, i * band, W, band);
    // yard lines every 1/8 of field height
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 1; i < 8; i++) ctx.fillRect(0, i * H / 8 - 3, W, 6);
  }

  // intent indicator (replaces the old route telegraph): 4 small paw
  // dots ahead of the dog along his CURRENT heading, updated live,
  // plus a soft dashed gold ring showing his sprint reach — the
  // "catchable zone". Shown until the throw; then he's committed.
  function drawIntent() {
    if (state !== "play") return;
    if (round.phase !== "running" && round.phase !== "ready") return;
    if (frisbee && frisbee.mode !== "ready") return;
    const d = dog;
    const dx = Math.cos(d.heading), dy = Math.sin(d.heading);
    for (let i = 1; i <= 4; i++) {
      drawPaw(d.x + dx * i * 30, d.y + dy * i * 30, 0.7, 0.55);
    }
    ctx.save();
    ctx.strokeStyle = "rgba(255,210,63,0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(d.x, d.y, zoneReach(), 0, 6.2832);
    ctx.stroke();
    ctx.restore();
  }

  // the top UI strip reads as "not the field" — taps here don't throw,
  // and the dog never runs above it
  function drawStrip() {
    ctx.fillStyle = "rgba(6,26,18,0.55)";
    ctx.fillRect(0, 0, W, CFG.STRIP_H);
  }

  function drawPaw(x, y, s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x, y + 5 * s, 9 * s, 7 * s, 0, 0, 6.2832);
    ctx.fill();
    const toes = [[-11, -6], [0, -12], [11, -6]];
    for (const tp of toes) {
      ctx.beginPath();
      ctx.arc(x + tp[0] * s, y + tp[1] * s, 4.5 * s, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- drawing: the dog (top-down, chunky) ---------------- */
  function drawDog() {
    const d = dog;
    const OUT = "#6b4423", FUR = "#e2a355", FUR_D = "#c07f35", CREAM = "#f6d79a";
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(0.76, 0.76); // smaller graphics, more field room (DOG_R 42 -> 32)
    // shadow stays grounded
    ctx.fillStyle = "rgba(20,60,25,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 48, 14, 0, 0, 6.2832);
    ctx.fill();
    // eager bounce during the ready beat
    if (round.phase === "ready" && state === "play") {
      ctx.translate(0, -Math.abs(Math.sin(time * 10)) * 9);
    }
    let ang = d.angle;
    if (d.flipT > 0) { const k = 1 - d.flipT / 0.55; ang += k * Math.PI * 2; } // joyful spin
    if (d.shakeT > 0) { ang += Math.sin(d.shakeT * 28) * 0.22; }              // confused shake
    ctx.rotate(ang);
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUT;

    // legs — paddling side nubs
    ctx.fillStyle = FUR;
    const legs = [[-20, -30, 0], [-20, 30, Math.PI], [22, -30, Math.PI], [22, 30, 0]];
    for (const lg of legs) {
      const sw = Math.sin(d.phase + lg[2]) * 8;
      ctx.beginPath();
      ctx.ellipse(lg[0] + sw, lg[1], 10, 8, 0, 0, 6.2832);
      ctx.fill(); ctx.stroke();
    }

    // tail nub — wagging
    const wag = Math.sin(d.phase * 1.7) * 0.5;
    ctx.save();
    ctx.translate(-44, 0);
    ctx.rotate(wag * 0.6);
    ctx.fillStyle = FUR_D;
    ctx.beginPath();
    ctx.arc(-8, 0, 10, 0, 6.2832);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // body
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 28, 0, 0, 6.2832);
    ctx.fill(); ctx.stroke();
    // saddle patch
    ctx.fillStyle = FUR_D;
    ctx.beginPath();
    ctx.ellipse(-8, 0, 26, 17, 0, 0, 6.2832);
    ctx.fill();

    // head
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.arc(50, 0, 24, 0, 6.2832); ctx.fill(); ctx.stroke();
    // floppy ears
    const flop = Math.sin(d.phase + 1.2) * 0.25;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(42, s * 20);
      ctx.rotate(s * (0.5 + flop));
      ctx.fillStyle = FUR_D;
      ctx.beginPath();
      ctx.ellipse(0, s * 10, 10, 18, 0, 0, 6.2832);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // snout + nose
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.ellipse(66, 0, 12, 9, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#3a2410";
    ctx.beginPath(); ctx.arc(75, 0, 5.5, 0, 6.2832); ctx.fill();
    // eyes — looking where he's going
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(56, s * 11, 7, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#241505";
      ctx.beginPath(); ctx.arc(59, s * 11, 3.4, 0, 6.2832); ctx.fill();
    }

    ctx.restore();
  }

  /* ---------------- drawing: frisbee (top-down spinning disc) ---------------- */
  function drawDiscTop(x, y, r, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#8f1f1f";
    ctx.fillStyle = "#e23b3b";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 6.2832);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a = spin + i * 2.094;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, a, a + 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrisbee() {
    const f = frisbee;
    if (!f) return;
    if (f.mode === "flying") {
      for (const tr of f.trail) {
        const k = Math.max(0, 1 - tr.t / 0.45);
        ctx.fillStyle = "rgba(255,210,63," + (k * 0.5).toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 10 * k + 2, 0, 6.2832); ctx.fill();
      }
      drawDiscTop(f.x, f.y, 22, f.spin);
    } else if (f.mode === "caught") {
      // THE catch signal: the disc is visibly in the dog's mouth
      const mx = dog.x + Math.cos(dog.angle) * 56;
      const my = dog.y + Math.sin(dog.angle) * 56;
      drawDiscTop(mx, my, 22, f.spin);
    } else if (f.mode === "landed") {
      // THE miss signal: the disc lies on the grass where it fell
      drawDiscTop(f.x, f.y, 22, 0);
    }
  }

  /* ---------------- drawing: treats (win shower) ---------------- */
  function drawTreat(t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot);
    ctx.fillStyle = "#d9a066";
    ctx.strokeStyle = "#8a5a24";
    ctx.lineWidth = 3;
    const w = 26, h = 10;
    ctx.beginPath();
    ctx.arc(-w / 2, 0, 8, 0, 6.2832);
    ctx.arc(w / 2, 0, 8, 0, 6.2832);
    ctx.fill();
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- drawing: HUD ---------------- */
  // catch progress: 10 small disc icons across the top strip, filling in
  // as he catches — visual only, no numbers. Clear of the back button.
  function drawProgress() {
    const n = CFG.WIN_CATCHES, r = 10, gap = 28;
    const sx = Math.max(104, W / 2 - (n - 1) * gap / 2);
    const y = CFG.STRIP_H / 2;
    for (let i = 0; i < n; i++) {
      const x = sx + i * gap;
      if (i < catches) {
        drawDiscTop(x, y, r, time * 2);
      } else {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.2832);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function bigButton(label) {
    const pulse = 1 + Math.sin(time * 4) * 0.03;
    const w = playBtn.w * pulse, h = playBtn.h;
    const x = W / 2 - w / 2, y = playBtn.y;
    ctx.save();
    ctx.shadowColor = "#29faff"; ctx.shadowBlur = 26;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#22d3ee"); g.addColorStop(1, "#0e7490");
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 20); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#04121a";
    ctx.font = "26px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, W / 2, y + h / 2 + 2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  function drawTitle() {
    ctx.fillStyle = "rgba(10,40,60,0.45)";
    ctx.fillRect(0, 0, W, H);
    // spinning disc logo
    const bx = W / 2, by = H * 0.26 + Math.abs(Math.sin(time * 2.4)) * -30;
    ctx.save();
    ctx.shadowColor = "#e23b3b"; ctx.shadowBlur = 30;
    drawDiscTop(bx, by, 44, time * 3);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.font = "34px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(20,60,90,0.9)"; ctx.lineWidth = 6;
    ctx.strokeText("FRISBEE", W / 2, H * 0.44);
    ctx.fillText("FRISBEE", W / 2, H * 0.44);
    ctx.strokeText("DOG", W / 2, H * 0.44 + 46);
    ctx.fillText("DOG", W / 2, H * 0.44 + 46);
    ctx.font = "13px 'Press Start 2P', monospace";
    ctx.fillStyle = "#e8fbff";
    ctx.fillText("TAP TO THROW", W / 2, H * 0.44 + 86);
    ctx.textAlign = "left";
    bigButton("PLAY");
  }

  function drawWin() {
    ctx.fillStyle = "rgba(10,40,60,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffd23f";
    ctx.font = "34px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(90,50,0,0.9)"; ctx.lineWidth = 6;
    ctx.strokeText("YOU WIN!", W / 2, H * 0.30);
    ctx.fillText("YOU WIN!", W / 2, H * 0.30);
    drawPixelNumber(ctx, CFG.WIN_CATCHES, W / 2, H * 0.30 + 40, 7, "#ffffff", true);
    ctx.textAlign = "left";
    bigButton("PLAY AGAIN");
  }

  function drawParts() {
    for (const p of parts) {
      const k = 1 - p.t / p.life;
      ctx.fillStyle = "hsla(" + p.hue + ",95%,62%," + k.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * k + 0.5, 0, 6.2832);
      ctx.fill();
    }
    for (const r of rings) {
      if (r.t < 0) continue;
      const k = clamp(r.t / r.life, 0, 1);
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,65%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 80, 0, 6.2832);
      ctx.stroke();
    }
  }

  function render() {
    drawField();
    drawStrip();
    drawIntent();
    if (dog) drawDog();
    drawFrisbee();
    for (const t of treats) drawTreat(t);
    drawParts();
    if (state !== "title") drawProgress();
    if (state === "title") drawTitle();
    else if (state === "win") drawWin();
  }

  /* ---------------- layout ---------------- */
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    playBtn.w = Math.min(300, W * 0.62); playBtn.h = 84;
    playBtn.x = W / 2 - playBtn.w / 2;  playBtn.y = H * 0.66;
    // keep coordinates sane: rebuild the round on the new field size
    if (state === "play") newRound();
    else if (dog) { dog.x = W / 2; dog.y = H - CFG.LINEUP_Y; }
  }
  window.addEventListener("resize", resize);

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; } // pause when tab hidden
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    tick(dt);
    render();
  }

  resize();
  resetDog();
  newRound(); // lineup ready behind the title screen
  requestAnimationFrame(frame);

  /* Test hook. `debug` exposes live objects so tests can set the dog's
     heading, throw, and inspect the round — test-only, never used by
     the game. */
  window.__dogTest = {
    get state() { return state; },
    get catches() { return catches; },
    get cfg() { return CFG; },
    debug: {
      dog: function () { return dog; },
      frisbee: function () { return frisbee; },
      phase: function () { return round.phase; },
      heading: function () { return dog.heading; },
      zoneR: function () { return zoneReach(); },
      reacting: function () { return round.reacting; },
      thrown: function () { return round.thrown; },
      result: function () { return round.result; },
      // start a fresh round with a forced heading (tests only).
      // skipReady=true (default) puts the dog straight into his run.
      forceHeading: function (hd, skipReady) {
        if (state !== "play") startGame();
        newRound(hd, skipReady === undefined ? true : skipReady);
      },
    },
    tap: function (x, y) { onTap(x, y); },
    start: function () { startGame(); },
    step: function (dt) { tick(dt || 0.016); },
  };
})();
