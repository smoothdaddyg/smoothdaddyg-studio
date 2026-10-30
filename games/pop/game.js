/* ============================================================
   POP — SmoothDaddyG
   Colorful orbs float upward. Tap one: it bursts into particles
   with a chiptune pop and the score ticks up.
   Endless. Relaxing. Impossible to fail.
   One interaction: tap. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();
  /* Background music (2026-10-30 rollout): an original chiptune loop —
     distinct chiptune voice, kept under the SFX. Starts at load; the
     synth stays silent until the first tap, then plays mid-loop. */
  const MUSIC = audio.makeMusic({
    bpm: 144, div: 4, steps: 64,
    bassType: "triangle", bassVol: 0.2,
    leadType: "square", leadVol: 0.05,
    harmonyType: "square", harmonyVol: 0.025,
    kickVol: 0.16, snareVol: 0.05, hatVol: 0.02,
    kicks: [0, 6, 8, 14, 16, 22, 24, 30, 32, 38, 40, 46, 48, 54, 56, 62],
    snares: [4, 12, 20, 28, 36, 44, 52, 60],
    hats: "odd",
    bass: [65.41, 0, 0, 130.81, 0, 0, 65.41, 0, 0, 130.81, 0, 0, 65.41, 0, 98, 0,
           98, 0, 0, 196, 0, 0, 98, 0, 0, 196, 0, 0, 98, 0, 146.83, 0,
           87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 130.81, 0,
           98, 0, 0, 196, 0, 0, 98, 0, 0, 196, 0, 0, 98, 0, 146.83, 0],
    lead: [523.25, 0, 523.25, 0, 659.25, 0, 0, 523.25, 0, 659.25, 0, 783.99, 0, 0, 659.25, 0,
           783.99, 0, 783.99, 0, 659.25, 0, 0, 587.33, 0, 659.25, 0, 783.99, 0, 0, 587.33, 0,
           698.46, 0, 698.46, 0, 880, 0, 0, 698.46, 0, 880, 0, 1046.5, 0, 0, 880, 0,
           392, 587.33, 783.99, 587.33, 392, 587.33, 783.99, 880, 783.99, 587.33, 392, 0, 0, 0, 0, 0],
    harmony: [329.63, 0, 0, 0, 0, 0, 0, 0, 392, 0, 0, 0, 0, 0, 0, 0,
           493.88, 0, 0, 0, 0, 0, 0, 0, 587.33, 0, 0, 0, 0, 0, 0, 0,
           440, 0, 0, 0, 0, 0, 0, 0, 523.25, 0, 0, 0, 0, 0, 0, 0,
           493.88, 0, 0, 0, 0, 0, 0, 0, 587.33, 0, 0, 0, 0, 0, 0, 0]
  });
  MUSIC.start();

  let W = 0, H = 0, DPR = 1;

  const HUES = [315, 190, 45, 150, 265, 15]; // neon palette
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

  let orbs = [];
  let particles = [];
  let rings = [];
  let popups = [];
  let stars = [];
  let score = 0;
  let popped = 0;
  let spawnT = 0;
  let time = 0;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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

  function spawnOrb() {
    const r = 36 + Math.random() * 30; // big touch targets
    orbs.push({
      x: r + Math.random() * Math.max(1, W - 2 * r),
      y: H + r + 12,
      r: r,
      hue: HUES[(Math.random() * HUES.length) | 0],
      vy: 42 + Math.random() * 58,
      swayAmp: 18 + Math.random() * 30,
      swaySpd: 0.7 + Math.random() * 1.3,
      swayPh: Math.random() * 6.283,
      baseX: 0,
      born: time,
      invite: popped < 3, // first orbs pulse to invite a tap
    });
    const o = orbs[orbs.length - 1];
    o.baseX = o.x;
  }

  function burst(o) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.283;
      const sp = 130 + Math.random() * 280;
      particles.push({
        x: o.x, y: o.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: 0.6 + Math.random() * 0.5,
        hue: o.hue, r: 3 + Math.random() * 4,
      });
    }
    rings.push({ x: o.x, y: o.y, r: o.r * 0.4, t: 0, life: 0.35, hue: o.hue });
    popups.push({ x: o.x, y: o.y - o.r * 0.6, t: 0, life: 0.7, n: score + 1 });
    score++;
    popped++;
    const note = PENTA[popped % PENTA.length];
    audio.tone(note * 2, 0.12, { type: "square", vol: 0.09, slideTo: note * 2.7 });
    audio.tone(note, 0.1, { type: "triangle", vol: 0.07, when: 0.04 });
  }

  function onTap(e) {
    const x = e.clientX, y = e.clientY;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      const dx = x - o.x, dy = y - o.y;
      const rr = o.r * 1.2; // generous hit area
      if (dx * dx + dy * dy <= rr * rr) {
        orbs.splice(i, 1);
        burst(o);
        return;
      }
    }
    // Tapping empty space still does something: a soft ripple.
    rings.push({ x: x, y: y, r: 10, t: 0, life: 0.3, hue: 220 });
    audio.tone(220, 0.07, { type: "sine", vol: 0.035 });
  }

  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());


  function drawOrb(o) {
    let scale = 1;
    if (o.invite) {
      scale = 1 + Math.sin(time * 5) * 0.09; // pulsing invitation
    }
    const r = o.r * scale;
    const g = ctx.createRadialGradient(
      o.x - r * 0.3, o.y - r * 0.35, r * 0.1,
      o.x, o.y, r
    );
    g.addColorStop(0, `hsl(${o.hue}, 100%, 78%)`);
    g.addColorStop(0.55, `hsl(${o.hue}, 95%, 55%)`);
    g.addColorStop(1, `hsl(${o.hue}, 95%, 38%)`);
    ctx.save();
    ctx.shadowColor = `hsl(${o.hue}, 95%, 60%)`;
    ctx.shadowBlur = 26;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, 0, 6.2832);
    ctx.fill();
    ctx.restore();
    // glossy highlight
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(o.x - r * 0.32, o.y - r * 0.38, r * 0.16, 0, 6.2832);
    ctx.fill();
  }

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (MUSIC) MUSIC.tick(dt);
    time += dt;

    // spawn
    spawnT -= dt;
    if (spawnT <= 0 && orbs.length < 9) {
      spawnOrb();
      spawnT = 0.55 + Math.random() * 0.5;
    }

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

    // orbs
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.y -= o.vy * dt;
      o.swayPh += o.swaySpd * dt;
      o.x = o.baseX + Math.sin(o.swayPh) * o.swayAmp;
      if (o.y < -o.r - 20) {
        orbs.splice(i, 1); // drifted away — no penalty
        continue;
      }
      drawOrb(o);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = `hsla(${p.hue},95%,62%,${k.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * k + 0.5, 0, 6.2832);
      ctx.fill();
    }

    // rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) { rings.splice(i, 1); continue; }
      const k = r.t / r.life;
      ctx.strokeStyle = `hsla(${r.hue},95%,65%,${(1 - k).toFixed(2)})`;
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 70, 0, 6.2832);
      ctx.stroke();
    }

    // +N popups (numerals only) — show the pop number you're on
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.t += dt;
      if (p.t >= p.life) { popups.splice(i, 1); continue; }
      const k = p.t / p.life;
      drawPixelNumber(ctx, p.n, p.x, p.y - k * 46, 5, `rgba(255,255,255,${(1 - k).toFixed(2)})`, false);
    }

    // score — big pixel numerals, tucked below the chrome
    if (score > 0) {
      drawPixelNumber(ctx, score, W / 2, 84, 7, "#ffe14d", true);
    }

    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
