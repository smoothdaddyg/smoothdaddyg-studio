/* ============================================================
   COUNT — SmoothDaddyG
   Asteroids drift by. Tap each one: it explodes and the count
   ticks up with a rising chiptune note. When all are popped,
   a big celebration shows the total — as a numeral, no words.
   More asteroids appear as the player succeeds (max 5).
   One interaction: tap. No reading required. No losing.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1;
  let time = 0;

  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0]; // do re mi fa sol
  const MAX_N = 5;

  let rocks = [];
  let particles = [];
  let rings = [];
  let popups = [];   // floating numerals
  let stars = [];
  let target = 2;    // how many asteroids this round
  let count = 0;     // tapped so far this round
  let roundsDone = 0;
  let state = "play"; // "play" | "finale"
  let finaleT = 0;

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
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4, tw: Math.random() * 6.283,
      });
    }
  }

  function makeRockVerts() {
    const v = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832;
      const rr = 0.78 + Math.random() * 0.3;
      v.push({ a: a, rr: rr });
    }
    return v;
  }

  function placeRocks() {
    rocks = [];
    const topPad = 120;
    for (let i = 0; i < target; i++) {
      const r = 46 + Math.random() * 14; // big touch targets
      let x = 0, y = 0, ok = false, tries = 0;
      while (!ok && tries < 60) {
        tries++;
        x = r + 20 + Math.random() * Math.max(1, W - 2 * (r + 20));
        y = topPad + r + Math.random() * Math.max(1, H - topPad - 2 * r - 60);
        ok = rocks.every((o) => {
          const dx = x - o.x, dy = y - o.y;
          return dx * dx + dy * dy > (r + o.r + 26) * (r + o.r + 26);
        });
      }
      rocks.push({
        x: x, y: y, r: r,
        verts: makeRockVerts(),
        rot: Math.random() * 6.283,
        rotSpd: (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * 26,
        vy: (Math.random() - 0.5) * 22,
        hue: 210 + Math.random() * 30,
        born: time,
      });
    }
  }

  function newRound() {
    count = 0;
    state = "play";
    placeRocks();
  }

  function explode(rock) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 6.283;
      const sp = 110 + Math.random() * 260;
      particles.push({
        x: rock.x, y: rock.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: 0.6 + Math.random() * 0.5,
        hue: Math.random() < 0.6 ? rock.hue : 45,
        r: 3 + Math.random() * 4,
      });
    }
    rings.push({ x: rock.x, y: rock.y, r: rock.r * 0.4, t: 0, life: 0.4, hue: 45 });
    count++;
    popups.push({ x: rock.x, y: rock.y, n: count, t: 0, life: 0.9 });
    audio.tone(PENTA[(count - 1) % PENTA.length] * 2, 0.14, {
      type: "square", vol: 0.09, slideTo: PENTA[(count - 1) % PENTA.length] * 2.4,
    });
    if (count >= target) {
      state = "finale";
      finaleT = 0;
      roundsDone++;
      // fanfare: rising arpeggio + shimmer
      audio.arp([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.1, "square", 0.09);
      audio.arp([261.63, 329.63, 392.0, 523.25], 0.14, "triangle", 0.07);
      for (let i = 0; i < 60; i++) {
        confettiBurst(W / 2 + (Math.random() - 0.5) * W * 0.7, H * 0.28);
      }
      rings.push({ x: W / 2, y: H * 0.42, r: 20, t: 0, life: 0.9, hue: 45 });
    }
  }

  function confettiBurst(x, y) {
    const a = Math.random() * 6.283;
    const sp = 90 + Math.random() * 260;
    particles.push({
      x: x, y: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140,
      t: 0, life: 1.1 + Math.random() * 0.8,
      hue: [45, 315, 190, 150, 265][(Math.random() * 5) | 0],
      r: 3 + Math.random() * 4,
    });
  }

  function onTap(e) {
    if (state !== "play") return;
    const x = e.clientX, y = e.clientY;
    for (let i = rocks.length - 1; i >= 0; i--) {
      const rk = rocks[i];
      const dx = x - rk.x, dy = y - rk.y;
      const rr = rk.r * 1.2;
      if (dx * dx + dy * dy <= rr * rr) {
        rocks.splice(i, 1);
        explode(rk);
        return;
      }
    }
    // empty tap: soft ripple so every touch answers back
    rings.push({ x: x, y: y, r: 10, t: 0, life: 0.3, hue: 220 });
    audio.tone(220, 0.07, { type: "sine", vol: 0.035 });
  }

  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());


  function drawRock(rk) {
    ctx.save();
    ctx.translate(rk.x, rk.y);
    ctx.rotate(rk.rot);
    ctx.beginPath();
    rk.verts.forEach((v, i) => {
      const px = Math.cos(v.a) * rk.r * v.rr;
      const py = Math.sin(v.a) * rk.r * v.rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, rk.r * 0.1, 0, 0, rk.r);
    g.addColorStop(0, "#4a4a63");
    g.addColorStop(1, "#262633");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(120,140,200,0.5)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(160,180,220,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // craters
    ctx.fillStyle = "rgba(10,10,18,0.45)";
    ctx.beginPath(); ctx.arc(-rk.r * 0.25, -rk.r * 0.1, rk.r * 0.18, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(rk.r * 0.3, rk.r * 0.25, rk.r * 0.13, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    time += dt;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c0c18");
    bg.addColorStop(1, "#0a0a13");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const a = 0.25 + Math.abs(Math.sin(time * 0.8 + s.tw)) * 0.5;
      ctx.fillStyle = `rgba(160,200,255,${a.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // drifting rocks
    for (const rk of rocks) {
      rk.rot += rk.rotSpd * dt;
      rk.x += rk.vx * dt;
      rk.y += rk.vy * dt;
      if (rk.x < rk.r) { rk.x = rk.r; rk.vx = Math.abs(rk.vx); }
      if (rk.x > W - rk.r) { rk.x = W - rk.r; rk.vx = -Math.abs(rk.vx); }
      if (rk.y < 110 + rk.r * 0.4) { rk.y = 110 + rk.r * 0.4; rk.vy = Math.abs(rk.vy); }
      if (rk.y > H - rk.r) { rk.y = H - rk.r; rk.vy = -Math.abs(rk.vy); }
      drawRock(rk);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 320 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = `hsla(${p.hue},90%,62%,${k.toFixed(2)})`;
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
      ctx.arc(r.x, r.y, r.r + k * 80, 0, 6.2832);
      ctx.stroke();
    }

    // floating numerals where asteroids popped
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.t += dt;
      if (p.t >= p.life) { popups.splice(i, 1); continue; }
      const k = p.t / p.life;
      drawPixelNumber(ctx, p.n, p.x, p.y - 30 - k * 44, 8, `rgba(255,225,77,${(1 - k).toFixed(2)})`, true);
    }

    // finale: giant total in the middle
    if (state === "finale") {
      finaleT += dt;
      const pulse = 1 + Math.sin(finaleT * 6) * 0.06;
      const px = Math.min(34, W / 14) * pulse;
      ctx.save();
      ctx.shadowColor = "#ffe14d";
      ctx.shadowBlur = 40;
      drawPixelNumber(ctx, target, W / 2, H * 0.42 - (5 * px) / 2, px, "#ffe14d", false);
      ctx.restore();
      if (finaleT > 2.0) {
        // quietly raise the challenge every couple of rounds
        if (roundsDone % 2 === 0 && target < MAX_N) target++;
        newRound();
      }
    }

    requestAnimationFrame(frame);
  }

  resize();
  newRound();
  requestAnimationFrame(frame);
})();
