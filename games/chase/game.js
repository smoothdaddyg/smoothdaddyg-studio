/* ============================================================
   CHASE — SmoothDaddyG
   A bouncy star hops to a new spot every couple of seconds —
   or the moment you tap it. Tap it for a giggle-arpeggio
   and a burst of sparks. Tapping empty space does nothing bad.
   One interaction: tap the star. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  const HUES = [45, 315, 190, 150, 265];
  const GIGGLE = [660, 830, 990, 1240, 990, 830];

  const star = {
    x: 0, y: 0, r: 46,
    fromX: 0, fromY: 0, toX: 0, toY: 0,
    hopT: 1, hopDur: 0.5, hopping: false,
    squash: 0, // >0 right after landing
    hue: 45,
    idlePh: 0,
  };

  let parts = [];
  let rings = [];
  let bg = [];
  let idleT = 0;
  const IDLE_HOP = 2.6;

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
    if (!star.x) {
      star.x = W / 2; star.y = H / 2;
      star.fromX = star.x; star.fromY = star.y;
      star.toX = star.x; star.toY = star.y;
      star.hue = HUES[(Math.random() * HUES.length) | 0];
    }
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

  function pickSpot() {
    const m = 100;
    return {
      x: m + Math.random() * Math.max(1, W - 2 * m),
      y: m + 60 + Math.random() * Math.max(1, H - 2 * m - 120),
    };
  }

  function hop() {
    const p = pickSpot();
    star.fromX = star.x; star.fromY = star.y;
    star.toX = p.x; star.toY = p.y;
    star.hopT = 0;
    star.hopDur = 0.45 + Math.random() * 0.15;
    star.hopping = true;
    idleT = 0;
    audio.tone(300, 0.12, { type: "sine", vol: 0.05, slideTo: 620 });
  }

  function starPath(x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function burst(x, y, hue) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 6.283;
      const sp = 130 + Math.random() * 300;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: 0.5 + Math.random() * 0.5,
        hue: hue, r: 2.5 + Math.random() * 4,
      });
    }
    rings.push({ x: x, y: y, r: star.r * 0.5, t: 0, life: 0.35, hue: hue });
  }

  function onTap(e) {
    const x = e.clientX, y = e.clientY;
    const dx = x - star.x, dy = y - star.y;
    const rr = star.r * 1.3; // generous hit area
    if (dx * dx + dy * dy <= rr * rr) {
      burst(star.x, star.y, star.hue);
      audio.arp(GIGGLE, 0.055, "square", 0.08);
      star.hue = HUES[(Math.random() * HUES.length) | 0];
      hop();
    } else {
      // empty space: a soft ripple, nothing bad
      rings.push({ x: x, y: y, r: 10, t: 0, life: 0.3, hue: 220 });
      audio.tone(220, 0.07, { type: "sine", vol: 0.035 });
    }
  }
  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });


  function drawStar() {
    // squash & stretch
    let sx = 1, sy = 1;
    if (star.hopping) {
      const k = Math.min(1, star.hopT / star.hopDur);
      const stretch = Math.sin(k * Math.PI) * 0.18;
      sx = 1 - stretch; sy = 1 + stretch;
    } else if (star.squash > 0) {
      const s = star.squash * 0.25;
      sx = 1 + s; sy = 1 - s;
    } else {
      const p = 1 + Math.sin(star.idlePh) * 0.05; // idle invitation pulse
      sx = p; sy = p;
    }
    ctx.save();
    ctx.translate(star.x, star.y);
    ctx.scale(sx, sy);
    ctx.shadowColor = "hsl(" + star.hue + ", 95%, 60%)";
    ctx.shadowBlur = 30;
    starPath(0, 0, star.r, time * 0.4);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, star.r);
    g.addColorStop(0, "hsl(" + star.hue + ", 100%, 80%)");
    g.addColorStop(1, "hsl(" + star.hue + ", 95%, 45%)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    time += dt;
    star.idlePh += dt * 3;

    // auto-hop every couple of seconds
    if (!star.hopping) {
      idleT += dt;
      if (idleT >= IDLE_HOP) hop();
    }

    // hop motion: ease + parabolic arc
    if (star.hopping) {
      star.hopT += dt;
      const k = Math.min(1, star.hopT / star.hopDur);
      const e = 1 - Math.pow(1 - k, 2);
      star.x = star.fromX + (star.toX - star.fromX) * e;
      const baseY = star.fromY + (star.toY - star.fromY) * e;
      star.y = baseY - Math.sin(k * Math.PI) * 130;
      if (k >= 1) {
        star.hopping = false;
        star.x = star.toX; star.y = star.toY;
        star.squash = 1;
        audio.tone(180, 0.08, { type: "sine", vol: 0.05, slideTo: 120 });
      }
    }
    if (star.squash > 0) star.squash = Math.max(0, star.squash - dt * 6);

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

    drawStar();

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = "hsla(" + p.hue + ",95%,62%," + k.toFixed(2) + ")";
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
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,65%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 70, 0, 6.2832);
      ctx.stroke();
    }

    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
