/* ============================================================
   TAG! YOU'RE IT — SmoothDaddyG (game #18)
   Real playground tag, kept simple. The big bouncing star badge
   marks IT — and IT passes to whoever gets tagged.
   You start as IT. Everybody runs from you. Catch someone on
   the slide and THEY'RE it — now run, because they chase whoever
   is closest, and that might be you. Tag anybody, anybody can
   tag you. When the timer runs out, whoever is IT is the loser.
   ONE interaction: drag anywhere. That's all there is to it.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- tuning (all gameplay numbers live here) ---------------- */
  const CFG = {
    KID_COUNT: 5,       // friends to tag
    ROUND_T: 60,        // seconds on the clock — whoever is IT at 0 loses
    PLAYER_SPEED: 260,  // your kid runs toward your finger, px/s
    KID_SPEED_MIN: 60,  // friends dawdle — always slower than you
    KID_SPEED_MAX: 90,
    KID_TURN_MIN: 2,    // friends change direction every 2-4 s
    KID_TURN_MAX: 4,
    IT_KID_SPEED: 170,  // the "it" kid chases hard — faster than fleeing
                        // friends (120) but slower than you (260), so you
                        // can dodge or chase as you like
    KID_FLEE_SPEED: 120, // friends run from IT — quick, but you catch them
    FLEE_R: 150,        // friends start running when IT gets this close
    TAG_COOLDOWN: 0.8,  // s after a tag before anyone can be tagged again —
                        // the "it counts" beat: tagger gets a head start,
                        // then the new IT can tag anybody
    TAG_R: 70,          // generous tag radius — be kind
    KID_R: 34,          // kid body size (px) — BIG, Fisher-Price chunky
    EDGE_M: 70,         // everyone stays this far inside the field
    OBSTACLES: 3,       // solid playground equipment to chase around
  };

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  // state: 'title' | 'play' | 'end'
  let state = "title";

  // the tagger: {x, y, angle, phase, target:{x,y}|null}
  // drag anywhere and the kid runs toward your finger
  let player = null;

  // friends: {x, y, angle, speed, turnT, phase, color, skin}
  // they dawdle around, run from IT (and get caught up on the slide!),
  // and chase hard when THEY are it
  let kids = [];

  // who is IT: "player" or a kid index. The star badge marks them, and
  // IT passes to whoever gets tagged — real playground rules.
  let it = "player";
  // last tag {newIt, t} — the brief "it counts" beat before anyone can
  // be tagged again, so the tagger gets a head start
  let lastTag = null;
  // the clock: seconds left in the round. At 0, whoever is IT loses.
  let roundT = CFG.ROUND_T;

  // solid playground obstacles: {x, y, w, h, kind} — everyone runs AROUND
  // them (circle-vs-rect push-out, so chases slide around corners).
  // Tags stay pure distance (generous, forgiving) — only movement collides.
  let obstacles = [];

  function buildObstacles() {
    obstacles = [
      { kind: "slide", x: W * 0.08, y: H * 0.30, w: 130, h: 92 },
      { kind: "dome",  x: W * 0.66, y: H * 0.52, w: 116, h: 84 },
      { kind: "tree",  x: W * 0.30, y: H * 0.72, w: 76,  h: 76 },
    ];
  }

  function insideObstacle(x, y, pad) {
    pad = pad || 0;
    for (const o of obstacles) {
      if (x > o.x - pad && x < o.x + o.w + pad &&
          y > o.y - pad && y < o.y + o.h + pad) return true;
    }
    return false;
  }

  // push a circle (kid/player body) out of every obstacle — slides around
  function collideObstacles(p, r) {
    for (const o of obstacles) {
      const cx = clamp(p.x, o.x, o.x + o.w);
      const cy = clamp(p.y, o.y, o.y + o.h);
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < r) {
        if (d > 0.001) {
          p.x = cx + dx / d * r;
          p.y = cy + dy / d * r;
        } else {
          // center inside the rect: pop out the nearest face
          const pl = p.x - o.x, pr = o.x + o.w - p.x;
          const pt = p.y - o.y, pb = o.y + o.h - p.y;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) p.x = o.x - r;
          else if (m === pr) p.x = o.x + o.w + r;
          else if (m === pt) p.y = o.y - r;
          else p.y = o.y + o.h + r;
        }
      }
    }
  }

  // do segments AB and CD intersect? (for obstacle line-of-sight)
  // Intersections at the very start of AB (t ~ 0) don't count — that's
  // just us standing on a waypoint corner, not a real blockage.
  function segInt(ax, ay, bx, by, cx, cy, dx, dy) {
    const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
    const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
    return t > 1e-6 && t <= 1 && u >= 0 && u <= 1;
  }

  // steer k toward (tx,ty) at speed, swinging around obstacle corners
  // instead of stalling on them. Returns true when the real target is
  // reached. Detour corners are snapped to once close, so the next tick
  // routes cleanly from the exact corner instead of hovering near it.
  function steerAround(k, tx, ty, speed, dt) {
    const wp = routeAround(k, tx, ty);
    const isTarget = (wp.x === tx && wp.y === ty);
    let d = dist(k.x, k.y, wp.x, wp.y);
    if (!isTarget && d < 12) {
      k.x = wp.x; k.y = wp.y;
      d = 0;
    }
    if (isTarget && d < 4) return true; // arrived — happy stop
    if (d > 0.5) {
      const step = Math.min(d, speed * dt);
      k.angle = Math.atan2(wp.y - k.y, wp.x - k.x);
      k.x += (wp.x - k.x) / d * step;
      k.y += (wp.y - k.y) / d * step;
    }
    return false;
  }

  // steer toward (tx,ty), routing around an obstacle corner when one sits
  // directly in the way — so chases never deadlock head-on into the slide.
  function routeAround(k, tx, ty) {
    const pad = CFG.KID_R * 0.8; // matches the collision radius — no dead band
    for (const o of obstacles) {
      const x1 = o.x - pad, y1 = o.y - pad;
      const x2 = o.x + o.w + pad, y2 = o.y + o.h + pad;
      // inside the expanded rect (shouldn't happen — collision keeps us out,
      // but resize can leave us here): head for the nearest edge to get out
      if (k.x > x1 && k.x < x2 && k.y > y1 && k.y < y2) {
        const dl = k.x - x1, dr = x2 - k.x, dt = k.y - y1, db = y2 - k.y;
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) return { x: x1, y: k.y };
        if (m === dr) return { x: x2, y: k.y };
        if (m === dt) return { x: k.x, y: y1 };
        return { x: k.x, y: y2 };
      }
      const blocked =
        segInt(k.x, k.y, tx, ty, x1, y1, x2, y1) ||
        segInt(k.x, k.y, tx, ty, x2, y1, x2, y2) ||
        segInt(k.x, k.y, tx, ty, x2, y2, x1, y2) ||
        segInt(k.x, k.y, tx, ty, x1, y2, x1, y1);
      if (blocked) {
        // swing around whichever corner shortens the trip most
        let bx = x1, by = y1, bd = 1e9;
        const corners = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
        for (const c of corners) {
          const dd = dist(k.x, k.y, c[0], c[1]) + dist(c[0], c[1], tx, ty);
          if (dd < bd) { bd = dd; bx = c[0]; by = c[1]; }
        }
        return { x: bx, y: by };
      }
    }
    return { x: tx, y: ty };
  }

  // drag target: null when the finger is up
  let target = null;
  let dragging = false;

  let parts = [];   // particles {x,y,vx,vy,t,life,hue,r}
  let rings = [];   // expanding rings {x,y,r,t,life,hue}
  let confetti = []; // win-state falling confetti {x,y,vy,rot,vr,hue,w}

  let playBtn = { x: 0, y: 0, r: 0 }; // big triangle play button (title)
  let againBtn = { x: 0, y: 0, r: 0 }; // big replay arrow button (win)

  const KID_COLORS = ["#e23b3b", "#3b7de2", "#43b34d", "#a55eea", "#f28c28"];
  const SKINS = ["#f6d3a8", "#e8b078", "#c98a54", "#f6d3a8", "#e8b078"];

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

  function addPart(p) {
    if (parts.length < 420) parts.push(p);
  }

  function burst(x, y, hue, n, spd) {
    n = n || 18; spd = spd || 260;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const s = rnd(spd * 0.4, spd);
      addPart({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                t: 0, life: rnd(0.4, 0.9), hue: hue, r: rnd(2.5, 5) });
    }
  }

  function confettiBlast(x, y, n) {
    n = n || 90;
    const hues = [45, 190, 315, 150, 265, 0];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const s = rnd(140, 420);
      addPart({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140,
                t: 0, life: rnd(0.8, 1.6),
                hue: hues[(Math.random() * hues.length) | 0], r: rnd(3, 6) });
    }
    for (let k = 0; k < 3; k++) {
      rings.push({ x: x, y: y, r: 16 + k * 10, t: -k * 0.09, life: 0.7, hue: 45 });
    }
  }

  /* ---------------- sounds (always on, no toggle — studio rule) ---------------- */
  function sndGo() {
    // happy "you're it!" whistle
    audio.tone(880, 0.1, { type: "sine", vol: 0.10, slideTo: 1320 });
    audio.tone(1320, 0.14, { type: "sine", vol: 0.10, slideTo: 1760, when: 0.11 });
  }
  function sndTag() {
    // happy giggle arpeggio
    audio.arp([740, 880, 1040, 1320], 0.07, "square", 0.10);
  }
  function sndYoureIt() {
    // "you're it!" — bright rising whistle when the badge comes to you
    audio.tone(660, 0.09, { type: "sine", vol: 0.11, slideTo: 990 });
    audio.tone(990, 0.12, { type: "sine", vol: 0.11, slideTo: 1480, when: 0.10 });
  }
  function sndWin() {
    // big surprise-finale fanfare
    audio.arp([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.11, "square", 0.12);
  }
  function sndOops() {
    // gentle "you're it at the buzzer" — soft, not sad; play again!
    audio.tone(392, 0.15, { type: "sine", vol: 0.10, slideTo: 330 });
    audio.tone(330, 0.2, { type: "sine", vol: 0.10, slideTo: 262, when: 0.16 });
  }

  /* ---------------- setup ---------------- */
  function resetPlayer() {
    player = { x: W / 2, y: H / 2, angle: -Math.PI / 2, phase: 0 };
    target = null;
    dragging = false;
  }

  function resetKids() {
    kids = [];
    for (let i = 0; i < CFG.KID_COUNT; i++) {
      // scatter the friends around the field, away from the middle
      let x = 0, y = 0, tries = 0;
      do {
        x = rnd(CFG.EDGE_M, W - CFG.EDGE_M);
        y = rnd(CFG.EDGE_M + 90, H - CFG.EDGE_M); // clear of the timer bar
        tries++;
      } while ((dist(x, y, W / 2, H / 2) < 170 || insideObstacle(x, y, 45)) && tries < 100);
      kids.push({
        x: x, y: y,
        angle: rnd(0, 6.283),
        speed: rnd(CFG.KID_SPEED_MIN, CFG.KID_SPEED_MAX),
        turnT: rnd(CFG.KID_TURN_MIN, CFG.KID_TURN_MAX),
        phase: rnd(0, 6.283),
        color: KID_COLORS[i % KID_COLORS.length],
        skin: SKINS[i % SKINS.length],
      });
    }
  }

  function startGame() {
    parts = []; rings = []; confetti = [];
    resetPlayer();
    resetKids();
    it = "player"; // you start as IT, just like the title says
    lastTag = null;
    roundT = CFG.ROUND_T;
    state = "play";
    if (window.SDGplays) window.SDGplays.played("tag");
    sndGo();
  }

  function endGame() {
    // the clock hit 0: whoever is IT loses.
    state = "end";
    if (it === "player") sndOops(); // gentle — you're it, play again!
    else { sndWin(); confettiBlast(W / 2, H * 0.4, 130); }
  }

  /* ---------------- tagging: IT passes to whoever gets tagged ---------------- */
  // pass the star badge to the new IT, starting the brief "it counts" beat
  function passIt(newIt) {
    lastTag = { newIt: newIt, t: time };
    it = newIt;
  }

  function tagBurst(x, y) {
    burst(x, y - 30, 45, 26, 300);
    rings.push({ x: x, y: y - 20, r: 22, t: 0, life: 0.55, hue: 45 });
  }

  // YOU tag a friend: they're IT now — run!
  function playerTagsKid(i) {
    const k = kids[i];
    tagBurst(k.x, k.y);
    sndTag();
    passIt(i);
  }

  // the IT kid tags YOU: you're IT — go chase somebody!
  function kidTagsPlayer() {
    tagBurst(player.x, player.y);
    sndYoureIt();
    passIt("player");
  }

  // the IT kid tags another friend: IT keeps bouncing around the playground
  function kidTagsKid(i) {
    const k = kids[i];
    tagBurst(k.x, k.y);
    sndTag();
    passIt(i);
  }

  /* ---------------- input: drag anywhere ---------------- */
  function setTarget(x, y) {
    target = { x: clamp(x, CFG.EDGE_M * 0.4, W - CFG.EDGE_M * 0.4),
               y: clamp(y, CFG.EDGE_M * 0.4, H - CFG.EDGE_M * 0.4) };
  }

  function onDown(x, y) {
    if (audio.unlock) audio.unlock();
    if (state === "title") { startGame(); return; }
    if (state === "end") {
      if (dist(x, y, againBtn.x, againBtn.y) <= againBtn.r) startGame();
      return;
    }
    if (state !== "play") return;
    dragging = true;
    setTarget(x, y);
  }

  function onMove(x, y) {
    if (state !== "play" || !dragging) return;
    setTarget(x, y);
  }

  function onUp() {
    dragging = false;
    target = null; // finger up — your kid stops, happy and waiting
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    onDown(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointermove", function (e) {
    e.preventDefault();
    onMove(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerup", function (e) {
    e.preventDefault();
    onUp();
  });
  canvas.addEventListener("pointercancel", function (e) {
    e.preventDefault();
    onUp();
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function tickPlayer(dt) {
    player.phase += dt * 10;
    if (!target) return;
    // steer around obstacles so a straight drag never stalls on the slide
    if (steerAround(player, target.x, target.y, CFG.PLAYER_SPEED, dt)) {
      target = null; // arrived — happy stop
    }
    player.x = clamp(player.x, 20, W - 20);
    player.y = clamp(player.y, 20, H - 20);
    collideObstacles(player, CFG.KID_R * 0.8);
  }

  function clampToField(k) {
    // soft bounce off the field edges — always stay in bounds
    const m = CFG.EDGE_M;
    if (k.x < m) { k.x = m; k.angle = Math.PI - k.angle; }
    if (k.x > W - m) { k.x = W - m; k.angle = Math.PI - k.angle; }
    if (k.y < m) { k.y = m; k.angle = -k.angle; }
    if (k.y > H - m) { k.y = H - m; k.angle = -k.angle; }
  }

  function itPos() {
    // where is IT right now? (everyone runs from this spot)
    return it === "player" ? player : kids[it];
  }

  function tickKids(dt) {
    const ip = itPos();
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      k.phase += dt * (3 + k.speed * 0.03);
      if (it === i) {
        // THIS kid is IT — chase whoever is CLOSEST (you or a friend),
        // no favorites. Tag anybody.
        let tx = player.x, ty = player.y;
        let bd = dist(k.x, k.y, player.x, player.y);
        for (let j = 0; j < kids.length; j++) {
          if (j === i) continue;
          const o = kids[j];
          const d = dist(k.x, k.y, o.x, o.y);
          if (d < bd) { bd = d; tx = o.x; ty = o.y; }
        }
        // swing around the slide instead of stalling on it head-on
        steerAround(k, tx, ty, CFG.IT_KID_SPEED, dt);
        clampToField(k);
        collideObstacles(k, CFG.KID_R * 0.8);
        continue;
      }
      // not it: run from IT when it gets close, dawdle otherwise
      const d = dist(k.x, k.y, ip.x, ip.y);
      if (d < CFG.FLEE_R) {
        const a = Math.atan2(k.y - ip.y, k.x - ip.x);
        k.angle = a;
        k.x += Math.cos(a) * CFG.KID_FLEE_SPEED * dt;
        k.y += Math.sin(a) * CFG.KID_FLEE_SPEED * dt;
      } else {
        k.turnT -= dt;
        if (k.turnT <= 0) {
          // dawdle off in a new direction — never a sprint, never at you
          k.angle = rnd(0, 6.283);
          k.turnT = rnd(CFG.KID_TURN_MIN, CFG.KID_TURN_MAX);
        }
        k.x += Math.cos(k.angle) * k.speed * dt;
        k.y += Math.sin(k.angle) * k.speed * dt;
      }
      clampToField(k);
      collideObstacles(k, CFG.KID_R * 0.8);
    }
  }

  // personal space: non-it kids don't pile up on each other (which used to
  // fuel instant tag ping-pongs). The it-kid is exempt — it must get close.
  function separateKids() {
    const minD = 80; // just outside tag range, so tags still fire first
    for (let i = 0; i < kids.length; i++) {
      if (it === i) continue;
      for (let j = i + 1; j < kids.length; j++) {
        if (it === j) continue;
        const a = kids[i], b = kids[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < minD && d > 0.01) {
          const push = (minD - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          clampToField(a); clampToField(b);
        }
      }
    }
  }

  function tickTags() {
    // the "it counts" beat: after a tag, nobody can be tagged for a
    // moment — the tagger gets a head start, then IT can tag anybody
    if (lastTag && (time - lastTag.t) < CFG.TAG_COOLDOWN) return;
    if (it === "player") {
      // you're IT — tag a friend and THEY become it
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (dist(player.x, player.y, k.x, k.y) < CFG.TAG_R) {
          playerTagsKid(i);
          return;
        }
      }
    } else {
      const k = kids[it];
      // the IT kid tags YOU — you're it again!
      if (dist(k.x, k.y, player.x, player.y) < CFG.TAG_R) {
        kidTagsPlayer();
        return;
      }
      // ...or tags another friend — IT keeps bouncing around
      for (let i = 0; i < kids.length; i++) {
        if (i === it) continue;
        const o = kids[i];
        if (dist(k.x, k.y, o.x, o.y) < CFG.TAG_R) {
          kidTagsKid(i);
          return;
        }
      }
    }
  }

  function tick(dt) {
    time += dt;

    if (state === "play") {
      roundT -= dt;
      if (roundT <= 0) { roundT = 0; endGame(); return; }
      tickPlayer(dt);
      tickKids(dt);
      separateKids();
      tickTags();
    } else if (state === "end") {
      // celebration: everyone jumps and cheers, confetti keeps falling
      for (const k of kids) k.phase += dt * 9;
      player.phase += dt * 9;
      if (confetti.length < 150 && Math.random() < dt * 30) {
        const hues = [45, 190, 315, 150, 265, 0];
        confetti.push({ x: rnd(0, W), y: -30, vy: rnd(120, 240),
                        rot: rnd(0, 6.28), vr: rnd(-4, 4),
                        hue: hues[(Math.random() * hues.length) | 0], w: rnd(8, 14) });
      }
    } else {
      // title: gentle idle bounce behind the title card
      if (player) player.phase += dt * 4;
      for (const k of kids) k.phase += dt * 4;
    }

    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.y > H + 40) confetti.splice(i, 1);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) rings.splice(i, 1);
    }
  }

  /* ---------------- drawing: playground ---------------- */
  function drawField() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#57b368");
    g.addColorStop(1, "#3a8348");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // mow stripes
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    const band = H / 14;
    for (let i = 0; i < 14; i += 2) ctx.fillRect(0, i * band, W, band);
    // little flowers scattered on the grass
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 14; i++) {
      const fx = ((i * 197.3) % 1) * W, fy = ((i * 311.7) % 1) * H;
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,120,0.7)";
      ctx.beginPath();
      ctx.arc(fx, fy, 1.4, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
    }
    drawObstacles();
  }

  // solid playground obstacles — chunky, flat, Fisher-Price. Everyone
  // runs AROUND these (see collideObstacles); they're drawn under the kids.
  function drawObstacles() {
    for (const o of obstacles) {
      // soft ground shadow
      ctx.fillStyle = "rgba(20,60,25,0.28)";
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, o.y + o.h - 2, o.w * 0.55, 12, 0, 0, 6.2832);
      ctx.fill();
      if (o.kind === "slide") drawSlide(o);
      else if (o.kind === "dome") drawDome(o);
      else if (o.kind === "tree") drawTree(o);
    }
  }

  function drawSlide(o) {
    const x = o.x, y = o.y;
    // ladder rails (left)
    ctx.strokeStyle = "#7a5c3e"; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 18, y + o.h); ctx.lineTo(x + 18, y + 12);
    ctx.moveTo(x + 44, y + o.h); ctx.lineTo(x + 44, y + 12);
    ctx.stroke();
    ctx.lineWidth = 6;
    for (const ry of [30, 52, 74]) {
      ctx.beginPath();
      ctx.moveTo(x + 18, y + ry); ctx.lineTo(x + 44, y + ry);
      ctx.stroke();
    }
    // platform
    ctx.fillStyle = "#8a6a48";
    ctx.fillRect(x + 10, y + 2, 52, 14);
    // chute: red slide swooping down to the right
    ctx.fillStyle = "#c9563c";
    ctx.beginPath();
    ctx.moveTo(x + 58, y + 8);
    ctx.lineTo(x + o.w - 6, y + o.h - 12);
    ctx.lineTo(x + o.w - 28, y + o.h - 12);
    ctx.lineTo(x + 44, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(90,30,15,0.5)";
    ctx.stroke();
  }

  function drawDome(o) {
    const cx = o.x + o.w / 2, base = o.y + o.h;
    const r = o.w / 2;
    // crisscross climbing bars
    ctx.strokeStyle = "#4d7ea8"; ctx.lineWidth = 7; ctx.lineCap = "round";
    for (let i = -2; i <= 2; i++) {
      const a0 = Math.PI + (i + 2.5) * Math.PI / 5.5;
      const a1 = Math.PI + (i - 0.5) * Math.PI / 5.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * r, base + Math.sin(a0) * r * 0.9);
      ctx.lineTo(cx + Math.cos(a1) * r, base + Math.sin(a1) * r * 0.9);
      ctx.stroke();
    }
    // dome outline
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(cx, base, r, r * 0.9, 0, Math.PI, 0);
    ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(30,60,90,0.5)";
    ctx.beginPath();
    ctx.ellipse(cx, base, r, r * 0.9, 0, Math.PI, 0);
    ctx.stroke();
  }

  function drawTree(o) {
    const cx = o.x + o.w / 2;
    // trunk
    ctx.fillStyle = "#7a5c3e";
    ctx.fillRect(cx - 10, o.y + o.h * 0.35, 20, o.h * 0.65);
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(60,40,20,0.5)";
    ctx.strokeRect(cx - 10, o.y + o.h * 0.35, 20, o.h * 0.65);
    // leafy canopy (overhangs the trunk a little — pretty, not solid)
    ctx.fillStyle = "#2f7d3a";
    const blobs = [
      [cx, o.y + 22, 30], [cx - 24, o.y + 36, 22], [cx + 24, o.y + 36, 22],
    ];
    for (const b of blobs) {
      ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.arc(cx - 10, o.y + 14, 12, 0, 6.2832); ctx.fill();
  }

  /* ---------------- drawing: kids ---------------- */
  function drawStar(x, y, r, fill, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = (i % 2 === 0) ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(10,40,20,0.55)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
  }

  // cute chunky kid: round head + colored body. faces() draws the smile.
  function drawKidFace(x, y, r, skin) {
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(60,30,10,0.55)"; ctx.stroke();
    // eyes
    ctx.fillStyle = "#2a1a08";
    ctx.beginPath(); ctx.arc(x - r * 0.34, y - r * 0.1, r * 0.11, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.34, y - r * 0.1, r * 0.11, 0, 6.2832); ctx.fill();
    // big happy smile
    ctx.strokeStyle = "#2a1a08"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.12, r * 0.42, 0.35, Math.PI - 0.35);
    ctx.stroke();
    // cheeks
    ctx.fillStyle = "rgba(255,120,120,0.55)";
    ctx.beginPath(); ctx.arc(x - r * 0.55, y + r * 0.28, r * 0.14, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.55, y + r * 0.28, r * 0.14, 0, 6.2832); ctx.fill();
  }

  function drawKidBody(k, bounce) {
    const r = CFG.KID_R;
    ctx.save();
    ctx.translate(k.x, k.y + (bounce || 0));
    // shadow
    ctx.fillStyle = "rgba(20,60,25,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, r * 1.05 - (bounce || 0), r * 0.9, r * 0.28, 0, 0, 6.2832);
    ctx.fill();
    // body: colored shirt
    ctx.fillStyle = k.color;
    ctx.beginPath(); ctx.arc(0, r * 0.45, r * 0.72, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(40,20,5,0.4)"; ctx.stroke();
    // head
    drawKidFace(0, -r * 0.35, r * 0.62, k.skin);
    ctx.restore();
  }

  function drawPlayer() {
    const r = CFG.KID_R;
    const bounce = Math.abs(Math.sin(player.phase)) * (target ? 10 : 5);
    ctx.save();
    ctx.translate(player.x, player.y - bounce);
    // shadow stays grounded
    ctx.fillStyle = "rgba(20,60,25,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, r * 1.05 + bounce, r * 0.95, r * 0.28, 0, 0, 6.2832);
    ctx.fill();
    // body: bright yellow shirt — YOU
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.arc(0, r * 0.45, r * 0.72, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(90,60,0,0.5)"; ctx.stroke();
    // head
    drawKidFace(0, -r * 0.35, r * 0.62, "#f6d3a8");
    // THE star badge: big, bouncing, impossible to miss — but only while YOU are IT
    if (it === "player") {
      const starBounce = Math.abs(Math.sin(player.phase * 1.3)) * 7;
      ctx.save();
      ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 22;
      drawStar(0, -r * 1.55 - starBounce, 26, "#ffe45e", Math.sin(time * 2) * 0.15);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFriend(k, idx) {
    const bounce = Math.abs(Math.sin(k.phase)) * 7;
    // giggle wiggle while wandering (the IT kid leans into the chase)
    const wig = Math.sin(k.phase * 2) * 0.06;
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(wig);
    ctx.translate(-k.x, -k.y);
    drawKidBody(k, -bounce);
    ctx.restore();
    if (it === idx) {
      // THIS kid is IT — the star badge bounces overhead
      const starBounce = Math.abs(Math.sin(k.phase * 1.3)) * 7;
      ctx.save();
      ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 22;
      drawStar(k.x, k.y - CFG.KID_R * 1.55 - starBounce, 26, "#ffe45e",
               Math.sin(time * 2 + k.phase) * 0.15);
      ctx.restore();
    }
  }

  /* ---------------- drawing: HUD (the clock — visual, no reading) ---------------- */
  // A draining bar across the top + the seconds left. When the bar is
  // gone, time's up and whoever is IT loses. The last 10 seconds the bar
  // turns red and pulses — uh oh!
  function drawSlots() {
    const frac = clamp(roundT / CFG.ROUND_T, 0, 1);
    const bw = W - 240, bh = 16;
    const bx = 112, by = 18; // clear of the back button (top-left)
    // bar track
    ctx.fillStyle = "rgba(6,8,28,0.55)";
    roundRect(bx - 6, by - 6, bw + 12, bh + 12, 12); ctx.fill();
    // draining bar
    const urgent = roundT <= 10;
    ctx.fillStyle = urgent ? (Math.sin(time * 8) > 0 ? "#ff5a5a" : "#ff8a5a") : "#ffd23f";
    if (frac > 0) { roundRect(bx, by, Math.max(4, bw * frac), bh, 8); ctx.fill(); }
    // seconds left, right of the bar
    drawPixelNumber(ctx, Math.ceil(roundT), bx + bw + 34, by + bh / 2, 5,
                    urgent ? "#ff8a5a" : "#ffffff", true);
  }

  /* ---------------- drawing: buttons ---------------- */
  function drawTriangleButton(b, color) {
    const pulse = 1 + Math.sin(time * 4) * 0.04;
    const r = b.r * pulse;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 26;
    const g = ctx.createLinearGradient(0, b.y - r, 0, b.y + r);
    g.addColorStop(0, "#22d3ee"); g.addColorStop(1, "#0e7490");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.2832); ctx.fill();
    ctx.restore();
    // triangle arrow — no text needed
    ctx.fillStyle = "#04121a";
    ctx.beginPath();
    ctx.moveTo(b.x - r * 0.32, b.y - r * 0.45);
    ctx.lineTo(b.x + r * 0.52, b.y);
    ctx.lineTo(b.x - r * 0.32, b.y + r * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  function drawTitle() {
    ctx.fillStyle = "rgba(10,40,25,0.45)";
    ctx.fillRect(0, 0, W, H);
    // bouncing star logo
    const by = H * 0.24 - Math.abs(Math.sin(time * 2.4)) * 26;
    ctx.save();
    ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 34;
    drawStar(W / 2, by, 52, "#ffe45e", Math.sin(time * 1.8) * 0.12);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.font = "44px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(60,40,0,0.9)"; ctx.lineWidth = 7;
    ctx.strokeText("TAG!", W / 2, H * 0.42);
    ctx.fillText("TAG!", W / 2, H * 0.42);
    ctx.font = "20px 'Press Start 2P', monospace";
    ctx.fillStyle = "#ffe45e";
    ctx.strokeText("YOU'RE IT", W / 2, H * 0.42 + 44);
    ctx.fillText("YOU'RE IT", W / 2, H * 0.42 + 44);
    ctx.textAlign = "left";
    drawTriangleButton(playBtn, "#22d3ee");
  }

  function drawEnd() {
    // the clock ran out: whoever is IT loses.
    const youLose = it === "player";
    ctx.fillStyle = youLose ? "rgba(40,10,25,0.30)" : "rgba(10,40,25,0.30)";
    ctx.fillRect(0, 0, W, H);
    // star shower badge
    ctx.save();
    ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 40;
    drawStar(W / 2, H * 0.2 - Math.abs(Math.sin(time * 3)) * 14, 46,
             "#ffe45e", Math.sin(time * 2.2) * 0.15);
    ctx.restore();
    // the verdict — big and unmissable, no reading skill needed
    ctx.textAlign = "center";
    ctx.font = "34px 'Press Start 2P', monospace";
    ctx.strokeStyle = "rgba(60,40,0,0.9)"; ctx.lineWidth = 7;
    if (youLose) {
      // you're IT at the buzzer — gentle, play again!
      ctx.fillStyle = "#ff8a8a";
      ctx.strokeText("YOU'RE IT!", W / 2, H * 0.42);
      ctx.fillText("YOU'RE IT!", W / 2, H * 0.42);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.strokeText("YOU WIN!", W / 2, H * 0.42);
      ctx.fillText("YOU WIN!", W / 2, H * 0.42);
    }
    ctx.textAlign = "left";
    drawTriangleButton(againBtn, youLose ? "#ff8a8a" : "#ffd23f");
  }

  function drawParts() {
    for (const p of parts) {
      const k = 1 - p.t / p.life;
      ctx.fillStyle = "hsla(" + p.hue + ",95%,62%," + k.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * k + 0.5, 0, 6.2832);
      ctx.fill();
    }
    for (const r of rings) {
      if (r.t < 0) continue;
      const k = Math.min(1, Math.max(0, r.t / r.life));
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,65%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 80, 0, 6.2832);
      ctx.stroke();
    }
    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = "hsl(" + c.hue + ",95%,62%)";
      ctx.fillRect(-c.w / 2, -3, c.w, 6);
      ctx.restore();
    }
  }

  function render() {
    drawField();
    if (state === "end") {
      // celebration: everyone jumps and cheers
      const jb = Math.abs(Math.sin(time * 6)) * 22;
      ctx.save();
      ctx.translate(0, -jb);
      drawPlayer();
      ctx.restore();
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        const kj = Math.abs(Math.sin(time * 6 + k.phase)) * 22;
        ctx.save();
        ctx.translate(0, -kj);
        drawFriend(k, i);
        ctx.restore();
      }
    } else {
      if (player) drawPlayer();
      for (let i = 0; i < kids.length; i++) drawFriend(kids[i], i);
    }
    drawParts();
    if (state !== "title") drawSlots();
    if (state === "title") drawTitle();
    else if (state === "end") drawEnd();
  }

  /* ---------------- layout ---------------- */
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
    playBtn.r = 64;
    playBtn.x = W / 2; playBtn.y = H * 0.66;
    againBtn.r = 72;
    againBtn.x = W / 2; againBtn.y = H * 0.62;
    buildObstacles();
    if (player) {
      player.x = clamp(player.x, 20, W - 20);
      player.y = clamp(player.y, 20, H - 20);
      collideObstacles(player, CFG.KID_R * 0.8);
    }
    for (const k of kids) {
      k.x = clamp(k.x, CFG.EDGE_M, W - CFG.EDGE_M);
      k.y = clamp(k.y, CFG.EDGE_M, H - CFG.EDGE_M);
      collideObstacles(k, CFG.KID_R * 0.8);
    }
  }
  window.addEventListener("resize", resize);

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; } // pause when tab hidden
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    tick(dt);
    render();
  }

  resize();
  resetPlayer();
  resetKids();
  requestAnimationFrame(frame);

  /* Test hook. `debug` exposes live objects so tests can position kids,
     force tags, and inspect state — test-only, never used by the game. */
  window.__tagTest = {
    get state() { return state; },
    get cfg() { return CFG; },
    get roundT() { return roundT; },
    get it() { return it; }, // "player" or a kid index — who wears the badge
    debug: {
      player: function () { return player; },
      kids: function () { return kids; },
      obstacles: function () { return obstacles; },
      target: function () { return target; },
      // drag to (x, y) exactly like a finger drag (tests only)
      drag: function (x, y) {
        if (state !== "play") startGame();
        dragging = true;
        setTarget(x, y);
      },
      release: function () { onUp(); },
      // you tag kid i directly (tests only)
      forceTag: function (i) {
        if (state !== "play") startGame();
        playerTagsKid(i);
      },
      placePlayer: function (x, y) {
        if (state !== "play") startGame();
        player.x = x; player.y = y;
      },
      placeKid: function (i, x, y) {
        if (state !== "play") startGame();
        kids[i].x = x; kids[i].y = y;
      },
    },
    tap: function (x, y) { onDown(x, y); onUp(); },
    start: function () { startGame(); },
    step: function (dt) { tick(dt || 0.016); },
  };
})();
