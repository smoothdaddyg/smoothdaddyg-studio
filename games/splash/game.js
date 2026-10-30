/* ============================================================
   SPLASH — SmoothDaddyG
   Tap anywhere: a big neon blob splats with a pop.
   Blobs linger, then fade. Endlessly repeatable.
   Pure cause and effect — impossible to get wrong.
   One interaction: tap. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();
  /* Background music (2026-10-30 rollout): an original chiptune loop —
     funk bass + square hook, kept under the SFX. Starts at load; the
     synth stays silent until the first tap, then plays mid-loop. */
  const MUSIC = audio.makeMusic({
    bpm: 138, div: 4, steps: 64, bassVol: 0.2, leadVol: 0.05, hats: "odd",
    kicks: [0, 8, 14, 16, 24, 30, 32, 40, 46, 48, 56, 62],
    snares: [4, 12, 20, 28, 36, 44, 52, 60],
    bass: [98, 0, 0, 98, 0, 0, 146.83, 0, 98, 0, 0, 98, 196, 0, 146.83, 0,
           65.41, 0, 0, 65.41, 0, 0, 98, 0, 65.41, 0, 0, 65.41, 130.81, 0, 98, 0,
           82.41, 0, 0, 82.41, 0, 0, 123.47, 0, 82.41, 0, 0, 82.41, 164.81, 0, 123.47, 0,
           73.42, 0, 0, 73.42, 0, 0, 110, 0, 73.42, 0, 0, 73.42, 146.83, 0, 110, 0],
    lead: [392, 0, 493.88, 0, 587.33, 0, 493.88, 0, 392, 0, 493.88, 0, 587.33, 0, 493.88, 0,
           523.25, 0, 659.25, 0, 523.25, 0, 440, 0, 523.25, 0, 392, 0, 440, 0, 523.25, 0,
           659.25, 0, 587.33, 0, 659.25, 0, 783.99, 0, 659.25, 0, 587.33, 0, 493.88, 0, 587.33, 0,
           392, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33, 493.88, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33, 0],
  });
  MUSIC.start();

  let W = 0, H = 0, DPR = 1, time = 0;

  const HUES = [315, 190, 45, 150, 265, 15, 210];

  let blobs = [];
  let drops = [];
  let rings = [];
  let bg = [];

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
    buildBg();
  }
  window.addEventListener("resize", resize);

  function buildBg() {
    bg = [];
    const n = Math.max(30, Math.floor((W * H) / 12000));
    for (let i = 0; i < n; i++) {
      bg.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * 6.283,
      });
    }
  }

  function splat(x, y) {
    const hue = HUES[(Math.random() * HUES.length) | 0];
    const r = 52 + Math.random() * 46;
    blobs.push({
      x: x, y: y, r: r, hue: hue,
      t: 0, life: 2.6 + Math.random() * 0.9,
      seed: Math.random() * 6.283,
      wob: 2 + ((Math.random() * 3) | 0),
    });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.283;
      const sp = 140 + Math.random() * 300;
      drops.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        t: 0, life: 0.5 + Math.random() * 0.4,
        hue: hue, r: 3 + Math.random() * 5,
      });
    }
    rings.push({ x: x, y: y, r: r * 0.5, t: 0, life: 0.4, hue: hue });
    audio.tone(280 + Math.random() * 220, 0.09, { type: "square", vol: 0.1, slideTo: 80 });
    audio.tone(140 + Math.random() * 80, 0.12, { type: "triangle", vol: 0.08, when: 0.03 });
  }

  canvas.addEventListener("pointerdown", function (e) {
    splat(e.clientX, e.clientY);
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });


  function drawBlob(b) {
    const k = b.t / b.life;
    let alpha = 1;
    if (k > 0.62) alpha = 1 - (k - 0.62) / 0.38;
    const grow = Math.min(1, b.t * 7); // quick pop-in
    const r = b.r * (0.55 + 0.45 * grow);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.shadowColor = "hsl(" + b.hue + ", 95%, 60%)";
    ctx.shadowBlur = 34;
    ctx.fillStyle = "hsl(" + b.hue + ", 90%, 55%)";
    ctx.beginPath();
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 6.2832;
      const rr = r * (1 + 0.16 * Math.sin(b.wob * a + b.seed) +
        0.08 * Math.sin(2 * b.wob * a - b.seed));
      const px = b.x + Math.cos(a) * rr;
      const py = b.y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // hot core
    ctx.shadowBlur = 0;
    ctx.fillStyle = "hsla(" + b.hue + ", 100%, 74%, 0.55)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 0.45, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (MUSIC) MUSIC.tick(dt);
    time += dt;

    // background
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#0b0b16");
    grd.addColorStop(1, "#0a0a13");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    for (const s of bg) {
      const a = 0.25 + Math.abs(Math.sin(time * 0.8 + s.tw)) * 0.5;
      ctx.fillStyle = "rgba(160,200,255," + a.toFixed(2) + ")";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // blobs
    for (let i = blobs.length - 1; i >= 0; i--) {
      const b = blobs[i];
      b.t += dt;
      if (b.t >= b.life) { blobs.splice(i, 1); continue; }
      drawBlob(b);
    }

    // droplets
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i];
      p.t += dt;
      if (p.t >= p.life) { drops.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = "hsla(" + p.hue + ",95%,64%," + k.toFixed(2) + ")";
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
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,68%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 90, 0, 6.2832);
      ctx.stroke();
    }

    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
