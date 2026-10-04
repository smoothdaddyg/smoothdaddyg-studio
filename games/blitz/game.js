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
  var BASE_COUNT = 6;

  /* ---------------- state ---------------- */
  var state = "play";        // play | win | over
  var scroll = 0, worldW = 0;
  var plane = { y: 0, vy: 0, tilt: 0 };
  var planeX = 0, groundY = 0;
  var bullets = [], bombs = [], enemies = [], parts = [], clouds = [];
  var bases = [];
  var score = 0, shown = 0;
  var shields = MAX_SHIELDS;
  var invuln = 0, fireCd = 0, bombCd = 0, puttT = 0, enemyT = 2;
  var shake = 0, winT = 0, overT = 0;
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
  function baseShape(i) {
    // A few chunky ground-target silhouettes, cycled.
    var kinds = ["hangar", "tank", "tower", "tent", "tank", "hangar"];
    return kinds[i % kinds.length];
  }

  function resetBases() {
    bases = [];
    for (var i = 0; i < BASE_COUNT; i++) {
      // Spread around the loop, never under the spawn runway.
      var wx = worldW * ((i + 0.6) / BASE_COUNT);
      bases.push({ wx: wx, kind: baseShape(i), alive: true, wob: Math.random() * 6.28 });
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
    scroll = 0; bullets = []; bombs = []; enemies = []; parts = [];
    shields = MAX_SHIELDS; invuln = 0; fireCd = 0; bombCd = 0;
    shake = 0; winT = 0; overT = 0; steerId = null; btnPointers = {}; fireHeld = false;
    plane.y = groundY - H * 0.35; plane.vy = 0; plane.tilt = 0;
    resetBases();
    if (full) { score = 0; shown = 0; }
    state = "play";
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
    if (state !== "play") { reset(state === "win" ? true : false); e.preventDefault(); return; }
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

  var muteBtn = document.getElementById("muteBtn");
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    muteBtn.style.opacity = audio.toggleMute() ? "0.35" : "1";
  });

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
      plane.y = Math.min(plane.y, groundY - 160);
      plane.vy = 0;
    }
  }

  function checkWin() {
    for (var i = 0; i < bases.length; i++) if (bases[i].alive) return;
    state = "win"; winT = 0;
    audio.arp([523, 659, 784, 1047, 1319], 0.1, "square", 0.14);
    for (var j = 0; j < 90; j++) {
      parts.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
        life: 2.5, t: 0,
        c: ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb"][j % 5],
        r: 3 + Math.random() * 4, confetti: true
      });
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
      if (plane.y > groundY - 26) {
        // kissed the dirt — forgiving bounce, costs a shield
        plane.y = groundY - 26;
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
          if (Math.abs(b.x - sx) < 34 && b.y > groundY - 70) {
            killBase(bs); bullets.splice(i, 1); hit = true; break;
          }
        }
        if (hit) continue;
      }

      // bombs
      for (var k = bombs.length - 1; k >= 0; k--) {
        var bo = bombs[k];
        bo.vy += GRAV * dt;
        bo.y += bo.vy * dt;
        if (bo.y >= groundY - 6) {
          bombs.splice(k, 1);
          explode(bo.x, groundY - 10, true);
          for (var q = 0; q < bases.length; q++) {
            var qb = bases[q];
            if (!qb.alive) continue;
            if (Math.abs(wrapX(qb.wx) - bo.x) < BLAST_R) killBase(qb);
          }
        }
      }

      // enemy planes drift in from the right
      enemyT -= dt;
      if (enemyT <= 0) {
        enemyT = 2.2 + Math.random() * 2.4;
        enemies.push({
          x: W + 60, y: 90 + Math.random() * (groundY - 220),
          vx: -(120 + Math.random() * 90), wob: Math.random() * 6.28
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
          hurt();
        }
      }

      // score eases up to its target (the count-up reward)
      if (shown < score) shown = Math.min(score, shown + Math.ceil((score - shown) * dt * 6) + 1);
    }

    if (state === "win") { winT += dt; if (shown < score) shown = Math.min(score, shown + 7); }
    if (state === "over") { overT += dt; }

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
      clouds[c].x -= clouds[c].v * dt;
      if (clouds[c].x < -120) { clouds[c].x = W + 120; clouds[c].y = Math.random() * H * 0.5; }
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
  }

  function killBase(bs) {
    if (!bs.alive) return;
    bs.alive = false;
    var sx = wrapX(bs.wx);
    explode(sx, groundY - 26, true);
    addScore(500);
    audio.arp([659, 880], 0.07, "square", 0.12);
    checkWin();
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
    if (!bs.alive) {
      // smoldering rubble
      ctx.fillStyle = "#4a4a4a";
      ctx.fillRect(sx - 24, groundY - 12, 48, 12);
      if (Math.random() < 0.25) {
        parts.push({ x: sx + (Math.random() - 0.5) * 30, y: groundY - 14, vx: 0, vy: -40, life: 0.8, t: 0, c: "#999", r: 3 });
      }
      return;
    }
    var wob = Math.sin(bs.wob += 0.02) * 2;
    ctx.save();
    ctx.translate(sx, groundY);
    if (bs.kind === "hangar") {
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

    // sky
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#5aa7d6"); g.addColorStop(0.7, "#aee3f5"); g.addColorStop(1, "#d8f3dc");
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);

    // sun
    ctx.fillStyle = "#ffdf5e";
    ctx.beginPath(); ctx.arc(W - 90, 90, 40, 0, 6.29); ctx.fill();
    ctx.fillStyle = "rgba(255,223,94,0.3)";
    ctx.beginPath(); ctx.arc(W - 90, 90, 58, 0, 6.29); ctx.fill();

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

    // distant hills (parallax)
    ctx.fillStyle = "#8fce8f";
    ctx.beginPath(); ctx.moveTo(-20, groundY);
    for (var hx = -20; hx <= W + 20; hx += 40) {
      var hh = 40 + 30 * Math.sin((hx + scroll * 0.3) / 160);
      ctx.lineTo(hx, groundY - hh);
    }
    ctx.lineTo(W + 20, groundY); ctx.closePath(); ctx.fill();

    // ground
    ctx.fillStyle = "#7cb342";
    ctx.fillRect(-20, groundY, W + 40, H - groundY + 20);
    ctx.fillStyle = "#689f38";
    ctx.fillRect(-20, groundY, W + 40, 10);
    // runway dashes scroll by
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    var dashOff = scroll % 120;
    for (var dx = -dashOff; dx < W; dx += 120) ctx.fillRect(dx, groundY + 44, 56, 7);

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

    // enemies
    for (var e = 0; e < enemies.length; e++) {
      drawBiplane(enemies[e].x, enemies[e].y, Math.sin(enemies[e].wob) * 0.15, "#455a64", true);
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

    // HUD
    // shields: little planes top-left
    for (var s = 0; s < MAX_SHIELDS; s++) {
      ctx.globalAlpha = s < shields ? 1 : 0.22;
      drawMiniPlane(30 + s * 44, 34, s < shields ? "#d32f2f" : "#90a4ae");
    }
    ctx.globalAlpha = 1;
    // bases remaining: target dots top-right
    var left = 0;
    for (var q = 0; q < bases.length; q++) if (bases[q].alive) left++;
    for (var r = 0; r < BASE_COUNT; r++) {
      var bx = W - 30 - r * 30;
      ctx.fillStyle = r < left ? "#ff1744" : "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.arc(bx, 34, 9, 0, 6.29); ctx.fill();
      if (r < left) {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(bx, 34, 3.5, 0, 6.29); ctx.fill();
      }
    }
    // score, count-up
    drawPixelNumber(ctx, shown, W / 2, 30, 5, "#ffffff", true);

    // buttons (mirrored pairs)
    roundBtn(zones.fireL, 0, "fire"); roundBtn(zones.fireR, 0, "fire");
    roundBtn(zones.bombL, 0, "bomb"); roundBtn(zones.bombR, 0, "bomb");

    // overlays
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
      wrapX: wrapX, zoneAt: zoneAt, inZone: inZone,
      audioState: function () { return audio.state(); },
      _set: function (o) {
        if (o.scroll != null) scroll = o.scroll;
        if (o.worldW != null) worldW = o.worldW;
        if (o.W != null) W = o.W;
      },
      _zones: zones
    };
  }
})();
