/* ============================================================
   ORBIT — SmoothDaddyG
   A glowing planet sits at the center of the sky. Tap anywhere
   to launch a glowing comet: it settles into orbit at the tap's
   distance — close taps make tight fast orbits, far taps make
   slow majestic ones. Orbit pitch follows distance: close comets
   sing high, far ones sing low. Tap a comet's glowing head to
   release it. Every completed orbit chimes its note and ticks
   the counter. Every 12 orbits earns the planet a ring; earn 5
   rings and the next set triggers a SUPERNOVA.
   Endless. Relaxing. Impossible to fail.
   One interaction: tap. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;
  let cx = 0, cy = 0, planetR = 64;
  let minR = 108, maxR = 320;

  const HUES = [315, 190, 45, 150, 265, 15]; // neon palette
  const RING_HUES = [45, 190, 315, 150, 265]; // planet ring colors
  // 26 quantized steps over five octaves of the minor pentatonic
  // scale (C2 .. C7): the farthest orbit rumbles at 65 Hz — 808
  // territory — while the closest sings at 2093 Hz.
  // Near orbit = high note, far orbit = sub bass.
  const PENTA_DEEP = (function () {
    const notes = [];
    const C2 = 65.41;
    const semis = [0, 3, 5, 7, 10]; // minor pentatonic on C
    for (let oct = 0; oct < 5; oct++) {
      for (let i = 0; i < semis.length; i++) {
        notes.push(C2 * Math.pow(2, (oct * 12 + semis[i]) / 12));
      }
    }
    notes.push(C2 * 32); // C7, the top of the range
    return notes;
  })();
  const MAX_COMETS = 10;
  const SET_SIZE = 12; // orbits per ring
  const MAX_RINGS = 5;
  const KEPLER = 3103; // omega = KEPLER / r^1.5 (close = fast)

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Radius-mapped pitch: targetR across [minR, maxR] -> PENTA_DEEP index.
  function noteForRadius(targetR) {
    const span = Math.max(1, maxR - minR);
    const k = clamp((maxR - targetR) / span, 0, 1); // near = 1 (high)
    return PENTA_DEEP[Math.round(k * (PENTA_DEEP.length - 1))];
  }

  let comets = [];
  let particles = [];
  let fxRings = [];
  let stars = [];
  let planetRings = []; // array of hues, earned rings
  let orbits = 0;
  let launchN = 0;
  let celebT = 0, flashT = 0;
  let lastPulseT = -99;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2;
    cy = H / 2;
    planetR = Math.min(W, H) * 0.085;
    minR = planetR + 44;
    maxR = Math.min(W, H) / 2 - 24;
    buildStars();
  }
  window.addEventListener("resize", resize);

  function buildStars() {
    stars = [];
    const n = Math.max(30, Math.floor((W * H) / 11000));
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * 6.283,
      });
    }
  }

  function burst(x, y, hue, n, spread) {
    n = n || 16;
    spread = spread || 280;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const sp = 90 + Math.random() * spread;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: 0.6 + Math.random() * 0.7,
        hue: hue, r: 2.5 + Math.random() * 3.5,
      });
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }

  function spawnComet(x, y) {
    if (comets.length >= MAX_COMETS) {
      // No dead taps: the oldest comet does a happy pulse instead.
      const old = comets[0];
      old.pulse = 1;
      lastPulseT = time;
      burst(old.x, old.y, old.hue, 12, 200);
      audio.tone(old.note, 0.15, { type: "triangle", vol: 0.07 });
      return;
    }
    let dx = x - cx, dy = y - cy;
    let r = Math.hypot(dx, dy);
    if (r < 1) { dx = 0; dy = -1; r = 1; }
    const targetR = Math.max(minR, Math.min(maxR, r));
    const c = {
      angle: Math.atan2(dy, dx), // launch side = starting angle
      r: r, // settles toward targetR
      targetR: targetR,
      omega: KEPLER / Math.pow(targetR, 1.5),
      hue: HUES[launchN % HUES.length],
      note: noteForRadius(targetR), // pitch follows orbit distance
      trail: [],
      acc: 0,
      pulse: 0,
      x: x, y: y,
    };
    launchN++;
    comets.push(c);
    // launch whoosh
    audio.tone(c.note, 0.2, { type: "sine", vol: 0.06, slideTo: c.note * 2 });
  }

  function orbitComplete(c) {
    orbits++;
    audio.tone(c.note * 2, 0.18, { type: "triangle", vol: 0.08 });
    if (c.note < 160) {
      // deep orbits get a bass-drum thump under the chime
      audio.tone(c.note * 2, 0.3, { type: "sine", vol: 0.16, slideTo: Math.max(30, c.note) });
    }
    burst(c.x, c.y, c.hue, 10, 220);
    if (orbits % SET_SIZE === 0) setComplete();
  }

  function setComplete() {
    if (planetRings.length < MAX_RINGS) {
      planetRings.push(RING_HUES[planetRings.length % RING_HUES.length]);
      // celebration: confetti from the planet + rising arpeggio + rings
      celebT = 1.4;
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * 6.283;
        const rr = Math.random() * planetR;
        burst(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr,
          HUES[(Math.random() * HUES.length) | 0], 1, 420);
      }
      for (let i = 0; i < 3; i++) {
        fxRings.push({ x: cx, y: cy, r: planetR * 0.6, t: -i * 0.12, life: 0.9, hue: 45 });
      }
      audio.arp([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.09, "square", 0.08);
    } else {
      supernova();
    }
  }

  function supernova() {
    // 6th set: full-screen flash + fireworks from every comet,
    // rings reset, comets keep orbiting, orbit counter never resets.
    flashT = 1.0;
    planetRings.length = 0;
    for (const c of comets) {
      burst(c.x, c.y, c.hue, 24, 520);
      fxRings.push({ x: c.x, y: c.y, r: 8, t: 0, life: 0.8, hue: c.hue });
    }
    audio.arp([523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0], 0.08, "square", 0.09);
  }

  // Tapping a comet's glowing head releases it; taps anywhere
  // else launch a new comet, exactly as before.
  function cometAt(x, y) {
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      const headR = 11 * (1 + c.pulse * 0.45);
      const hr = headR * 1.8 + 8; // generous touch target
      const dx = x - c.x, dy = y - c.y;
      if (dx * dx + dy * dy <= hr * hr) return i;
    }
    return -1;
  }

  function removeComet(i) {
    const c = comets[i];
    // implosion: particles rush inward, then it's gone
    for (let j = 0; j < 14; j++) {
      const a = Math.random() * 6.283;
      const sp = 40 + Math.random() * 120;
      particles.push({
        x: c.x + Math.cos(a) * 40, y: c.y + Math.sin(a) * 40,
        vx: -Math.cos(a) * sp, vy: -Math.sin(a) * sp,
        t: 0, life: 0.45 + Math.random() * 0.3,
        hue: c.hue, r: 2 + Math.random() * 3,
      });
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
    // soft descending tone: its own note sliding down an octave
    audio.tone(c.note, 0.35, { type: "sine", vol: 0.08, slideTo: c.note / 2 });
    comets.splice(i, 1);
  }

  function handleTap(x, y) {
    const i = cometAt(x, y);
    if (i >= 0) removeComet(i);
    else spawnComet(x, y);
  }

  function onTap(e) {
    handleTap(e.clientX, e.clientY);
  }
  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });


  function cometPos(c) {
    c.x = cx + Math.cos(c.angle) * c.r;
    c.y = cy + Math.sin(c.angle) * c.r;
  }

  function update(dt) {
    for (const c of comets) {
      c.angle -= c.omega * dt; // counterclockwise on screen
      c.acc += c.omega * dt;
      if (c.acc >= Math.PI * 2) {
        c.acc -= Math.PI * 2;
        cometPos(c);
        orbitComplete(c);
      }
      // settle into orbit radius
      c.r += (c.targetR - c.r) * Math.min(1, dt * 2.5);
      if (c.pulse > 0) c.pulse = Math.max(0, c.pulse - dt * 1.8);
      cometPos(c);
      c.trail.push({ x: c.x, y: c.y });
      if (c.trail.length > 60) c.trail.shift();
    }
    if (celebT > 0) celebT -= dt;
    if (flashT > 0) flashT -= dt;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97; p.vy *= 0.97;
    }
    for (let i = fxRings.length - 1; i >= 0; i--) {
      const r = fxRings[i];
      r.t += dt;
      if (r.t >= r.life) { fxRings.splice(i, 1); continue; }
    }
  }

  function drawPlanet() {
    // glowing gradient sphere
    const g = ctx.createRadialGradient(
      cx - planetR * 0.35, cy - planetR * 0.4, planetR * 0.1,
      cx, cy, planetR
    );
    g.addColorStop(0, "#8fd8ff");
    g.addColorStop(0.45, "#3f7fe0");
    g.addColorStop(1, "#1c2f7a");
    ctx.save();
    ctx.shadowColor = "hsl(215, 90%, 60%)";
    ctx.shadowBlur = 44;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, planetR, 0, 6.2832);
    ctx.fill();
    ctx.restore();
    // slow rotating surface shimmer
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, planetR, 0, 6.2832);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 10;
    for (let i = 0; i < 3; i++) {
      const a = time * 0.25 + (i * 2.094);
      ctx.beginPath();
      ctx.arc(cx, cy, planetR * 0.62, a, a + 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRings() {
    // earned rings: tilted neon ellipses around the planet
    for (let i = 0; i < planetRings.length; i++) {
      const hue = planetRings[i];
      const rr = planetR + 26 + i * 20;
      ctx.save();
      ctx.strokeStyle = `hsl(${hue}, 95%, 62%)`;
      ctx.shadowColor = `hsl(${hue}, 95%, 60%)`;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.36, 0, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawComet(c) {
    // fading trail
    const n = c.trail.length;
    if (n > 1) {
      ctx.lineCap = "round";
      for (let i = 1; i < n; i++) {
        const k = i / n;
        ctx.strokeStyle = `hsla(${c.hue},95%,62%,${(k * 0.55).toFixed(3)})`;
        ctx.lineWidth = 1 + k * 3.5;
        ctx.beginPath();
        ctx.moveTo(c.trail[i - 1].x, c.trail[i - 1].y);
        ctx.lineTo(c.trail[i].x, c.trail[i].y);
        ctx.stroke();
      }
    }
    // glowing head (pulses when it's the capped-out oldest comet)
    const headR = 11 * (1 + c.pulse * 0.45);
    ctx.save();
    ctx.shadowColor = `hsl(${c.hue}, 95%, 60%)`;
    ctx.shadowBlur = 24;
    const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, headR);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.4, `hsl(${c.hue}, 100%, 70%)`);
    g.addColorStop(1, `hsl(${c.hue}, 95%, 45%)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, headR, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b0b16");
    bg.addColorStop(1, "#0a0a13");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const a = 0.25 + Math.abs(Math.sin(time * 0.8 + s.tw)) * 0.5;
      ctx.fillStyle = `rgba(160,200,255,${a.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    drawRings();
    drawPlanet();

    for (const c of comets) drawComet(c);

    // particles
    for (const p of particles) {
      const k = 1 - p.t / p.life;
      ctx.fillStyle = `hsla(${p.hue},95%,62%,${k.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * k + 0.5, 0, 6.2832);
      ctx.fill();
    }

    // expanding rings
    for (const r of fxRings) {
      if (r.t < 0) continue;
      const k = r.t / r.life;
      ctx.strokeStyle = `hsla(${r.hue},95%,65%,${(1 - k).toFixed(2)})`;
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 90, 0, 6.2832);
      ctx.stroke();
    }

    // orbit counter — big pixel numerals at top center
    if (orbits > 0) {
      drawPixelNumber(ctx, orbits, W / 2, 34, 6, "#ffe14d", true);
    }

    // supernova flash
    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(flashT * 0.85).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    time += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);

  // Read-only test hook (plus a few debug setters for the test harness).
  window.__orbitTest = {
    tap: function (x, y) { handleTap(x, y); }, // real tap path (hit-test)
    spawn: function (x, y) { spawnComet(x, y); }, // force-launch, no hit-test
    remove: function (i) { removeComet(i); },
    radii: function () { return { cx: cx, cy: cy, minR: minR, maxR: maxR }; },
    tick: function (dt) { time += dt; update(dt); draw(); },
    comets: function () { return comets.length; },
    comet: function (i) {
      const c = comets[i];
      return { x: c.x, y: c.y, r: c.r, targetR: c.targetR, hue: c.hue, note: c.note, omega: c.omega };
    },
    orbits: function () { return orbits; },
    ringCount: function () { return planetRings.length; },
    celebration: function () { return celebT > 0; },
    supernova: function () { return flashT > 0; },
    pulsed: function () { return time - lastPulseT < 2; },
    setOrbits: function (v) { orbits = v; },
    setRings: function (v) { planetRings.length = 0; for (let i = 0; i < v; i++) planetRings.push(RING_HUES[i % RING_HUES.length]); },
    nudgeComet: function (i) { comets[i].acc = Math.PI * 2 - 0.001; },
  };
})();
