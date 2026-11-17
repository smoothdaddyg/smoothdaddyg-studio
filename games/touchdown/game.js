/* ============================================================
   TOUCHDOWN! — SmoothDaddyG
   ------------------------------------------------------------
   Danny's 2026-11-16 call: a test game built on the Passing
   Frenzy passing feel, but real football. You line up, the
   other team lines up in front of you, one-two-three GO and
   everybody moves. Your thumb moves the quarterback — up,
   down, left, right — while your guys take off running:
   some block, a few run out to catch a pass, a couple want
   a handoff. See a guy open, throw it to him like Passing
   Frenzy; if he catches it he runs for the goal, and if he
   gets tackled you line up at that spot and go again. Keep
   driving across 100 yards until you score. "I don't know
   if this is going to work or not... maybe you can wire
   something — let's try it out."

   THE CONTROLS (his worry, answered) — he wasn't sure the
   move-the-QB-then-tap-to-pass mechanics would work with
   one thumb. So the two jobs sit on two thumbs: a floating
   thumb-stick lives in the bottom deck (Vault Blaster
   pattern — drag anywhere in the deck and the QB runs that
   way; the stick floats to either hand, and the thumb never
   covers the playfield, per the studio deck rule) and a
   big PASS button sits on EACH end of the deck (mirrored —
   either thumb can throw). One thumb steers, the other
   throws. Field touches do NOTHING during play.
   PASS auto-targets the most open receiver with a lead,
   Passing Frenzy-style — no aiming, just timing.
   HANDOFF needs no button at all: steer the QB into a
   nearby back and he takes it and runs.

   THE DRIVE: start on your own 20, 80 yards to go. No
   downs, no turnovers in v1 — incomplete or intercepted,
   the ball just comes back to the line and you run it
   again; tackled, you line up at that spot. Keep driving
   until somebody crosses the goal: big touchdown finale,
   then PLAY AGAIN from the 20. 7v7 (QB + 2 WR + 2 RB + 2
   blockers vs 3 DL + 2 LB + 2 DB); receivers pick a random
   route every play — go, slant, cross, out, curl — per his
   "they just start running randomly." After a catch or a
   handoff the carrier runs for the goal on his own, dodging
   the nearest defender, while the defense chases.

   PASS RUSH: the rush holds for a beat after the snap so the
   QB gets a second to read the field (live-check fix
   2026-11-16 — with no delay, hesitating 0.6s after the
   snap was a sack every time). The lines stand 2.5 yards
   apart at the snap so the two teams don't overlap.

   NO-GAME-OVER: there is no losing here. A tackle is a
   whistle and a new line of scrimmage, never a restart.
   NO READING: yard lines on the field, a yard label, a
   progress strip — pictures only.
   MUSIC: an original C-major fight-song loop composed here
   (square lead, triangle bass at vol 0.2, noise drums, a
   harmony voice) — its own melody, never a re-skin.
   ============================================================ */
