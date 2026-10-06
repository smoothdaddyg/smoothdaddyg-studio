/* ============================================================
   BIPLANE BLITZ — SmoothDaddyG
   A Sopwith-spirited sky run for one finger (or two).
   Your little red biplane always flies forward — the world
   scrolls by. Touch ABOVE the plane to climb, BELOW it to
   dive. Big buttons on BOTH sides (either hand): FIRE shoots
   the machine gun, BOMB drops a bomb. Blow up all 6 ground
   bases to win. 3 shields. No reading required.
   ============================================================ */

(function () {
  "use strict";

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var audio = makeAudio();

  var W = 0, H = 0, DPR = 1;

  /* ---------------- tuning ---------------- */
  var SCROLL = 130;          // world speed, px/sec (plane's forward speed)
  var CLIMB = -260, DIVE = 300;
  var DEADZONE = 26;         // px around plane y that means "level"
  var GUN_VX = 520;          // bullet screen speed (muzzle velocity)
  var FIRE_CD = 0.22;        // seconds between shots
  var BOMB_CD = 0.9;
  var GRAV = 900;
  var BLAST_R = 70;          // bomb blast radius
  var MAX_SHIELDS = 3;
  var INVULN = 1.6;
  var WORLD_SCREENS = 3;     // world width in screens, wraps around
  var LEVELS = 5;
  var WEATHERS = ["sunny", "cloud", "wind", "rain", "storm"];
  var ENEMY_COLORS = ["#455a64", "#607d8b", "#37474f", "#263238", "#15151f"];

  /* ---------------- state ---------------- */
  var state = "play";        // play | levelup | win | over
  var level = 1, baseCount = 6, weather = "sunny";
  var scroll = 0, worldW = 0;
  var plane = { y: 0, vy: 0, tilt: 0 };
  var planeX = 0, groundY = 0;
  var bullets = [], bombs = [], enemies = [], parts = [], clouds = [], rainDrops = [];
  var bases = [];
  var score = 0, shown = 0;
  var shields = MAX_SHIELDS;
  var invuln = 0, fireCd = 0, bombCd = 0, puttT = 0, enemyT = 2;
  var shake = 0, winT = 0, overT = 0, levelupT = 0, introT = 0;
  var flash = 0, boltT = 3;  // lightning
  var ambient = null;        // looping weather sound bed
  var steerId = null, steerY = 0;
  var btnPointers = {};      // pointerId -> "fire" | "bomb" (held autofire)
  var fireHeld = false;

  /* Button zones, recomputed on resize: mirrored pairs. */
  var BTN = { size: 76, gap: 14, margin: 16 };
  var zones = { fireL: null, fireR: null, bombL: null, bombR: null };

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    planeX = Math.round(W * 0.32);
    groundY = H - 120;
    worldW = W * WORLD_SCREENS;
    if (!plane.y) plane.y = groundY - H * 0.35;
    plane.y = Math.min(plane.y, groundY - 30);
    var s = Math.min(84, Math.max(64, W * 0.09));
    BTN.size = s;
    zones.fireL = { x: BTN.margin, y: H - BTN.margin - s, s: s };
    zones.fireR = { x: W - BTN.margin - s, y: H - BTN.margin - s, s: s };
    zones.bombL = { x: BTN.margin, y: H - BTN.margin - s * 2 - BTN.gap, s: s };
    zones.bombR = { x: W - BTN.margin - s, y: H - BTN.margin - s * 2 - BTN.gap, s: s };
    seedClouds();
  }

  /* ---------------- world ---------------- */
  // Rolling hills: periodic in worldW so the loop joins seamlessly.
  function groundAt(wx) {
    var t = wx / worldW * Math.PI * 2;
    return groundY + Math.sin(t * 3 + 1.3) * 26 + Math.sin(t * 7 + 4.1) * 14;
  }

  // Nudge a base into the nearest valley so shelters nestle between hills.
  function nestle(wx) {
    var best = wx, bestG = groundAt(wx);
    for (var d = -180; d <= 180; d += 18) {
      var g = groundAt(wx + d);
      if (g > bestG) { bestG = g; best = wx + d; }
    }
    return ((best % worldW) + worldW) % worldW;
  }

  // How often a concrete bunker appears: tougher as levels rise.
  function concreteEvery() {
    return Math.max(2, 5 - level);
  }

  function baseShape(i) {
    // A few chunky ground-target silhouettes, cycled.
    var kinds = ["hangar", "tank", "tower", "tent", "tank", "hangar"];
    return kinds[i % kinds.length];
  }

  function resetBases() {
    bases = [];
    var ce = concreteEvery();
    for (var i = 0; i < baseCount; i++) {
      // Spread around the loop, never under the spawn runway.
      var wx = nestle(worldW * ((i + 0.6) / baseCount));
      var concrete = (i % ce === ce - 1);
      bases.push({
        wx: wx, kind: concrete ? "bunker" : baseShape(i),
        alive: true, wob: Math.random() * 6.28,
        hp: concrete ? 3 : 1, maxHp: concrete ? 3 : 1
      });
    }
  }

  function seedClouds() {
    clouds = [];
    var n = Math.max(6, Math.floor(W / 160));
    for (var i = 0; i < n; i++) {
      clouds.push({
        x: Math.random() * W, y: Math.random() * H * 0.5,
        s: 0.6 + Math.random() * 0.9, v: 12 + Math.random() * 20
      });
    }
  }

  function reset(full) {
    scroll = 0; bullets = []; bombs = []; enemies = []; parts = []; rainDrops = [];
    shields = MAX_SHIELDS; invuln = 0; fireCd = 0; bombCd = 0;
    shake = 0; winT = 0; overT = 0; levelupT = 0; flash = 0;
    steerId = null; btnPointers = {}; fireHeld = false;
    plane.y = groundY - H * 0.35; plane.vy = 0; plane.tilt = 0;
    if (full) { score = 0; shown = 0; level = 1; }
    startLevel();
  }

  function startLevel() {
    baseCount = 5 + level;          // 6, 7, 8, 9, 10 targets
    weather = WEATHERS[level - 1];  // sunny -> cloud -> wind -> rain -> storm
    stopAmbient();
    resetBases();
    shields = MAX_SHIELDS; invuln = 0;
    rainDrops = []; flash = 0; boltT = 2 + Math.random() * 3;
    enemyT = 2;
    introT = 1.8;
    startAmbient();
    state = "play";
  }

  /* Weather sound beds: rain patter, wind whistle, soft cloudy breeze. */
  function startAmbient() {
    var opts = null;
    if (weather === "rain" || weather === "storm") {
      opts = { loop: true, filter: "bandpass", freq: 2800, Q: 0.5, vol: weather === "storm" ? 0.1 : 0.06, attack: 1.5 };
    } else if (weather === "wind") {
      opts = { loop: true, filter: "bandpass", freq: 500, Q: 1.2, vol: 0.05, attack: 1.5 };
    } else if (weather === "cloud") {
      opts = { loop: true, filter: "lowpass", freq: 380, vol: 0.03, attack: 1.5 };
    }
    if (opts) ambient = audio.noise(4, opts);
  }

  function stopAmbient() {
    var h = ambient; ambient = null;
    if (!h) return;
    try {
      var t = h.ctx.currentTime;
      h.gain.gain.setTargetAtTime(0.0001, t, 0.3);
      setTimeout(function () { try { h.src.stop(); } catch (e) {} }, 1300);
    } catch (e) {}
  }

  function wrapX(wx) {
    var x = (wx - scroll) % worldW;
    if (x < 0) x += worldW;
    return x;
  }

  /* ---------------- input ---------------- */
  function inZone(z, x, y) {
    return x >= z.x && x <= z.x + z.s && y >= z.y && y <= z.y + z.s;
  }

  function zoneAt(x, y) {
    if (inZone(zones.fireL, x, y) || inZone(zones.fireR, x, y)) return "fire";
    if (inZone(zones.bombL, x, y) || inZone(zones.bombR, x, y)) return "bomb";
    return null;
  }

  function onDown(e) {
    audio.unlock && audio.unlock();
    var x = e.clientX, y = e.clientY;
    if (state === "win" || state === "over") { reset(state === "win"); e.preventDefault(); return; }
    if (state === "levelup") { e.preventDefault(); return; }
    var z = zoneAt(x, y);
    if (z) {
      btnPointers[e.pointerId] = z;
      if (z === "fire") { fireHeld = true; tryFire(); }
      else tryBomb();
    } else if (steerId === null) {
      steerId = e.pointerId; steerY = y;
    }
    e.preventDefault();
  }

  function onMove(e) {
    if (e.pointerId === steerId) steerY = e.clientY;
  }

  function onUp(e) {
    if (e.pointerId === steerId) steerId = null;
    var z = btnPointers[e.pointerId];
    if (z) {
      delete btnPointers[e.pointerId];
      if (z === "fire") {
        fireHeld = false;
        for (var k in btnPointers) if (btnPointers[k] === "fire") fireHeld = true;
      }
    }
  }

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", resize);


  /* ---------------- actions ---------------- */
  function tryFire() {
    if (fireCd > 0 || state !== "play") return;
    fireCd = FIRE_CD;
    bullets.push({ x: planeX + 34, y: plane.y - 2 });
    audio.noise(0.09, { filter: "highpass", freq: 2400, vol: 0.16 });
    audio.tone(880, 0.06, { type: "square", vol: 0.07, slideTo: 440 });
  }

  function tryBomb() {
    if (bombCd > 0 || state !== "play") return;
    bombCd = BOMB_CD;
    bombs.push({ x: planeX + 6, y: plane.y + 14, vy: 40 });
    audio.tone(1200, 0.7, { type: "sine", vol: 0.08, slideTo: 280 });
  }

  function explode(x, y, big) {
    var n = big ? 26 : 14;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, sp = 60 + Math.random() * (big ? 320 : 200);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        life: 0.5 + Math.random() * 0.7, t: 0,
        c: ["#ffdd55", "#ff9933", "#ff5522", "#666666"][Math.floor(Math.random() * 4)],
        r: 3 + Math.random() * (big ? 9 : 6)
      });
    }
    audio.noise(big ? 0.7 : 0.35, { filter: "lowpass", freq: 900, vol: 0.4 });
    audio.tone(150, 0.4, { type: "triangle", vol: 0.25, slideTo: 38 });
    shake = Math.max(shake, big ? 10 : 5);
  }

  function addScore(n) { score += n; }

  function hurt() {
    if (invuln > 0 || state !== "play") return;
    shields--; invuln = INVULN;
    explode(planeX, plane.y, false);
    audio.tone(220, 0.3, { type: "sawtooth", vol: 0.2, slideTo: 60 });
    if (shields <= 0) {
      state = "over"; overT = 0;
      explode(planeX, plane.y, true);
      audio.arp([392, 311, 262, 196], 0.16, "triangle", 0.16);
    } else {
      plane.y = Math.min(plane.y, groundAt(scroll + planeX) - 160);
      plane.vy = 0;
    }
  }

  function planeDownSound() {
    // R2-D2-style power-down wail — you really feel this crash.
    audio.arp([740, 622, 523, 440, 349, 262, 196, 147], 0.09, "square", 0.16);
    audio.tone(180, 0.9, { type: "sawtooth", vol: 0.1, when: 0.75, slideTo: 45 });
  }

  function confetti(n) {
    for (var j = 0; j < n; j++) {
      parts.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
        life: 2.5, t: 0,
        c: ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb"][j % 5],
        r: 3 + Math.random() * 4, confetti: true
      });
    }
  }

  function checkWin() {
    for (var i = 0; i < bases.length; i++) if (bases[i].alive) return;
    if (level < LEVELS) {
      state = "levelup"; levelupT = 0;
      audio.arp([523, 659, 784, 1047], 0.1, "square", 0.14);
      confetti(70);
    } else {
      state = "win"; winT = 0;
      audio.arp([523, 659, 784, 1047, 1319], 0.1, "square", 0.14);
      confetti(90);
    }
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    // engine putt-putt, very Sopwith
    if (state === "play") {
      puttT -= dt;
      if (puttT <= 0) {
        puttT = 0.13;
        audio.tone(82 + Math.random() * 8, 0.05, { type: "square", vol: 0.05 });
      }
    }

    if (state === "play") {
      // steering: above plane = climb, below = dive
      var target = 0;
      if (steerId !== null) {
        if (steerY < plane.y - DEADZONE) target = CLIMB;
        else if (steerY > plane.y + DEADZONE) target = DIVE;
      }
      plane.vy += (target - plane.vy) * Math.min(1, dt * 6);
      plane.y += plane.vy * dt;
      plane.tilt += ((plane.vy / 300) * 0.5 - plane.tilt) * Math.min(1, dt * 8);

      var top = 70;
      if (plane.y < top) { plane.y = top; plane.vy = 0; }
      var dirtY = groundAt(scroll + planeX) - 26;
      if (plane.y > dirtY) {
        // kissed the dirt — forgiving bounce, costs a shield
        plane.y = dirtY;
        hurt();
        if (state === "play") { plane.vy = CLIMB * 0.7; }
      }

      scroll = (scroll + SCROLL * dt) % worldW;

      fireCd -= dt; bombCd -= dt; invuln -= dt;
      if (fireHeld) tryFire();

      // bullets
      for (var i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        b.x += GUN_VX * dt;
        if (b.x > W + 20) { bullets.splice(i, 1); continue; }
        // vs enemy planes
        var hit = false;
        for (var e = enemies.length - 1; e >= 0; e--) {
          var en = enemies[e];
          var dx = b.x - en.x, dy = b.y - en.y;
          if (dx * dx + dy * dy < 34 * 34) {
            explode(en.x, en.y, false);
            enemies.splice(e, 1);
            addScore(200);
            hit = true; break;
          }
        }
        if (hit) { bullets.splice(i, 1); continue; }
        // vs ground bases (takes a few hits)
        for (var bi = 0; bi < bases.length; bi++) {
          var bs = bases[bi];
          if (!bs.alive) continue;
          var sx = wrapX(bs.wx);
          if (Math.abs(b.x - sx) < 34 && b.y > groundAt(bs.wx) - 70) {
            hitBase(bs); bullets.splice(i, 1); hit = true; break;
          }
        }
        if (hit) continue;
      }

      // bombs
      for (var k = bombs.length - 1; k >= 0; k--) {
        var bo = bombs[k];
        bo.vy += GRAV * dt;
        bo.y += bo.vy * dt;
        var bgy = groundAt(scroll + bo.x);
        if (bo.y >= bgy - 6) {
          bombs.splice(k, 1);
          explode(bo.x, bgy - 10, true);
          for (var q = 0; q < bases.length; q++) {
            var qb = bases[q];
            if (!qb.alive) continue;
            if (Math.abs(wrapX(qb.wx) - bo.x) < BLAST_R) hitBase(qb);
          }
        }
      }

      // enemy planes drift in from the right — faster and meaner each level
      enemyT -= dt;
      if (enemyT <= 0) {
        var diff = 1 + (level - 1) * 0.28;
        enemyT = (2.2 + Math.random() * 2.4) / diff;
        enemies.push({
          x: W + 60, y: 90 + Math.random() * (groundY - 220),
          vx: -(120 + Math.random() * 90) * diff, wob: Math.random() * 6.28
        });
      }
      for (var m = enemies.length - 1; m >= 0; m--) {
        var em = enemies[m];
        em.x += em.vx * dt;
        em.wob += dt * 3;
        em.y += Math.sin(em.wob) * 30 * dt;
        if (em.x < -80) { enemies.splice(m, 1); continue; }
        var pdx = em.x - planeX, pdy = em.y - plane.y;
        if (pdx * pdx + pdy * pdy < 44 * 44) {
          explode(em.x, em.y, false);
          enemies.splice(m, 1);
          addScore(100);
          planeDownSound();
          hurt();
        }
      }

      // weather: rain falls, lightning strikes
      var stormy = (weather === "rain" || weather === "storm");
      if (stormy) {
        var rate = weather === "storm" ? 110 : 50;
        var want = Math.ceil(rate * dt) + 1;
        for (var rd = 0; rd < want; rd++) {
          rainDrops.push({ x: Math.random() * (W + 120), y: -20, v: 700 + Math.random() * 400 });
        }
        boltT -= dt;
        if (boltT <= 0) {
          boltT = weather === "storm" ? 1.5 + Math.random() * 2.5 : 4 + Math.random() * 5;
          flash = 1;
          audio.noise(0.9, { filter: "lowpass", freq: 160, vol: 0.5, when: 0.25 + Math.random() * 0.4 });
        }
      }
      if (flash > 0) flash = Math.max(0, flash - dt * 3);
      var slantV = (weather === "wind" || weather === "storm") ? 220 : 60;
      for (var ri = rainDrops.length - 1; ri >= 0; ri--) {
        var rp = rainDrops[ri];
        rp.y += rp.v * dt;
        rp.x -= slantV * dt;
        if (rp.y > H + 20) rainDrops.splice(ri, 1);
      }

      // score eases up to its target (the count-up reward)
      if (shown < score) shown = Math.min(score, shown + Math.ceil((score - shown) * dt * 6) + 1);
    }

    if (state === "win") { winT += dt; if (shown < score) shown = Math.min(score, shown + 7); }
    if (state === "over") { overT += dt; }
    if (state === "levelup") {
      levelupT += dt;
      if (shown < score) shown = Math.min(score, shown + 7);
      if (levelupT > 2.4) { level++; startLevel(); }
    }
    if (introT > 0) introT -= dt;

    // particles always animate
    for (var p = parts.length - 1; p >= 0; p--) {
      var pt = parts[p];
      pt.t += dt;
      if (pt.t >= pt.life) { parts.splice(p, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (!pt.confetti) pt.vy += 500 * dt;
      pt.vx *= (1 - dt * 1.5);
    }
    for (var c = 0; c < clouds.length; c++) {
      var windMul = (weather === "wind" || weather === "storm") ? 2.6 : 1;
      clouds[c].x -= clouds[c].v * windMul * dt;
      if (clouds[c].x < -120) { clouds[c].x = W + 120; clouds[c].y = Math.random() * H * 0.5; }
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
  }

  // Bombs and bullets wear a base down; concrete bunkers take 3 hits,
  // crumbling a little more each time until the last one flattens it.
  function hitBase(bs) {
    if (!bs.alive) return;
    bs.hp--;
    var sx = wrapX(bs.wx), gy = groundAt(bs.wx);
    if (bs.hp <= 0) {
      bs.alive = false;
      explode(sx, gy - 26, true);
      addScore(500);
      audio.arp([659, 880], 0.07, "square", 0.12);
      checkWin();
    } else {
      explode(sx, gy - 26, false);
      addScore(200);
      audio.tone(140, 0.18, { type: "square", vol: 0.16, slideTo: 80 });
    }
  }

  /* ---------------- draw ---------------- */
  function drawBiplane(x, y, tilt, body, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.rotate(tilt);
    // fuselage
    ctx.fillStyle = body;
    ctx.fillRect(-26, -6, 52, 12);
    // nose + prop
    ctx.fillStyle = "#333";
    ctx.fillRect(26, -8, 6, 16);
    var pr = 16 + Math.sin(performance.now() / 28) * 4;
    ctx.fillStyle = "rgba(60,60,60,0.55)";
    ctx.fillRect(31, -pr, 4, pr * 2);
    // top + bottom wings
    ctx.fillStyle = shade(body, -24);
    ctx.fillRect(-10, -22, 26, 7);
    ctx.fillRect(-10, 8, 26, 7);
    // struts
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(-4, -15, 3, 23);
    ctx.fillRect(8, -15, 3, 23);
    // tail
    ctx.fillStyle = shade(body, -24);
    ctx.fillRect(-32, -14, 10, 7);
    ctx.fillRect(-32, -5, 6, 12);
    // cockpit
    ctx.fillStyle = "#b3e5fc";
    ctx.fillRect(2, -10, 10, 6);
    // wheels
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(-2, 14, 5, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(12, 14, 5, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawBase(bs, sx) {
    var gy = groundAt(bs.wx);
    if (!bs.alive) {
      // smoldering rubble
      ctx.fillStyle = "#4a4a4a";
      ctx.fillRect(sx - 24, gy - 12, 48, 12);
      if (Math.random() < 0.25) {
        parts.push({ x: sx + (Math.random() - 0.5) * 30, y: gy - 14, vx: 0, vy: -40, life: 0.8, t: 0, c: "#999", r: 3 });
      }
      return;
    }
    var wob = Math.sin(bs.wob += 0.02) * 2;
    ctx.save();
    ctx.translate(sx, gy);
    if (bs.kind === "bunker") {
      // concrete bunker: 3 hits, crumbles a stage at a time
      var dmg = bs.maxHp - bs.hp;
      ctx.fillStyle = dmg >= 2 ? "#757575" : "#a8a8a8";
      if (dmg >= 2) {
        ctx.beginPath(); ctx.arc(-6, 2, 26, Math.PI * 1.05, -0.15); ctx.fill();
        ctx.fillStyle = "#616161";
        ctx.fillRect(8, -14, 14, 10);
        ctx.fillRect(-32, -8, 10, 8);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, 30, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#8a8a8a";
        ctx.fillRect(-30, -4, 60, 6);
      }
      // firing slit
      ctx.fillStyle = "#212121";
      ctx.fillRect(-18, -18, 36, 7);
      if (dmg >= 1) {
        ctx.strokeStyle = "#424242"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, -28); ctx.lineTo(-6, -16); ctx.lineTo(-10, -6);
        ctx.moveTo(8, -29); ctx.lineTo(14, -18); ctx.lineTo(10, -8);
        if (dmg >= 2) ctx.moveTo(0, -28); ctx.lineTo(-2, -14);
        ctx.stroke();
      }
      if (dmg >= 2 && Math.random() < 0.3) {
        parts.push({ x: sx + (Math.random() - 0.5) * 30, y: gy - 30, vx: 0, vy: -50, life: 0.9, t: 0, c: "#777", r: 4 });
      }
    } else if (bs.kind === "hangar") {
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(-30, -34, 60, 34);
      ctx.fillStyle = "#6d4c41";
      ctx.beginPath(); ctx.moveTo(-34, -34); ctx.lineTo(0, -50); ctx.lineTo(34, -34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(-16, -26, 32, 26);
    } else if (bs.kind === "tank") {
      ctx.fillStyle = "#b0bec5";
      ctx.beginPath(); ctx.ellipse(0, -20, 24, 20, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#78909c";
      ctx.fillRect(-24, -20, 48, 20);
      ctx.fillStyle = "#ef5350";
      ctx.fillRect(-24, -12 + wob * 0.3, 48, 6);
    } else if (bs.kind === "tower") {
      ctx.fillStyle = "#616161";
      ctx.fillRect(-6, -64, 12, 64);
      ctx.fillStyle = "#ef5350";
      ctx.beginPath(); ctx.arc(0, -66, 9, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#9e9e9e"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -66, 16 + wob, 0, 6.29); ctx.stroke();
    } else { // tent
      ctx.fillStyle = "#a5d6a7";
      ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(0, -36); ctx.lineTo(28, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#66bb6a";
      ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(0, -36); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    }
    // little warning beacon
    ctx.fillStyle = (Math.floor(performance.now() / 400) % 2) ? "#ff1744" : "#7f0000";
    ctx.beginPath(); ctx.arc(0, -58, 4, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  function roundBtn(z, label, icon) {
    var active = false;
    for (var k in btnPointers) { /* pressed look if any pointer holds this kind */ }
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#263238";
    roundRect(z.x, z.y, z.s, z.s, 16); ctx.fill();
    ctx.strokeStyle = "#ffd740"; ctx.lineWidth = 3;
    roundRect(z.x, z.y, z.s, z.s, 16); ctx.stroke();
    var cx = z.x + z.s / 2, cy = z.y + z.s / 2;
    if (icon === "fire") {
      ctx.fillStyle = "#ffd740";
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 14 - 5, cy + 12);
        ctx.lineTo(cx + i * 14 - 5, cy - 4);
        ctx.lineTo(cx + i * 14, cy - 12);
        ctx.lineTo(cx + i * 14 + 5, cy - 4);
        ctx.lineTo(cx + i * 14 + 5, cy + 12);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = "#40c4ff";
      ctx.beginPath(); ctx.arc(cx, cy - 2, 11, 0, 6.29); ctx.fill();
      ctx.fillRect(cx - 4, cy + 6, 8, 12);
      ctx.fillStyle = "#ffd740";
      ctx.fillRect(cx - 9, cy + 16, 18, 4);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // sky, tinted by the weather
    var skyTop = "#5aa7d6", skyMid = "#aee3f5", skyBot = "#d8f3dc";
    if (weather === "cloud") { skyTop = "#7d9db5"; skyMid = "#b9cdd8"; skyBot = "#dfe8ea"; }
    else if (weather === "wind") { skyTop = "#6b93ad"; skyMid = "#a9c3d4"; skyBot = "#d5e2e6"; }
    else if (weather === "rain") { skyTop = "#4a5d70"; skyMid = "#7d8fa3"; skyBot = "#a9b7c2"; }
    else if (weather === "storm") { skyTop = "#2e3a48"; skyMid = "#566274"; skyBot = "#7a8794"; }
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, skyTop); g.addColorStop(0.7, skyMid); g.addColorStop(1, skyBot);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);

    // sun only shows on a sunny day
    if (weather === "sunny") {
      ctx.fillStyle = "#ffdf5e";
      ctx.beginPath(); ctx.arc(W - 90, 90, 40, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(255,223,94,0.3)";
      ctx.beginPath(); ctx.arc(W - 90, 90, 58, 0, 6.29); ctx.fill();
    }

    // clouds
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (var i = 0; i < clouds.length; i++) {
      var cl = clouds[i], s = cl.s;
      ctx.beginPath();
      ctx.arc(cl.x, cl.y, 26 * s, 0, 6.29);
      ctx.arc(cl.x + 24 * s, cl.y + 6 * s, 20 * s, 0, 6.29);
      ctx.arc(cl.x - 24 * s, cl.y + 8 * s, 18 * s, 0, 6.29);
      ctx.fill();
    }

    // rain streaks
    if (rainDrops.length) {
      ctx.strokeStyle = "rgba(174,194,224,0.55)";
      ctx.lineWidth = 2;
      var slant = (weather === "storm") ? -14 : -4;
      ctx.beginPath();
      for (var ri = 0; ri < rainDrops.length; ri++) {
        var rp2 = rainDrops[ri];
        ctx.moveTo(rp2.x, rp2.y);
        ctx.lineTo(rp2.x + slant, rp2.y + 30);
      }
      ctx.stroke();
    }

    // distant hills (parallax)
    ctx.fillStyle = "#8fce8f";
    ctx.beginPath(); ctx.moveTo(-20, groundY);
    for (var hx = -20; hx <= W + 20; hx += 40) {
      var hh = 40 + 30 * Math.sin((hx + scroll * 0.3) / 160);
      ctx.lineTo(hx, groundY - hh);
    }
    ctx.lineTo(W + 20, groundY); ctx.closePath(); ctx.fill();

    // rolling terrain — the ground itself has hills now
    ctx.fillStyle = "#7cb342";
    ctx.beginPath(); ctx.moveTo(-20, H + 20);
    for (var gx = -20; gx <= W + 20; gx += 24) {
      ctx.lineTo(gx, groundAt(scroll + gx));
    }
    ctx.lineTo(W + 20, H + 20); ctx.closePath(); ctx.fill();
    // grassy top edge follows the hills
    ctx.strokeStyle = "#689f38"; ctx.lineWidth = 7;
    ctx.beginPath();
    for (var gx2 = -20; gx2 <= W + 20; gx2 += 24) {
      var gy2 = groundAt(scroll + gx2) + 3;
      if (gx2 === -20) ctx.moveTo(gx2, gy2);
      else ctx.lineTo(gx2, gy2);
    }
    ctx.stroke();

    // bases
    for (var b = 0; b < bases.length; b++) {
      var sx = wrapX(bases[b].wx);
      if (sx > -80 && sx < W + 80) drawBase(bases[b], sx);
    }

    // bombs
    ctx.fillStyle = "#37474f";
    for (var bo = 0; bo < bombs.length; bo++) {
      var bm = bombs[bo];
      ctx.beginPath(); ctx.arc(bm.x, bm.y, 7, 0, 6.29); ctx.fill();
      ctx.fillRect(bm.x - 2, bm.y - 12, 4, 7);
    }

    // bullets
    ctx.fillStyle = "#ffea00";
    for (var bl = 0; bl < bullets.length; bl++) {
      var bu = bullets[bl];
      ctx.fillRect(bu.x - 10, bu.y - 2, 20, 4);
    }

    // enemies — new paint job every level, meaner each time
    for (var e = 0; e < enemies.length; e++) {
      drawBiplane(enemies[e].x, enemies[e].y, Math.sin(enemies[e].wob) * 0.15, ENEMY_COLORS[level - 1], true);
    }

    // player (blink while invulnerable)
    if (!(invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0)) {
      drawBiplane(planeX, plane.y, plane.tilt, "#d32f2f", false);
    }

    // particles
    for (var p = 0; p < parts.length; p++) {
      var pt = parts[p];
      ctx.globalAlpha = 1 - pt.t / pt.life;
      ctx.fillStyle = pt.c;
      if (pt.confetti) {
        ctx.fillRect(pt.x - pt.r / 2, pt.y - pt.r / 4, pt.r, pt.r / 2);
      } else {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * (1 - pt.t / pt.life * 0.5), 0, 6.29); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // steering hint: faint chevrons above/below plane for the first seconds
    if (state === "play" && score === 0 && scroll < W * 1.2) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(performance.now() / 300);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(planeX - 16, plane.y - 64); ctx.lineTo(planeX + 16, plane.y - 64); ctx.lineTo(planeX, plane.y - 84);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(planeX - 16, plane.y + 64); ctx.lineTo(planeX + 16, plane.y + 64); ctx.lineTo(planeX, plane.y + 84);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // lightning flash
    if (flash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + (flash * 0.55).toFixed(3) + ")";
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    // HUD
    // shields: little planes top-left
    for (var s = 0; s < MAX_SHIELDS; s++) {
      ctx.globalAlpha = s < shields ? 1 : 0.22;
      drawMiniPlane(30 + s * 44, 34, s < shields ? "#d32f2f" : "#90a4ae");
    }
    ctx.globalAlpha = 1;
    // level pips under the shields
    for (var lp = 0; lp < LEVELS; lp++) {
      ctx.fillStyle = lp < level ? "#ffd740" : "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(30 + lp * 24, 62, 7, 0, 6.29); ctx.fill();
    }
    // bases remaining: target dots top-right (squares = concrete bunkers)
    for (var r = 0; r < bases.length; r++) {
      var bd = bases[r];
      var bx = W - 30 - r * 30;
      ctx.fillStyle = bd.alive ? "#ff1744" : "rgba(255,255,255,0.3)";
      if (bd.maxHp > 1) {
        ctx.fillRect(bx - 8, 26, 16, 16);
        if (bd.alive && bd.hp < bd.maxHp) {
          // cracked: darker the more hits it has taken
          ctx.fillStyle = "rgba(0,0,0," + (0.35 * (bd.maxHp - bd.hp) / bd.maxHp).toFixed(2) + ")";
          ctx.fillRect(bx - 8, 26, 16, 16);
        }
      } else {
        ctx.beginPath(); ctx.arc(bx, 34, 9, 0, 6.29); ctx.fill();
        if (bd.alive) {
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(bx, 34, 3.5, 0, 6.29); ctx.fill();
        }
      }
    }
    // score, count-up
    drawPixelNumber(ctx, shown, W / 2, 30, 5, "#ffffff", true);

    // level intro banner: big digit, no reading needed
    if (introT > 0 && state === "play") {
      ctx.globalAlpha = Math.min(1, introT);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(16, W * 0.03)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("LEVEL", W / 2, H * 0.38);
      drawPixelNumber(ctx, level, W / 2, H * 0.42, 9, "#ffd740", true);
      ctx.globalAlpha = 1;
    }

    // minimap: the whole field, Sopwith-style, bottom center
    var mw = Math.min(W * 0.4, 380), mh = 30;
    var mx = (W - mw) / 2, my = H - BTN.margin - mh;
    ctx.fillStyle = "rgba(10,10,19,0.72)";
    roundRect(mx, my, mw, mh, 8); ctx.fill();
    ctx.strokeStyle = "rgba(255,215,64,0.55)"; ctx.lineWidth = 2;
    roundRect(mx, my, mw, mh, 8); ctx.stroke();
    var mapX = function (wx) { return mx + (wrapX(wx) / worldW) * mw; };
    for (var mi = 0; mi < bases.length; mi++) {
      var mb = bases[mi];
      ctx.fillStyle = mb.alive ? "#ff1744" : "rgba(255,255,255,0.25)";
      if (mb.maxHp > 1 && mb.alive) {
        // concrete bunker: red square on the map
        ctx.fillRect(mapX(mb.wx) - 3.5, my + mh / 2 - 3.5, 7, 7);
      } else {
        ctx.beginPath(); ctx.arc(mapX(mb.wx), my + mh / 2, mb.alive ? 4 : 3, 0, 6.29); ctx.fill();
      }
    }
    ctx.fillStyle = "#ffab40";
    for (var me = 0; me < enemies.length; me++) {
      ctx.fillRect(mapX(scroll + enemies[me].x) - 2, my + mh / 2 - 2, 4, 4);
    }
    ctx.fillStyle = "#ffffff";
    var pxm = mx + ((((scroll + planeX) % worldW) + worldW) % worldW) / worldW * mw;
    ctx.beginPath();
    ctx.moveTo(pxm, my + 5); ctx.lineTo(pxm - 5, my + mh - 6); ctx.lineTo(pxm + 5, my + mh - 6);
    ctx.closePath(); ctx.fill();

    // buttons (mirrored pairs)
    roundBtn(zones.fireL, 0, "fire"); roundBtn(zones.fireR, 0, "fire");
    roundBtn(zones.bombL, 0, "bomb"); roundBtn(zones.bombR, 0, "bomb");

    // overlays
    if (state === "levelup") {
      ctx.fillStyle = "rgba(20,40,70,0.45)";
      ctx.fillRect(0, 0, W, H);
      drawPixelNumber(ctx, level + 1, W / 2, H * 0.32, 9, "#ffd740", true);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(20, W * 0.035)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("LEVEL UP", W / 2, H * 0.54);
    }
    if (state === "win" || state === "over") {
      ctx.fillStyle = state === "win" ? "rgba(20,60,30,0.55)" : "rgba(40,10,10,0.55)";
      ctx.fillRect(0, 0, W, H);
      drawPixelNumber(ctx, shown, W / 2, H * 0.34, 8, "#ffd740", true);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(22, W * 0.035)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      var msg = state === "win" ? "ALL BASES DOWN!" : "TRY AGAIN";
      ctx.fillText(msg, W / 2, H * 0.52);
      if ((state === "win" ? winT : overT) > 0.8) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 350);
        ctx.font = Math.round(Math.min(14, W * 0.028)) + 'px "Press Start 2P", monospace';
        ctx.fillText("TAP TO FLY AGAIN", W / 2, H * 0.62);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  function drawMiniPlane(x, y, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.fillRect(-14, -3, 28, 6);
    ctx.fillRect(-4, -11, 14, 4);
    ctx.fillRect(-16, -7, 6, 4);
    ctx.restore();
  }

  /* ---------------- main loop ---------------- */
  var last = 0;
  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  reset(true);
  requestAnimationFrame(frame);

  /* Test hook: pure-ish logic for node tests. */
  if (typeof window !== "undefined") {
    window.__blitz = {
      wrapX: wrapX, zoneAt: zoneAt, inZone: inZone, groundAt: groundAt,
      audioState: function () { return audio.state(); },
      levelInfo: function () {
        return { level: level, weather: WEATHERS[level - 1], baseCount: 5 + level, levels: LEVELS, concreteEvery: concreteEvery() };
      },
      _set: function (o) {
        if (o.scroll != null) scroll = o.scroll;
        if (o.worldW != null) worldW = o.worldW;
        if (o.W != null) W = o.W;
        if (o.level != null) level = o.level;
      },
      _zones: zones
    };
  }
})();
