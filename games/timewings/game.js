/* ============================================================
   SmoothDaddyG — Time Wings (redesign 2026-10-07, stick 2026-10-19)
   A love letter to the original Time Pilot: YOUR plane stays
   fixed in the middle of the screen. Steer with the thumb stick
   at the bottom — your finger stays out of the way and the WORLD
   (clouds, islands, stars) streams past to sell the motion.
   Big chunky 2x graphics, gentler difficulty. Four eras —
   1910, 1940, 1970, 1983 — each ending in a big boss ship.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var audio = makeAudio();
  /* Background music (2026-10-30 rollout): an original chiptune loop —
     funk bass + square hook, kept under the SFX. Starts at load; the
     synth stays silent until the first tap, then plays mid-loop. */
  var MUSIC = audio.makeMusic({
    bpm: 138, div: 4, steps: 64, bassVol: 0.2, leadVol: 0.05, hats: "odd",
    kicks: [0, 8, 14, 16, 24, 30, 32, 40, 46, 48, 56, 62],
    snares: [4, 12, 20, 28, 36, 44, 52, 60],
    bass: [98, 0, 0, 98, 0, 0, 146.83, 0, 98, 0, 0, 98, 196, 0, 146.83, 0,
           73.42, 0, 0, 73.42, 0, 0, 110, 0, 73.42, 0, 0, 73.42, 146.83, 0, 110, 0,
           82.41, 0, 0, 82.41, 0, 0, 123.47, 0, 82.41, 0, 0, 82.41, 164.81, 0, 123.47, 0,
           65.41, 0, 0, 65.41, 0, 0, 98, 0, 65.41, 0, 0, 65.41, 130.81, 0, 98, 0],
    lead: [392, 0, 587.33, 0, 783.99, 0, 587.33, 0, 392, 0, 493.88, 0, 587.33, 0, 783.99, 0,
           587.33, 0, 659.25, 0, 783.99, 0, 659.25, 0, 587.33, 0, 523.25, 0, 587.33, 0, 659.25, 0,
           659.25, 0, 783.99, 0, 659.25, 0, 587.33, 0, 659.25, 0, 783.99, 0, 880, 0, 783.99, 0,
           392, 493.88, 587.33, 659.25, 783.99, 880, 1046.5, 880, 783.99, 659.25, 587.33, 659.25, 783.99, 880, 1046.5, 0],
  });
  MUSIC.start();

  var W = 0, H = 0, DPR = 1;

  /* ---------------- tuning ---------------- */
  var PLAYER_SPEED = 275;
  var TURN_RATE = 4.6;       // rad/sec the nose can swing
  var FIRE_CD = 0.22;
  var BULLET_SPEED = 640;
  var INVULN = 1.6;          // grace period after respawn
  var DOWN_TIME = 1.5;       // death pause before respawn
  var SPR = 2;               // global sprite scale — chunky and playful
  var ERAS = [
    { year: 1910, quota: 8, esp: 125, fire: 0,   wob: 0.6, body: "#8d6e63", dark: "#5d4037", bossHp: 5 },
    { year: 1940, quota: 10, esp: 175, fire: 3.2, wob: 1.0, body: "#546e7a", dark: "#37474f", bossHp: 6 },
    { year: 1970, quota: 12, esp: 235, fire: 2.3, wob: 1.8, body: "#90a4ae", dark: "#546e7a", bossHp: 8 },
    { year: 1983, quota: 14, esp: 205, fire: 1.8, wob: 2.6, body: "#7e57c2", dark: "#4527a0", bossHp: 10 }
  ];

  /* ---------------- state ---------------- */
  // The player lives in WORLD coordinates; the camera is glued to
  // the player, so on screen the plane never leaves the center.
  var state = "play";        // play | clear | win
  var level = 1;             // 1..4
  var player = { x: 0, y: 0, hd: -Math.PI / 2 };
  var camX = 0, camY = 0;    // world coords shown at screen center
  var bullets = [], ebullets = [], enemies = [], parts = [], clouds = [], stars = [], pickups = [], grounds = [];
  var boss = null;
  var killed = 0;
  var score = 0, shown = 0;
  var invuln = 0, fireCd = 0, spawnT = 1, starT = 5, bossMinionT = 0;
  var downT = 0;             // death pause: >0 means crashed, waiting to respawn
  var shake = 0, clearT = 0, winT = 0, introT = 0, humT = 0;

  function era() { return ERAS[level - 1]; }

  // screen position of a world point
  function sx(wx) { return wx - camX + W / 2; }
  function sy(wy) { return wy - camY + H / 2; }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stickHome = { x: W / 2, y: H - 118 };
    seedClouds();
    seedGround();
  }

  // Clouds tile seamlessly around the camera: each cloud has a fixed
  // offset in tile space, wrapped against the camera every frame.
  function seedClouds() {
    clouds = [];
    var n = Math.max(12, Math.floor(W * H / 38000));
    for (var i = 0; i < n; i++) {
      clouds.push({
        ox: Math.random(), oy: Math.random(),
        s: 0.7 + Math.random() * 1.1, v: 10 + Math.random() * 18
      });
    }
    stars = [];
    for (var s = 0; s < 90; s++) {
      stars.push({
        ox: Math.random(), oy: Math.random(),
        par: s < 45 ? 0.3 : 0.6, tw: Math.random() * 6.28
      });
    }
  }

  // Ground features (fields / islands / city blocks) per era, tiled too.
  function seedGround() {
    grounds = [];
    var n = Math.max(8, Math.floor(W * H / 90000));
    for (var i = 0; i < n; i++) {
      grounds.push({
        ox: Math.random(), oy: Math.random(),
        s: 0.6 + Math.random() * 1.2, k: Math.floor(Math.random() * 3)
      });
    }
  }

  function startLevel() {
    bullets = []; ebullets = []; enemies = []; parts = []; pickups = [];
    boss = null; killed = 0;
    invuln = 0; downT = 0;
    spawnT = 0.8; starT = 4; shake = 0; clearT = 0;
    player.x = 0; player.y = 0; player.hd = -Math.PI / 2;
    camX = 0; camY = 0;
    stick.id = null;
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

  /* ---------------- input: thumb stick ---------------- */
  // A floating-origin virtual joystick. Its home is the bottom of the
  // screen; press and it anchors where your thumb lands, drag in a
  // small circle to steer. Your thumb stays low, out of the way of the
  // action, and the plane (pinned to the middle) turns toward the tilt.
  var stick = { id: null, ox: 0, oy: 0, kx: 0, ky: 0 };
  var STICK_R = 92, KNOB_R = 38, STICK_DEAD = 15;
  var stickHome = { x: 0, y: 0 }; // idle base position — set in resize()

  function stickClamp() {
    var dx = stick.kx - stick.ox, dy = stick.ky - stick.oy;
    var d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      stick.kx = stick.ox + dx / d * STICK_R;
      stick.ky = stick.oy + dy / d * STICK_R;
    }
  }

  function onDown(e) {
    if (audio.unlock) audio.unlock();
    if (state === "win") { if (window.SDGplays) SDGplays.played("timewings"); reset(true); e.preventDefault(); return; }
    if (state !== "play") { e.preventDefault(); return; }
    stick.id = e.pointerId;
    stick.ox = e.clientX; stick.oy = e.clientY;
    stick.kx = e.clientX; stick.ky = e.clientY;
    e.preventDefault();
  }

  function onMove(e) {
    if (e.pointerId === stick.id) {
      stick.kx = e.clientX; stick.ky = e.clientY;
      stickClamp();
    }
  }

  function onUp(e) {
    if (e.pointerId === stick.id) stick.id = null;
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
        x: player.x + (Math.random() - 0.5) * W, y: player.y - H / 2 - Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
        life: 2.5, t: 0,
        c: ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb"][j % 5],
        r: 3 + Math.random() * 4, confetti: true
      });
    }
  }

  function addScore(n) { score += n; }

  function hurt() {
    if (invuln > 0 || downT > 0 || state !== "play") return;
    // no game over, ever — a hit is a pause, then you pop back in
    downT = DOWN_TIME;
    explode(player.x, player.y, true);
    audio.tone(220, 0.3, { type: "sawtooth", vol: 0.2, slideTo: 60 });
    shake = Math.max(shake, 10);
  }

  /* ---------------- spawning (world coords, around the player) ---------------- */
  function spawnEnemy() {
    var E = era();
    var a = Math.random() * Math.PI * 2;
    var d = Math.max(W, H) * 0.75;
    var x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
    enemies.push({
      x: x, y: y,
      hd: Math.atan2(player.y - y, player.x - x),
      sp: E.esp * 0.7 * (0.85 + Math.random() * 0.3), // gentler than before
      wob: Math.random() * 6.28, fireT: 1.5 + Math.random() * 2,
      r: 30
    });
  }

  function spawnBoss() {
    var E = era();
    boss = {
      x: player.x, y: player.y - Math.max(W, H) * 0.42,
      vx: 80, hp: E.bossHp, maxHp: E.bossHp,
      fireT: 1.6, wob: 0, r: 70
    };
    audio.arp([196, 196, 262], 0.14, "sawtooth", 0.16);
  }

  function spawnPickup() {
    pickups.push({
      x: player.x + (Math.random() - 0.5) * (W - 160),
      y: player.y + (Math.random() - 0.5) * (H - 260),
      t: 0, life: 8
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
    if (state === "play" && downT <= 0) {
      humT -= dt;
      if (humT <= 0) {
        humT = 0.16;
        audio.tone(68 + Math.random() * 6, 0.07, { type: "triangle", vol: 0.045 });
      }
    }
    if (introT > 0) introT -= dt;

    if (state === "play" && downT > 0) {
      // death pause: the world holds still while the smoke clears,
      // then you pop back in — score, kills, era kept
      downT -= dt;
      if (downT <= 0) invuln = INVULN;
    }

    if (state === "play" && downT <= 0) {
      // steering: the nose swings toward the finger. The plane itself
      // never leaves the middle of the screen — the world moves instead.
      if (stick.id !== null) {
        var sdx = stick.kx - stick.ox, sdy = stick.ky - stick.oy;
        if (Math.hypot(sdx, sdy) > STICK_DEAD) {
          player.hd = turnToward(player.hd, Math.atan2(sdy, sdx), TURN_RATE * dt);
        }
      }
      player.x += Math.cos(player.hd) * PLAYER_SPEED * dt;
      player.y += Math.sin(player.hd) * PLAYER_SPEED * dt;
      // the camera is glued to the player: the world streams past
      camX = player.x; camY = player.y;

      // auto-fire
      fireCd -= dt;
      if (fireCd <= 0) {
        fireCd = FIRE_CD;
        bullets.push({
          x: player.x + Math.cos(player.hd) * 34,
          y: player.y + Math.sin(player.hd) * 34,
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
        if (spawnT <= 0 && enemies.length < 4) {
          spawnT = 1.2;
          spawnEnemy();
        }
      } else if (!boss && killed >= E.quota) {
        spawnBoss();
      }

      // star pickups drift by
      starT -= dt;
      if (starT <= 0) { starT = 6 + Math.random() * 4; spawnPickup(); }

      // enemies (world coords — distances are camera-independent)
      var far = Math.max(W, H);
      for (var i = enemies.length - 1; i >= 0; i--) {
        var en = enemies[i];
        var wantHd = Math.atan2(player.y - en.y, player.x - en.x);
        en.wob += dt * E.wob * 2;
        var seek = wantHd + Math.sin(en.wob) * 0.7;
        en.hd = turnToward(en.hd, seek, 2.6 * dt);
        en.x += Math.cos(en.hd) * en.sp * dt;
        en.y += Math.sin(en.hd) * en.sp * dt;
        if (Math.hypot(en.x - player.x, en.y - player.y) > far * 1.2) {
          enemies.splice(i, 1); continue;
        }
        // shoot back, from 1940 on — slower and rarer than before
        if (E.fire > 0) {
          en.fireT -= dt;
          if (en.fireT <= 0) {
            en.fireT = E.fire * 1.7 * (0.8 + Math.random() * 0.4);
            var a = Math.atan2(player.y - en.y, player.x - en.x);
            ebullets.push({ x: en.x, y: en.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, t: 0 });
            audio.tone(300, 0.08, { type: "sawtooth", vol: 0.06, slideTo: 150 });
          }
        }
        var dx = en.x - player.x, dy = en.y - player.y;
        if (dx * dx + dy * dy < 28 * 28) {   // forgiving player hitbox
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
        if (bo.x < player.x - 260 || bo.x > player.x + 260) bo.vx *= -1;
        bo.y += Math.sin(bo.wob) * 20 * dt;
        bo.fireT -= dt;
        if (bo.fireT <= 0) {
          bo.fireT = 2.2;
          var ba = Math.atan2(player.y - bo.y, player.x - bo.x);
          for (var s = -1; s <= 1; s++) {
            var sa = ba + s * 0.22;
            ebullets.push({ x: bo.x, y: bo.y + 40, vx: Math.cos(sa) * 200, vy: Math.sin(sa) * 200, t: 0 });
          }
          audio.tone(180, 0.15, { type: "sawtooth", vol: 0.1, slideTo: 90 });
        }
        bossMinionT -= dt;
        if (bossMinionT <= 0 && enemies.length < 3) {
          bossMinionT = 3.5;
          spawnEnemy();
        }
        var bdx = bo.x - player.x, bdy = bo.y - player.y;
        if (bdx * bdx + bdy * bdy < 78 * 78) hurt();
      }

      // player bullets
      for (var b = bullets.length - 1; b >= 0; b--) {
        var bu = bullets[b];
        bu.t += dt;
        bu.x += bu.vx * dt; bu.y += bu.vy * dt;
        if (bu.t > 1.1 || Math.hypot(bu.x - player.x, bu.y - player.y) > far) {
          bullets.splice(b, 1); continue;
        }
        var hit = false;
        for (var e2 = enemies.length - 1; e2 >= 0; e2--) {
          var en2 = enemies[e2];
          var edx = bu.x - en2.x, edy = bu.y - en2.y;
          if (edx * edx + edy * edy < 34 * 34) {   // generous — easy to hit
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
          if (bdx2 * bdx2 + bdy2 * bdy2 < 74 * 74) {
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
        if (eb2.t > 4 || Math.hypot(eb2.x - player.x, eb2.y - player.y) > far * 1.2) {
          ebullets.splice(eb, 1); continue;
        }
        var pdx = eb2.x - player.x, pdy = eb2.y - player.y;
        if (pdx * pdx + pdy * pdy < 20 * 20) {
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
        if (qdx * qdx + qdy * qdy < 44 * 44) {
          pickups.splice(pk, 1);
          addScore(250);
          audio.arp([880, 1320], 0.06, "sine", 0.12);
          confetti(8);
        }
      }

      // clouds drift a little on their own, on top of the world motion
      for (var c = 0; c < clouds.length; c++) {
        clouds[c].ox -= (clouds[c].v * dt) / (W + 480);
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

    // particles (world coords — they ride the camera like everything else)
    for (var p = 0; p < parts.length; p++) {
      var pt = parts[p];
      pt.t += dt;
      if (pt.t >= pt.life) { parts.splice(p, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (!pt.confetti) pt.vy += 300 * dt;
      pt.vx *= (1 - dt * 1.5);
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
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.lineTo(7, 4); ctx.lineTo(5, 16); ctx.lineTo(-5, 16); ctx.lineTo(-7, 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(-20, -4, 40, 8);
    ctx.fillRect(-9, 12, 18, 5);
    ctx.fillStyle = "#b3e5fc";
    ctx.beginPath(); ctx.arc(0, -6, 4, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  function drawUFO(x, y, wob, body, dark) {
    ctx.save();
    ctx.translate(x, y + Math.sin(wob) * 5);
    ctx.scale(1.7, 1.7);
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
    ctx.scale(1.5, 1.5);
    if (level === 4) {
      ctx.fillStyle = "#4527a0";
      ctx.beginPath(); ctx.ellipse(0, 0, 58, 20, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#7e57c2";
      ctx.beginPath(); ctx.arc(0, -12, 24, 0, 6.29); ctx.fill();
      ctx.fillStyle = (Math.floor(performance.now() / 150) % 2) ? "#ff1744" : "#7e57c2";
      ctx.beginPath(); ctx.arc(0, -12, 8, 0, 6.29); ctx.fill();
    } else {
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
    ctx.fillRect(x - 60, y - 78, 120, 12);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(x - 58, y - 76, 116 * Math.max(0, boss.hp / boss.maxHp), 8);
  }

  function drawGroundTile() {
    // era-flavored ground patches that stream past below the clouds
    for (var i = 0; i < grounds.length; i++) {
      var g2 = grounds[i];
      var TW = W + 560, TH = H + 560;
      var X = wrap(g2.ox * TW - camX * 0.85, TW) - 280;
      var Y = wrap(g2.oy * TH - camY * 0.85, TH) - 280;
      var r = 55 * g2.s;
      ctx.globalAlpha = 0.5;
      if (level === 1) {
        ctx.fillStyle = g2.k === 0 ? "#b98d55" : g2.k === 1 ? "#a87f4b" : "#c49a5f";
        ctx.beginPath(); ctx.ellipse(X, Y, r * 1.6, r, 0.3, 0, 6.29); ctx.fill();
      } else if (level === 2) {
        ctx.fillStyle = g2.k === 0 ? "#6b7f6e" : g2.k === 1 ? "#5d6f66" : "#77876f";
        ctx.fillRect(X - r, Y - r * 0.6, r * 2, r * 1.2);
      } else if (level === 3) {
        ctx.fillStyle = g2.k === 0 ? "#3f7a44" : g2.k === 1 ? "#4c8a3f" : "#35702f";
        ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.29); ctx.fill();
      }
      // 1983: no ground — deep space
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    // sky (screen space)
    var sc = skyColors();
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sc[0]); g.addColorStop(0.6, sc[1]); g.addColorStop(1, sc[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (level === 4) {
      // parallax starfield, two depths
      for (var st = 0; st < stars.length; st++) {
        var s2 = stars[st];
        var TW = W + 200, TH = H + 200;
        var X = wrap(s2.ox * TW - camX * s2.par, TW) - 100;
        var Y = wrap(s2.oy * TH - camY * s2.par, TH) - 100;
        ctx.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(performance.now() / 700 + s2.tw))) * (s2.par + 0.4);
        ctx.fillStyle = "#ffffff";
        var sz = s2.par > 0.5 ? 3.5 : 2.5;
        ctx.fillRect(X, Y, sz, sz);
      }
      ctx.globalAlpha = 1;
    } else {
      // ground patches stream by underneath
      drawGroundTile();
      // big puffy clouds, tiled around the camera
      ctx.fillStyle = level === 2 ? "rgba(230,235,240,0.75)" : "rgba(255,255,255,0.9)";
      var TW2 = W + 480, TH2 = H + 480;
      for (var i = 0; i < clouds.length; i++) {
        var cl = clouds[i], s = cl.s * 1.6; // 2x-ish puffs
        var cx2 = wrap(cl.ox * TW2 - camX, TW2) - 240;
        var cy2 = wrap(cl.oy * TH2 - camY, TH2) - 240;
        ctx.beginPath();
        ctx.arc(cx2, cy2, 30 * s, 0, 6.29);
        ctx.arc(cx2 + 28 * s, cy2 + 7 * s, 23 * s, 0, 6.29);
        ctx.arc(cx2 - 28 * s, cy2 + 9 * s, 21 * s, 0, 6.29);
        ctx.fill();
      }
    }

    // pickups: big twinkling stars
    for (var pk = 0; pk < pickups.length; pk++) {
      var pku = pickups[pk];
      var tw = 0.6 + 0.4 * Math.sin(performance.now() / 200 + pku.x);
      ctx.save();
      ctx.translate(sx(pku.x), sy(pku.y));
      ctx.rotate(performance.now() / 1200);
      ctx.globalAlpha = tw;
      ctx.fillStyle = "#ffd740";
      ctx.beginPath();
      for (var sp = 0; sp < 10; sp++) {
        var rr = sp % 2 === 0 ? 22 : 9;
        var aa = sp * Math.PI / 5;
        ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // enemy bullets — big and slow, easy to see
    ctx.fillStyle = "#ff5252";
    for (var eb = 0; eb < ebullets.length; eb++) {
      ctx.beginPath(); ctx.arc(sx(ebullets[eb].x), sy(ebullets[eb].y), 9, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#ff8a80";
      ctx.beginPath(); ctx.arc(sx(ebullets[eb].x), sy(ebullets[eb].y), 4, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#ff5252";
    }

    // player bullets
    ctx.fillStyle = "#ffea00";
    for (var b = 0; b < bullets.length; b++) {
      var bu = bullets[b];
      ctx.save();
      ctx.translate(sx(bu.x), sy(bu.y));
      ctx.rotate(Math.atan2(bu.vy, bu.vx));
      ctx.fillRect(-15, -3.5, 30, 7);
      ctx.restore();
    }

    // enemies — chunky 2x sprites
    var E = era();
    for (var e = 0; e < enemies.length; e++) {
      var en = enemies[e];
      if (level === 4) drawUFO(sx(en.x), sy(en.y), en.wob, E.body, E.dark);
      else drawPlane(sx(en.x), sy(en.y), en.hd, E.body, E.dark, 1.8);
    }

    // boss
    if (boss) drawBoss(sx(boss.x), sy(boss.y), boss.wob);

    // THE player — dead center, always (hidden while crashed)
    if (downT <= 0 && !(invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0)) {
      drawPlane(W / 2, H / 2, player.hd, "#d32f2f", "#7f0000", SPR);
    }

    // particles
    for (var p = 0; p < parts.length; p++) {
      var pt = parts[p];
      ctx.globalAlpha = 1 - pt.t / pt.life;
      ctx.fillStyle = pt.c;
      if (pt.confetti) {
        ctx.fillRect(sx(pt.x) - pt.r / 2, sy(pt.y) - pt.r / 4, pt.r, pt.r / 2);
      } else {
        ctx.beginPath(); ctx.arc(sx(pt.x), sy(pt.y), pt.r * (1 - pt.t / pt.life * 0.5), 0, 6.29); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // HUD (screen space)
    for (var lp = 0; lp < ERAS.length; lp++) {
      ctx.fillStyle = lp < level ? "#ffd740" : "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(30 + lp * 24, 62, 7, 0, 6.29); ctx.fill();
    }
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
    drawPixelNumber(ctx, shown, W / 2, 30, 5, "#ffffff", true);

    drawStick();

    if (introT > 0 && state === "play") {
      ctx.globalAlpha = Math.min(1, introT);
      drawPixelNumber(ctx, era().year, W / 2, H * 0.38, 8, "#ffd740", true);
      ctx.globalAlpha = 1;
    }

    if (state === "play" && score === 0 && killed === 0 && !boss) {
      ctx.globalAlpha = 0.4 + 0.25 * Math.sin(performance.now() / 300);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(15, W * 0.03)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("TILT THE STICK TO STEER", W / 2, H - 245);
      ctx.globalAlpha = 1;
    }

    if (state === "clear") {
      ctx.fillStyle = "rgba(20,40,70,0.45)";
      ctx.fillRect(0, 0, W, H);
      drawPixelNumber(ctx, ERAS[level].year, W / 2, H * 0.32, 8, "#ffd740", true);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(20, W * 0.035)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("ERA CLEAR", W / 2, H * 0.54);
    }
    if (state === "win") {
      ctx.fillStyle = "rgba(20,60,30,0.55)";
      ctx.fillRect(0, 0, W, H);
      drawPixelNumber(ctx, shown, W / 2, H * 0.34, 8, "#ffd740", true);
      ctx.fillStyle = "#ffffff";
      ctx.font = Math.round(Math.min(22, W * 0.035)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("TIME MASTER!", W / 2, H * 0.52);
      if (winT > 0.8) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 350);
        ctx.font = Math.round(Math.min(14, W * 0.028)) + 'px "Press Start 2P", monospace';
        ctx.fillText("TAP TO FLY AGAIN", W / 2, H * 0.62);
        ctx.globalAlpha = 1;
      }
    }
  }

  // The thumb stick (screen space): base circle + knob. Idles at the
  // bottom-center as a hint; jumps to the thumb when grabbed.
  function drawStick() {
    if (state !== "play") return;
    var active = stick.id !== null;
    var bx = active ? stick.ox : stickHome.x;
    var by = active ? stick.oy : stickHome.y;
    var kx = active ? stick.kx : stickHome.x;
    var ky = active ? stick.ky : stickHome.y;
    var pulse = active ? 1 : 0.82 + 0.10 * Math.sin(performance.now() / 400);
    ctx.save();
    // base ring
    ctx.globalAlpha = active ? 0.85 : 0.5;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(bx, by, STICK_R * pulse, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = active ? 0.18 : 0.08;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(bx, by, STICK_R * pulse, 0, 6.29); ctx.fill();
    ctx.globalAlpha = 1;
    // direction tick: shows where the tilt is pointing
    if (active && Math.hypot(kx - bx, ky - by) > STICK_DEAD) {
      var a = Math.atan2(ky - by, kx - bx);
      ctx.strokeStyle = "rgba(255,215,64,0.9)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * (STICK_R + 8), by + Math.sin(a) * (STICK_R + 8));
      ctx.lineTo(bx + Math.cos(a) * (STICK_R + 26), by + Math.sin(a) * (STICK_R + 26));
      ctx.stroke();
    }
    // knob
    var kg = ctx.createRadialGradient(kx - 10, ky - 12, 6, kx, ky, KNOB_R);
    kg.addColorStop(0, "#ff8a80"); kg.addColorStop(1, "#c62828");
    ctx.fillStyle = kg;
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(kx, ky, KNOB_R, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* ---------------- main loop ---------------- */
  var last = 0;
  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    if (MUSIC) MUSIC.tick(dt);
    update(dt);
    draw();
    requestAnimationFrame(frame);
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
      },
      _frame: function (dt) { update(dt); },
      _drag: function (x, y) { stick.id = 1; stick.ox = W / 2; stick.oy = H / 2; stick.kx = x; stick.ky = y; stickClamp(); },
      _stick: function (ox, oy, kx, ky) { stick.id = 1; stick.ox = ox; stick.oy = oy; stick.kx = kx; stick.ky = ky; stickClamp(); },
      _stickPos: function () { return { ox: stick.ox, oy: stick.oy, kx: stick.kx, ky: stick.ky, active: stick.id !== null, home: { x: stickHome.x, y: stickHome.y } }; },
      _undrag: function () { stick.id = null; },
      _player: function () { return { x: player.x, y: player.y, hd: player.hd }; },
      _cam: function () { return { x: camX, y: camY }; },
      _screen: function (wx, wy) { return { x: sx(wx), y: sy(wy) }; },
      _enemies: function () { return enemies; },
      _spawnEnemy: spawnEnemy,
      _state: function (s) { if (s !== undefined) state = s; return state; },
      _setPlayer: function (x, y, hd) { player.x = x; player.y = y; if (hd != null) player.hd = hd; camX = x; camY = y; }
    };
  }
})();
