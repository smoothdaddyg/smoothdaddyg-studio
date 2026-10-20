/* ============================================================
   SINK THE SHIP! — SmoothDaddyG
   You're a cute chunky submarine. Ships sail past above you —
   your torpedoes auto-fire upward, so all you do is DRAG to steer.
   Torpedoes destroy EVERYTHING they touch: ships, enemy subs,
   even planes in the sky. Sunk ships plunge all the way to the
   ocean floor — and a falling wreck landing on you is fatal.
   Any hit KILLS you... but you pop back to life after a second,
   keeping all your progress (no game over, ever). Bump the
   friendly octopus for rapid-fire. 3 levels, then a fireworks
   finale.
   ONE interaction: drag anywhere. No reading required.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- tuning (all gameplay numbers live here) ---------------- */
  const CFG = {
    SUB_R: 40,           // player sub body size (px) — Fisher-Price chunky
    SUB_SPEED: 560,      // max steering speed toward your finger
    TORP_INTERVAL: 0.9,  // torpedoes auto-fire this often
    RAPID_INTERVAL: 0.25,// ...this often during the octopus bonus
    RAPID_T: 8,          // octopus rapid-fire lasts 8 seconds
    TORP_SPEED: 560,     // torpedo upward speed px/s
    FUSE_R: 46,          // generous proximity fuse — near-misses still hit
    RESPAWN_T: 1.0,      // a hit KILLS you — then you pop back in 1 second
    GRACE_T: 0.8,        // ...plus a brief no-re-kill bubble (forgiving)
    GOALS: [5, 6, 7],    // ships to sink per level
    SHIP_SPEED: [        // per level [min, max]
      [60, 105], [95, 145], [115, 175],
    ],
    SHIP_SPAWN_T: 2.0,   // new ship every ~2s (max 3 afloat)
    MAX_SHIPS: 3,
    MINE_R: 26,
    MINE_N: 4,           // level 2+ drifting mines
    ESUB_N: 2,           // level 3 enemy subs
    ESUB_SPEED: 75,
    ESUB_FIRE_T: 2.6,    // enemy torpedo every ~2.6s
    ETORP_SPEED: 200,    // slow horizontal torpedoes — easy to dodge
    PLANE_T: 4.2,        // a plane crosses every ~4.2s on level 3
    PLANE_SPEED: 170,
    CHARGE_WARN_T: 1.0,  // splash ring shows ~1s before the charge lands
    CHARGE_SINK_VY: 70,  // ...then it sinks slowly through the water
    SPLASH_T: 1.8,       // level intro card seconds
    WAIT_T: 5.0,         // octopus drifts in ~5s into each level
  };

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;
  let WL = 0; // waterline y — ships sail here, sky above, ocean below

  // state: 'title' | 'splash' | 'play' | 'win'
  let state = "title";
  let level = 1;      // 1..3
  let sunk = 0;       // ships sunk this level
  let splashT = 0;

  let sub = null;     // {x,y,tx,ty,deadT,rapidT,wob,fireT}
  let torps = [];     // {x,y}
  let ships = [];     // {x,y,dir,speed,hue,sinking,sinkT,tilt,smkT}
  let mines = [];     // {x,y,vx,vy,blink}
  let esubs = [];     // {x,y,dir,speed,fireT}
  let etorps = [];    // {x,y,dir}
  let planes = [];    // {x,y,dir,speed,dropT}
  let charges = [];   // {x,y,vy,warnT,ringX}
  let octo = null;    // {x,y,dir,t,bonusGiven,happyT}
  let octoT = 0;      // level timer for the octopus cameo

  let parts = [];     // particles {x,y,vx,vy,t,life,hue,r,grav}
  let rings = [];     // expanding rings {x,y,r,t,life,hue,maxR,lw}
  let bubbles = [];   // rising bubbles {x,y,r,t,vy}

  let shipSpawnT = 0, planeT = 0;
  let winT = 0;       // fireworks timer in the win state
  let playBtn = { x: 0, y: 0, w: 0, h: 0 };

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function addPart(p) { if (parts.length < 500) parts.push(p); }
  function addBubble(x, y) {
    if (bubbles.length < 120) bubbles.push({ x: x, y: y, r: rnd(2, 6), t: 0, vy: rnd(40, 110) });
  }

  function boom(x, y, big) {
    const n = big ? 34 : 18;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rnd(60, big ? 380 : 280);
      addPart({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                t: 0, life: rnd(0.4, 0.9), hue: pick([20, 35, 45, 0]), r: rnd(2.5, 6), grav: 160 });
    }
    rings.push({ x: x, y: y, r: 10, t: 0, life: 0.5, hue: 35, maxR: big ? 130 : 90, lw: 6 });
  }

  function confettiBlast(x, y, n) {
    n = n || 90;
    const hues = [45, 190, 315, 150, 265, 0];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rnd(140, 420);
      addPart({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140,
                t: 0, life: rnd(0.8, 1.6), hue: hues[(Math.random() * hues.length) | 0],
                r: rnd(3, 6), grav: 300 });
    }
  }

  /* ---------------- sounds (always on, no toggle — studio rule) ---------------- */
  function sndLaunch() {
    audio.tone(180, 0.18, { type: "sine", vol: 0.07, slideTo: 520 }); // soft whoosh
  }
  function sndBoom() {
    audio.noise(0.35, { vol: 0.16, slideTo: 200 });
    audio.tone(120, 0.3, { type: "sine", vol: 0.12, slideTo: 45 });
  }
  function sndSink() {
    // descending bubble glugs as the ship slides under
    audio.arp([520, 420, 330, 240], 0.11, "sine", 0.10);
  }
  function sndOcto() {
    audio.arp([523, 659, 784, 1047, 1319], 0.08, "square", 0.11); // happy!
  }
  function sndLevel() {
    audio.arp([392, 523, 659, 784], 0.1, "square", 0.12);
  }
  function sndWin() {
    audio.arp([523, 659, 784, 1047, 880, 1047, 1319, 1568, 2093], 0.1, "square", 0.12);
  }

  /* ---------------- setup ---------------- */
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    WL = Math.round(H * 0.12);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    playBtn = { x: W / 2 - 70, y: H * 0.72, w: 140, h: 140 };
    if (!sub) resetSub();
  }
  window.addEventListener("resize", resize);

  function resetSub() {
    sub = { x: W / 2, y: H * 0.72, tx: W / 2, ty: H * 0.72,
            deadT: 0, graceT: 0, rapidT: 0, wob: 0, fireT: 0.4 };
  }

  function clearEntities() {
    torps = []; ships = []; mines = []; esubs = [];
    etorps = []; planes = []; charges = []; octo = null;
    parts = []; rings = []; bubbles = [];
  }

  function startGame() {
    level = 1;
    resetSub();
    startLevel(1);
    if (window.SDGplays) window.SDGplays.played("sinktheship");
  }

  function startLevel(n) {
    level = n;
    sunk = 0;
    clearEntities();
    resetSub();
    shipSpawnT = 0.5;
    planeT = 2.0;
    octoT = 0;
    if (n >= 2) for (let i = 0; i < CFG.MINE_N; i++) spawnMine();
    if (n >= 3) for (let i = 0; i < CFG.ESUB_N; i++) spawnESub(i);
    state = "splash";
    splashT = 0;
    sndLevel();
  }

  /* ---------------- spawners ---------------- */
  const SHIP_KINDS = ["cargo", "sail", "destroyer", "liner", "tug"];
  function spawnShip(x, y, dir, speed, kind) {
    const li = level - 1;
    const d = (dir !== undefined) ? dir : (ships.length % 2 === 0 ? 1 : -1);
    const sp = (speed !== undefined) ? speed
      : rnd(CFG.SHIP_SPEED[li][0], CFG.SHIP_SPEED[li][1]);
    const sx = (x !== undefined) ? x : (d > 0 ? -90 : W + 90);
    ships.push({ x: sx, y: (y !== undefined) ? y : WL + 6,
                 dir: d, speed: sp, hue: pick([8, 210, 150, 265, 35]),
                 kind: (kind !== undefined) ? kind : pick(SHIP_KINDS),
                 sinking: false, sinkT: 0, vy: 0, tilt: 0, smkT: rnd(0, 0.5) });
  }

  function spawnMine(x, y) {
    mines.push({ x: (x !== undefined) ? x : rnd(60, W - 60),
                 y: (y !== undefined) ? y : rnd(H * 0.35, H * 0.68),
                 vx: rnd(-22, 22), vy: rnd(-12, 12), blink: rnd(0, 6.28) });
  }

  function spawnESub(x, y, dir) {
    const d = (dir !== undefined) ? dir : (Math.random() < 0.5 ? 1 : -1);
    esubs.push({ x: (x !== undefined) ? x : (d > 0 ? -80 : W + 80),
                 y: (y !== undefined) ? y : rnd(H * 0.30, H * 0.52),
                 dir: d, speed: CFG.ESUB_SPEED * rnd(0.85, 1.15),
                 fireT: rnd(1.2, 2.4) });
  }

  function spawnPlane(x) {
    const d = Math.random() < 0.5 ? 1 : -1;
    planes.push({ x: (x !== undefined) ? x : (d > 0 ? -70 : W + 70),
                  y: H * 0.05, dir: d, speed: CFG.PLANE_SPEED * rnd(0.9, 1.1),
                  dropT: rnd(0.6, 1.6) });
  }

  function spawnOcto(x, y) {
    const d = Math.random() < 0.5 ? 1 : -1;
    octo = { x: (x !== undefined) ? x : (d > 0 ? -70 : W + 70),
             y: (y !== undefined) ? y : H * 0.5,
             dir: d, t: 0, bonusGiven: false, happyT: 0 };
  }

  /* ---------------- combat ---------------- */
  function fireTorp() {
    torps.push({ x: sub.x, y: sub.y - 46 });
    sndLaunch();
  }

  function sinkShip(s) {
    if (s.sinking) return;
    s.sinking = true;
    s.sinkT = 0;
    s.vy = 60;
    s.tilt = s.dir * 0.5;
    sunk++;
    boom(s.x, s.y - 10, true);
    sndBoom();
    sndSink(); // descending glugs as she goes down
  }

  // torpedoes destroy enemy subs too — big boom, they're gone
  function sinkESub(e) {
    const i = esubs.indexOf(e);
    if (i < 0) return;
    esubs.splice(i, 1);
    boom(e.x, e.y, true);
    sndBoom();
  }

  // ...and planes! A hit plane blows up in the sky
  function downPlane(p) {
    const i = planes.indexOf(p);
    if (i < 0) return;
    planes.splice(i, 1);
    boom(p.x, p.y, true);
    sndBoom();
  }

  // ANY hit is fatal — mine, torpedo, depth charge, or a falling wreck.
  // But you pop back to life after a second, progress fully intact.
  function killSub(x, y) {
    if (sub.deadT > 0 || sub.graceT > 0) return; // already dead / in grace
    sub.deadT = CFG.RESPAWN_T;
    sub.graceT = CFG.RESPAWN_T + CFG.GRACE_T; // brief no-re-kill bubble
    boom(x, y, true);
    sndBoom();
  }

  function respawnSub() {
    sub.x = W / 2; sub.y = H * 0.72;
    sub.tx = sub.x; sub.ty = sub.y;
    rings.push({ x: sub.x, y: sub.y, r: 14, t: 0, life: 0.5, hue: 190, maxR: 90, lw: 6 });
    for (let i = 0; i < 8; i++) addBubble(sub.x + rnd(-20, 20), sub.y + rnd(-14, 14));
  }

  /* ---------------- input ---------------- */
  function onDown(x, y) {
    if (audio.unlock) audio.unlock();
    if (state === "title") { startGame(); return; }
    if (state === "win") {
      if (x >= playBtn.x && x <= playBtn.x + playBtn.w &&
          y >= playBtn.y && y <= playBtn.y + playBtn.h) startGame();
      return;
    }
    steerTo(x, y);
  }
  function onMove(x, y) {
    if (state !== "play") return;
    steerTo(x, y);
  }
  function steerTo(x, y) {
    sub.tx = clamp(x, 40, W - 40);
    sub.ty = clamp(y, H * 0.34, H - 70); // bottom two-thirds only
  }
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault(); onDown(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (e.buttons || e.pointerType === "touch") { e.preventDefault(); onMove(e.clientX, e.clientY); }
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function update(dt) {
    time += dt;
    // particles & bubbles always animate
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt;
      if (r.t >= r.life) rings.splice(i, 1);
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.t += dt; b.y -= b.vy * dt; b.x += Math.sin(time * 3 + b.t * 5) * 12 * dt;
      if (b.y < WL + 4) bubbles.splice(i, 1);
    }

    if (state === "splash") {
      splashT += dt;
      if (splashT >= CFG.SPLASH_T) { state = "play"; }
      return;
    }
    if (state === "win") {
      winT += dt;
      if (winT > 0.4 && Math.random() < dt * 2.2) {
        const fx = rnd(W * 0.15, W * 0.85), fy = rnd(H * 0.08, H * 0.4);
        confettiBlast(fx, fy, 40);
        audio.arp([523, 659, 784, 1047], 0.07, "square", 0.07);
      }
      return; // tableau stays frozen
    }
    if (state !== "play") return;

    /* ----- player sub ----- */
    if (sub.deadT > 0) {
      // dead: drifting bubbles where you exploded, then pop back to life
      sub.deadT -= dt;
      if (sub.deadT <= 0) respawnSub();
    } else {
      const dx = sub.tx - sub.x, dy = sub.ty - sub.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const step = Math.min(d, CFG.SUB_SPEED * dt);
        sub.x += dx / d * step; sub.y += dy / d * step;
      }
    }
    if (sub.graceT > 0) sub.graceT -= dt;
    if (sub.rapidT > 0) sub.rapidT -= dt;

    // auto-fire (not while dead)
    if (sub.deadT <= 0) {
      sub.fireT -= dt;
      if (sub.fireT <= 0) {
        fireTorp();
        sub.fireT = sub.rapidT > 0 ? CFG.RAPID_INTERVAL : CFG.TORP_INTERVAL;
      }
    }

    // torpedoes fly up; the fuse kills whatever it touches —
    // ships at the waterline, enemy subs below, planes in the sky
    for (let i = torps.length - 1; i >= 0; i--) {
      const t = torps[i];
      t.y -= CFG.TORP_SPEED * dt;
      if (t.y > WL && Math.random() < dt * 20) addBubble(t.x + rnd(-4, 4), t.y);
      let hit = false;
      for (const s of ships) {
        if (!s.sinking && dist(t.x, t.y, s.x, s.y - 14) < CFG.FUSE_R) {
          sinkShip(s); hit = true; break;
        }
      }
      if (!hit) for (const e of esubs) {
        if (dist(t.x, t.y, e.x, e.y) < CFG.FUSE_R) {
          sinkESub(e); hit = true; break;
        }
      }
      if (!hit) for (const p of planes) {
        if (dist(t.x, t.y, p.x, p.y) < CFG.FUSE_R) {
          downPlane(p); hit = true; break;
        }
      }
      if (hit || t.y < -40) torps.splice(i, 1);
    }

    // ships sail; sunk ones PLUNGE to the ocean floor — and a falling
    // wreck crushes you if it lands on you
    for (let i = ships.length - 1; i >= 0; i--) {
      const s = ships[i];
      if (s.sinking) {
        s.sinkT += dt;
        s.vy = Math.min(s.vy + 420 * dt, 360);
        s.y += s.vy * dt;
        s.tilt += s.dir * 0.9 * dt;
        if (sub.deadT <= 0 && sub.graceT <= 0 &&
            dist(sub.x, sub.y, s.x, s.y) < 72) {
          killSub(sub.x, sub.y);
        }
        if (Math.random() < dt * 14) addBubble(s.x + rnd(-30, 30), s.y - 10);
        if (s.y > H + 90) ships.splice(i, 1);
      } else {
        s.x += s.dir * s.speed * dt;
        s.smkT += dt;
        if (s.smkT > 0.4) { s.smkT = 0; addBubble(s.x - s.dir * 20, s.y - 52); }
        if ((s.dir > 0 && s.x > W + 110) || (s.dir < 0 && s.x < -110)) ships.splice(i, 1);
      }
    }

    // keep ships coming until the goal is sunk
    const afloat = ships.filter(function (s) { return !s.sinking; }).length;
    shipSpawnT -= dt;
    if (shipSpawnT <= 0 && afloat < CFG.MAX_SHIPS && sunk + afloat < CFG.GOALS[level - 1] + 1) {
      spawnShip(); shipSpawnT = CFG.SHIP_SPAWN_T * rnd(0.8, 1.2);
    }

    // level complete?
    if (sunk >= CFG.GOALS[level - 1] && !ships.some(function (s) { return s.sinking; })) {
      if (level < 3) { startLevel(level + 1); }
      else { state = "win"; winT = 0; sndWin(); confettiBlast(W / 2, H * 0.3, 130); }
      return;
    }

    /* ----- mines (level 2+) ----- */
    for (const m of mines) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.blink += dt * 5;
      if (m.x < 40 || m.x > W - 40) m.vx *= -1;
      if (m.y < H * 0.3 || m.y > H * 0.72) m.vy *= -1;
      if (sub.deadT <= 0 && sub.graceT <= 0 &&
          dist(sub.x, sub.y, m.x, m.y) < CFG.MINE_R + CFG.SUB_R * 0.7) {
        killSub(sub.x, sub.y);
        m.vx = (m.x < sub.x ? -1 : 1) * rnd(30, 60); // knock the mine away
        m.vy = (m.y < sub.y ? -1 : 1) * rnd(20, 40);
      }
    }

    /* ----- enemy subs (level 3) ----- */
    for (const e of esubs) {
      e.x += e.dir * e.speed * dt;
      if (e.x > W + 100) e.x = -100;
      if (e.x < -100) e.x = W + 100;
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = CFG.ESUB_FIRE_T * rnd(0.85, 1.2);
        const dir = sub.x >= e.x ? 1 : -1;
        etorps.push({ x: e.x + dir * 50, y: e.y, dir: dir });
        audio.tone(200, 0.15, { type: "sine", vol: 0.05, slideTo: 400 });
      }
    }
    for (let i = etorps.length - 1; i >= 0; i--) {
      const t = etorps[i];
      t.x += t.dir * CFG.ETORP_SPEED * dt;
      if (Math.random() < dt * 16) addBubble(t.x, t.y - 6);
      if (sub.deadT <= 0 && sub.graceT <= 0 && dist(sub.x, sub.y, t.x, t.y) < 44) {
        killSub(t.x, t.y); etorps.splice(i, 1); continue;
      }
      if (t.x < -60 || t.x > W + 60) etorps.splice(i, 1);
    }

    /* ----- planes + depth charges (level 3) ----- */
    planeT -= dt;
    if (planeT <= 0) { spawnPlane(); planeT = CFG.PLANE_T * rnd(0.85, 1.2); }
    for (let i = planes.length - 1; i >= 0; i--) {
      const p = planes[i];
      p.x += p.dir * p.speed * dt;
      p.dropT -= dt;
      if (p.dropT <= 0) {
        p.dropT = 9999; // one charge per crossing
        const cx = clamp(p.x + rnd(-30, 30), 30, W - 30);
        charges.push({ x: cx, y: p.y, vy: (WL - p.y) / CFG.CHARGE_WARN_T,
                       warnT: CFG.CHARGE_WARN_T, ringX: cx });
      }
      if ((p.dir > 0 && p.x > W + 90) || (p.dir < 0 && p.x < -90)) planes.splice(i, 1);
    }
    for (let i = charges.length - 1; i >= 0; i--) {
      const c = charges[i];
      if (c.warnT > 0) {
        c.warnT -= dt;
        c.y += c.vy * dt;
        if (c.warnT <= 0 || c.y >= WL) { c.y = Math.max(c.y, WL); c.vy = CFG.CHARGE_SINK_VY; }
      } else {
        c.y += c.vy * dt;
        if (Math.random() < dt * 10) addBubble(c.x + rnd(-5, 5), c.y - 8);
      }
      if (sub.deadT <= 0 && sub.graceT <= 0 && dist(sub.x, sub.y, c.x, c.y) < 44) {
        boom(c.x, c.y, false); killSub(c.x, c.y); charges.splice(i, 1); continue;
      }
      if (c.y > H + 30) charges.splice(i, 1);
    }

    /* ----- friendly octopus: one cameo per level ----- */
    octoT += dt;
    if (!octo && octoT > CFG.WAIT_T && state === "play") spawnOcto();
    if (octo) {
      const o = octo;
      o.t += dt;
      o.x += o.dir * 62 * dt;
      o.y += Math.sin(o.t * 2.2) * 26 * dt;
      if (o.happyT > 0) o.happyT -= dt;
      if (!o.bonusGiven && dist(sub.x, sub.y, o.x, o.y) < 84) {
        o.bonusGiven = true; o.happyT = 1.2;
        sub.rapidT = CFG.RAPID_T;
        sndOcto();
        rings.push({ x: o.x, y: o.y, r: 20, t: 0, life: 0.6, hue: 280, maxR: 110, lw: 6 });
      }
      if ((o.dir > 0 && o.x > W + 90) || (o.dir < 0 && o.x < -90)) octo = null;
    }
  }

  /* ---------------- drawing ---------------- */
  function drawWater() {
    const g = ctx.createLinearGradient(0, WL, 0, H);
    g.addColorStop(0, "#2fa3c7");
    g.addColorStop(0.45, "#1668a0");
    g.addColorStop(1, "#0a2f5c");
    ctx.fillStyle = g;
    ctx.fillRect(0, WL, W, H - WL);
    // sky
    const sg = ctx.createLinearGradient(0, 0, 0, WL);
    sg.addColorStop(0, "#8fd8f2");
    sg.addColorStop(1, "#d8f4ff");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, WL);
    // sun
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath(); ctx.arc(W - 70, 44, 26, 0, 6.2832); ctx.fill();
    // light rays
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 4; i++) {
      const rx = (i * 0.27 + 0.06) * W + Math.sin(time * 0.4 + i) * 14;
      ctx.beginPath();
      ctx.moveTo(rx, WL); ctx.lineTo(rx + 70, WL);
      ctx.lineTo(rx + 170, H); ctx.lineTo(rx + 60, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // wavy surface
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) {
      const y = WL + Math.sin(x * 0.05 + time * 2.2) * 4;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // sandy bottom
    ctx.fillStyle = "#d9c084";
    ctx.fillRect(0, H - 26, W, 26);
    ctx.fillStyle = "rgba(120,90,40,0.35)";
    for (let x = 20; x < W; x += 90) {
      ctx.beginPath(); ctx.ellipse(x, H - 18, 26, 7, 0, 0, 6.2832); ctx.fill();
    }
  }

  function drawSub() {
    const s = sub;
    if (s.deadT > 0) return; // you're gone — pop back in a second
    ctx.save();
    ctx.translate(s.x, s.y);
    // rapid-fire glow
    if (s.rapidT > 0) {
      ctx.strokeStyle = "rgba(255,210,63," + (0.5 + 0.4 * Math.sin(time * 12)).toFixed(2) + ")";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0, 0, 62, 34, 0, 0, 6.2832); ctx.stroke();
    }
    // post-respawn grace bubble — gentle "you're safe" shimmer
    if (s.graceT > 0) {
      ctx.strokeStyle = "rgba(160,220,255," + (0.35 + 0.2 * Math.sin(time * 8)).toFixed(2) + ")";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 0, 68, 38, 0, 0, 6.2832); ctx.stroke();
    }
    const OUT = "#7a2d12", YEL = "#ffb62e", YEL_D = "#e08b12";
    // propeller
    const spin = time * 18;
    ctx.strokeStyle = OUT; ctx.lineWidth = 5;
    ctx.save(); ctx.translate(-58, 0); ctx.rotate(spin);
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke();
    ctx.restore();
    // tail fins
    ctx.fillStyle = YEL_D;
    ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-62, -18); ctx.lineTo(-62, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    // hull
    ctx.fillStyle = YEL;
    ctx.beginPath(); ctx.ellipse(0, 0, 52, 26, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    // stripe
    ctx.fillStyle = "#e23b3b";
    ctx.fillRect(-52, -6, 104, 12);
    // conning tower
    ctx.fillStyle = YEL_D;
    ctx.beginPath(); ctx.ellipse(2, -26, 20, 14, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    // periscope
    ctx.strokeStyle = OUT; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(2, -38); ctx.lineTo(2, -50); ctx.lineTo(14, -50); ctx.stroke();
    // portholes
    ctx.fillStyle = "#bfe9ff";
    for (const px of [-24, 0, 24]) {
      ctx.beginPath(); ctx.arc(px, 2, 8, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    }
    // torpedo tube hint
    ctx.fillStyle = "#5b220c";
    ctx.beginPath(); ctx.arc(52, -8, 6, 0, 6.2832); ctx.fill();
    ctx.restore();
    // bubbles from the sub
    if (Math.random() < 0.06) addBubble(s.x - 40, s.y - 10);
  }

  /* Five ship kinds, each a distinct silhouette so no two look alike:
     cargo (container stack), sail (tall sails), destroyer (warship),
     liner (cruise decks), tug (chunky workboat). */
  function drawShip(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.dir < 0) ctx.scale(-1, 1);
    if (s.sinking) {
      ctx.rotate(s.tilt);
      // fades into the deep as she plunges
      const depthK = Math.min(1, Math.max(0, (s.y - WL) / (H * 0.55)));
      ctx.globalAlpha = Math.max(0, 1 - depthK * 0.85);
    }
    const OUT = "#3a2a18";
    ctx.lineWidth = 4; ctx.strokeStyle = OUT;
    const kind = s.kind || "cargo";
    if (kind === "cargo") {
      // long hull + stacked shipping containers
      ctx.fillStyle = "hsl(" + s.hue + ",55%,42%)";
      ctx.beginPath();
      ctx.moveTo(-70, -14); ctx.lineTo(70, -14); ctx.lineTo(54, 16); ctx.lineTo(-54, 16);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.fillRect(-66, -18, 132, 6);
      const boxHues = [8, 210, 150, 35];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "hsl(" + boxHues[(i + s.hue) % 4] + ",60%,50%)";
        ctx.fillRect(-58 + i * 30, -44, 28, 26);
        ctx.strokeRect(-58 + i * 30, -44, 28, 26);
        if (i % 2 === 0) {
          ctx.fillRect(-58 + i * 30, -68, 28, 22);
          ctx.strokeRect(-58 + i * 30, -68, 28, 22);
        }
      }
      // wheelhouse aft
      ctx.fillStyle = "#f4ead2";
      ctx.fillRect(44, -52, 24, 34); ctx.strokeRect(44, -52, 24, 34);
      ctx.fillStyle = "#7ec8e8"; ctx.fillRect(48, -46, 16, 10);
    } else if (kind === "sail") {
      // sailboat: hull + tall mast + big white sails
      ctx.fillStyle = "#8a5a33";
      ctx.beginPath();
      ctx.moveTo(-52, -10); ctx.lineTo(52, -10); ctx.lineTo(34, 18); ctx.lineTo(-34, 18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#5a3a1e"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -108); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = OUT;
      // main sail + jib
      ctx.fillStyle = "#fdfdf4";
      ctx.beginPath(); ctx.moveTo(4, -104); ctx.lineTo(4, -14); ctx.lineTo(52, -14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -96); ctx.lineTo(-4, -14); ctx.lineTo(-44, -14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // pennant
      ctx.fillStyle = "#e23b3b";
      ctx.beginPath(); ctx.moveTo(0, -108); ctx.lineTo(24, -102); ctx.lineTo(0, -96);
      ctx.closePath(); ctx.fill();
    } else if (kind === "destroyer") {
      // gray warship: sleek hull, gun turret, radar mast
      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.moveTo(-66, -12); ctx.lineTo(66, -12); ctx.lineTo(70, -2); ctx.lineTo(48, 16); ctx.lineTo(-52, 16);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#4b5563"; ctx.fillRect(-62, -16, 128, 6);
      // gun turret + barrel
      ctx.fillStyle = "#565e6b";
      ctx.beginPath(); ctx.arc(30, -22, 14, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(30, -26); ctx.rotate(-0.25);
      ctx.fillRect(0, -4, 44, 8); ctx.strokeRect(0, -4, 44, 8); ctx.restore();
      // radar mast
      ctx.strokeStyle = OUT; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-20, -52); ctx.stroke();
      ctx.fillStyle = "#9ca3af";
      ctx.fillRect(-34, -58, 28, 8); ctx.strokeRect(-34, -58, 28, 8);
      ctx.fillStyle = "#e23b3b";
      ctx.beginPath(); ctx.arc(-20, -62, 5, 0, 6.2832); ctx.fill();
    } else if (kind === "liner") {
      // cruise liner: white, stacked decks, portholes, twin funnels
      ctx.fillStyle = "#f2f4f6";
      ctx.beginPath();
      ctx.moveTo(-64, -16); ctx.lineTo(64, -16); ctx.lineTo(50, 16); ctx.lineTo(-50, 16);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#dfe5ea";
      ctx.fillRect(-56, -40, 112, 24); ctx.strokeRect(-56, -40, 112, 24);
      ctx.fillRect(-46, -62, 92, 22); ctx.strokeRect(-46, -62, 92, 22);
      // portholes
      ctx.fillStyle = "#2b6cb0";
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.arc(-45 + i * 18, -28, 5, 0, 6.2832); ctx.fill();
        if (i < 5) { ctx.beginPath(); ctx.arc(-36 + i * 18, -51, 4, 0, 6.2832); ctx.fill(); }
      }
      // twin funnels
      for (const fx of [-16, 16]) {
        ctx.fillStyle = "#e23b3b";
        ctx.fillRect(fx - 8, -92, 16, 32); ctx.strokeRect(fx - 8, -92, 16, 32);
        ctx.fillStyle = "#333"; ctx.fillRect(fx - 8, -92, 16, 8);
      }
    } else { // tug
      // chunky workboat: tall hull, big wheelhouse, fat stack
      ctx.fillStyle = "hsl(" + s.hue + ",60%,38%)";
      ctx.beginPath();
      ctx.moveTo(-44, -20); ctx.lineTo(44, -20); ctx.lineTo(34, 18); ctx.lineTo(-34, 18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.fillRect(-40, -24, 80, 6);
      // tire fenders
      ctx.fillStyle = "#222";
      for (const fx of [-30, 0, 30]) {
        ctx.beginPath(); ctx.arc(fx, 2, 8, 0, 6.2832); ctx.fill();
      }
      // wheelhouse
      ctx.fillStyle = "#f4ead2";
      ctx.fillRect(-20, -58, 40, 36); ctx.strokeRect(-20, -58, 40, 36);
      ctx.fillStyle = "#7ec8e8"; ctx.fillRect(-14, -52, 28, 14); ctx.strokeRect(-14, -52, 28, 14);
      // fat smokestack
      ctx.fillStyle = "#444";
      ctx.fillRect(-34, -84, 18, 30); ctx.strokeRect(-34, -84, 18, 30);
      ctx.fillStyle = "#e23b3b"; ctx.fillRect(-34, -84, 18, 9);
    }
    ctx.restore();
  }

  function drawMine(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.sin(time * 1.3 + m.blink) * 0.15);
    const OUT = "#1c1c1c";
    ctx.fillStyle = "#2e2e2e";
    ctx.strokeStyle = OUT; ctx.lineWidth = 4;
    // spikes
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(Math.cos(a) * 32, Math.sin(a) * 32, 5, 0, 6.2832); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.2832); ctx.fill(); ctx.stroke();
    // blinking red light
    const on = Math.sin(m.blink) > 0;
    ctx.fillStyle = on ? "#ff3b30" : "#5a1512";
    ctx.beginPath(); ctx.arc(0, -8, 7, 0, 6.2832); ctx.fill();
    if (on) {
      ctx.strokeStyle = "rgba(255,80,70,0.6)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -8, 13, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
  }

  function drawESub(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.dir < 0) ctx.scale(-1, 1);
    const OUT = "#141414";
    ctx.fillStyle = "#3d3d4d";
    ctx.strokeStyle = OUT; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 20, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#2b2b38";
    ctx.beginPath(); ctx.ellipse(0, -20, 14, 10, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    // angry eye
    ctx.fillStyle = "#ff5b4d";
    ctx.beginPath(); ctx.arc(28, -4, 7, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#1a0000";
    ctx.beginPath(); ctx.arc(30, -4, 3, 0, 6.2832); ctx.fill();
    // torpedo tube
    ctx.fillStyle = "#101010";
    ctx.fillRect(40, -6, 12, 12);
    ctx.restore();
  }

  function drawPlane(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.dir < 0) ctx.scale(-1, 1);
    ctx.fillStyle = "#e8e8ee";
    ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
    // fuselage
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 9, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    // wings
    ctx.fillStyle = "#c33";
    ctx.fillRect(-8, -26, 16, 30);
    ctx.strokeRect(-8, -26, 16, 30);
    // tail
    ctx.fillStyle = "#c33";
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-44, -12); ctx.lineTo(-44, 12); ctx.closePath(); ctx.fill();
    // propeller blur
    ctx.strokeStyle = "rgba(60,60,60,0.5)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(38, -12); ctx.lineTo(38, 12); ctx.stroke();
    ctx.restore();
  }

  function drawOcto(o) {
    ctx.save();
    ctx.translate(o.x, o.y + Math.sin(o.t * 3) * 6);
    const PUR = "#b678e8", PUR_D = "#8f4fc4", OUT = "#5e2f86";
    ctx.lineWidth = 4; ctx.strokeStyle = OUT;
    // waving arms
    ctx.strokeStyle = PUR_D; ctx.lineWidth = 9; ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.15 + i * 0.14) + Math.sin(o.t * 4 + i) * 0.25;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.quadraticCurveTo(Math.cos(a) * 34, 18 + Math.sin(a) * 30,
                           Math.cos(a) * 46, 34 + Math.sin(a) * 34);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    // head dome
    ctx.fillStyle = PUR;
    ctx.beginPath(); ctx.arc(0, 0, 34, Math.PI, 0); ctx.fill();
    ctx.fillRect(-34, 0, 68, 20);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 34, Math.PI, 0); ctx.stroke();
    // happy face
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(-12, -6, 9, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -6, 9, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#2a1140";
    const look = o.bonusGiven ? 0 : Math.sin(o.t * 2) * 2;
    ctx.beginPath(); ctx.arc(-12 + look, -6, 4.5, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(12 + look, -6, 4.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = "#2a1140"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 6, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // sparkle when the bonus lands
    if (o.happyT > 0) {
      ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + o.t * 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 44);
        ctx.lineTo(Math.cos(a) * 54, Math.sin(a) * 54);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTorp(t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.fillStyle = "#dfe6ee";
    ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 18, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e23b3b";
    ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(7, 10); ctx.lineTo(0, 20); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawETorp(t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    if (t.dir < 0) ctx.scale(-1, 1);
    ctx.fillStyle = "#5a5a6a";
    ctx.strokeStyle = "#111"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 7, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff5b4d";
    ctx.beginPath(); ctx.arc(18, 0, 5, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function drawCharge(c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = "#39424e";
    ctx.strokeStyle = "#14181d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff5b4d";
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.2832); ctx.fill();
    ctx.restore();
    // telegraph: splash ring on the water while it falls
    if (c.warnT > 0) {
      const k = 1 - Math.max(0, c.warnT) / CFG.CHARGE_WARN_T;
      ctx.strokeStyle = "rgba(255,90,70," + (0.45 + 0.45 * Math.sin(time * 16)).toFixed(2) + ")";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(c.ringX, WL + 4, 14 + k * 26, 7, 0, 0, 6.2832); ctx.stroke();
    }
  }

  function drawProgress() {
    // row of little ship icons at the top — fills as you sink them
    const goal = CFG.GOALS[level - 1];
    const n = goal;
    const bw = 34, gap = 10, total = n * bw + (n - 1) * gap;
    let x0 = W / 2 - total / 2;
    const y0 = 14;
    for (let i = 0; i < n; i++) {
      const done = i < sunk;
      ctx.save();
      ctx.translate(x0 + i * (bw + gap) + bw / 2, y0 + 12);
      ctx.globalAlpha = done ? 1 : 0.35;
      ctx.fillStyle = done ? "#ffd23f" : "#ffffff";
      ctx.strokeStyle = "#3a2a18"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-14, -4); ctx.lineTo(14, -4); ctx.lineTo(10, 8); ctx.lineTo(-10, 8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(-5, -14, 10, 10);
      if (done) {
        ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, 6.2832); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawLevelIcon(n, x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 4; ctx.strokeStyle = "#123";
    if (n === 1) {
      ctx.fillStyle = "#4d96d9";
      ctx.beginPath();
      ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.lineTo(32, 26); ctx.lineTo(-32, 26);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f4ead2"; ctx.fillRect(-16, -26, 32, 26); ctx.strokeRect(-16, -26, 32, 26);
    } else if (n === 2) {
      ctx.fillStyle = "#2e2e2e";
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
        ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath(); ctx.arc(0, -6, 7, 0, 6.2832); ctx.fill();
    } else {
      ctx.fillStyle = "#e8e8ee";
      ctx.beginPath(); ctx.ellipse(0, 0, 40, 12, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c33"; ctx.fillRect(-8, -34, 16, 34);
    }
    ctx.restore();
  }

  function drawTitle() {
    drawWater();
    // hero sub + ships tableau
    ctx.save();
    ctx.globalAlpha = 0.95;
    const keepSub = sub;
    sub = { x: W / 2, y: H * 0.62, tx: W / 2, ty: H * 0.62, deadT: 0, graceT: 0, rapidT: 0, wob: 0, fireT: 9 };
    drawSub();
    sub = keepSub;
    ctx.restore();
    drawShip({ x: W * 0.24, y: WL + 6, dir: 1, hue: 8, kind: "cargo", sinking: false, sinkT: 0, vy: 0, tilt: 0, smkT: 0 });
    drawShip({ x: W * 0.74, y: WL + 6, dir: -1, hue: 210, kind: "sail", sinking: false, sinkT: 0, vy: 0, tilt: 0, smkT: 0 });
    // tap hint: pulsing ring
    const pr = 46 + Math.sin(time * 4) * 10;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(W / 2, H * 0.86, pr, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(W / 2, H * 0.86, 12, 0, 6.2832); ctx.fill();
  }

  function drawSplash() {
    drawWater();
    ctx.fillStyle = "rgba(4,30,50,0.45)";
    ctx.fillRect(0, 0, W, H);
    const pop = Math.min(1, splashT / 0.35);
    ctx.save();
    ctx.translate(W / 2, H * 0.42);
    ctx.scale(pop, pop);
    drawPixelNumber(ctx, level, 0, -70, 9, "#ffd23f", true);
    drawLevelIcon(level, 0, 60, 1.6);
    ctx.restore();
  }

  function drawWin() {
    drawWater();
    for (const s of ships) drawShip(s);
    if (sub) drawSub();
    if (octo) drawOcto(octo);
    // replay arrow — giant, no reading needed
    const b = playBtn;
    const pulse = 1 + Math.sin(time * 4) * 0.05;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(10,40,70,0.75)";
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, 6.2832); ctx.stroke();
    // curved replay arrow
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 12; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, 38, -0.6, 4.4); ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(38, -30); ctx.lineTo(52, 2); ctx.lineTo(18, -8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (state === "title") { drawTitle(); return; }
    if (state === "splash") { drawSplash(); return; }
    if (state === "win") { drawWin(); }
    else {
      drawWater();
      drawProgress();
      for (const m of mines) drawMine(m);
      for (const e of esubs) drawESub(e);
      for (const t of etorps) drawETorp(t);
      for (const p of planes) drawPlane(p);
      for (const c of charges) drawCharge(c);
      if (octo) drawOcto(octo);
      for (const s of ships) drawShip(s);
      for (const t of torps) drawTorp(t);
      drawSub();
    }
    // bubbles
    ctx.fillStyle = "rgba(220,240,255,0.5)";
    for (const b of bubbles) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
    }
    // rings
    for (const r of rings) {
      const k = r.t / r.life;
      const rad = r.r + (r.maxR - r.r) * k;
      ctx.strokeStyle = "hsla(" + r.hue + ",90%,60%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = r.lw * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 6.2832); ctx.stroke();
    }
    // particles
    for (const p of parts) {
      const k = 1 - p.t / p.life;
      ctx.fillStyle = "hsla(" + p.hue + ",90%,55%," + k.toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k + 0.5, 0, 6.2832); ctx.fill();
    }
  }

  /* ---------------- main loop ---------------- */
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  resetSub();
  requestAnimationFrame(frame);

  /* Test hook. `debug` exposes live state so tests can steer the sub,
     force levels, spawn entities, and inspect everything — test-only,
     never used by the game. */
  window.__shipTest = {
    get state() { return state; },
    get level() { return level; },
    get sunk() { return sunk; },
    get cfg() { return CFG; },
    debug: {
      sub: function () { return sub; },
      ships: function () { return ships; },
      torps: function () { return torps; },
      mines: function () { return mines; },
      esubs: function () { return esubs; },
      etorps: function () { return etorps; },
      planes: function () { return planes; },
      charges: function () { return charges; },
      octo: function () { return octo; },
      playBtn: function () { return playBtn; },
      forceLevel: function (n) {
        if (state !== "play" && state !== "splash") startGame();
        startLevel(n);
      },
      spawnShip: function (x, y, dir, speed, kind) { spawnShip(x, y, dir, speed, kind); },
      spawnMine: function (x, y) { spawnMine(x, y); },
      spawnESub: function (x, y, dir) { spawnESub(x, y, dir); },
      spawnPlane: function (x) { spawnPlane(x); },
      spawnOcto: function (x, y) { octo = { x: x, y: y, dir: 1, t: 0, bonusGiven: false, happyT: 0 }; },
    },
    start: function () { startGame(); },
    tap: function (x, y) { onDown(x, y); },
    drag: function (x, y) {
      if (state === "play") steerTo(x, y);
      else { onDown(x, y); if (state === "play") steerTo(x, y); }
    },
    step: function (dt) { update(dt || 0.016); },
  };
})();
