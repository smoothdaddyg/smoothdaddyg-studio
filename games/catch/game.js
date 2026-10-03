/* ============================================================
   CATCH — SmoothDaddyG
   A glowing basket follows your finger. Stars fall from the
   sky — catch them for a chime and a burst of sparks.
   Caught stars pile up in the basket. Every 8 completes a set:
   fanfare, the stars fly into your trophy row up top, and the
   basket levels up (wider, prettier, stars fall a touch faster).
   Faint glows on the ground show where stars will land —
   learn to read them and be there first.
   Missed stars fade away. Nothing to lose.
   One interaction: move / drag. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  const HUES = [45, 190, 315, 150, 265];
  const CHIME = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  const SET_SIZE = 8;          // stars per set
  const BASKET_W = 120;        // base width
  const MAX_W_BONUS = 48;      // +8px per level, capped
  const MAX_SPEED_BONUS = 0.40; // +8% fall speed per level, capped
  const MAX_PARTS = 500;

  let stars = [];
  let parts = [];
  let rings = [];
  let bg = [];
  let flyers = [];    // collected stars flying up to the trophy row
  let collected = []; // stars resting in the basket { hue }
  let sets = [];      // completed sets { hue } — the trophy row
  let spawnT = 0;
  let chimeI = 0;

  let count = 0;      // total stars caught — the big count-up
  let level = 1;      // = sets.length + 1
  let streak = 0;     // consecutive catches without a miss
  let rimI = 1;       // rim color index into HUES (starts cyan)
  let flashT = 0;     // basket celebration flash

  let lastBurst = 0;  // test introspection: last catch burst size
  let lastChime = 0;  // test introspection: last catch chime base freq

  let bx = 0, tx = 0, by = 0;

  function basketW() {
    return BASKET_W + Math.min(MAX_W_BONUS, (level - 1) * 8);
  }
  function fallMul() {
    return 1 + Math.min(MAX_SPEED_BONUS, (level - 1) * 0.08);
  }
  function spawnMul() {
    return Math.max(0.75, 1 - (level - 1) * 0.03);
  }
  function rimHue() {
    return HUES[rimI % HUES.length];
  }

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
    by = H - 96;
    if (!bx) { bx = W / 2; tx = W / 2; }
    tx = Math.max(70, Math.min(W - 70, tx));
    bx = Math.max(70, Math.min(W - 70, bx));
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

  function spawnStar() {
    const r = 24 + Math.random() * 14;
    const s = {
      x: r + 10 + Math.random() * Math.max(1, W - 2 * r - 20),
      y: -50,
      r: r,
      hue: HUES[(Math.random() * HUES.length) | 0],
      vy: (120 + Math.random() * 100) * fallMul(),
      ph: Math.random() * 6.283,
      sway: 24 + Math.random() * 26,
      fade: 0,
      gone: false,
    };
    s.baseX = s.x;
    stars.push(s);
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

  function addPart(p) {
    if (parts.length < MAX_PARTS) parts.push(p);
  }

  function burst(x, y, hue, n) {
    n = n || 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const sp = 120 + Math.random() * 280;
      addPart({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: 0.5 + Math.random() * 0.5,
        hue: hue, r: 2.5 + Math.random() * 3.5,
      });
    }
    rings.push({ x: x, y: y, r: 10, t: 0, life: 0.35, hue: hue });
  }

  function confetti(x, y) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * 6.283;
      const sp = 160 + Math.random() * 380;
      addPart({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        t: 0, life: 0.8 + Math.random() * 0.7,
        hue: HUES[(Math.random() * HUES.length) | 0],
        r: 3 + Math.random() * 4,
      });
    }
  }

  /* Trophy-row slot for completed set i (0-based), wraps rows. */
  function setSlot(i) {
    const perRow = 12, gap = 42;
    return { x: 52 + (i % perRow) * gap, y: 52 + Math.floor(i / perRow) * 44 };
  }

  function completeSet() {
    const setHue = rimHue();
    sets.push({ hue: setHue });
    level++;
    rimI = (rimI + 1) % HUES.length;
    flashT = 0.9;
    // fanfare: confetti + expanding rings + rising arpeggio
    confetti(bx, by - 20);
    for (let k = 0; k < 3; k++) {
      rings.push({ x: bx, y: by - 20, r: 14 + k * 8, t: -k * 0.08, life: 0.6, hue: setHue });
    }
    audio.arp([392, 523.25, 659.25, 783.99, 1046.5], 0.09, "square", 0.1);
    // collected stars fly up into the trophy row
    const slot = setSlot(sets.length - 1);
    for (let c = 0; c < collected.length; c++) {
      flyers.push({
        x: bx, y: by - 20,
        tx: slot.x, ty: slot.y,
        hue: collected[c].hue,
        t: 0, life: 0.9,
      });
    }
    collected = [];
  }

  function catchStar(s) {
    count++;
    streak++;
    collected.push({ hue: s.hue });
    // combo feel: bigger burst + brighter chime with the streak
    const burstN = Math.min(44, 18 + streak * 3);
    lastBurst = burstN;
    burst(s.x, s.y, s.hue, burstN);
    const base = CHIME[chimeI % CHIME.length] * (1 + Math.min(6, streak - 1) * 0.06);
    lastChime = base;
    chimeI++;
    audio.arp([base * 2, base * 2.5, base * 3], 0.07, "triangle", 0.09);
    if (collected.length >= SET_SIZE) {
      completeSet();
    }
  }

  function onMiss() {
    // misses are consequence-free: they only quietly reset the streak
    streak = 0;
  }

  function onPoint(e) {
    tx = Math.max(70, Math.min(W - 70, e.clientX));
  }
  canvas.addEventListener("pointerdown", onPoint);
  canvas.addEventListener("pointermove", onPoint);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  const muteBtn = document.getElementById("muteBtn");
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    muteBtn.style.opacity = audio.toggleMute() ? "0.35" : "1";
  });

  function drawBasket() {
    const w = basketW(), h = 46;
    const bob = Math.sin(time * 2.2) * 4;
    const x = bx, y = by + bob;
    const hue = rimHue();
    ctx.save();
    ctx.shadowColor = "hsl(" + hue + ", 95%, 60%)";
    ctx.shadowBlur = 30 + (flashT > 0 ? 40 * flashT : 0);
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, "hsl(" + hue + ", 90%, 42%)");
    g.addColorStop(1, "hsl(" + ((hue + 10) % 360) + ", 95%, 26%)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.lineTo(x + w / 2 - 16, y + h / 2);
    ctx.lineTo(x - w / 2 + 16, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // collected stars resting inside, tucked under the rim
    const n = collected.length;
    for (let i = 0; i < n; i++) {
      const sx = x + (i - (n - 1) / 2) * Math.min(18, (w - 24) / Math.max(1, n));
      const sy = y - h / 2 + 10 + Math.sin(time * 3 + i * 1.7) * 2;
      ctx.save();
      ctx.shadowColor = "hsl(" + collected[i].hue + ", 95%, 65%)";
      ctx.shadowBlur = 12;
      starPath(sx, sy, 11, time * 0.8 + i);
      ctx.fillStyle = "hsl(" + collected[i].hue + ", 95%, 68%)";
      ctx.fill();
      ctx.restore();
    }
    // glowing rim
    ctx.strokeStyle = "hsl(" + hue + ", 100%, 72%)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 4, y - h / 2);
    ctx.lineTo(x + w / 2 + 4, y - h / 2);
    ctx.stroke();
    // weave lines
    ctx.strokeStyle = "hsla(" + hue + ", 100%, 75%, 0.35)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const yy = y - h / 2 + (h / 4) * i;
      const inset = 16 * (i / 4);
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + inset, yy);
      ctx.lineTo(x + w / 2 - inset, yy);
      ctx.stroke();
    }
  }

  function drawStar(s) {
    const alpha = s.gone ? Math.max(0, 1 - s.fade) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "hsl(" + s.hue + ", 95%, 60%)";
    ctx.shadowBlur = 22;
    starPath(s.x, s.y, s.r, s.ph * 0.3);
    const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.r);
    g.addColorStop(0, "hsl(" + s.hue + ", 100%, 80%)");
    g.addColorStop(1, "hsl(" + s.hue + ", 95%, 45%)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  /* Faint landing glow on the ground under a falling star —
     the thing to learn: read the glow, be there first. */
  function drawLandingGlow(s) {
    const pulse = 0.10 + 0.06 * Math.sin(time * 4 + s.ph);
    ctx.fillStyle = "hsla(" + s.hue + ", 95%, 70%, " + pulse.toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(s.x, H - 26, 26, 9, 0, 0, 6.2832);
    ctx.fill();
  }

  function drawTrophies() {
    for (let i = 0; i < sets.length; i++) {
      const slot = setSlot(i);
      ctx.save();
      ctx.shadowColor = "hsl(" + sets[i].hue + ", 95%, 60%)";
      ctx.shadowBlur = 10;
      starPath(slot.x, slot.y, 12, time * 0.5 + i * 0.4);
      ctx.fillStyle = "hsl(" + sets[i].hue + ", 95%, 62%)";
      ctx.fill();
      ctx.restore();
    }
  }

  function tick(dt) {
    time += dt;
    if (flashT > 0) flashT -= dt;

    // basket eases toward the finger
    bx += (tx - bx) * Math.min(1, dt * 10);

    // spawn
    spawnT -= dt;
    if (spawnT <= 0 && stars.length < 7) {
      spawnStar();
      spawnT = (0.7 + Math.random() * 0.7) * spawnMul();
    }

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

    // trophy row (persistent for the session)
    drawTrophies();

    const w = basketW();

    // stars
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      if (s.gone) {
        s.y += s.vy * dt * 0.5;
        s.fade += dt * 1.6;
        if (s.fade >= 1) { stars.splice(i, 1); continue; }
        drawStar(s);
        continue;
      }
      s.y += s.vy * dt;
      s.ph += dt * 1.6;
      s.x = s.baseX + Math.sin(s.ph) * s.sway;
      drawLandingGlow(s);
      // caught?
      if (s.y + s.r * 0.3 >= by - 34 && s.y <= by + 6 &&
          Math.abs(s.x - bx) < w / 2 - 6) {
        catchStar(s);
        stars.splice(i, 1);
        continue;
      }
      // missed — sink and fade away, no penalty
      if (s.y - s.r > H) {
        onMiss();
        s.gone = true;
        s.fade = 0;
      }
      drawStar(s);
    }

    // flyers: collected stars soaring up to the trophy row
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t += dt;
      if (f.t >= f.life) { flyers.splice(i, 1); continue; }
      const k = f.t / f.life;
      const e = 1 - (1 - k) * (1 - k); // ease-out
      const fx = f.x + (f.tx - f.x) * e;
      const fy = f.y + (f.ty - f.y) * e - Math.sin(k * Math.PI) * 40;
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.3;
      ctx.shadowColor = "hsl(" + f.hue + ", 95%, 65%)";
      ctx.shadowBlur = 14;
      starPath(fx, fy, 12 * (1 - k * 0.4), f.t * 6);
      ctx.fillStyle = "hsl(" + f.hue + ", 95%, 68%)";
      ctx.fill();
      ctx.restore();
    }

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
      const k = Math.max(0, Math.min(1, r.t / r.life));
      if (r.t < 0) continue;
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,65%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 70, 0, 6.2832);
      ctx.stroke();
    }

    drawBasket();

    // big count-up, top center
    if (count > 0) {
      drawPixelNumber(ctx, count, W / 2, 64, 7, "#ffe14d", true);
    }
  }

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    tick(dt);
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);

  /* Read-only test hook (extended with controlled inputs for tests). */
  window.__catchTest = {
    get count() { return count; },
    get collected() { return collected.length; },
    get sets() { return sets.length; },
    get level() { return level; },
    get streak() { return streak; },
    get basketW() { return basketW(); },
    get fallMul() { return fallMul(); },
    get spawnMul() { return spawnMul(); },
    get flyers() { return flyers.length; },
    get parts() { return parts.length; },
    get setSize() { return SET_SIZE; },
    get lastBurst() { return lastBurst; },
    get lastChime() { return lastChime; },
    get rimI() { return rimI; },
    catchOne: function () { catchStar({ x: bx, y: by, hue: 45, r: 24 }); },
    missOne: function () { onMiss(); },
    step: function (dt) { tick(dt || 0.016); },
  };
})();