"use strict";
(function () {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  /* ---------------- config ---------------- */
  const CFG = {
    FIELD_W: 30,        // yards across (x: -15..15)
    VIEW_YD: 22,        // yards of field visible vertically
    START_YD: 80,       // ball starts 80 yd from the goal (own 20)
    QB_SPEED: 6.5,      // yd/s
    REC_SPEED: 6.0,     // yd/s (routes; ±0.4 per player)
    CARRY_SPEED: 6.3,   // yd/s (ball carrier running for the goal)
    DEF_SPEED: 5.9,     // yd/s (defenders chase)
    PASS_SPEED: 26,     // yd/s (ball flight)
    TACKLE_R: 1.4,      // yd (defender reaches the carrier)
    CATCH_R: 1.6,       // yd (receiver reaches the landing spot)
    HANDOFF_R: 1.7,     // yd (QB runs into a back)
    PLAY_CAP: 9,        // s (safety valve: whistle, ball back at line)
    RUSH_DELAY: 1.0,    // s the rush holds after the snap — the QB
                        // gets a beat to read the field before the
                        // pocket collapses (live-check fix 2026-11-16:
                        // with no delay a 0.6s hesitation was a sack)
    WHISTLE_T: 1.1,     // s (pause after a tackle / dead ball)
    STICK_R: 55,        // px (max stick drag)
    PASS_R: 38,         // px (PASS button radius)
  };
  const ROUTES = ["go", "slant", "cross", "out", "curl"];

  /* ---------------- helpers ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /* ---------------- audio ---------------- */
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  function sndSnap() { noiseS(0.08, { filter: "bandpass", freq: 2000, vol: 0.12 }); }
  function sndGo() { tone(880, 0.12, { type: "square", vol: 0.10 }); }
  function sndThrow() { noiseS(0.18, { filter: "bandpass", freq: 900, vol: 0.10, slideTo: 2400 }); }
  function sndCatch() { arp([523, 784, 1046], 0.06, "square", 0.10); }
  function sndHandoff() { tone(660, 0.08, { type: "square", vol: 0.10, slideTo: 880 }); }
  function sndTackle() {
    noiseS(0.25, { filter: "lowpass", freq: 700, vol: 0.2, slideTo: 120 });
    tone(120, 0.25, { type: "triangle", vol: 0.14, slideTo: 50 });
  }
  function sndWhistle() {
    tone(2200, 0.16, { type: "square", vol: 0.08 });
    tone(2200, 0.22, { type: "square", vol: 0.08, when: 0.2 });
  }
  function sndBad() { tone(220, 0.25, { type: "sawtooth", vol: 0.08, slideTo: 140 }); }
  function sndFanfare() { arp([523, 659, 784, 1046, 784, 1046, 1318, 1568], 0.11, "square", 0.10); }
  function sndCheer() { noiseS(1.2, { filter: "highpass", freq: 2500, vol: 0.06, when: 0.1 }); }

  /* ---------------- background music ----------------
     An ORIGINAL fight-song loop, composed here for
     Touchdown!: C major, short singable phrase with a
     variation at the end, rests that breathe, and a
     harmony voice a third under the lead (the NES second
     pulse channel). Driving bass (C pedal, F lift, G
     drive, back to C) and a fight-song drum feel (kick
     on 1 and 3, snare on 2 and 4). 64 sixteenth steps
     at 132 BPM, bass LOUD at 0.2. */
  const C2 = 65.41, D2 = 73.42, F2 = 87.31, G2 = 98;
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46,
        G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5;
  const MUSIC_CFG = {
    bpm: 132, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 8, 16, 24, 32, 40, 48, 56], snares: [4, 12, 20, 28, 36, 44, 52, 60], hats: "odd",
    bass: [C2,0,C2,0, G2,0,C2,0, C2,0,C2,0, G2,0,C2,0,
           F2,0,F2,0, C2,0,F2,0, F2,0,F2,0, C2,0,F2,0,
           G2,0,G2,0, D2,0,G2,0, G2,0,G2,0, D2,0,G2,0,
           C2,0,C2,0, G2,0,C2,0, C2,0,G2,0, C2,0,0,0],
    lead: [C5,0,E5,0, G5,0,E5,0, C6,0,G5,0, E5,0,C5,0,
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
    third[B5] = 783.99; third[C6] = 880;
    for (let i = 0; i < 64; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }

  /* ---------------- layout ----------------
     The field is 30 yards wide and 100 yards long
     (y = 0 is the goal line at the top, y = 100 your
     own goal). The camera shows VIEW_YD yards and
     follows the ball, keeping it about two-thirds down
     the screen so you can see upfield. */
  let W = 400, H = 700, DPR = 1, DECK_H = 190, PH = 510;
  let camY = 65;
  let passL = { x: 52, y: 0, r: CFG.PASS_R }, passR = { x: 348, y: 0, r: CFG.PASS_R };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.26, 170, 210));
    PH = H - DECK_H;
    passL = { x: Math.round(W * 0.13), y: PH + DECK_H / 2, r: CFG.PASS_R };
    passR = { x: Math.round(W * 0.87), y: PH + DECK_H / 2, r: CFG.PASS_R };
    updateCam();
  }
  window.addEventListener("resize", resize);
  // World (yards) -> screen (px). x: -15..15 spans the width.
  const sx = (x) => (x + CFG.FIELD_W / 2) / CFG.FIELD_W * W;
  const sy = (y) => (y - camY) / CFG.VIEW_YD * PH;
  const ydPx = () => W / CFG.FIELD_W; // px per yard across
  function updateCam() {
    camY = clamp(ballY - 15, -8, 100 - CFG.VIEW_YD);
  }

  /* ---------------- state ---------------- */
  let state = "title"; // title | lineup | play | whistle | win
  let ballY = CFG.START_YD;   // yards from the goal (80 = own 20)
  let lineY = CFG.START_YD;   // line of scrimmage for this play
  let playT = 0, whistleT = 0, goFlash = 0, winT = 0, plays = 0;
  let carrier = null;         // the player object holding the ball
  let ballInAir = null;       // {x0,y0,x1,y1,t,T,target} or null
  let flash = null;           // {text, t} — big center flash
  let off = [], def = [];     // offense / defense players
  let parts = [], rings = [], confetti = [], fireworks = [];
  let testStick = null;       // {x, y} test override (-1..1), or null

  // One player: {side, role, x, y, vx, vy, speed, route, routeT,
  //   blockT, hasBall, color, r}
  function mkPlayer(side, role, x, y, speed, color) {
    return { side: side, role: role, x: x, y: y, vx: 0, vy: 0,
      speed: speed, route: null, routeT: 0, blockT: 0,
      hasBall: false, color: color, r: 0.9 };
  }
  function lineup() {
    const L = ballY;
    off = [
      mkPlayer("off", "qb", 0, L + 4, CFG.QB_SPEED, "#29faff"),
      mkPlayer("off", "wr", -13, L + 1, CFG.REC_SPEED + rnd(-0.3, 0.4), "#29faff"),
      mkPlayer("off", "wr", 13, L + 1, CFG.REC_SPEED + rnd(-0.3, 0.4), "#29faff"),
      mkPlayer("off", "rb", -6, L + 5, CFG.REC_SPEED + rnd(-0.2, 0.3), "#7df9ff"),
      mkPlayer("off", "rb", 6, L + 5, CFG.REC_SPEED + rnd(-0.2, 0.3), "#7df9ff"),
      mkPlayer("off", "ol", -4, L + 1, 4.5, "#1e90c8"),
      mkPlayer("off", "ol", 4, L + 1, 4.5, "#1e90c8"),
    ];
    def = [
      mkPlayer("def", "dl", -4, L - 1.5, CFG.DEF_SPEED, "#ff3b30"),
      mkPlayer("def", "dl", 0, L - 1.5, CFG.DEF_SPEED, "#ff3b30"),
      mkPlayer("def", "dl", 4, L - 1.5, CFG.DEF_SPEED, "#ff3b30"),
      mkPlayer("def", "lb", -8, L - 4, CFG.DEF_SPEED, "#ff9f2e"),
      mkPlayer("def", "lb", 8, L - 4, CFG.DEF_SPEED, "#ff9f2e"),
      mkPlayer("def", "db", -11, L - 9, CFG.DEF_SPEED, "#ff5e8a"),
      mkPlayer("def", "db", 11, L - 9, CFG.DEF_SPEED, "#ff5e8a"),
    ];
    off[0].hasBall = true;
    carrier = off[0];
    ballInAir = null;
    lineY = ballY;
    // Near the goal the defense would line up past the goal
    // line — clamp everybody onto the field.
    for (const p of off) p.y = clamp(p.y, 0.5, 99);
    for (const p of def) p.y = clamp(p.y, 0.5, 99);
    updateCam();
  }
  function assignRoutes() {
    for (const p of off) {
      if (p.role === "wr") p.route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
      else if (p.role === "rb") p.route = (p.x < 0) ? "flat" : "check";
      else p.route = null;
      p.routeT = 0;
    }
  }
  // Route velocity for a receiver at time t into the play.
  function routeVel(p, dt) {
    p.routeT += dt;
    const t = p.routeT, dir = p.x < 0 ? 1 : -1; // run toward the middle / out
    switch (p.route) {
      case "go": return { x: 0, y: -1 };
      case "slant": return { x: -dir * 0.55, y: -0.84 };
      case "cross": return t < 1.6 ? { x: -dir, y: -0.25 } : { x: 0, y: -1 };
      case "out": return t < 0.7 ? { x: 0, y: -1 } : { x: dir, y: -0.15 };
      case "curl": return t < 1.3 ? { x: 0, y: -1 } : { x: 0, y: 0 };
      case "flat": return t < 1.0 ? { x: dir, y: 0.1 } : { x: dir * 0.3, y: -1 };
      case "check": return t < 1.5 ? { x: 0, y: 0.15 } : { x: 0, y: -1 };
      default: return { x: 0, y: 0 };
    }
  }
  function nearestDef(x, y) {
    let best = null, bd = 1e9;
    for (const d of def) {
      const dd = dist(x, y, d.x, d.y);
      if (dd < bd) { bd = dd; best = d; }
    }
    return { d: best, dist: bd };
  }
  function separation(p) {
    return nearestDef(p.x, p.y).dist;
  }
  // Most open eligible receiver: biggest separation, upfield
  // breaks ties. Eligible = WRs and RBs (not the line).
  function pickTarget() {
    let best = null, bs = -1e9;
    for (const p of off) {
      if (p.role !== "wr" && p.role !== "rb") continue;
      const s = separation(p) + 0.3 * (lineY - p.y);
      if (s > bs) { bs = s; best = p; }
    }
    return best;
  }

  /* ---------------- input ----------------
     Deck only — field touches do nothing during play.
     One thumb steers (floating stick, any deck point that
     isn't a PASS button), the other thumb throws (mirrored
     PASS buttons, both ends of the deck). A deck tap while
     lined up is the snap. Title / win: any tap advances. */
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  function inPass(x, y) {
    return dist(x, y, passL.x, passL.y) < passL.r + 14 ||
           dist(x, y, passR.x, passR.y) < passR.r + 14;
  }
  function onDown(x, y, id) {
    if (state === "title") { startDrive(); return; }
    if (state === "win") { startDrive(); return; }
    if (y < PH) return; // field touch: nothing
    if (state === "lineup") { snap(); return; }
    if (state !== "play") return;
    if (inPass(x, y)) { throwPass(); return; }
    if (stick.id === null) {
      stick.id = id;
      stick.ox = clamp(x, W * 0.28, W * 0.72);
      stick.oy = y;
      stick.x = 0; stick.y = 0;
    }
  }
  function onMove(x, y, id) {
    if (stick.id !== id) return;
    let dx = (x - stick.ox) / CFG.STICK_R;
    let dy = (y - stick.oy) / CFG.STICK_R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    stick.x = dx; stick.y = dy;
  }
  function onUp(id) {
    if (stick.id === id) { stick.id = null; stick.x = 0; stick.y = 0; }
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

  /* ---------------- flow ---------------- */
  function startDrive() {
    ballY = CFG.START_YD;
    plays = 0;
    parts = []; rings = []; confetti = []; fireworks = [];
    lineup();
    state = "lineup";
    flash = null;
    if (MUSIC) { try { MUSIC.start(); } catch (e) {} }
    try { if (window.SDGplays) window.SDGplays.played("touchdown"); } catch (e) {}
  }
  function snap() {
    state = "play";
    playT = 0;
    goFlash = 0.6;
    plays++;
    assignRoutes();
    sndSnap(); sndGo();
  }
  function throwPass() {
    if (state !== "play" || ballInAir || !carrier || carrier.role !== "qb") return;
    const target = pickTarget();
    if (!target) return;
    // Lead the runner: aim where his route is taking him when
    // the ball gets there. The flight time depends on the
    // distance, which depends on the lead — so iterate twice
    // to converge on the true intercept (a fixed 0.55s lead
    // undershoots on long throws: the receiver outruns it).
    // Use the route direction, not his current step velocity
    // — right after the snap he hasn't built up a step yet.
    const rv = routeVel(target, 0);
    const vx = rv.x * target.speed, vy = rv.y * target.speed;
    let lead = 0.55, tx = target.x, ty = target.y;
    for (let i = 0; i < 2; i++) {
      tx = clamp(target.x + vx * lead, -14.5, 14.5);
      ty = Math.max(0.5, target.y + vy * lead);
      lead = clamp(dist(carrier.x, carrier.y, tx, ty) / CFG.PASS_SPEED, 0.35, 0.9);
    }
    const d = dist(carrier.x, carrier.y, tx, ty);
    ballInAir = { x0: carrier.x, y0: carrier.y, x1: tx, y1: ty,
      t: 0, T: clamp(d / CFG.PASS_SPEED, 0.35, 0.9), target: target };
    carrier.hasBall = false;
    carrier = null;
    sndThrow();
  }
  function resolveCatch() {
    const b = ballInAir;
    ballInAir = null;
    const t = b.target;
    const td = dist(t.x, t.y, b.x1, b.y1);
    const nd = nearestDef(b.x1, b.y1);
    if (td <= CFG.CATCH_R && td <= nd.dist) {
      // Caught — he runs for the goal now.
      t.hasBall = true;
      carrier = t;
      ballY = clamp(t.y, 0.5, 99);
      updateCam();
      sndCatch();
      burst(sx(t.x), sy(t.y), "#ffe14d", 10, 2);
      if (t.y <= 0.5) touchdown(t);
      else flash = { text: "CAUGHT!", t: 0.9 };
    } else if (nd.dist <= CFG.CATCH_R + 0.2) {
      // A defender got there first — ball back at the line.
      whistle("INTERCEPTED!", false);
      sndBad();
    } else {
      whistle("INCOMPLETE!", false);
      sndBad();
    }
  }
  function handoff(rb) {
    const qb = off[0];
    qb.hasBall = false;
    rb.hasBall = true;
    carrier = rb;
    flash = { text: "HANDOFF!", t: 0.9 };
    sndHandoff();
    burst(sx(rb.x), sy(rb.y), "#7df9ff", 8, 2);
  }
  function tackle(atY, gain) {
    sndTackle(); sndWhistle();
    burst(sx(carrier ? carrier.x : 0), sy(atY), "#ff9f2e", 14, 2);
    rings.push({ x: sx(carrier ? carrier.x : 0), y: sy(atY), t: 0, life: 0.5, maxR: 46, color: "#ff9f2e" });
    const g = Math.round(gain);
    const txt = g > 0 ? "+" + g + " YARDS!" : g < 0 ? "LOSS OF " + (-g) : "NO GAIN";
    whistle(txt, true);
  }
  function whistle(text, spotted) {
    state = "whistle";
    whistleT = 0;
    flash = { text: text, t: CFG.WHISTLE_T };
    if (!spotted) ballY = lineY; // dead ball: back at the line
    updateCam();
  }
  function touchdown(p) {
    state = "win";
    winT = 0;
    flash = { text: "TOUCHDOWN!", t: 999 };
    sndFanfare(); sndCheer();
    burst(sx(p.x), sy(p.y), "#ffe14d", 30, 3);
    rings.push({ x: sx(p.x), y: sy(p.y), t: 0, life: 0.8, maxR: 90, color: "#ffe14d" });
  }
  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(40, 160) * spd;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, life: rnd(0.4, 0.9), color: color, r: rnd(2, 5) });
    }
  }

  /* ---------------- update ---------------- */
  function tickQB(dt) {
    const qb = off[0];
    if (!qb.hasBall) return;
    const s = testStick || (stick.id !== null ? { x: stick.x, y: stick.y } : null);
    if (s) {
      qb.vx = s.x * CFG.QB_SPEED;
      qb.vy = s.y * CFG.QB_SPEED;
      qb.x = clamp(qb.x + qb.vx * dt, -14.5, 14.5);
      qb.y = clamp(qb.y + qb.vy * dt, 1, 99);
      ballY = qb.y;
      updateCam();
    } else { qb.vx = 0; qb.vy = 0; }
    // Run into a back and he takes it — the handoff. This
    // runs whether or not the stick is held: standing next
    // to a back is a handoff too, not just steering into one.
    for (const p of off) {
      if (p.role === "rb" && dist(qb.x, qb.y, p.x, p.y) < CFG.HANDOFF_R) {
        handoff(p);
        return;
      }
    }
  }
  function tickOffense(dt) {
    for (const p of off) {
      if (p.role === "qb") continue;
      if (p.hasBall) continue; // the carrier runs his own way
      if (p.role === "ol") {
        // Blockers: step to the nearest rusher and hold him.
        const nd = nearestDef(p.x, p.y);
        if (nd.d && nd.dist < 6) {
          const d = nd.dist || 1;
          p.x += (nd.d.x - p.x) / d * p.speed * dt * 0.6;
          p.y += (nd.d.y - p.y) / d * p.speed * dt * 0.6;
          if (nd.dist < 1.4) nd.d.blockT = Math.max(nd.d.blockT, 0.9);
        }
        continue;
      }
      const v = routeVel(p, dt);
      p.vx = v.x * p.speed;
      p.vy = v.y * p.speed;
      p.x = clamp(p.x + p.vx * dt, -14.5, 14.5);
      p.y = clamp(p.y + p.vy * dt, 0.5, 99);
    }
  }
  function moveToward(p, tx, ty, dt, speed) {
    const d = dist(p.x, p.y, tx, ty) || 1;
    p.x += (tx - p.x) / d * speed * dt;
    p.y += (ty - p.y) / d * speed * dt;
    p.x = clamp(p.x, -14.5, 14.5);
    p.y = clamp(p.y, 0.5, 99);
  }
  function tickDefense(dt) {
    for (const d of def) {
      if (d.blockT > 0) { d.blockT -= dt; continue; }
      // The rush holds for a beat after the snap — the QB gets
      // a second to read the field before the pocket collapses.
      // DBs still cover right away; a ball already in the air
      // pulls everybody to the landing spot regardless.
      if ((d.role === "dl" || d.role === "lb") && playT < CFG.RUSH_DELAY && !ballInAir) continue;
      if (ballInAir) { moveToward(d, ballInAir.x1, ballInAir.y1, dt, CFG.DEF_SPEED); continue; }
      if (carrier && carrier.role !== "qb") { moveToward(d, carrier.x, carrier.y, dt, CFG.DEF_SPEED); continue; }
      if (carrier && carrier.role === "qb") {
        // Chase the scrambling QB once he's past the line;
        // before that, rush from the snap.
        moveToward(d, carrier.x, carrier.y, dt, CFG.DEF_SPEED);
        continue;
      }
      // No carrier (shouldn't happen) — hold ground.
    }
    // Keep defenders from stacking on one spot. Half-strength
    // positional correction: each pair separates by (min-d)/2
    // per frame, so a crowd closing on the carrier spreads
    // smoothly instead of flinging defenders around (a full-
    // strength pass with seven defenders on one point used
    // to explode them across the field).
    for (let i = 0; i < def.length; i++) for (let j = i + 1; j < def.length; j++) {
      const a = def[i], b = def[j];
      const d = dist(a.x, a.y, b.x, b.y), min = 1.8;
      if (d < min) {
        if (d > 0.001) {
          const push = (min - d) / 4 / d;
          a.x -= (b.x - a.x) * push; a.y -= (b.y - a.y) * push;
          b.x += (b.x - a.x) * push; b.y += (b.y - a.y) * push;
        } else {
          // Exactly coincident: nudge apart deterministically.
          a.x -= 0.05; b.x += 0.05;
        }
      }
    }
  }
  function tickBall(dt) {
    if (!ballInAir) return;
    const b = ballInAir;
    b.t += dt;
    if (b.t >= b.T) resolveCatch();
  }
  function tickCarrier(dt) {
    if (!carrier || carrier.role === "qb") return;
    // The carrier runs for the goal, dodging the nearest defender.
    const nd = nearestDef(carrier.x, carrier.y);
    let vx = 0, vy = -1;
    if (nd.d && nd.dist < 5) {
      const d = nd.dist || 1;
      vx += (carrier.x - nd.d.x) / d * 0.8;
      vy += (carrier.y - nd.d.y) / d * 0.8;
    }
    const m = Math.hypot(vx, vy) || 1;
    carrier.vx = vx / m * CFG.CARRY_SPEED;
    carrier.vy = vy / m * CFG.CARRY_SPEED;
    carrier.x = clamp(carrier.x + carrier.vx * dt, -14.5, 14.5);
    carrier.y = clamp(carrier.y + carrier.vy * dt, 0.5, 99);
    ballY = carrier.y;
    updateCam();
    if (carrier.y <= 0.5) { touchdown(carrier); return; }
    if (carrier.x <= -14.4 || carrier.x >= 14.4) {
      // Ran out of bounds — down at that spot.
      tackleAtSpot();
    }
  }
  function tackleAtSpot() {
    const spot = clamp(carrier.y, 0.5, 99);
    const gain = lineY - spot;
    ballY = spot;
    updateCam();
    tackle(spot, gain);
  }
  function checkTackle() {
    if (!carrier || state !== "play") return;
    const nd = nearestDef(carrier.x, carrier.y);
    if (nd.d && nd.dist < CFG.TACKLE_R) {
      if (carrier.y <= 0.5) { touchdown(carrier); return; }
      tackleAtSpot();
    }
  }
  function tickParts(dt) {
    for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; }
    parts = parts.filter((p) => p.t < p.life);
    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < r.life);
    for (const c of confetti) { c.t += dt; c.y += c.vy * dt; c.x += Math.sin(c.t * 5 + c.seed) * 30 * dt; c.rot += dt * 4; }
    confetti = confetti.filter((c) => c.t < c.life);
    for (const f of fireworks) {
      f.t += dt;
      for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
    }
    fireworks = fireworks.filter((f) => f.t < 1.2);
  }
  function update(dt) {
    if (flash && flash.t < 900) flash.t -= dt;
    if (goFlash > 0) goFlash -= dt;
    tickParts(dt);
    if (state === "play") {
      playT += dt;
      tickQB(dt);
      if (state !== "play") return; // handoff switched carrier; still play
      tickOffense(dt);
      tickDefense(dt);
      tickBall(dt);
      if (state !== "play") return; // catch / dead ball resolved
      tickCarrier(dt);
      if (state !== "play") return; // touchdown / out of bounds
      checkTackle();
      if (state === "play" && playT > CFG.PLAY_CAP) whistle("PLAY OVER", false);
    } else if (state === "whistle") {
      whistleT += dt;
      if (whistleT >= CFG.WHISTLE_T) {
        lineup();
        state = "lineup";
        flash = null;
      }
    } else if (state === "win") {
      winT += dt;
      if (Math.random() < dt * 2.2) {
        const fx = rnd(W * 0.15, W * 0.85), fy = rnd(PH * 0.1, PH * 0.5);
        const cols = ["#ffe14d", "#29faff", "#ff5e8a", "#7dff5e"];
        const fp = [];
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2, s = rnd(60, 220);
          fp.push({ x: fx, y: fy, vx: Math.cos(a) * s, vy: Math.sin(a) * s });
        }
        fireworks.push({ t: 0, parts: fp, color: cols[Math.floor(Math.random() * cols.length)] });
      }
      if (Math.random() < dt * 14) {
        confetti.push({ x: rnd(0, W), y: -10, vy: rnd(60, 140), t: 0,
          life: rnd(2, 3.5), rot: rnd(0, 6), seed: rnd(0, 6),
          color: ["#ffe14d", "#29faff", "#ff5e8a", "#7dff5e"][Math.floor(Math.random() * 4)] });
      }
    }
  }

  /* ---------------- render ---------------- */
  function yardLabel() {
    const y = Math.round(ballY);
    if (y <= 1) return "GOAL LINE";
    return y >= 50 ? "OWN " + (100 - y) : "OPP " + y;
  }
  function drawField() {
    ctx.fillStyle = "#1d7a2e";
    ctx.fillRect(0, 0, W, PH);
    // End zone (visible when the camera is near the goal).
    if (camY < 0) {
      ctx.fillStyle = "#14571f";
      ctx.fillRect(0, 0, W, sy(0));
    }
    // Yard lines every 5 yards, numbers on the left.
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "11px 'Press Start 2P', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let y = 0; y <= 100; y += 5) {
      const py = sy(y);
      if (py < -20 || py > PH + 20) continue;
      ctx.lineWidth = (y % 10 === 0) ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(0, py); ctx.lineTo(W, py);
      ctx.stroke();
      if (y > 0 && y < 100) ctx.fillText(String(y), 8, py - 10);
      // Hash marks.
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(-5), py - 4); ctx.lineTo(sx(-5), py + 4);
      ctx.moveTo(sx(5), py - 4); ctx.lineTo(sx(5), py + 4);
      ctx.stroke();
    }
    // Goal line, thick and white.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0));
    ctx.stroke();
    // Sidelines.
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx(-15), 0); ctx.lineTo(sx(-15), PH);
    ctx.moveTo(sx(15), 0); ctx.lineTo(sx(15), PH);
    ctx.stroke();
  }
  function drawPlayer(p) {
    const x = sx(p.x), y = sy(p.y), r = p.r * ydPx();
    if (y < -30 || y > PH + 30) return;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (p.hasBall) {
      ctx.fillStyle = "#8a5a2b";
      ctx.beginPath();
      ctx.arc(x + r * 0.5, y - r * 0.5, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + r * 0.2, y - r * 0.5); ctx.lineTo(x + r * 0.8, y - r * 0.5);
      ctx.stroke();
    }
    if (carrier === p) {
      ctx.strokeStyle = "#ffe14d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  function drawBall() {
    if (!ballInAir) return;
    const b = ballInAir;
    const k = b.t / b.T;
    const x = b.x0 + (b.x1 - b.x0) * k;
    const y = b.y0 + (b.y1 - b.y0) * k;
    const h = Math.sin(k * Math.PI) * 3; // yards of arc
    const px = sx(x), py = sy(y - h);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(sx(x), sy(y), 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a2b";
    ctx.beginPath();
    ctx.ellipse(px, py, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py);
    ctx.stroke();
  }
  function drawHUD() {
    // Yard label, top-centre — clear of the 84px back button.
    ctx.font = "13px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const label = yardLabel();
    const tw = ctx.measureText ? ctx.measureText(label).width : 90;
    ctx.fillRect(W / 2 - tw / 2 - 10, 8, tw + 20, 26);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, W / 2, 22);
    // Progress strip, right edge: the whole 100-yard drive.
    const sx0 = W - 12, top = 100, bot = PH - 12;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(sx0 - 3, top, 6, bot - top);
    ctx.fillStyle = "#29faff";
    ctx.fillRect(sx0 - 3, top, 6, (bot - top) * (1 - ballY / 100));
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath();
    ctx.arc(sx0, top + (bot - top) * (ballY / 100), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawDeck() {
    ctx.fillStyle = "#101018";
    ctx.fillRect(0, PH, W, DECK_H);
    ctx.strokeStyle = "rgba(41,250,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, PH); ctx.lineTo(W, PH);
    ctx.stroke();
    // Floating stick (only while steering).
    if (stick.id !== null) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(stick.ox, stick.oy, CFG.STICK_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#29faff";
      ctx.beginPath();
      ctx.arc(stick.ox + stick.x * CFG.STICK_R, stick.oy + stick.y * CFG.STICK_R, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mirrored PASS buttons, both ends.
    for (const b of [passL, passR]) {
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#101018";
      ctx.font = "13px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PASS", b.x, b.y + 1);
    }
    // Hints.
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "11px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    if (state === "lineup") {
      const pulse = 0.6 + 0.4 * Math.sin(time * 5);
      ctx.globalAlpha = pulse;
      ctx.fillText("TAP TO SNAP", W / 2, PH + DECK_H / 2);
      ctx.globalAlpha = 1;
    } else if (state === "title") {
      ctx.fillText("TAP TO PLAY", W / 2, PH + DECK_H / 2);
    } else if (state === "win") {
      ctx.fillText("TAP TO PLAY AGAIN", W / 2, PH + DECK_H / 2);
    }
  }
  function drawFlash() {
    if (state === "title") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, PH);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe14d";
      ctx.font = "34px 'Press Start 2P', monospace";
      ctx.fillText("TOUCHDOWN!", W / 2, PH * 0.32);
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.fillText("DRAG TO RUN", W / 2, PH * 0.44);
      ctx.fillText("TAP PASS TO THROW", W / 2, PH * 0.44 + 26);
      ctx.fillText("DRIVE 100 YARDS!", W / 2, PH * 0.44 + 52);
      return;
    }
    if (goFlash > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#7dff5e";
      ctx.font = "30px 'Press Start 2P', monospace";
      ctx.fillText("GO!", W / 2, PH * 0.4);
    }
    if (flash && flash.t > 0 && flash.t < 900) {
      ctx.textAlign = "center";
      ctx.fillStyle = flash.text === "TOUCHDOWN!" ? "#ffe14d" : "#ffffff";
      ctx.font = "26px 'Press Start 2P', monospace";
      const scale = flash.text === "TOUCHDOWN!" ? 1.2 : 1;
      ctx.save();
      ctx.translate(W / 2, PH * 0.4);
      ctx.scale(scale, scale);
      ctx.fillText(flash.text, 0, 0);
      ctx.restore();
    }
    if (state === "win") {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, W, PH);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe14d";
      ctx.font = "34px 'Press Start 2P', monospace";
      ctx.fillText("TOUCHDOWN!", W / 2, PH * 0.32);
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.fillText("YOU DROVE " + (CFG.START_YD - 0) + " YARDS!", W / 2, PH * 0.44);
    }
  }
  function drawParts() {
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    }
    ctx.globalAlpha = 1;
    for (const r of rings) {
      ctx.globalAlpha = Math.max(0, 1 - r.t / r.life);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxR * (r.t / r.life), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = Math.max(0, 1 - c.t / c.life);
      ctx.fillStyle = c.color;
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const f of fireworks) {
      for (const p of f.parts) {
        ctx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
        ctx.fillStyle = f.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawField();
    for (const p of off) drawPlayer(p);
    for (const p of def) drawPlayer(p);
    drawBall();
    drawHUD();
    drawParts();
    drawFlash();
    drawDeck();
  }

  /* ---------------- main loop ---------------- */
  let time = 0, last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- test hook ---------------- */
  window.__tdTest = {
    get state() { return state; },
    get ballY() { return ballY; },
    get lineY() { return lineY; },
    get carrier() { return carrier; },
    get off() { return off; },
    get def() { return def; },
    get ballInAir() { return ballInAir; },
    get flash() { return flash; },
    get plays() { return plays; },
    cfg: CFG,
    get music() { return MUSIC_CFG; },
    get passButtons() { return { L: passL, R: passR }; },
    get deckTop() { return PH; },
    debug: {
      render() {
        const saved = state;
        for (const s of ["title", "lineup", "play", "whistle", "win"]) {
          state = s;
          if (s === "play") { ballInAir = { x0: 0, y0: 84, x1: 4, y1: 70, t: 0.3, T: 0.6, target: off[1] }; }
          render();
          ballInAir = null;
        }
        state = saved;
      },
      step(dt) { update(dt || 1 / 60); },
      stepN(n) { for (let i = 0; i < n; i++) update(1 / 60); },
      fresh() { startDrive(); },
      snap() { if (state === "lineup") snap(); },
      setStick(x, y) { testStick = { x: x, y: y }; },
      clearStick() { testStick = null; },
      pressPass() { throwPass(); },
      placeBall(y) { ballY = y; lineup(); state = "lineup"; },
      placeQB(x, y) { off[0].x = x; off[0].y = y; },
      deckTap(x, y) { onDown(x, y, 999); },
      deckRelease() { onUp(999); },
      passTap(side) { const b = side === "L" ? passL : passR; onDown(b.x, b.y, 998); },
      stickState() { return { id: stick.id, x: stick.x, y: stick.y }; },
      yardLabel() { return yardLabel(); },
    },
  };

  resize();
  lineup();
  requestAnimationFrame(frame);
})();
