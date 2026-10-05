/* ============================================================
   SmoothDaddyG — Time Wings
   A simple love letter to Time Pilot: drag anywhere to steer,
   your plane fires on its own. Four eras — 1910, 1940, 1970,
   1983 — each ending in a big boss ship.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var audio = makeAudio();

  var W = 0, H = 0, DPR = 1;

  /* ---------------- tuning ---------------- */
  var PLAYER_SPEED = 275;
  var TURN_RATE = 4.6;       // rad/sec the nose can swing
  var FIRE_CD = 0.26;
  var BULLET_SPEED = 640;
  var MAX_SHIELDS = 3;
  var INVULN = 1.6;
  var ERAS = [
    { year: 1910, quota: 10, esp: 125, fire: 0,    wob: 0.6, body: "#8d6e63", dark: "#5d4037", bossHp: 6 },
    { year: 1940, quota: 12, esp: 175, fire: 3.2,  wob: 1.0, body: "#546e7a", dark: "#37474f", bossHp: 8 },
    { year: 1970, quota: 14, esp: 235, fire: 2.3,  wob: 1.8, body: "#90a4ae", dark: "#546e7a", bossHp: 10 },
    { year: 1983, quota: 16, esp: 205, fire: 1.8,  wob: 2.6, body: "#7e57c2", dark: "#4527a0", bossHp: 12 }
  ];

  /* ---------------- state ---------------- */
  var state = "play";        // play | clear | win | over
  var level = 1;             // 1..4
  var player = { x: 0, y: 0, hd: -Math.PI / 2 };
  var bullets = [], ebullets = [], enemies = [], parts = [], clouds = [], stars = [], pickups = [];
  var boss = null;
  var killed = 0;
  var score = 0, shown = 0;
  var shields = MAX_SHIELDS;
  var invuln = 0, fireCd = 0, spawnT = 1, starT = 5, bossMinionT = 0;
  var shake = 0, clearT = 0, winT = 0, overT = 0, introT = 0, humT = 0;
  var dragId = null, dragX = 0, dragY = 0;

  function era() { return ERAS[level - 1]; }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!player.x) { player.x = W / 2; player.y = H / 2; }
    player.x = Math.min(Math.max(player.x, 30), W - 30);
    player.y = Math.min(Math.max(player.y, 90), H - 30);
    seedClouds();
  }

  function seedClouds() {
    clouds = [];
    var n = Math.max(10, Math.floor(W * H / 45000));
    for (var i = 0; i < n; i++) {
      clouds.push({
        x: Math.random() * W, y: Math.random() * H,
        s: 0.5 + Math.random() * 1.1, v: 14 + Math.random() * 26
      });
    }
  }

  function startLevel() {
    bullets = []; ebullets = []; enemies = []; parts = []; pickups = [];
    boss = null; killed = 0;
    shields = MAX_SHIELDS; invuln = 0;
    spawnT = 0.8; starT = 4; shake = 0; clearT = 0;
    player.x = W / 2; player.y = H / 2; player.hd = -Math.PI / 2;
    dragId = null;
    introT = 2.0;
    state = "play";
  }

  function reset(full) {
    if (full) { score = 0; shown = 0; level = 1; }
    startLevel();
  }

  /* ---------------- math helpers ---------------- */
  function angDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function turnToward(cur, target, maxStep) {
    var d = angDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + (d > 0 ? maxStep : -maxStep);
  }

  function wrap(v, m) {
    v = v % m;
    if (v < 0) v += m;
    return v;
  }

  /* ---------------- input: drag anywhere to steer ---------------- */
  function onDown(e) {
    if (audio.unlock) audio.unlock();
    if (state === "win" || state === "over") { reset(state === "win"); e.preventDefault(); return; }
    if (state !== "play") { e.preventDefault(); return; }
    dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY;
    e.preventDefault();
  }

  function onMove(e) {
    if (e.pointerId === dragId) { dragX = e.clientX; dragY = e.clientY; }
  }

  function onUp(e) {
    if (e.pointerId === dragId) dragId = null;
  }

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", resize);

  /* ---------------- audio ---------------- */
  function explode(x, y, big) {
    var n = big ? 26 : 14;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, sp = 60 + Math.random() * (big ? 320 : 200);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.7, t: 0,
        c: ["#ffdd55", "#ff9933", "#ff5522", "#888888"][Math.floor(Math.random() * 4)],
        r: 3 + Math.random() * (big ? 9 : 6)
      });
    }
    audio.noise(big ? 0.7 : 0.35, { filter: "lowpass", freq: 900, vol: 0.4 });
    audio.tone(150, 0.4, { type: "triangle", vol: 0.25, slideTo: 38 });
    shake = Math.max(shake, big ? 10 : 5);
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

  function addScore(n) { score += n; }

  function hurt() {
    if (invuln > 0 || state !== "play") return;
    shields--; invuln = INVULN;
    explode(player.x, player.y, false);
    audio.tone(220, 0.3, { type: "sawtooth", vol: 0.2, slideTo: 60 });
    if (shields <= 0) {
      state = "over"; overT = 0;
      explode(player.x, player.y, true);
      audio.arp([392, 311, 262, 196], 0.16, "triangle", 0.16);
    }
  }

  /* ---------------- spawning ---------------- */
  function spawnEnemy() {
    var E = era();
    var side = Math.floor(Math.random() * 4), x, y;
    if (side === 0) { x = -40; y = Math.random() * H; }
    else if (side === 1) { x = W + 40; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = -40; }
    else { x = Math.random() * W; y = H + 40; }
    enemies.push({
      x: x, y: y,
      hd: Math.atan2(player.y - y, player.x - x),
      sp: E.esp * (0.85 + Math.random() * 0.3),
      wob: Math.random() * 6.28, fireT: 1 + Math.random() * 2,
      r: level === 4 ? 20 : 24
    });
  }

  function spawnBoss() {
    var E = era();
    boss = {
      x: W / 2, y: 130, vx: 90, hp: E.bossHp, maxHp: E.bossHp,
      fireT: 1.2, wob: 0, r: 54
    };
    audio.arp([196, 196, 262], 0.14, "sawtooth", 0.16);
  }

  function spawnPickup() {
    pickups.push({
      x: 60 + Math.random() * (W - 120), y: 120 + Math.random() * (H - 240),
      t: 0, life: 7
    });
  }

  function levelClear() {
    if (level < ERAS.length) {
      state = "clear"; clearT = 0;
      audio.arp([523, 659, 784, 1047], 0.1, "square", 0.14);
      confetti(70);
    } else {
      state = "win"; winT = 0;
      audio.arp([523, 659, 784, 1047, 1319, 1568], 0.1, "square", 0.14);
      confetti(120);
    }
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    // soft engine hum
    if (state === "play") {
      humT -= dt;
      if (humT <= 0) {
        humT = 0.16;
        audio.tone(68 + Math.random() * 6, 0.07, { type: "triangle", vol: 0.045 });
      }
    }
    if (introT > 0) introT -= dt;

    if (state === "play") {
      // steering: nose swings toward the finger
      if (dragId !== null) {
        var want = Math.atan2(dragY - player.y, dragX - player.x);
        if (Math.hypot(dragX - player.x, dragY - player.y) > 24) {
          player.hd = turnToward(player.hd, want, TURN_RATE * dt);
        }
      }
      player.x = wrap(player.x + Math.cos(player.hd) * PLAYER_SPEED * dt, W);
      player.y += Math.sin(player.hd) * PLAYER_SPEED * dt;
      if (player.y < 80) player.y = 80;
      if (player.y > H - 20) player.y = H - 20;

      // auto-fire
      fireCd -= dt;
      if (fireCd <= 0) {
        fireCd = FIRE_CD;
        bullets.push({
          x: player.x + Math.cos(player.hd) * 30,
          y: player.y + Math.sin(player.hd) * 30,
          vx: Math.cos(player.hd) * BULLET_SPEED,
          vy: Math.sin(player.hd) * BULLET_SPEED,
          t: 0
        });
        audio.tone(920, 0.05, { type: "square", vol: 0.05, slideTo: 480 });
      }

      // spawn enemies until the quota is met, then the boss
      var E = era();
      if (!boss && killed < E.quota) {
        spawnT -= dt;
        if (spawnT <= 0 && enemies.length < 5) {
          spawnT = 1.1;
          spawnEnemy();
        }
      } else if (!boss && killed >= E.quota) {
        spawnBoss();
      }

      // star pickups drift by
      starT -= dt;
      if (starT <= 0) { starT = 6 + Math.random() * 4; spawnPickup(); }

      // enemies
      for (var i = enemies.length - 1; i >= 0; i--) {
        var en = enemies[i];
        var wantHd = Math.atan2(player.y - en.y, player.x - en.x);
        en.wob += dt * E.wob * 2;
        var seek = wantHd + Math.sin(en.wob) * 0.7;
        en.hd = turnToward(en.hd, seek, 2.6 * dt);
        en.x += Math.cos(en.hd) * en.sp * dt;
        en.y += Math.sin(en.hd) * en.sp * dt;
        if (en.x < -70 || en.x > W + 70 || en.y < -70 || en.y > H + 70) {
          enemies.splice(i, 1); continue;
        }
        // shoot back, from 1940 on
        if (E.fire > 0) {
          en.fireT -= dt;
          if (en.fireT <= 0) {
            en.fireT = E.fire * (0.8 + Math.random() * 0.4);
            var a = Math.atan2(player.y - en.y, player.x - en.x);
            ebullets.push({ x: en.x, y: en.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, t: 0 });
            audio.tone(300, 0.08, { type: "sawtooth", vol: 0.06, slideTo: 150 });
          }
        }
        var dx = en.x - player.x, dy = en.y - player.y;
        if (dx * dx + dy * dy < 34 * 34) {
          explode(en.x, en.y, false);
          enemies.splice(i, 1);
          hurt();
        }
      }

      // boss
      if (boss) {
        var bo = boss;
        bo.wob += dt * 2;
        bo.x += bo.vx * dt;
        if (bo.x < 110 || bo.x > W - 110) bo.vx *= -1;
        bo.fireT -= dt;
        if (bo.fireT <= 0) {
          bo.fireT = 1.6;
          var ba = Math.atan2(player.y - bo.y, player.x - bo.x);
          for (var s = -1; s <= 1; s++) {
            var sa = ba + s * 0.22;
            ebullets.push({ x: bo.x, y: bo.y + 30, vx: Math.cos(sa) * 250, vy: Math.sin(sa) * 250, t: 0 });
          }
          audio.tone(180, 0.15, { type: "sawtooth", vol: 0.1, slideTo: 90 });
        }
        bossMinionT -= dt;
        if (bossMinionT <= 0 && enemies.length < 3) {
          bossMinionT = 3;
          spawnEnemy();
        }
        var bdx = bo.x - player.x, bdy = bo.y - player.y;
        if (bdx * bdx + bdy * bdy < 62 * 62) hurt();
      }

      // player bullets
      for (var b = bullets.length - 1; b >= 0; b--) {
        var bu = bullets[b];
        bu.t += dt;
        bu.x += bu.vx * dt; bu.y += bu.vy * dt;
        if (bu.t > 1 || bu.x < -20 || bu.x > W + 20 || bu.y < -20 || bu.y > H + 20) {
          bullets.splice(b, 1); continue;
        }
        var hit = false;
        for (var e2 = enemies.length - 1; e2 >= 0; e2--) {
          var en2 = enemies[e2];
          var edx = bu.x - en2.x, edy = bu.y - en2.y;
          if (edx * edx + edy * edy < 30 * 30) {
            explode(en2.x, en2.y, false);
            enemies.splice(e2, 1);
            addScore(100);
            killed++;
            audio.arp([660, 990], 0.05, "square", 0.08);
            hit = true; break;
          }
        }
        if (hit) { bullets.splice(b, 1); continue; }
        if (boss) {
          var bdx2 = bu.x - boss.x, bdy2 = bu.y - boss.y;
          if (bdx2 * bdx2 + bdy2 * bdy2 < 58 * 58) {
            bullets.splice(b, 1);
            boss.hp--;
            explode(bu.x, bu.y, false);
            audio.tone(500, 0.06, { type: "square", vol: 0.08, slideTo: 300 });
            if (boss.hp <= 0) {
              explode(boss.x, boss.y, true);
              addScore(1000);
              boss = null;
              levelClear();
            }
            continue;
          }
        }
      }

      // enemy bullets
      for (var eb = ebullets.length - 1; eb >= 0; eb--) {
        var eb2 = ebullets[eb];
        eb2.t += dt;
        eb2.x += eb2.vx * dt; eb2.y += eb2.vy * dt;
        if (eb2.t > 3 || eb2.x < -20 || eb2.x > W + 20 || eb2.y < -20 || eb2.y > H + 20) {
          ebullets.splice(eb, 1); continue;
        }
        var pdx = eb2.x - player.x, pdy = eb2.y - player.y;
        if (pdx * pdx + pdy * pdy < 24 * 24) {
          ebullets.splice(eb, 1);
          hurt();
        }
      }

      // pickups
      for (var pk = pickups.length - 1; pk >= 0; pk--) {
        var pku = pickups[pk];
        pku.t += dt;
        if (pku.t > pku.life) { pickups.splice(pk, 1); continue; }
        var qdx = pku.x - player.x, qdy = pku.y - player.y;
        if (qdx * qdx + qdy * qdy < 40 * 40) {
          pickups.splice(pk, 1);
          addScore(250);
          audio.arp([880, 1320], 0.06, "sine", 0.12);
          confetti(8);
        }
      }

      invuln -= dt;
      if (shown < score) shown = Math.min(score, shown + Math.ceil((score - shown) * dt * 6) + 1);
    }

    if (state === "clear") {
      clearT += dt;
      if (shown < score) shown = Math.min(score, shown + 7);
      if (clearT > 2.4) { level++; startLevel(); }
    }
    if (state === "win") { winT += dt; if (shown < score) shown = Math.min(score, shown + 7); }
    if (state === "over") { overT += dt; }

    // particles
    for (var p = parts.length - 1; p >= 0; p--) {
      var pt = parts[p];
      pt.t += dt;
      if (pt.t >= pt.life) { parts.splice(p, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (!pt.confetti) pt.vy += 300 * dt;
      pt.vx *= (1 - dt * 1.5);
    }
    // clouds drift
    for (var c = 0; c < clouds.length; c++) {
      clouds[c].x -= clouds[c].v * dt;
      if (clouds[c].x < -140) { clouds[c].x = W + 140; clouds[c].y = Math.random() * H; }
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
  }

  /* ---------------- drawing ---------------- */
  function skyColors() {
    if (level === 1) return ["#d9b98c", "#e8d5ae", "#f2e8cf"]; // 1910 sepia
    if (level === 2) return ["#5d7a8c", "#8ba3b5", "#c3d3de"]; // 1940 steel
    if (level === 3) return ["#4a7c59", "#7cb342", "#c5e1a5"]; // 1970 fields
    return ["#0d1230", "#1a2350", "#2a3570"];                  // 1983 space
  }

  function drawPlane(x, y, hd, body, dark, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hd + Math.PI / 2);
    ctx.scale(scale, scale);
    // fuselage (top-down)
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.lineTo(7, 4); ctx.lineTo(5, 16); ctx.lineTo(-5, 16); ctx.lineTo(-7, 4);
    ctx.closePath(); ctx.fill();
    // wings
    ctx.fillStyle = dark;
    ctx.fillRect(-20, -4, 40, 8);
    // tail
    ctx.fillRect(-9, 12, 18, 5);
    // cockpit
    ctx.fillStyle = "#b3e5fc";
    ctx.beginPath(); ctx.arc(0, -6, 4, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  function drawUFO(x, y, wob, body, dark) {
    ctx.save();
    ctx.translate(x, y + Math.sin(wob) * 5);
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 10, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, -6, 12, 0, 6.29); ctx.fill();
    ctx.fillStyle = (Math.floor(performance.now() / 200) % 2) ? "#ffea00" : "#ff9100";
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.arc(i * 10, 2, 2.5, 0, 6.29); ctx.fill();
    }
    ctx.restore();
  }

  function drawBoss(x, y, wob) {
    var E = era();
    ctx.save();
    ctx.translate(x, y + Math.sin(wob) * 8);
    if (level === 4) {
      // mothership saucer
      ctx.fillStyle = "#4527a0";
      ctx.beginPath(); ctx.ellipse(0, 0, 58, 20, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#7e57c2";
      ctx.beginPath(); ctx.arc(0, -12, 24, 0, 6.29); ctx.fill();
      ctx.fillStyle = (Math.floor(performance.now() / 150) % 2) ? "#ff1744" : "#7e57c2";
      ctx.beginPath(); ctx.arc(0, -12, 8, 0, 6.29); ctx.fill();
    } else {
      // big bomber / carrier plane
      ctx.fillStyle = E.dark;
      ctx.fillRect(-58, -10, 116, 20);
      ctx.fillRect(-14, -34, 28, 68);
      ctx.fillStyle = E.body;
      ctx.fillRect(-58, -4, 116, 8);
      ctx.beginPath(); ctx.arc(58, 0, 12, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#ff1744";
      ctx.beginPath(); ctx.arc(-40, 0, 5, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(40, 0, 5, 0, 6.29); ctx.fill();
    }
    ctx.restore();
    // boss health bar
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x - 50, y - 52, 100, 10);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(x - 48, y - 50, 96 * Math.max(0, boss.hp / boss.maxHp), 6);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // sky
    var sc = skyColors();
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sc[0]); g.addColorStop(0.6, sc[1]); g.addColorStop(1, sc[2]);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);

    // space stars for 1983
    if (level === 4) {
      ctx.fillStyle = "#ffffff";
      for (var st = 0; st < stars.length; st++) {
        var s2 = stars[st];
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 700 + s2.tw));
        ctx.fillRect(s2.x * W, s2.y * H, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    } else {
      // clouds
      ctx.fillStyle = level === 2 ? "rgba(230,235,240,0.7)" : "rgba(255,255,255,0.85)";
      for (var i = 0; i < clouds.length; i++) {
        var cl = clouds[i], s = cl.s;
        ctx.beginPath();
        ctx.arc(cl.x, cl.y, 26 * s, 0, 6.29);
        ctx.arc(cl.x + 24 * s, cl.y + 6 * s, 20 * s, 0, 6.29);
        ctx.arc(cl.x - 24 * s, cl.y + 8 * s, 18 * s, 0, 6.29);
        ctx.fill();
      }
    }

    // pickups: twinkling stars
    for (var pk = 0; pk < pickups.length; pk++) {
      var pku = pickups[pk];
      var tw = 0.6 + 0.4 * Math.sin(performance.now() / 200 + pku.x);
      ctx.save();
      ctx.translate(pku.x, pku.y);
      ctx.rotate(performance.now() / 1200);
      ctx.globalAlpha = tw;
      ctx.fillStyle = "#ffd740";
      ctx.beginPath();
      for (var sp = 0; sp < 10; sp++) {
        var rr = sp % 2 === 0 ? 14 : 6;
        var aa = sp * Math.PI / 5;
        ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // enemy bullets
    ctx.fillStyle = "#ff5252";
    for (var eb = 0; eb < ebullets.length; eb++) {
      ctx.beginPath(); ctx.arc(ebullets[eb].x, ebullets[eb].y, 6, 0, 6.29); ctx.fill();
    }

    // player bullets
    ctx.fillStyle = "#ffea00";
    for (var b = 0; b < bullets.length; b++) {
      var bu = bullets[b];
      ctx.save();
      ctx.translate(bu.x, bu.y);
      ctx.rotate(Math.atan2(bu.vy, bu.vx));
      ctx.fillRect(-12, -2.5, 24, 5);
      ctx.restore();
    }

    // enemies
    var E = era();
    for (var e = 0; e < enemies.length; e++) {
      var en = enemies[e];
      if (level === 4) drawUFO(en.x, en.y, en.wob, E.body, E.dark);
      else drawPlane(en.x, en.y, en.hd, E.body, E.dark, 0.9);
    }

    // boss
    if (boss) drawBoss(boss.x, boss.y, boss.wob);

    // player (blink while invulnerable)
    if (!(invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0)) {
      drawPlane(player.x, player.y, player.hd, "#d32f2f", "#7f0000", 1);
      // little steering ribbon toward the finger
      if (dragId !== null && state === "play") {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 10]);
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(dragX, dragY); ctx.stroke();
        ctx.setLineDash([]);
      }
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

    // HUD
    for (var s = 0; s < MAX_SHIELDS; s++) {
      ctx.globalAlpha = s < shields ? 1 : 0.22;
      drawMiniPlane(30 + s * 44, 34, s < shields ? "#d32f2f" : "#90a4ae");
    }
    ctx.globalAlpha = 1;
    // level pips
    for (var lp = 0; lp < ERAS.length; lp++) {
      ctx.fillStyle = lp < level ? "#ffd740" : "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(30 + lp * 24, 62, 7, 0, 6.29); ctx.fill();
    }
    // quota progress: dots top-right
    var E2 = era();
    var left = boss ? 0 : Math.max(0, E2.quota - killed);
    var total = E2.quota;
    for (var r = 0; r < total; r++) {
      var bx = W - 24 - r * 20;
      if (bx < W / 2 + 60) break;
      ctx.fillStyle = r < left ? "#ffab40" : "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.arc(bx, 34, 7, 0, 6.29); ctx.fill();
    }
    if (boss) {
      ctx.fillStyle = "#ff1744";
      ctx.font = Math.round(Math.min(15, W * 0.03)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "right";
      ctx.fillText("BOSS", W - 24, 40);
    }
    // score
    drawPixelNumber(ctx, shown, W / 2, 30, 5, "#ffffff", true);

    // era intro: the year, big — no reading needed
    if (introT > 0 && state === "play") {
      ctx.globalAlpha = Math.min(1, introT);
      drawPixelNumber(ctx, era().year, W / 2, H * 0.38, 8, "#ffd740", true);
      ctx.globalAlpha = 1;
    }

    // steering hint at the very start
    if (state === "play" && score === 0 && killed === 0 && !boss) {
      ctx.globalAlpha = 0.4 + 0.25 * Math.sin(performance.now() / 300);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(15, W * 0.03)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("DRAG TO STEER", W / 2, H * 0.72);
      ctx.globalAlpha = 1;
    }

    // overlays
    if (state === "clear") {
      ctx.fillStyle = "rgba(20,40,70,0.45)";
      ctx.fillRect(0, 0, W, H);
      drawPixelNumber(ctx, ERAS[level].year, W / 2, H * 0.32, 8, "#ffd740", true);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(20, W * 0.035)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("ERA CLEAR", W / 2, H * 0.54);
    }
    if (state === "win" || state === "over") {
      ctx.fillStyle = state === "win" ? "rgba(20,60,30,0.55)" : "rgba(40,10,10,0.55)";
      ctx.fillRect(0, 0, W, H);
      drawPixelNumber(ctx, shown, W / 2, H * 0.34, 8, "#ffd740", true);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(22, W * 0.035)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      var msg = state === "win" ? "TIME MASTER!" : "TRY AGAIN";
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

  // starfield for the 1983 space era
  for (var si = 0; si < 70; si++) {
    stars.push({ x: Math.random(), y: Math.random(), tw: Math.random() * 6.28 });
  }

  resize();
  reset(true);
  requestAnimationFrame(frame);

  /* Test hook: pure-ish logic for node tests. */
  if (typeof window !== "undefined") {
    window.__timewings = {
      turnToward: turnToward, wrap: wrap, angDiff: angDiff,
      eraInfo: function (l) {
        var e = ERAS[l - 1];
        return e ? { year: e.year, quota: e.quota, bossHp: e.bossHp, levels: ERAS.length } : null;
      },
      _set: function (o) {
        if (o.W != null) W = o.W;
        if (o.H != null) H = o.H;
        if (o.level != null) level = o.level;
      }
    };
  }
})();
