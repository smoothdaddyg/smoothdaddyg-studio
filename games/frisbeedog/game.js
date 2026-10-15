/* ============================================================
   FRISBEE DOG — SmoothDaddyG
   A joyful, super-simple game of catch.
   A big goofy dog sprints back and forth across a sunny park.
   ONE interaction: tap anywhere — the frisbee arcs from the
   bottom of the screen to where you tapped (~0.6s flight).
   The dog NEVER stops running, so you must LEAD him: tap where
   he WILL be when the frisbee lands, not where he is. Tap right
   on him and he's gone by landing time — just like leading a
   receiver in football.
   Land it close (generous catch radius) and he barks, flips,
   and the catch counter goes up. Miss? Soft thud, cute
   head-tilt, throw again right away — nothing lost, ever.
   First to 10 catches wins: treat-shower finale + PLAY AGAIN.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- tuning (all gameplay numbers live here) ---------------- */
  const CFG = {
    WIN_CATCHES: 10,    // first to this many catches wins
    DOG_R: 42,          // dog body radius (px) — BIG, Fisher-Price chunky
    CATCH_R: 68,        // generous catch radius (~1.6x body radius) — be kind
    DOG_SPEED: 130,     // starting run speed px/s — moderate, predictable
    DOG_SPEED_UP: 12,   // +px/s every SPEED_EVERY catches (gentle ramp)
    SPEED_EVERY: 2,
    DOG_SPEED_MAX: 230, // cap — stays super simple
    FLIGHT_T: 0.6,      // frisbee flight seconds, tap to landing
    DOG_Y_FRAC: 0.70,   // dog runs along this fraction of screen height
    TURN_MARGIN: 80,    // turn this far from the side edges
    ARC_LIFT: 170,      // extra arc height px on top of distance-based lift
  };

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  // state: 'title' | 'play' | 'win'
  let state = "title";
  let catches = 0;

  // the dog: {x,y,dir,speed,phase,flipT,tiltT}
  // dir: 1 = running right, -1 = running left
  let dog = null;

  // frisbee modes: 'ready' | 'flying'
  // flight is a quadratic bezier: start -> control -> target
  let frisbee = null;

  let parts = [];   // particles {x,y,vx,vy,t,life,hue,r}
  let rings = [];   // expanding rings {x,y,r,t,life,hue}
  let treats = [];  // win-state falling treats {x,y,vy,rot,vr}
  let clouds = [];  // {x,y,s,v}
  let flowers = []; // {x,y,hue}

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
  function sndBark() {
    // happy double-yip
    audio.tone(740, 0.09, { type: "square", vol: 0.12, slideTo: 380 });
    audio.tone(880, 0.09, { type: "square", vol: 0.12, slideTo: 420, when: 0.11 });
  }
  function sndThud() {
    audio.tone(150, 0.16, { type: "sine", vol: 0.09, slideTo: 85 }); // soft landing
  }
  function sndWin() {
    audio.arp([523, 659, 784, 1047, 880, 1047, 1319, 1568], 0.1, "square", 0.12);
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
    if (dog) dog.y = H * CFG.DOG_Y_FRAC;
    playBtn.w = Math.min(300, W * 0.62); playBtn.h = 84;
    playBtn.x = W / 2 - playBtn.w / 2;  playBtn.y = H * 0.66;
    // scatter clouds + flowers
    clouds = [];
    for (let i = 0; i < 4; i++) {
      clouds.push({ x: rnd(0, W), y: rnd(40, H * 0.3), s: rnd(0.7, 1.3), v: rnd(8, 20) });
    }
    flowers = [];
    for (let i = 0; i < 26; i++) {
      flowers.push({ x: rnd(10, W - 10), y: rnd(H * 0.62, H - 14),
                     hue: [0, 45, 300, 200, 150][(Math.random() * 5) | 0] });
    }
  }
  window.addEventListener("resize", resize);

  function resetDog() {
    dog = { x: W / 2, y: H * CFG.DOG_Y_FRAC, dir: Math.random() < 0.5 ? 1 : -1,
            speed: dogSpeed(), phase: 0, flipT: 0, tiltT: 0 };
  }

  function resetFrisbee() {
    frisbee = { mode: "ready", x: 0, y: 0,
                sx: 0, sy: 0, cx: 0, cy: 0, tx: 0, ty: 0,
                t: 0, dur: CFG.FLIGHT_T, spin: 0, trail: [] };
  }

  function startGame() {
    catches = 0;
    parts = []; rings = []; treats = [];
    resetDog();
    resetFrisbee();
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
    f.ty = clamp(y, 70, H - 70);
    const mx = (f.sx + f.tx) / 2, my = (f.sy + f.ty) / 2;
    const d = dist(f.sx, f.sy, f.tx, f.ty);
    f.cx = mx; f.cy = my - (CFG.ARC_LIFT + d * 0.18); // high happy arc
    f.t = 0; f.dur = CFG.FLIGHT_T; f.spin = 0; f.trail = [];
    f.x = f.sx; f.y = f.sy;
    sndThrow();
  }

  function bez(k) {
    const f = frisbee, u = 1 - k;
    return {
      x: u * u * f.sx + 2 * u * k * f.cx + k * k * f.tx,
      y: u * u * f.sy + 2 * u * k * f.cy + k * k * f.ty,
    };
  }

  function doCatch() {
    catches++;
    dog.speed = dogSpeed();
    dog.flipT = 0.55;                       // joyful flip
    sndBark();
    confettiBlast(dog.x, dog.y - 50, 26);
    rings.push({ x: dog.x, y: dog.y - 30, r: 20, t: 0, life: 0.5, hue: 45 });
    if (catches >= CFG.WIN_CATCHES) winGame();
  }

  function doMiss(x, y) {
    // forgiving: soft thud, cute head-tilt, throw again right away.
    // Nothing lost — no penalty, no streak reset, no sad sounds.
    sndThud();
    dog.tiltT = 0.9;
    for (let i = 0; i < 8; i++) {
      addPart({ x: x + rnd(-8, 8), y: y + rnd(-4, 4),
                vx: rnd(-60, 60), vy: rnd(-70, -10),
                t: 0, life: rnd(0.3, 0.6), hue: 90, r: rnd(2, 4) });
    }
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
    if (frisbee.mode !== "ready") return; // one frisbee at a time; flight is short
    throwFrisbee(x, y);
  }
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    onTap(e.clientX, e.clientY);
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function tick(dt) {
    time += dt;

    // clouds always drift
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > W + 90) { c.x = -90; c.y = rnd(40, H * 0.3); }
    }

    // the dog NEVER stops running — turn at the edges, face travel direction
    if (dog) {
      dog.x += dog.dir * dog.speed * dt;
      dog.phase += dt * (6 + dog.speed * 0.045);
      if (dog.x < CFG.TURN_MARGIN) { dog.x = CFG.TURN_MARGIN; dog.dir = 1; }
      if (dog.x > W - CFG.TURN_MARGIN) { dog.x = W - CFG.TURN_MARGIN; dog.dir = -1; }
      if (dog.flipT > 0) dog.flipT -= dt;
      if (dog.tiltT > 0) dog.tiltT -= dt;
      // victory flips keep coming in the win state
      if (state === "win" && dog.flipT <= 0 && Math.random() < dt * 1.6) dog.flipT = 0.55;
    }

    // frisbee flight
    const f = frisbee;
    if (f && f.mode === "flying" && state === "play") {
      f.t += dt;
      f.spin += dt * 14;
      const k = Math.min(1, f.t / f.dur);
      const p = bez(k);
      f.x = p.x; f.y = p.y;
      f.trail.push({ x: f.x, y: f.y, t: 0 });
      if (f.trail.length > 12) f.trail.shift();
      for (const tr of f.trail) tr.t += dt;
      if (k >= 1) {
        // landing: is the dog close enough?
        if (dist(dog.x, dog.y, f.tx, f.ty) < CFG.CATCH_R) doCatch();
        else doMiss(f.tx, f.ty);
        f.mode = "ready"; // throw again immediately
      }
    }

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

  /* ---------------- drawing: sunny park ---------------- */
  function drawPark() {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#5fbdf2"); g.addColorStop(0.62, "#b5e6fb"); g.addColorStop(1, "#d8f3ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // sun
    const sx = W - 70, sy = 84;
    ctx.save();
    ctx.shadowColor = "#ffe45e"; ctx.shadowBlur = 44;
    ctx.fillStyle = "#ffdf3f";
    ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 6.2832); ctx.fill();
    ctx.restore();
    // clouds
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (const c of clouds) {
      const s = c.s;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 26 * s, 0, 6.2832);
      ctx.arc(c.x + 26 * s, c.y - 8 * s, 20 * s, 0, 6.2832);
      ctx.arc(c.x + 52 * s, c.y, 24 * s, 0, 6.2832);
      ctx.arc(c.x + 26 * s, c.y + 10 * s, 24 * s, 0, 6.2832);
      ctx.fill();
    }
    // grass
    const gy = H * 0.60;
    const gg = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, "#63c771"); gg.addColorStop(1, "#3d9950");
    ctx.fillStyle = gg;
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = "#55b765";
    ctx.beginPath();
    ctx.ellipse(W / 2, gy + 6, W * 0.75, 26, 0, 0, 6.2832);
    ctx.fill();
    // trees at the edges
    drawTree(W * 0.10, gy + 30, 1.0);
    drawTree(W * 0.90, gy + 44, 1.25);
    // flowers
    for (const fl of flowers) {
      ctx.fillStyle = "hsla(" + fl.hue + ",85%,62%,1)";
      ctx.beginPath(); ctx.arc(fl.x, fl.y, 5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#fff8d6";
      ctx.beginPath(); ctx.arc(fl.x, fl.y, 2, 0, 6.2832); ctx.fill();
    }
  }

  function drawTree(x, y, s) {
    ctx.fillStyle = "#7a4a21";
    ctx.fillRect(x - 9 * s, y - 64 * s, 18 * s, 64 * s);
    ctx.fillStyle = "#2f8f46";
    ctx.beginPath();
    ctx.arc(x, y - 84 * s, 34 * s, 0, 6.2832);
    ctx.arc(x - 26 * s, y - 64 * s, 24 * s, 0, 6.2832);
    ctx.arc(x + 26 * s, y - 64 * s, 24 * s, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "#3aa655";
    ctx.beginPath();
    ctx.arc(x - 10 * s, y - 92 * s, 14 * s, 0, 6.2832);
    ctx.fill();
  }

  /* ---------------- drawing: the dog (big, chunky, goofy) ---------------- */
  function drawDog() {
    const d = dog;
    const OUT = "#6b4423", FUR = "#e2a355", FUR_D = "#c07f35", CREAM = "#f6d79a";
    ctx.save();
    ctx.translate(d.x, d.y);
    // joyful flip: full rotation + hop
    if (d.flipT > 0) {
      const k = 1 - d.flipT / 0.55;
      ctx.rotate(k * Math.PI * 2 * d.dir);
      ctx.translate(0, -Math.sin(k * Math.PI) * 64);
    }
    // shadow (skip while flipping — he's airborne)
    if (d.flipT <= 0) {
      ctx.fillStyle = "rgba(20,60,25,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, 44, 52, 12, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.scale(d.dir, 1); // face travel direction
    const bob = Math.abs(Math.sin(d.phase)) * 5;
    ctx.translate(0, -bob);
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUT;

    // tail — wagging
    const wag = Math.sin(d.phase * 1.6) * 0.55;
    ctx.save();
    ctx.translate(-44, -14);
    ctx.rotate(-0.7 + wag);
    ctx.fillStyle = FUR_D;
    ctx.beginPath();
    ctx.ellipse(16, 0, 18, 8, 0, 0, 6.2832);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // legs — alternating trot
    ctx.fillStyle = FUR;
    const legSwing = Math.sin(d.phase) * 12;
    const legSwing2 = Math.sin(d.phase + Math.PI) * 12;
    const legs = [[-30, legSwing], [-10, legSwing2], [12, legSwing2], [30, legSwing]];
    for (const [lx, sw] of legs) {
      ctx.beginPath();
      ctx.ellipse(lx + sw, 34, 9, 16, 0, 0, 6.2832);
      ctx.fill(); ctx.stroke();
    }

    // body
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, 0, CFG.DOG_R, 30, 0, 0, 6.2832);
    ctx.fill(); ctx.stroke();
    // belly patch
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(2, 12, 26, 12, 0, 0, 6.2832);
    ctx.fill();

    // head (tilts cute on a miss)
    ctx.save();
    ctx.translate(34, -14);
    if (d.tiltT > 0) ctx.rotate(0.38 * Math.min(1, d.tiltT / 0.9));
    // ear — floppy, flops with the run
    const flop = Math.sin(d.phase + 1.2) * 0.35;
    ctx.save();
    ctx.translate(-6, -18);
    ctx.rotate(-0.5 + flop);
    ctx.fillStyle = FUR_D;
    ctx.beginPath();
    ctx.ellipse(0, -12, 11, 20, 0, 0, 6.2832);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // head ball
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.arc(6, 0, 25, 0, 6.2832); ctx.fill(); ctx.stroke();
    // snout
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.ellipse(24, 6, 15, 11, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    // nose
    ctx.fillStyle = "#3a2410";
    ctx.beginPath(); ctx.arc(35, 2, 6.5, 0, 6.2832); ctx.fill();
    // eye — looks where he's going
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(12, -10, 8, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#241505";
    ctx.beginPath(); ctx.arc(15, -10, 3.8, 0, 6.2832); ctx.fill();
    // happy mouth
    ctx.strokeStyle = OUT; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(20, 12, 9, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore(); // head

    ctx.restore(); // dog
  }

  /* ---------------- drawing: frisbee ---------------- */
  function drawFrisbeeDisc(x, y, r, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(spin) * 0.25);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#8f1f1f";
    ctx.fillStyle = "#e23b3b";
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.62, 0, 0, 6.2832);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.45, r * 0.28, 0, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.18, r * 0.28, r * 0.12, -0.4, 0, 6.2832);
    ctx.stroke();
    ctx.restore();
  }

  function drawFrisbee() {
    const f = frisbee;
    if (!f || f.mode !== "flying") return;
    // trail
    for (const tr of f.trail) {
      const k = Math.max(0, 1 - tr.t / 0.45);
      ctx.fillStyle = "rgba(255,210,63," + (k * 0.5).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(tr.x, tr.y, 10 * k + 2, 0, 6.2832); ctx.fill();
    }
    drawFrisbeeDisc(f.x, f.y, 22, f.spin);
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
  function drawCounter() {
    // big catch count, top-center — clear of the 84px back button (top-left)
    ctx.fillStyle = "rgba(4,30,16,0.55)";
    const bw = 150, bh = 64;
    const bx = W / 2 - bw / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, 12, bw, bh, 16); else ctx.rect(bx, 12, bw, bh);
    ctx.fill();
    drawFrisbeeDisc(bx + 30, 44, 13, time * 2);
    drawPixelNumber(ctx, catches, bx + bw / 2 + 12, 44, 6, "#ffd23f", true);
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
    // bouncing frisbee logo
    const bx = W / 2, by = H * 0.26 + Math.abs(Math.sin(time * 2.4)) * -30;
    ctx.save();
    ctx.shadowColor = "#e23b3b"; ctx.shadowBlur = 30;
    drawFrisbeeDisc(bx, by, 44, time * 3);
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
    drawPark();
    if (dog) drawDog();
    drawFrisbee();
    for (const t of treats) drawTreat(t);
    drawParts();
    if (state !== "title") drawCounter();
    if (state === "title") drawTitle();
    else if (state === "win") drawWin();
  }

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
  resetFrisbee();
  requestAnimationFrame(frame);

  /* Test hook. `debug` exposes live objects so tests can position the dog
     and inspect the frisbee — test-only, never used by the game itself. */
  window.__dogTest = {
    get state() { return state; },
    get catches() { return catches; },
    get cfg() { return CFG; },
    debug: {
      dog: function () { return dog; },
      frisbee: function () { return frisbee; },
    },
    tap: function (x, y) { onTap(x, y); },
    start: function () { startGame(); },
    step: function (dt) { tick(dt || 0.016); },
  };
})();
