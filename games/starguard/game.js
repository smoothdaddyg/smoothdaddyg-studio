/* ============================================================
   STAR GUARD — SmoothDaddyG
   A retro sky-defense game in the spirit of the Odyssey era.
   Invaders glide side to side and step down; your ship follows
   your finger and fires on its own. Clear all 24 invaders to
   win. You have 3 shields — losing them all ends the run.
   One interaction: drag / move anywhere. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  const COLS = 6, ROWS = 4, TOTAL = COLS * ROWS;
  const FIRE_INTERVAL = 0.45;   // ship auto-fires this often
  const BOLT_SPEED = 560;
  const ENEMY_INTERVAL = 1.2;   // invaders drop a shot this often
  const ENEMY_SHOT_SPEED = 260;
  const MAX_ENEMY_SHOTS = 3;
  const DROP = 24;              // px the block steps down at an edge
  const INVULN_TIME = 1.5;
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
  const MARCH = [98, 87.31, 82.41, 73.42]; // iconic 4-note descending bass

  // --- original pixel-art invaders: crab-bot, squid-bot, dome-bot ---
  // rows: 0 = dome (gold), 1-2 = squid (green), 3 = crab (magenta)
  const SPR = {
    crabA: [
      "..X......X..",
      "...X....X...",
      "...XXXXXX...",
      "..XXXXXXXX..",
      ".XXXXXXXXXX.",
      "X.XXXXXXXX.X",
      "X..........X",
      "....X..X....",
    ],
    crabB: [
      "...X....X...",
      "..X......X..",
      "...XXXXXX...",
      "..XXXXXXXX..",
      ".XXXXXXXXXX.",
      "X.XXXXXXXX.X",
      "....X..X....",
      "...X....X...",
    ],
    squidA: [
      "....XX....",
      "...XXXX...",
      "..XXXXXX..",
      ".XXXXXXXX.",
      "XXXXXXXXXX",
      "X.XXXXXX.X",
      "...XXXX...",
      "...X..X...",
      "..X....X..",
    ],
    squidB: [
      "....XX....",
      "...XXXX...",
      "..XXXXXX..",
      ".XXXXXXXX.",
      "XXXXXXXXXX",
      "X.XXXXXX.X",
      "..X.XX.X..",
      "....XX....",
      "...X..X...",
    ],
    domeA: [
      ".....XX.....",
      "....XXXX....",
      "...XXXXXX...",
      "..XXXXXXXX..",
      ".XXXXXXXXXX.",
      "XXXXXXXXXXXX",
      ".X..XXXX..X.",
      ".....XX.....",
      ".....XX.....",
    ],
    domeB: [
      "............",
      "....XXXX....",
      "...XXXXXX...",
      "..XXXXXXXX..",
      ".XXXXXXXXXX.",
      "XXXXXXXXXXXX",
      "X...XXXX...X",
      ".....XX.....",
      ".....XX.....",
    ],
    ship: [
      ".....X.....",
      ".....X.....",
      "....XXX....",
      "....XXX....",
      "...XXXXX...",
      "...XXXXX...",
      "..XXXXXXX..",
      ".XXXXXXXXX.",
      "XX.XXXXX.XX",
    ],
  };
  const TYPE_OF_ROW = ["dome", "squid", "squid", "crab"];
  const HUE_OF_TYPE = { dome: 45, squid: 140, crab: 315 };

  let invaders = [];   // {col,row,type,hue,alive}
  let gridX = 0, gridY = 0, gridW = 0, dir = 1;
  let cellW = 48, cellH = 40, gapX = 10, gapY = 9, ipx = 3;
  let bolts = [];
  let enemyShots = [];
  let particles = [];
  let rings = [];
  let stars = [];
  let killSpots = [];  // {x,y,hue} of every kill, for the win fireworks

  let shipX = 0, shipY = 0, targetX = 0, spx = 4, hasDragged = false;
  let score = 0, shields = 3, killStreak = 0;
  let state = "play";  // "play" | "over" | "win"
  let fireT = 0.3, enemyT = 1.0, marchT = 0.4, marchIdx = 0;
  let invulnT = 0, shakeT = 0, flashT = 0, waddleT = 0;

  // Test counters (production no-ops, read by the test hook).
  let boltTotal = 0;
  const marchLog = [];
  const chimeLog = [];
  const noiseLog = [];

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
    ipx = Math.max(2.5, Math.min(4, W / 240));
    cellW = 12 * ipx;
    cellH = 10 * ipx;
    gapX = ipx * 2.5;
    gapY = ipx * 2.2;
    gridW = COLS * cellW + (COLS - 1) * gapX;
    spx = 4;
    shipY = H - 110;
    if (!shipX) { shipX = W / 2; targetX = W / 2; }
    shipX = Math.max(40, Math.min(W - 40, shipX));
    targetX = Math.max(40, Math.min(W - 40, targetX));
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

  function reset() {
    invaders = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = TYPE_OF_ROW[r];
        invaders.push({ col: c, row: r, type: type, hue: HUE_OF_TYPE[type], alive: true });
      }
    }
    gridX = (W - gridW) / 2;
    gridY = 108;
    dir = 1;
    bolts = [];
    enemyShots = [];
    particles = [];
    rings = [];
    killSpots = [];
    shipX = W / 2;
    targetX = W / 2;
    hasDragged = false;
    score = 0;
    shields = 3;
    killStreak = 0;
    state = "play";
    fireT = 0.3;
    enemyT = 1.0;
    marchT = 0.4;
    marchIdx = 0;
    invulnT = 0;
    shakeT = 0;
    flashT = 0;
    boltTotal = 0;
    marchLog.length = 0;
    chimeLog.length = 0;
    noiseLog.length = 0;
  }

  function aliveCount() {
    let n = 0;
    for (const v of invaders) if (v.alive) n++;
    return n;
  }

  function invaderXY(v) {
    return {
      x: gridX + v.col * (cellW + gapX),
      y: gridY + v.row * (cellH + gapY),
    };
  }

  function burst(x, y, hue, n, spread) {
    n = n || 14;
    spread = spread || 260;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const sp = 70 + Math.random() * spread;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: 0.5 + Math.random() * 0.6,
        hue: hue, r: 2 + Math.random() * 3,
      });
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }

  function destroyInvader(v) {
    if (!v.alive || state !== "play") return;
    v.alive = false;
    const p = invaderXY(v);
    const cxp = p.x + cellW / 2, cyp = p.y + cellH / 2;
    burst(cxp, cyp, v.hue, 16, 300);
    burst(cxp, cyp, 0, 6, 200);
    rings.push({ x: cxp, y: cyp, r: 8, t: 0, life: 0.4, hue: v.hue });
    killSpots.push({ x: cxp, y: cyp, hue: v.hue });
    audio.noise(0.32, { filter: "bandpass", freq: 1200, Q: 0.7, vol: 0.22 });
    audio.tone(320, 0.25, { type: "sawtooth", vol: 0.08, slideTo: 60 });
    // kill chime climbs a pentatonic ladder; a hit resets it
    const note = PENTA[killStreak % PENTA.length];
    killStreak++;
    audio.tone(note, 0.15, { type: "square", vol: 0.09 });
    score++;
    if (aliveCount() === 0) winGame();
  }

  function winGame() {
    state = "win";
    flashT = 1.0;
    enemyShots = [];
    bolts = [];
    // fireworks from every kill position
    for (const s of killSpots) {
      burst(s.x, s.y, s.hue, 18, 420);
      burst(s.x, s.y, (s.hue + 140) % 360, 10, 320);
      rings.push({ x: s.x, y: s.y, r: 10, t: 0, life: 0.8, hue: s.hue });
    }
    audio.arp([523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98], 0.1, "square", 0.1);
  }

  function hitPlayer() {
    if (state !== "play" || invulnT > 0) return;
    shields--;
    killStreak = 0; // the ladder resets when you're hit
    invulnT = INVULN_TIME;
    shakeT = 0.35;
    burst(shipX, shipY, 190, 18, 320);
    audio.tone(90, 0.3, { type: "sine", vol: 0.25, slideTo: 38 });
    if (shields <= 0) {
      state = "over";
      enemyShots = [];
      bolts = [];
    }
  }

  function fireBolt() {
    bolts.push({ x: shipX, y: shipY - 22 });
    audio.tone(880, 0.12, { type: "square", vol: 0.07, slideTo: 220 });
  }

  function dropEnemyShot() {
    // pick a random alive column's bottom-most invader
    const cols = [];
    for (let c = 0; c < COLS; c++) {
      let best = null;
      for (const v of invaders) {
        if (v.alive && v.col === c && (!best || v.row > best.row)) best = v;
      }
      if (best) cols.push(best);
    }
    if (!cols.length) return;
    const v = cols[(Math.random() * cols.length) | 0];
    const p = invaderXY(v);
    enemyShots.push({ x: p.x + cellW / 2, y: p.y + cellH + 6 });
    audio.tone(300, 0.15, { type: "sawtooth", vol: 0.04, slideTo: 120 });
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function update(dt) {
    // ship follows the finger (either hand, anywhere on screen)
    shipX += (targetX - shipX) * Math.min(1, dt * 12);
    if (invulnT > 0) invulnT -= dt;
    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt;
    waddleT += dt;

    if (state === "play") {
      // auto-fire
      fireT -= dt;
      if (fireT <= 0 && bolts.length < 1) {
        fireBolt();
        fireT = FIRE_INTERVAL;
      }
      // invader block glides; steps down and reverses at edges
      const kills = TOTAL - aliveCount();
      const vx = W * 0.105 + kills * 1.5;
      gridX += dir * vx * dt;
      if (dir > 0 && gridX + gridW >= W - 16) {
        gridX = W - 16 - gridW;
        gridY += DROP;
        dir = -1;
      } else if (dir < 0 && gridX <= 16) {
        gridX = 16;
        gridY += DROP;
        dir = 1;
      }
      // enemy fire
      enemyT -= dt;
      if (enemyT <= 0 && enemyShots.length < MAX_ENEMY_SHOTS) {
        dropEnemyShot();
        enemyT = ENEMY_INTERVAL;
      }
      // the 4-note bass march, faster as invaders fall
      marchT -= dt;
      if (marchT <= 0) {
        audio.tone(MARCH[marchIdx % MARCH.length], 0.22, { type: "triangle", vol: 0.05 });
        marchIdx++;
        marchT = Math.max(0.24, 0.55 - kills * 0.014);
      }
    }

    // player bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      if (!b) continue; // array may be cleared mid-loop by winGame()
      b.y -= BOLT_SPEED * dt;
      if (b.y < -30) { bolts.splice(i, 1); continue; }
      for (const v of invaders) {
        if (!v.alive) continue;
        const p = invaderXY(v);
        if (overlap(b.x - 3, b.y - 18, 6, 18, p.x, p.y, cellW, cellH)) {
          bolts.splice(i, 1);
          destroyInvader(v);
          break;
        }
      }
    }

    // enemy shots
    for (let i = enemyShots.length - 1; i >= 0; i--) {
      const s = enemyShots[i];
      if (!s) continue; // array may be cleared mid-loop by hitPlayer()
      s.y += ENEMY_SHOT_SPEED * dt;
      if (s.y > H + 20) { enemyShots.splice(i, 1); continue; }
      if (state === "play" && invulnT <= 0 &&
          overlap(s.x - 7, s.y - 7, 14, 14, shipX - 22, shipY - 18, 44, 36)) {
        enemyShots.splice(i, 1);
        hitPlayer();
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) { rings.splice(i, 1); continue; }
    }
  }

  /* ---------- input: one interaction, drag anywhere ---------- */

  function steer(x) {
    targetX = Math.max(40, Math.min(W - 40, x));
    hasDragged = true;
  }

  function onTap(e) {
    if (state === "over" || state === "win") {
      reset(); // tap anywhere to play again
      return;
    }
    steer(e.clientX);
  }
  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("pointermove", function (e) {
    if (e.buttons > 0) steer(e.clientX);
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });


  /* ---------- drawing ---------- */

  function drawBitmap(map, cxp, cyp, px, hue, glow) {
    const w = map[0].length * px, h = map.length * px;
    const x0 = cxp - w / 2, y0 = cyp - h / 2;
    ctx.save();
    ctx.shadowColor = "hsl(" + hue + ", 95%, 60%)";
    ctx.shadowBlur = glow == null ? 14 : glow;
    ctx.fillStyle = "hsl(" + hue + ", 90%, 60%)";
    for (let r = 0; r < map.length; r++) {
      const row = map[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === "X") ctx.fillRect(Math.round(x0 + c * px), Math.round(y0 + r * px), px + 0.5, px + 0.5);
      }
    }
    ctx.restore();
  }

  function drawShip() {
    const bob = hasDragged ? 0 : Math.sin(time * 2.4) * 6;
    if (invulnT > 0 && ((time * 12) | 0) % 2 === 0) return; // blink while invulnerable
    drawBitmap(SPR.ship, shipX, shipY + bob, spx, 190, 22);
    // engine glow
    ctx.save();
    ctx.fillStyle = "hsla(45, 100%, 60%, 0.85)";
    ctx.shadowColor = "hsl(45, 100%, 55%)";
    ctx.shadowBlur = 16;
    const fl = 8 + Math.sin(time * 30) * 3;
    ctx.beginPath();
    ctx.moveTo(shipX - 7, shipY + 18 + bob);
    ctx.lineTo(shipX + 7, shipY + 18 + bob);
    ctx.lineTo(shipX, shipY + 18 + bob + fl + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawInvaders() {
    const frame = ((waddleT / 0.4) | 0) % 2;
    for (const v of invaders) {
      if (!v.alive) continue;
      const p = invaderXY(v);
      const map = SPR[v.type + (frame === 0 ? "A" : "B")];
      drawBitmap(map, p.x + cellW / 2, p.y + cellH / 2, ipx, v.hue, 12);
    }
  }

  function drawBolts() {
    for (const b of bolts) {
      ctx.save();
      ctx.shadowColor = "hsl(190, 100%, 65%)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#eafcff";
      ctx.fillRect(b.x - 3, b.y - 18, 6, 18);
      ctx.restore();
    }
  }

  function drawEnemyShots() {
    for (const s of enemyShots) {
      const pulse = 1 + Math.sin(time * 10 + s.x) * 0.15;
      ctx.save();
      ctx.shadowColor = "hsl(315, 100%, 60%)";
      ctx.shadowBlur = 18;
      const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 8 * pulse);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, "hsl(315, 100%, 62%)");
      g.addColorStop(1, "hsla(315, 95%, 45%, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8 * pulse, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawShields() {
    // 3 small ship icons, top-left — no text
    for (let i = 0; i < 3; i++) {
      const x = 34 + i * 40, y = 34;
      ctx.save();
      if (i >= shields) ctx.globalAlpha = 0.22; // lost shields go dim
      drawBitmap(SPR.ship, x, y, 1.8, 190, 8);
      ctx.restore();
    }
  }

  function drawReplay() {
    // big pulsing circular replay arrow — no reading
    const cxp = W / 2, cyp = H / 2;
    const pulse = 1 + Math.sin(time * 4) * 0.07;
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = "#eafcff";
    ctx.shadowColor = "hsl(190, 100%, 60%)";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 34, -0.6, 5.2);
    ctx.stroke();
    // arrowhead
    const ax = Math.cos(5.2) * 34, ay = Math.sin(5.2) * 34;
    ctx.fillStyle = "#eafcff";
    ctx.beginPath();
    ctx.moveTo(ax + 16, ay - 4);
    ctx.lineTo(ax - 6, ay - 12);
    ctx.lineTo(ax - 2, ay + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 12 * shakeT, (Math.random() - 0.5) * 12 * shakeT);
    }

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b0b16");
    bg.addColorStop(1, "#0a0a13");
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    for (const s of stars) {
      const a = 0.25 + Math.abs(Math.sin(time * 0.8 + s.tw)) * 0.5;
      ctx.fillStyle = "rgba(160,200,255," + a.toFixed(2) + ")";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    drawInvaders();
    drawBolts();
    drawEnemyShots();
    drawShip();

    // particles
    for (const p of particles) {
      const k = 1 - p.t / p.life;
      ctx.fillStyle = "hsla(" + p.hue + ",95%,65%," + k.toFixed(2) + ")";
      const r = p.r * k + 0.5;
      ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
    }
    // rings
    for (const r of rings) {
      const k = r.t / r.life;
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,65%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 70, 0, 6.2832);
      ctx.stroke();
    }

    // score — big pixel numerals, top-center
    if (score > 0) {
      drawPixelNumber(ctx, score, W / 2, 34, 6, "#ffe14d", true);
    }
    drawShields();

    // CRT scanlines
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(-20, y, W + 40, 1);
    }

    // win flash
    if (flashT > 0) {
      ctx.fillStyle = "rgba(255,255,255," + (flashT * 0.7).toFixed(3) + ")";
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    ctx.restore();

    // game-over / win overlay (no shake here)
    if (state === "over" || state === "win") {
      ctx.fillStyle = "rgba(5,5,12,0.72)";
      ctx.fillRect(0, 0, W, H);
      drawReplay();
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

  // Wrap the kill-chime / laser / march / explosion calls so the
  // test harness can count them (transparent in production).
  const _tone = audio.tone.bind(audio);
  audio.tone = function (freq, dur, opts) {
    if (freq === 880 && dur === 0.12) boltTotal++;
    if (MARCH.indexOf(freq) >= 0 && dur === 0.22) marchLog.push(freq);
    if (PENTA.indexOf(freq) >= 0 && dur === 0.15) chimeLog.push(freq);
    return _tone(freq, dur, opts);
  };
  const _noise = audio.noise.bind(audio);
  audio.noise = function (dur, opts) {
    noiseLog.push(dur);
    return _noise(dur, opts);
  };

  // Test hook: drives the game without a real browser.
  window.__starGuardTest = {
    drag: function (x) { steer(x); },
    tap: function (x, y) { onTap({ clientX: x, clientY: y }); },
    tick: function (dt) { time += dt; update(dt); draw(); },
    shipX: function () { return shipX; },
    state: function () { return state; },
    score: function () { return score; },
    shields: function () { return shields; },
    invaderCount: function () { return aliveCount(); },
    boltsFired: function () { return boltTotal; },
    boltsLive: function () { return bolts.length; },
    dir: function () { return dir; },
    gridY: function () { return gridY; },
    invuln: function () { return invulnT > 0; },
    flash: function () { return flashT > 0; },
    shaking: function () { return shakeT > 0; },
    marchNotes: function () { return marchLog.length; },
    killChimes: function () { return chimeLog.length; },
    noiseBursts: function () { return noiseLog.length; },
    firstInvaderX: function () {
      for (const v of invaders) {
        if (v.alive) { const p = invaderXY(v); return p.x + cellW / 2; }
      }
      return null;
    },
    aim: function () {
      const x = this.firstInvaderX();
      if (x != null) { shipX = x; targetX = x; }
    },
    killOne: function () {
      for (const v of invaders) {
        if (v.alive) { destroyInvader(v); return; }
      }
    },
    dropShotOnShip: function () {
      enemyShots.push({ x: shipX, y: shipY - 40 });
    },
    clearShots: function () { enemyShots.length = 0; },
    setGridX: function (x) { gridX = x; },
  };

  resize();
  reset();
  requestAnimationFrame(frame);
})();
