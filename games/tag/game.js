/* ============================================================
   TAG! YOU'RE IT — SmoothDaddyG (game #18)
   Real playground tag, sharpened. The big bouncing star badge
   marks IT — and IT passes to whoever gets tagged.
   You start as IT. Everybody runs from you — and everybody runs
   FAST now. Tag anybody, but NO TAG-BACKS: once you tag someone,
   they can't tag you back until they've tagged someone else.
   When you're IT, grab a dodgeball and TAP to throw it at the
   nearest friend, or grab the star for a STAR FRENZY that tags
   the three nearest friends at once. Pop-up benches and tires
   appear and block the field, so escape routes keep changing.
   5 quick levels, each one faster. Survive the clock without
   wearing the badge and the level is yours; clear all 5 and
   you're the champion.
   ONE interaction: drag to run. TAP to throw while holding a ball.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- tuning (all gameplay numbers live here) ---------------- */
  const CFG = {
    KID_COUNT: 5,       // friends to tag
    LEVELS: 5,          // quick levels — clear all 5 and you're champion
    LEVEL_TIMES: [40, 35, 35, 30, 30], // seconds on the clock per level
    PLAYER_SPEED: 320,  // L1 — your kid runs toward your finger, px/s
                        // (+15 per level, so you stay the fastest)
    KID_SPEED_MIN: 90,  // friends jog now, not dawdle — always slower
    KID_SPEED_MAX: 140, // than you, but the gap shrinks every level
    KID_TURN_MIN: 2,    // friends change direction every 2-4 s
    KID_TURN_MAX: 4,
    IT_KID_SPEED: 240,  // L1 — the "it" kid chases hard, faster than
                        // fleeing friends (180) but slower than you
                        // (320), so you can dodge or chase as you like
    KID_FLEE_SPEED: 180, // friends run from IT — quick, but you catch them
    LEVEL_SPEED: 0.12,  // kid speeds grow 12% per level (L5: it-kid 355,
                        // still under your 380 — dodgeable, barely)
    FLEE_R: 150,        // friends start running when IT gets this close
    TAG_COOLDOWN: 0.8,  // s after a tag before anyone can be tagged again —
                        // the "it counts" beat; the new IT also STANDS
                        // STILL for a full second (TAG_HOLD) so the tagger
                        // gets a real head start — no ping-pong tagging
    TAG_HOLD: 1.0,      // the new IT must wait this long before chasing
    TAG_R: 70,          // generous tag radius — be kind
    KID_R: 34,          // kid body size (px) — BIG, Fisher-Price chunky
    EDGE_M: 70,         // everyone stays this far inside the field
    OBSTACLES: 3,       // solid playground equipment to chase around
    POPUP_WARN: 0.9,    // telegraph before a pop-up goes solid
    POPUP_SOLID: 5,     // seconds a pop-up blocks the field
    POPUP_FIRST: 8,     // first pop-up appears this far into a level
    BALL_R: 50,         // pickup radius for a dodgeball
    THROW_R: 320,       // tap-throw only reaches this far (aim line shows it)
    THROW_SPEED: 520,   // a thrown ball flies straight, no homing
    STAR_R: 46,         // pickup radius for the star
    STAR_FIRST: 12,     // first star appears this far into a level
    STAR_EVERY: 22,     // a new star this often after one is used/lost
    STAR_LIFE: 9,       // star vanishes after this long unclaimed
  };

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();
  /* Background music (2026-10-30 rollout): an original chiptune loop —
     distinct chiptune voice, kept under the SFX. Starts at load; the
     synth stays silent until the first tap, then plays mid-loop. */
  const MUSIC = audio.makeMusic({
    bpm: 146, div: 4, steps: 64,
    bassType: "triangle", bassVol: 0.2,
    leadType: "square", leadVol: 0.05,
    harmonyType: "square", harmonyVol: 0.025,
    kickVol: 0.16, snareVol: 0.05, hatVol: 0.02,
    kicks: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
    snares: [4, 12, 20, 28, 36, 44, 52, 60],
    hats: "odd",
    bass: [65.41, 0, 0, 130.81, 0, 0, 65.41, 0, 0, 130.81, 0, 0, 65.41, 0, 98, 0,
           87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 130.81, 0,
           98, 0, 0, 196, 0, 0, 98, 0, 0, 196, 0, 0, 98, 0, 146.83, 0,
           87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 130.81, 0],
    lead: [523.25, 523.25, 0, 523.25, 0, 659.25, 0, 523.25, 523.25, 0, 523.25, 0, 392, 0, 0, 0,
           698.46, 698.46, 0, 698.46, 0, 880, 0, 698.46, 698.46, 0, 698.46, 0, 523.25, 0, 0, 0,
           783.99, 783.99, 0, 783.99, 0, 659.25, 0, 783.99, 783.99, 0, 783.99, 0, 587.33, 0, 0, 0,
           698.46, 880, 1046.5, 880, 698.46, 880, 1046.5, 1174.66, 1046.5, 880, 698.46, 0, 0, 0, 0, 0],
    harmony: [329.63, 0, 0, 0, 0, 0, 0, 0, 392, 0, 0, 0, 0, 0, 0, 0,
           440, 0, 0, 0, 0, 0, 0, 0, 523.25, 0, 0, 0, 0, 0, 0, 0,
           493.88, 0, 0, 0, 0, 0, 0, 0, 587.33, 0, 0, 0, 0, 0, 0, 0,
           440, 0, 0, 0, 0, 0, 0, 0, 523.25, 0, 0, 0, 0, 0, 0, 0]
  });
  MUSIC.start();

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
  // how long the NEW "it" must stand still before chasing (the hold)
  let itHold = 0;
  // NO TAG-BACKS: {it, not} — the current IT may not tag `not` until
  // they have tagged someone else (a new tag replaces the pair).
  let noBack = null;
  let noBackMsgT = -10; // throttle for the "NO TAG-BACKS!" floater
  // levels: 1-5. The clock: seconds left in the level. At 0, whoever
  // is IT loses the level (retry it) — survive it and the level is yours.
  let level = 1;
  let levelTotal = CFG.LEVEL_TIMES[0];
  let roundT = CFG.LEVEL_TIMES[0];
  // this level's speeds (set by startLevel — player stays fastest)
  let S = levelSpeeds(1);
  // level-clear splash: {txt, t} + the level it leads to, or 0
  let splash = null;
  let pendingLevel = 0;
  // end screen kind: "retry" (you're it at the buzzer) or "finale"
  let endKind = "retry";
  // pop-up obstacles: {x, y, w, h, kind, state: "warn"|"solid", t}
  let popups = [];
  let popupT = CFG.POPUP_FIRST;
  // dodgeballs: field balls {x, y}, flying balls {x, y, px, py, vx, vy,
  // travel, from, star} — star bullets fly like balls but tag gold
  let balls = [];
  let ballT = 0;
  let carried = false; // you (IT) are holding a ball — TAP to throw it
  let thrown = [];
  // the star pickup: {x, y, age} — IT grabs it for a STAR FRENZY
  let star = null;
  let starT = CFG.STAR_FIRST;
  // floating announcements {x, y, txt, t, life}
  let floaters = [];
  // quick-tap tracking for tap-to-throw (vs a drag)
  let downMs = 0, downX = 0, downY = 0;

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
  function sndThrow() {
    // dodgeball whoosh — quick slide down
    audio.tone(880, 0.12, { type: "sine", vol: 0.09, slideTo: 440 });
  }
  function sndStar() {
    // STAR FRENZY — sparkling rise
    audio.arp([784, 988, 1175, 1568], 0.06, "square", 0.10);
  }
  function sndLevel() {
    // level cleared — short happy climb
    audio.arp([523, 659, 784, 1047], 0.09, "square", 0.11);
  }
  function sndNoBack() {
    // gentle "nope" bonk for a blocked tag-back — soft, not scolding
    audio.tone(220, 0.1, { type: "square", vol: 0.07 });
    audio.tone(196, 0.12, { type: "square", vol: 0.07, when: 0.11 });
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
        speed: rnd(S.kidMin, S.kidMax),
        turnT: rnd(CFG.KID_TURN_MIN, CFG.KID_TURN_MAX),
        phase: rnd(0, 6.283),
        color: KID_COLORS[i % KID_COLORS.length],
        skin: SKINS[i % SKINS.length],
      });
    }
  }

  // this level's speeds — kid speeds scale, you stay the fastest
  function levelSpeeds(n) {
    const m = 1 + CFG.LEVEL_SPEED * (n - 1);
    return {
      player: CFG.PLAYER_SPEED + 15 * (n - 1),
      kidMin: CFG.KID_SPEED_MIN * m,
      kidMax: CFG.KID_SPEED_MAX * m,
      flee: CFG.KID_FLEE_SPEED * m,
      itKid: CFG.IT_KID_SPEED * m,
    };
  }

  function startLevel(n) {
    level = n;
    S = levelSpeeds(n);
    levelTotal = CFG.LEVEL_TIMES[n - 1];
    roundT = levelTotal;
    parts = []; rings = []; confetti = []; floaters = [];
    resetPlayer();
    resetKids();
    it = "player"; // you start every level as IT, just like the title says
    lastTag = null;
    itHold = 0;
    noBack = null;
    popups = []; popupT = CFG.POPUP_FIRST;
    balls = []; ballT = 0; spawnBall();
    carried = false; thrown = [];
    star = null; starT = CFG.STAR_FIRST;
    splash = null; pendingLevel = 0;
    state = "play";
  }

  function startGame() {
    startLevel(1);
    if (window.SDGplays) window.SDGplays.played("tag");
    sndGo();
  }

  function levelEnd() {
    // the clock hit 0: whoever is IT loses the LEVEL.
    if (it === "player") {
      // you're IT at the buzzer — gentle, retry this level!
      state = "end";
      endKind = "retry";
      sndOops();
    } else if (level >= CFG.LEVELS) {
      // all 5 levels cleared — champion!
      state = "end";
      endKind = "finale";
      sndWin();
      confettiBlast(W / 2, H * 0.4, 130);
    } else {
      // level cleared — splash, then the next (faster) level
      sndLevel();
      confettiBlast(W / 2, H * 0.4, 60);
      splash = { txt: "LEVEL " + (level + 1) + "!", t: 1.4 };
      pendingLevel = level + 1;
    }
  }

  /* ---------------- tagging: IT passes to whoever gets tagged ---------------- */
  // a floating announcement (no reading skill needed — big and brief)
  function floater(x, y, txt) {
    if (floaters.length < 6) floaters.push({ x: x, y: y, txt: txt, t: 0, life: 1.3 });
  }

  // NO TAG-BACKS: may `tagger` (the current IT) tag `victim`? No, when
  // victim tagged tagger last and hasn't tagged anyone since.
  function tagBlocked(tagger, victim) {
    return !!noBack && noBack.it === tagger && noBack.not === victim;
  }

  // pass the star badge to the new IT, starting the brief "it counts" beat
  function passIt(newIt, tagger) {
    lastTag = { newIt: newIt, t: time };
    it = newIt;
    // the new "it" must wait a full second before chasing — the
    // tagger gets a head start, no instant ping-pong tagging
    itHold = CFG.TAG_HOLD;
    // NO TAG-BACKS: the new IT can't tag their tagger back until
    // they've tagged someone else (the next tag replaces the pair)
    noBack = { it: newIt, not: tagger };
    // if you were carrying a ball and you're no longer IT, drop it
    if (carried && newIt !== "player") {
      carried = false;
      balls.push({ x: player.x, y: player.y });
    }
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
    passIt(i, "player");
  }

  // the IT kid tags YOU: you're IT — go chase somebody!
  function kidTagsPlayer() {
    tagBurst(player.x, player.y);
    sndYoureIt();
    passIt("player", it);
  }

  // the IT kid tags another friend: IT keeps bouncing around the playground
  function kidTagsKid(i) {
    const k = kids[i];
    tagBurst(k.x, k.y);
    sndTag();
    passIt(i, it);
  }

  // a thrown ball (or star bullet) tags a friend: same badge pass,
  // with the thrower as the tagger for no-tag-backs purposes
  function projectileTagsKid(i, from) {
    const k = kids[i];
    tagBurst(k.x, k.y);
    sndTag();
    passIt(i, from);
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
      if (dist(x, y, againBtn.x, againBtn.y) <= againBtn.r) {
        if (endKind === "retry") startLevel(level); // same level, again!
        else startGame(); // finale — back to level 1
      }
      return;
    }
    if (state !== "play") return;
    downMs = performance.now(); downX = x; downY = y;
    dragging = true;
    setTarget(x, y);
  }

  function onMove(x, y) {
    if (state !== "play" || !dragging) return;
    setTarget(x, y);
  }

  function onUp(x, y) {
    // a quick tap (not a drag) while you're IT and holding a ball
    // throws it at the nearest friend — dodgeball!
    if (state === "play" && carried && x !== undefined &&
        performance.now() - downMs < 300 &&
        dist(downX, downY, x, y) < 24) {
      throwBall();
    }
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
    onUp(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointercancel", function (e) {
    e.preventDefault();
    onUp();
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function tickPlayer(dt) {
    player.phase += dt * 10;
    if (target) {
      // steer around obstacles so a straight drag never stalls on the slide
      if (steerAround(player, target.x, target.y, S.player, dt)) {
        target = null; // arrived — happy stop
      }
      player.x = clamp(player.x, 20, W - 20);
      player.y = clamp(player.y, 20, H - 20);
    }
    collideObstacles(player, CFG.KID_R * 0.8);
    collidePopups(player, CFG.KID_R * 0.8);
    // IT-only pickups: a dodgeball to carry, or the star for a frenzy
    if (it === "player") {
      if (!carried) {
        for (let i = balls.length - 1; i >= 0; i--) {
          if (dist(player.x, player.y, balls[i].x, balls[i].y) < CFG.BALL_R) {
            balls.splice(i, 1);
            carried = true;
            ballT = 6; // a fresh ball joins the field shortly
            break;
          }
        }
      }
      if (star && dist(player.x, player.y, star.x, star.y) < CFG.STAR_R) {
        starBurst();
      }
    }
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
        // THIS kid is IT — but first, the HOLD: after being tagged the
        // new "it" must wait a full second standing still, so the
        // tagger gets a head start and tags can't ping-pong.
        if (itHold > 0) {
          continue;
        }
        // chase whoever is CLOSEST (you or a friend), no favorites —
        // except the one they can't tag back (no-tag-backs rule)
        let tx = null, ty = null, bd = 1e9;
        if (!tagBlocked(i, "player")) {
          tx = player.x; ty = player.y;
          bd = dist(k.x, k.y, player.x, player.y);
        }
        for (let j = 0; j < kids.length; j++) {
          if (j === i || tagBlocked(i, j)) continue;
          const o = kids[j];
          const d = dist(k.x, k.y, o.x, o.y);
          if (d < bd) { bd = d; tx = o.x; ty = o.y; }
        }
        if (tx === null) continue; // nowhere legal to chase — wait it out
        // swing around the slide instead of stalling on it head-on
        steerAround(k, tx, ty, S.itKid, dt);
        clampToField(k);
        collideObstacles(k, CFG.KID_R * 0.8);
        collidePopups(k, CFG.KID_R * 0.8);
        continue;
      }
      // not it: run from IT when it gets close, dawdle otherwise
      const d = dist(k.x, k.y, ip.x, ip.y);
      if (d < CFG.FLEE_R) {
        const a = Math.atan2(k.y - ip.y, k.x - ip.x);
        k.angle = a;
        k.x += Math.cos(a) * S.flee * dt;
        k.y += Math.sin(a) * S.flee * dt;
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
      collidePopups(k, CFG.KID_R * 0.8);
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
    // moment — the tagger gets a head start, then IT can tag anybody.
    // And while the new "it" is on their one-second hold, no tags at all.
    if (itHold > 0) return;
    if (lastTag && (time - lastTag.t) < CFG.TAG_COOLDOWN) return;
    if (it === "player") {
      // you're IT — tag a friend and THEY become it, unless that's
      // the one you can't tag back yet (they tagged you last)
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (dist(player.x, player.y, k.x, k.y) < CFG.TAG_R) {
          if (tagBlocked("player", i)) {
            // blocked — say so (throttled) and keep looking: another
            // friend nearby may be perfectly taggable
            if (time - noBackMsgT > 1.2) {
              noBackMsgT = time;
              floater(k.x, k.y - 60, "NO TAG-BACKS!");
              sndNoBack();
            }
            continue;
          }
          playerTagsKid(i);
          return;
        }
      }
    } else {
      const k = kids[it];
      // the IT kid tags YOU — unless you're the one they can't tag back
      if (!tagBlocked(it, "player") &&
          dist(k.x, k.y, player.x, player.y) < CFG.TAG_R) {
        kidTagsPlayer();
        return;
      }
      // ...or tags another friend — IT keeps bouncing around
      for (let i = 0; i < kids.length; i++) {
        if (i === it || tagBlocked(it, i)) continue;
        const o = kids[i];
        if (dist(k.x, k.y, o.x, o.y) < CFG.TAG_R) {
          kidTagsKid(i);
          return;
        }
      }
    }
  }

  /* ---------------- pop-ups, dodgeballs, star ---------------- */
  // a free spot: inside the field, clear of the timer bar, static
  // obstacles, solid pop-ups, and everyone playing (fair spawns)
  function spawnFreeSpot(pad) {
    let x = W / 2, y = H / 2, tries = 0;
    do {
      x = rnd(CFG.EDGE_M, W - CFG.EDGE_M);
      y = rnd(CFG.EDGE_M + 90, H - CFG.EDGE_M);
      tries++;
    } while ((insideObstacle(x, y, pad) || solidPopupAt(x, y, pad) ||
              dist(x, y, player.x, player.y) < 130 ||
              kids.some((k) => dist(x, y, k.x, k.y) < 130)) && tries < 100);
    return { x: x, y: y };
  }

  function solidPopupAt(x, y, pad) {
    for (const p of popups) {
      if (p.state !== "solid") continue;
      if (x > p.x - pad && x < p.x + p.w + pad &&
          y > p.y - pad && y < p.y + p.h + pad) return true;
    }
    return false;
  }

  // push a circle out of every SOLID pop-up (warn pop-ups don't block yet)
  function collidePopups(p, r) {
    for (const o of popups) {
      if (o.state !== "solid") continue;
      const cx = clamp(p.x, o.x, o.x + o.w);
      const cy = clamp(p.y, o.y, o.y + o.h);
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < r) {
        if (d > 0.001) {
          p.x = cx + dx / d * r;
          p.y = cy + dy / d * r;
        } else {
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

  function popupMax() {
    return level >= 4 ? 3 : level >= 2 ? 2 : 1;
  }
  function popupEvery() {
    return Math.max(4.5, 8 - 0.8 * (level - 1));
  }

  function tickPopups(dt) {
    popupT -= dt;
    if (popupT <= 0) {
      const solid = popups.filter((p) => p.state === "solid").length;
      if (solid < popupMax()) {
        const s = spawnFreeSpot(55);
        const w = rnd(72, 96), h = rnd(56, 80);
        popups.push({ x: s.x - w / 2, y: s.y - h / 2, w: w, h: h,
                      kind: Math.random() < 0.5 ? "bench" : "tire",
                      state: "warn", t: 0 });
      }
      popupT = popupEvery();
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.t += dt;
      if (p.state === "warn" && p.t >= CFG.POPUP_WARN) {
        p.state = "solid"; p.t = 0;
      } else if (p.state === "solid" && p.t >= CFG.POPUP_SOLID) {
        popups.splice(i, 1);
      }
    }
  }

  function spawnBall() {
    const s = spawnFreeSpot(60);
    balls.push({ x: s.x, y: s.y });
  }

  // TAP while holding a ball: throw it at the nearest friend in range.
  // Straight line, no homing — dodgeball! A hit tags them (unless
  // they're the one you can't tag back — then the ball fizzles).
  function throwBall() {
    if (!carried) return;
    let bi = -1, bd = CFG.THROW_R;
    for (let i = 0; i < kids.length; i++) {
      const d = dist(player.x, player.y, kids[i].x, kids[i].y);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi < 0) return; // nobody in range — keep holding it
    const t = kids[bi];
    const d = Math.max(1, dist(player.x, player.y, t.x, t.y));
    carried = false;
    ballT = 6; // a fresh ball joins the field shortly
    thrown.push({ x: player.x, y: player.y, px: player.x, py: player.y,
                  vx: (t.x - player.x) / d * CFG.THROW_SPEED,
                  vy: (t.y - player.y) / d * CFG.THROW_SPEED,
                  travel: 0, from: "player", star: false });
    sndThrow();
  }

  // STAR FRENZY: three gold bullets at the three nearest friends, all
  // at once. Each one that connects tags that friend — IT bounces
  // between them and lands on the last one hit.
  function starBurst() {
    if (!star) return;
    star = null;
    starT = CFG.STAR_EVERY;
    const order = kids.map((k, i) => ({ i: i, d: dist(player.x, player.y, k.x, k.y) }))
      .sort((a, b) => a.d - b.d).slice(0, 3);
    for (const o of order) {
      const t = kids[o.i];
      const d = Math.max(1, o.d);
      thrown.push({ x: player.x, y: player.y, px: player.x, py: player.y,
                    vx: (t.x - player.x) / d * 640,
                    vy: (t.y - player.y) / d * 640,
                    travel: 0, from: "player", star: true });
    }
    floater(player.x, player.y - 70, "STAR FRENZY!");
    rings.push({ x: player.x, y: player.y - 10, r: 24, t: 0, life: 0.6, hue: 45 });
    sndStar();
  }

  function tickProjectiles(dt) {
    for (let i = thrown.length - 1; i >= 0; i--) {
      const b = thrown[i];
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.travel += Math.hypot(b.vx, b.vy) * dt;
      let done = false;
      // a hit tags whoever it touches (unless no-tag-backs blocks it)
      for (let j = 0; j < kids.length; j++) {
        if (dist(b.x, b.y, kids[j].x, kids[j].y) < 42) {
          if (tagBlocked(b.from, j)) {
            floater(kids[j].x, kids[j].y - 60, "NO TAG-BACKS!");
            sndNoBack();
          } else {
            projectileTagsKid(j, b.from);
          }
          done = true;
          break;
        }
      }
      if (!done && (b.travel > 620 || b.x < 0 || b.x > W || b.y < 0 || b.y > H)) {
        // missed: a plain ball drops where it stopped (star bullets vanish)
        if (!b.star) {
          balls.push({ x: clamp(b.x, 30, W - 30), y: clamp(b.y, 100, H - 30) });
        }
        done = true;
      }
      if (done) thrown.splice(i, 1);
    }
    // a fresh ball joins the field when none is lying around
    if (balls.length === 0) {
      ballT -= dt;
      if (ballT <= 0) { spawnBall(); ballT = 6; }
    }
  }

  function tickStar(dt) {
    if (star) {
      star.age += dt;
      if (star.age >= CFG.STAR_LIFE) { star = null; starT = CFG.STAR_EVERY; }
    } else {
      starT -= dt;
      if (starT <= 0) {
        const s = spawnFreeSpot(60);
        star = { x: s.x, y: s.y, age: 0 };
      }
    }
  }

  function tick(dt) {
    time += dt;

    if (state === "play") {
      if (splash) {
        // level-clear splash: the field holds still for the announcement
        splash.t -= dt;
        if (splash.t <= 0) {
          splash = null;
          if (pendingLevel) {
            const n = pendingLevel; pendingLevel = 0;
            startLevel(n);
          }
        }
      } else {
        roundT -= dt;
        if (roundT <= 0) { roundT = 0; levelEnd(); return; }
        if (itHold > 0) itHold = Math.max(0, itHold - dt);
        tickPlayer(dt);
        tickKids(dt);
        separateKids();
        tickTags();
        tickPopups(dt);
        tickProjectiles(dt);
        tickStar(dt);
      }
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
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt; f.y -= 30 * dt;
      if (f.t >= f.life) floaters.splice(i, 1);
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
      const holding = itHold > 0;
      const starBounce = Math.abs(Math.sin(player.phase * 1.3)) * 7;
      ctx.save();
      ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 22;
      drawStar(0, -r * 1.55 - starBounce, 26, "#ffe45e",
               holding ? time * 9 : Math.sin(time * 2) * 0.15);
      ctx.restore();
      if (holding) {
        // the hold: a shrinking ring counts down your wait before you can tag
        const hk = itHold / CFG.TAG_HOLD;
        ctx.save();
        ctx.strokeStyle = "rgba(255,228,94," + (0.35 + hk * 0.5).toFixed(2) + ")";
        ctx.lineWidth = 5; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, r + 16, -Math.PI / 2, -Math.PI / 2 + hk * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
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
      const holding = itHold > 0;
      const starBounce = Math.abs(Math.sin(k.phase * 1.3)) * 7;
      ctx.save();
      ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 22;
      drawStar(k.x, k.y - CFG.KID_R * 1.55 - starBounce, 26, "#ffe45e",
               holding ? time * 9 : Math.sin(time * 2 + k.phase) * 0.15);
      ctx.restore();
      if (holding) {
        // the hold: a shrinking ring counts down the wait
        const hk = itHold / CFG.TAG_HOLD;
        ctx.save();
        ctx.strokeStyle = "rgba(255,228,94," + (0.35 + hk * 0.5).toFixed(2) + ")";
        ctx.lineWidth = 5; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(k.x, k.y, CFG.KID_R + 14, -Math.PI / 2,
                -Math.PI / 2 + hk * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ---------------- drawing: HUD (the clock — visual, no reading) ---------------- */
  // A draining bar across the top + the seconds left. When the bar is
  // gone, time's up and whoever is IT loses. The last 10 seconds the bar
  // turns red and pulses — uh oh!
  function drawSlots() {
    const frac = clamp(roundT / levelTotal, 0, 1);
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
    // one big level digit, bottom-right — which level you're on
    drawPixelNumber(ctx, level, W - 40, H - 54, 8, "rgba(255,255,255,0.45)", false);
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
    // the clock ran out: retry this level, or the 5-level finale.
    const retry = endKind === "retry";
    ctx.fillStyle = retry ? "rgba(40,10,25,0.30)" : "rgba(10,40,25,0.30)";
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
    if (retry) {
      // you're IT at the buzzer — gentle, same level again!
      ctx.fillStyle = "#ff8a8a";
      ctx.strokeText("YOU'RE IT!", W / 2, H * 0.42);
      ctx.fillText("YOU'RE IT!", W / 2, H * 0.42);
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText("TRY AGAIN", W / 2, H * 0.42 + 44);
      ctx.fillText("TRY AGAIN", W / 2, H * 0.42 + 44);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.strokeText("YOU WIN!", W / 2, H * 0.42);
      ctx.fillText("YOU WIN!", W / 2, H * 0.42);
      ctx.font = "20px 'Press Start 2P', monospace";
      ctx.fillStyle = "#ffe45e";
      ctx.strokeText("5 LEVELS CLEARED!", W / 2, H * 0.42 + 44);
      ctx.fillText("5 LEVELS CLEARED!", W / 2, H * 0.42 + 44);
    }
    ctx.textAlign = "left";
    drawTriangleButton(againBtn, retry ? "#ff8a8a" : "#ffd23f");
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

  /* ---------------- drawing: pop-ups, balls, star, floaters ---------------- */
  function drawPopups() {
    for (const p of popups) {
      if (p.state === "warn") {
        // telegraph: pulsing outline, filling in — get ready, it's coming!
        const k = 0.5 + Math.sin(time * 14) * 0.5;
        ctx.save();
        ctx.strokeStyle = "rgba(255,220,90," + (0.4 + k * 0.6).toFixed(2) + ")";
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 10]);
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.restore();
        ctx.fillStyle = "rgba(255,220,90," + (0.12 + k * 0.12).toFixed(2) + ")";
        ctx.fillRect(p.x, p.y, p.w, p.h);
      } else {
        const fade = p.t > CFG.POPUP_SOLID - 0.4
          ? (CFG.POPUP_SOLID - p.t) / 0.4 : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = "rgba(20,60,25,0.28)";
        ctx.beginPath();
        ctx.ellipse(p.x + p.w / 2, p.y + p.h - 2, p.w * 0.55, 10, 0, 0, 6.2832);
        ctx.fill();
        if (p.kind === "bench") {
          ctx.fillStyle = "#8a6a48";
          ctx.fillRect(p.x, p.y, p.w, 14);
          ctx.fillRect(p.x, p.y + p.h - 14, p.w, 14);
          ctx.fillStyle = "#a8845c";
          ctx.fillRect(p.x, p.y + 14, p.w, p.h - 28);
          ctx.fillStyle = "rgba(60,40,20,0.4)";
          ctx.fillRect(p.x, p.y + p.h / 2 - 2, p.w, 4);
        } else {
          // tire stack: dark rings
          const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
          ctx.fillStyle = "#2b2f36";
          ctx.beginPath(); ctx.arc(cx, cy, p.w * 0.42, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = "#565d6b"; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(cx, cy, p.w * 0.30, 0, 6.2832); ctx.stroke();
          ctx.fillStyle = "#3a3f4a";
          ctx.beginPath(); ctx.arc(cx, cy, p.w * 0.14, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  function drawBallShape(x, y, r, gold) {
    ctx.save();
    ctx.shadowColor = gold ? "#ffd23f" : "#ff5a5a";
    ctx.shadowBlur = gold ? 18 : 10;
    ctx.fillStyle = gold ? "#ffe45e" : "#e23b3b";
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 6.2832); ctx.stroke();
  }

  function drawPickups() {
    for (const b of balls) {
      ctx.fillStyle = "rgba(20,60,25,0.25)";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 12, 16, 5, 0, 0, 6.2832);
      ctx.fill();
      drawBallShape(b.x, b.y, 15, false);
    }
    if (star) {
      // blink in the last 3 seconds so nobody misses the goodbye
      if (star.age < CFG.STAR_LIFE - 3 || Math.sin(time * 16) > -0.2) {
        const bob = Math.abs(Math.sin(time * 3)) * 8;
        ctx.save();
        ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 30;
        drawStar(star.x, star.y - bob, 24, "#ffe45e", Math.sin(time * 2) * 0.2);
        ctx.restore();
      }
    }
  }

  function drawThrown() {
    for (const b of thrown) {
      // motion streak from the previous spot
      ctx.strokeStyle = b.star ? "rgba(255,228,94,0.6)" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (b.star) {
        drawStar(b.x, b.y, 14, "#ffe45e", time * 10);
      } else {
        drawBallShape(b.x, b.y, 13, false);
      }
    }
  }

  function drawAim() {
    // you're holding a ball: a dotted line to the nearest friend in
    // range shows what a tap would throw at — no guessing
    if (!carried || it !== "player") return;
    let bi = -1, bd = CFG.THROW_R;
    for (let i = 0; i < kids.length; i++) {
      const d = dist(player.x, player.y, kids[i].x, kids[i].y);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi < 0) return;
    const t = kids[bi];
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.setLineDash([2, 12]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 10);
    ctx.lineTo(t.x, t.y - 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,90,90,0.9)";
    ctx.beginPath();
    ctx.arc(t.x, t.y, CFG.KID_R + 10, 0, 6.2832);
    ctx.stroke();
    ctx.restore();
  }

  function drawCarried() {
    // the ball you're holding bounces over your head
    if (!carried || it !== "player") return;
    const bob = Math.abs(Math.sin(player.phase * 1.3)) * 6;
    drawBallShape(player.x, player.y - CFG.KID_R * 1.5 - bob, 13, false);
  }

  function drawFloaters() {
    ctx.textAlign = "center";
    ctx.font = "20px 'Press Start 2P', monospace";
    for (const f of floaters) {
      const k = 1 - f.t / f.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 2));
      ctx.strokeStyle = "rgba(60,40,0,0.9)"; ctx.lineWidth = 5;
      ctx.strokeText(f.txt, f.x, f.y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(f.txt, f.x, f.y);
      ctx.restore();
    }
    ctx.textAlign = "left";
  }

  function drawSplash() {
    if (!splash) return;
    ctx.fillStyle = "rgba(10,40,25,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "44px 'Press Start 2P', monospace";
    ctx.strokeStyle = "rgba(60,40,0,0.9)"; ctx.lineWidth = 8;
    ctx.strokeText(splash.txt, W / 2, H * 0.42);
    ctx.fillStyle = "#ffe45e";
    ctx.fillText(splash.txt, W / 2, H * 0.42);
    ctx.textAlign = "left";
  }

  function render() {
    drawField();
    if (state !== "title") {
      drawPopups();
      drawPickups();
    }
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
      drawCarried();
      drawThrown();
      drawAim();
    }
    drawParts();
    drawFloaters();
    if (state !== "title") drawSlots();
    if (state === "title") drawTitle();
    else if (state === "end") drawEnd();
    drawSplash();
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
    if (MUSIC) MUSIC.tick(dt);
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
    get itHold() { return itHold; },
    get tagWait() { return CFG.TAG_HOLD; },
    get level() { return level; },
    get noBack() { return noBack; },
    get balls() { return balls; },
    get star() { return star; },
    get popups() { return popups; },
    get carried() { return carried; },
    get thrown() { return thrown; },
    get splash() { return splash; },
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
      speeds: function () { return S; },
      forceLevel: function (n) { startLevel(n); },
      placeBall: function (x, y) { balls.push({ x: x, y: y }); },
      placeStar: function (x, y) { star = { x: x, y: y, age: 0 }; },
      spawnPopup: function (x, y, kind) {
        popups.push({ x: x, y: y, w: 84, h: 64, kind: kind || "bench",
                      state: "solid", t: 0 });
      },
    },
    tap: function (x, y) { onDown(x, y); onUp(x, y); },
    start: function () { startGame(); },
    step: function (dt) { tick(dt || 0.016); },
  };
})();
