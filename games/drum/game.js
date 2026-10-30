/* ============================================================
   DRUM — SmoothDaddyG
   Eight big neon drum pads: kick, higher bass, 808 boom, snare,
   closed + open hi-hats, crash cymbal, and a synthetic zap.
   Real synthesized drum sounds via WebAudio — noise + pitch
   sweeps, no samples. Tap one: it flashes and thumps.
   No rhythm required, just play. No reading required.
   One interaction: tap a pad.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();
  /* Background music (2026-10-30 rollout): an original chiptune loop —
     sparse chiptune stabs so the drums stay the star, kept
     under the SFX. Starts at load; the synth stays silent until the
     first tap, then plays mid-loop. */
  const MUSIC = audio.makeMusic({
    bpm: 150, div: 4, steps: 64,
    bassType: "triangle", bassVol: 0.2,
    leadType: "square", leadVol: 0.035,
    kickVol: 0.16, snareVol: 0.05, hatVol: 0.02,
    kicks: [0, 16, 32, 48],
    snares: [8, 24, 40, 56],
    hats: "none",
    bass: [82.41, 0, 0, 82.41, 0, 0, 123.47, 0, 82.41, 0, 0, 82.41, 164.81, 0, 123.47, 0,
           82.41, 0, 0, 82.41, 0, 0, 123.47, 0, 82.41, 0, 0, 82.41, 164.81, 0, 123.47, 0,
           98, 0, 0, 98, 0, 0, 146.83, 0, 98, 0, 0, 98, 196, 0, 146.83, 0,
           110, 0, 0, 110, 0, 0, 164.81, 0, 110, 0, 0, 110, 220, 0, 164.81, 0],
    lead: [329.63, 0, 0, 0, 0, 0, 392, 0, 0, 0, 329.63, 0, 0, 0, 0, 0,
           329.63, 0, 0, 0, 0, 0, 392, 0, 0, 0, 329.63, 0, 0, 0, 0, 0,
           392, 0, 0, 0, 0, 0, 493.88, 0, 0, 0, 392, 0, 0, 0, 0, 0,
           329.63, 0, 392, 0, 493.88, 0, 392, 0, 329.63, 0, 0, 0, 0, 0, 0, 0]
  });
  MUSIC.start();

  let W = 0, H = 0, DPR = 1, time = 0;

  // kind, hue, glyph — no text anywhere, icons only.
  const DEFS = [
    { kind: "kick",   hue: 315, glyph: "circle" },      // deep bass drum
    { kind: "bass",   hue: 265, glyph: "ring" },        // higher bass drum
    { kind: "boom",   hue: 225, glyph: "wave" },        // 808 synthetic sub boom
    { kind: "snare",  hue: 190, glyph: "cross" },       // snare
    { kind: "hat",    hue: 45,  glyph: "lines" },       // closed hi-hat
    { kind: "ohat",   hue: 35,  glyph: "lineswide" },   // open hi-hat
    { kind: "crash",  hue: 15,  glyph: "burst" },       // crash cymbal
    { kind: "zap",    hue: 150, glyph: "bolt" },        // synthetic zap
  ];

  let pads = [];
  let rings = [];

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

    // 4 columns x 2 rows on wide screens, 2 x 4 on narrow — big pads.
    const cols = W >= H ? 4 : 2;
    const rows = DEFS.length / cols;
    const gap = Math.max(14, Math.min(W, H) * 0.04);
    const marginX = gap * 1.5;
    const topClear = 96; // clear of top chrome
    const size = Math.min(
      (W - marginX * 2 - gap * (cols - 1)) / cols,
      (H - topClear - gap * (rows + 1)) / rows
    );
    const ox = (W - (size * cols + gap * (cols - 1))) / 2;
    const oy = topClear + gap;
    pads = DEFS.map(function (d, i) {
      const col = i % cols, row = (i / cols) | 0;
      return {
        kind: d.kind, hue: d.hue, glyph: d.glyph,
        x: ox + col * (size + gap),
        y: oy + row * (size + gap),
        w: size, h: size,
        flash: 0,
      };
    });
  }
  window.addEventListener("resize", resize);

  function drumSound(kind) {
    if (kind === "kick") {
      // deep bass drum: pitch-dropping sine + click transient + thump
      audio.tone(150, 0.32, { type: "sine", vol: 0.34, slideTo: 38 });
      audio.noise(0.06, { filter: "lowpass", freq: 2500, vol: 0.22 });
      audio.noise(0.12, { filter: "lowpass", freq: 380, vol: 0.28, when: 0.01 });
    } else if (kind === "bass") {
      // higher bass drum: same recipe pitched up
      audio.tone(220, 0.28, { type: "sine", vol: 0.32, slideTo: 55 });
      audio.noise(0.05, { filter: "lowpass", freq: 3200, vol: 0.2 });
      audio.noise(0.1, { filter: "lowpass", freq: 560, vol: 0.25, when: 0.01 });
    } else if (kind === "boom") {
      // 808 sub boom: long detuned sine drop
      audio.tone(65, 0.6, { type: "sine", vol: 0.32, slideTo: 30 });
      audio.tone(65.8, 0.6, { type: "sine", vol: 0.15, slideTo: 30.6 });
    } else if (kind === "snare") {
      // bandpassed noise crack + 190Hz body
      audio.noise(0.12, { filter: "bandpass", freq: 1800, Q: 1.0, vol: 0.3 });
      audio.tone(190, 0.12, { type: "triangle", vol: 0.24 });
    } else if (kind === "hat") {
      // closed hi-hat: tight highpass sizzle
      audio.noise(0.05, { filter: "highpass", freq: 8000, vol: 0.13 });
    } else if (kind === "ohat") {
      // open hi-hat: longer shimmer
      audio.noise(0.35, { filter: "highpass", freq: 7500, vol: 0.14 });
    } else if (kind === "crash") {
      // crash cymbal: long shimmering decay
      audio.noise(1.2, { filter: "highpass", freq: 5000, vol: 0.12 });
      audio.noise(0.5, { filter: "highpass", freq: 9000, vol: 0.07, when: 0.02 });
    } else { // zap — synthetic laser drum
      audio.tone(1200, 0.25, { type: "sawtooth", vol: 0.14, slideTo: 120 });
      audio.noise(0.18, { filter: "highpass", freq: 4000, vol: 0.08 });
    }
  }

  function hitPad(p, x, y) {
    p.flash = 1;
    drumSound(p.kind);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * 6.283;
      const sp = 100 + Math.random() * 220;
      rings.push({
        x: x, y: y, r: 12, t: 0, life: 0.35, hue: p.hue,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      });
    }
  }

  function onTap(e) {
    const x = e.clientX, y = e.clientY;
    for (const p of pads) {
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
        hitPad(p, x, y);
        return p;
      }
    }
    // between pads: a soft blip, nothing bad
    audio.tone(220, 0.06, { type: "sine", vol: 0.03 });
    return null;
  }
  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });


  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGlyph(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const s = p.w * 0.15;
    ctx.strokeStyle = "hsl(" + p.hue + ", 100%, 78%)";
    ctx.fillStyle = "hsl(" + p.hue + ", 100%, 78%)";
    ctx.lineWidth = Math.max(6, p.w * 0.032);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    if (p.glyph === "circle") {
      ctx.arc(cx, cy, s, 0, 6.2832);
      ctx.stroke();
    } else if (p.glyph === "ring") {
      ctx.arc(cx, cy, s, 0, 6.2832);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.45, 0, 6.2832);
      ctx.stroke();
    } else if (p.glyph === "wave") {
      // low bass wave: two stacked arcs
      ctx.arc(cx, cy - s * 0.35, s * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.45, s * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (p.glyph === "cross") {
      ctx.arc(cx, cy, s, 0, 6.2832);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.7, cy - s * 0.7);
      ctx.lineTo(cx + s * 0.7, cy + s * 0.7);
      ctx.moveTo(cx + s * 0.7, cy - s * 0.7);
      ctx.lineTo(cx - s * 0.7, cy + s * 0.7);
      ctx.stroke();
    } else if (p.glyph === "lines") {
      // closed hat: two close parallel lines
      ctx.moveTo(cx - s, cy - s * 0.25);
      ctx.lineTo(cx + s, cy - s * 0.25);
      ctx.moveTo(cx - s, cy + s * 0.25);
      ctx.lineTo(cx + s, cy + s * 0.25);
      ctx.stroke();
    } else if (p.glyph === "lineswide") {
      // open hat: two wider-spaced lines
      ctx.moveTo(cx - s, cy - s * 0.75);
      ctx.lineTo(cx + s, cy - s * 0.75);
      ctx.moveTo(cx - s, cy + s * 0.75);
      ctx.lineTo(cx + s, cy + s * 0.75);
      ctx.stroke();
    } else if (p.glyph === "burst") {
      // crash: starburst
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.2832;
        const r1 = s * 0.35, r2 = s * 1.05;
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      }
      ctx.stroke();
    } else { // bolt — lightning
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.35, cy - s * 1.1);
      ctx.lineTo(cx - s * 0.35, cy + s * 0.15);
      ctx.lineTo(cx + s * 0.25, cy + s * 0.15);
      ctx.lineTo(cx - s * 0.35, cy + s * 1.1);
      ctx.stroke();
    }
  }

  function drawPad(p) {
    const pulse = 1 + Math.sin(time * 2 + p.hue) * 0.012;
    ctx.save();
    ctx.shadowColor = "hsl(" + p.hue + ", 95%, 60%)";
    ctx.shadowBlur = 26 + p.flash * 40;
    roundRect(p.x, p.y, p.w * pulse, p.h * pulse, 26);
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, "hsl(" + p.hue + ", 70%, 20%)");
    g.addColorStop(1, "hsl(" + p.hue + ", 80%, 12%)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    // neon edge
    ctx.strokeStyle = "hsl(" + p.hue + ", 100%, 62%)";
    ctx.lineWidth = 4;
    roundRect(p.x, p.y, p.w, p.h, 26);
    ctx.stroke();
    // flash wash
    if (p.flash > 0) {
      ctx.fillStyle = "hsla(" + p.hue + ", 100%, 70%," + (p.flash * 0.55).toFixed(2) + ")";
      roundRect(p.x, p.y, p.w, p.h, 26);
      ctx.fill();
    }
    drawGlyph(p);
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

    for (const p of pads) {
      if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 3.2);
      drawPad(p);
    }

    // spark rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) { rings.splice(i, 1); continue; }
      r.x += (r.vx || 0) * dt;
      r.y += (r.vy || 0) * dt;
      const k = r.t / r.life;
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,68%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 46, 0, 6.2832);
      ctx.stroke();
    }

    requestAnimationFrame(frame);
  }

  // test hook
  window.__drumTest = {
    pads: function () {
      return pads.map(function (p) {
        return { kind: p.kind, x: p.x, y: p.y, w: p.w, h: p.h, flash: p.flash };
      });
    },
    tap: function (x, y) { return onTap({ clientX: x, clientY: y }); },
    muted: function () { return audio.muted; },
  };

  resize();
  requestAnimationFrame(frame);
})();
