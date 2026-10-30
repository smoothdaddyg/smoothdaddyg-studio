/* ============================================================
   Glam Hair — SmoothDaddyG
   ------------------------------------------------------------
   A no-reading hair salon: one cute girl, eleven big tools.
   Tap a tool, then drag it through her hair (or tap her face
   for makeup). Brush, curl, blow-dry, change the LENGTH, dye
   (16 colors), snip with real drag scissors, lipstick (12),
   eyeshadow (10), blush (4 colors), freckles, and 14 hair
   accessories that STACK — wear them all at once. She
   giggles, sparkles fly, and a full style meter earns a
   celebration and a brand-new model.

   Hair is a verlet-rope simulation: every strand is a chain
   of points with gravity, damping and length constraints, so
   it swings, bounces and settles like real hair.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1;
  var audio = (typeof makeAudio === "function") ? makeAudio() : null;
  /* Background music (2026-10-30 rollout): an original chiptune loop —
     distinct chiptune voice, kept under the SFX. Starts at load; the
     synth stays silent until the first tap, then plays mid-loop. */
  var MUSIC = audio ? audio.makeMusic({
    bpm: 132, div: 4, steps: 64,
    bassType: "triangle", bassVol: 0.2,
    leadType: "square", leadVol: 0.05,
    harmonyType: "square", harmonyVol: 0.025,
    kickVol: 0.16, snareVol: 0.05, hatVol: 0.02,
    kicks: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
    snares: [4, 12, 20, 28, 36, 44, 52, 60],
    hats: "all",
    bass: [87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 0, 174.61, 0, 0, 87.31, 0, 130.81, 0,
           73.42, 0, 0, 146.83, 0, 0, 73.42, 0, 0, 146.83, 0, 0, 73.42, 0, 110, 0,
           116.54, 0, 0, 233.08, 0, 0, 116.54, 0, 0, 233.08, 0, 0, 116.54, 0, 174.61, 0,
           65.41, 0, 0, 130.81, 0, 0, 65.41, 0, 0, 130.81, 0, 0, 65.41, 0, 98, 0],
    lead: [698.46, 880, 698.46, 880, 1046.5, 880, 698.46, 0, 880, 1046.5, 880, 698.46, 523.25, 0, 0, 0,
           587.33, 698.46, 587.33, 698.46, 880, 698.46, 587.33, 0, 698.46, 880, 698.46, 587.33, 523.25, 0, 0, 0,
           698.46, 880, 698.46, 880, 1046.5, 1174.66, 1046.5, 880, 698.46, 880, 1046.5, 880, 698.46, 0, 0, 0,
           523.25, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1174.66, 1046.5, 880, 783.99, 659.25, 523.25, 0, 0, 0],
    harmony: [440, 0, 0, 0, 0, 0, 0, 0, 523.25, 0, 0, 0, 0, 0, 0, 0,
           349.23, 0, 0, 0, 0, 0, 0, 0, 440, 0, 0, 0, 0, 0, 0, 0,
           587.33, 0, 0, 0, 0, 0, 0, 0, 698.46, 0, 0, 0, 0, 0, 0, 0,
           329.63, 0, 0, 0, 0, 0, 0, 0, 392, 0, 0, 0, 0, 0, 0, 0]
  }) : null;
  if (MUSIC) MUSIC.start();

  function beep(fn) { try { if (audio && audio.unlock) audio.unlock(); if (fn) fn(); } catch (e) {} }
  function tone(f, d, o) { beep(function () { audio.tone(f, d, o); }); }
  function noise(d, o) { beep(function () { audio.noise(d, o); }); }
  function arp(n, d, t, v) { beep(function () { audio.arp(n, d, t, v); }); }

  /* ---------------- tuning ---------------- */
  var SEG = 9;               // points per strand
  var BACK_N = 44, FRONT_N = 10;
  var HAIR_GRAV = 260;       // gentle — hair floats more than it falls
  var DAMP = 0.985;
  var ITER = 3;              // constraint iterations

  var SKINS = ["#ffd9b3", "#f1b98a", "#c98d5e", "#8d5a3b"];
  var EYES = ["#5b3a29", "#2f6f4f", "#3a6ea5", "#7b4fa6"];
  var DRESSES = ["#ff6f91", "#40c4ff", "#b388ff", "#69f0ae", "#ffd740"];
  var DYE = ["#ff5fa2", "#b388ff", "#40c4ff", "#69f0ae", "#ffd740", "#ff8a65",
             "#ff1744", "#00e5ff", "#76ff03", "#ff6d00", "#212121", "#e8e8f0",
             "#ffdab9", "#e75480", "#20b2aa", "#b0e0e6"];
  var LIPS = ["#ff6f9e", "#e0447c", "#ff8a5c", "#b388ff",
              "#d81b60", "#ff3d00", "#8e24aa", "#f48fb1",
              "#ff9e80", "#c2185b", "#7b1fa2", "#ffccbc"];
  var EYESHADOWS = ["#b388ff", "#40c4ff", "#ffd740", "#ff8a65", "#69f0ae", "#f48fb1",
                    "#9d4edd", "#f72585", "#4cc9f0", "#90be6d"];
  var BLUSHES = ["#ff8fab", "#ffab91", "#ff6f91", "#c94f7c"];
  var BOWS = ["bow", "headband", "star", "flower", "tiara", "butterfly", "heart",
              "catears", "horn", "gem", "ribbon", "halo", "moon", "rainbow"];
  var LENGTHS = [0.55, 0.85, 1.15, 1.5];  // bob, short, long, SUPER long

  /* ---------------- state ---------------- */
  var cx = 0, cy = 0, R = 100;      // head center + radius
  var barH = 116, barY = 0;
  var model = null;                 // the girl
  var strands = [];                 // hair
  var parts = [];                   // particles (sparkles, hearts, confetti)
  var tool = "brush";               // active tool id
  var dyeIdx = 0, lipIdx = 0, bowIdx = 0, shadowIdx = 0, blushIdx = 0, lengthIdx = 2;
  var style = 0;                    // style meter 0..100
  var styleCool = 0;                // per-action points cooldown
  var celebrating = 0;              // celebration timer
  var newModelT = 0;
  var hintT = 0;                    // first-run hint animation
  var usedCanvas = false;
  var blinkT = 2, blink = 0;
  var giggleT = 0;
  var bounce = 0;                   // happy bounce offset
  var time = 0;

  var pointer = { down: false, x: 0, y: 0, px: 0, py: 0, id: null };

  /* ============================================================
     THE MODEL
     ============================================================ */
  function newModel() {
    // freckle spots: a natural scatter across the nose and cheeks
    var spots = [];
    for (var fi = 0; fi < 16; fi++) {
      var side = fi % 2 === 0 ? -1 : 1;
      spots.push({
        dx: side * (0.06 + Math.random() * 0.42),
        dy: 0.30 + Math.random() * 0.16 - Math.abs(side) * 0.02,
        r: 1.6 + Math.random() * 1.6,
      });
    }
    model = {
      skin: SKINS[Math.floor(Math.random() * SKINS.length)],
      eye: EYES[Math.floor(Math.random() * EYES.length)],
      dress: DRESSES[Math.floor(Math.random() * DRESSES.length)],
      hairBase: DYE[Math.floor(Math.random() * DYE.length)],
      hairLen: 0.8 + Math.random() * 0.45,
      lipColor: null,
      blush: 0, blushColor: BLUSHES[0],
      eyeShadow: 0, eyeShadowColor: null,
      freckles: 0, freckSpots: spots,
      accs: [],   // STACKED accessories [{kind, x, y}] — wear them all!
      happy: 0.5,
    };
    buildHair();
  }

  /* ============================================================
     HAIR SIMULATION (verlet ropes — pure logic, canvas-free)
     ============================================================ */
  function makePt(x, y) { return { x: x, y: y, px: x, py: y }; }

  // A strand: root pinned to the scalp, points hanging free.
  function createStrand(rx, ry, dx, dy, segs, segLen, color) {
    var pts = [];
    for (var i = 0; i < segs; i++) {
      // rest shape: mostly down, fanning outward a little
      var spread = 0.35 * (i / segs);
      pts.push(makePt(
        rx + dx * segLen * i * 0.4 + dx * spread * segLen * i * 0.3,
        ry + dy * segLen * i
      ));
    }
    return {
      rx: rx, ry: ry, pts: pts, n: segs, maxN: segs,
      segLen: segLen, curl: 0, phase: Math.random() * 6.28,
      color: color, grow: 0,
    };
  }

  function buildHair() {
    strands = [];
    var segLen = R * 0.24 * model.hairLen;
    // back hair — long, behind the head
    for (var i = 0; i < BACK_N; i++) {
      var a = Math.PI * (1.06 + (i / (BACK_N - 1)) * 0.88);
      var rx = cx + Math.cos(a) * R * 0.96;
      var ry = cy + Math.sin(a) * R * 0.96;
      var dx = Math.cos(a), dy = 1; // down, fanning with the root angle
      strands.push(createStrand(rx, ry, dx * 0.55, dy, SEG, segLen, model.hairBase));
    }
    // front framing strands — shorter, drawn over the shoulders
    var fsegs = Math.max(5, Math.floor(SEG * 0.7));
    var arcs = [Math.PI * 1.11, Math.PI * 1.17, Math.PI * 1.23, Math.PI * 1.29, Math.PI * 1.35,
                Math.PI * 1.65, Math.PI * 1.71, Math.PI * 1.77, Math.PI * 1.83, Math.PI * 1.89];
    for (var f = 0; f < FRONT_N; f++) {
      var fa = arcs[f];
      var fx = cx + Math.cos(fa) * R * 0.94;
      var fy = cy + Math.sin(fa) * R * 0.94;
      strands.push(createStrand(fx, fy, Math.cos(fa) * 0.7, 1, fsegs, segLen * 0.9, model.hairBase));
      strands[strands.length - 1].front = true;
    }
  }

  // Change the hair LENGTH, keeping every strand's color and curl —
  // a new hairdo, not a new head of hair.
  function restyleLength() {
    if (!model) return;
    var keep = strands.map(function (s) { return { color: s.color, curl: s.curl, front: !!s.front }; });
    model.hairLen = LENGTHS[lengthIdx];
    buildHair();
    for (var i = 0; i < strands.length && i < keep.length; i++) {
      strands[i].color = keep[i].color;
      strands[i].curl = keep[i].curl;
    }
    sparkle(cx, cy - R * 0.6, "#fff7ae", 10);
  }

  function stepStrands(dt) {
    var i, j, s, p;
    var dtc = Math.min(dt, 0.033);
    for (i = 0; i < strands.length; i++) {
      s = strands[i];
      // roots ride the head (which bobs when she's happy)
      s.rx = s.ox != null ? s.ox : s.rx; // ox set by buildHair pinning below
      for (j = 1; j < s.n; j++) {
        p = s.pts[j];
        var vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP;
        p.px = p.x; p.py = p.y;
        p.x += vx;
        p.y += vy + HAIR_GRAV * dtc * dtc * 60;
        // gentle idle sway
        p.x += Math.sin(time * 1.7 + s.phase + j * 0.5) * 6 * dtc;
      }
      // regrow snipped hair slowly
      if (s.n < s.maxN) {
        s.grow += dtc;
        if (s.grow > 1.4) { s.grow = 0; s.n++; pinTail(s); }
      }
    }
    // constraints: pin root, keep segment lengths
    for (var it = 0; it < ITER; it++) {
      for (i = 0; i < strands.length; i++) {
        s = strands[i];
        s.pts[0].x = s.rx; s.pts[0].y = s.ry;
        s.pts[0].px = s.rx; s.pts[0].py = s.ry;
        for (j = 0; j < s.n - 1; j++) {
          var a = s.pts[j], b = s.pts[j + 1];
          var dx = b.x - a.x, dy = b.y - a.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          var diff = (d - s.segLen) / d;
          if (j === 0) { b.x -= dx * diff; b.y -= dy * diff; }
          else {
            var f = 0.5 * diff;
            a.x += dx * f; a.y += dy * f;
            b.x -= dx * f; b.y -= dy * f;
          }
        }
      }
    }
  }

  function pinTail(s) {
    // when a segment regrows, place it just past the current tip
    var tip = s.pts[s.n - 2], prev = s.pts[s.n - 3] || s.pts[0];
    var dx = tip.x - prev.x, dy = tip.y - prev.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var np = s.pts[s.n - 1];
    np.x = np.px = tip.x + (dx / d) * s.segLen;
    np.y = np.py = tip.y + (dy / d) * s.segLen;
  }

  // keep every root glued to the (possibly bobbing) head
  function pinRoots() {
    var k = 0, i, f;
    for (i = 0; i < BACK_N; i++, k++) {
      var a = Math.PI * (1.06 + (i / (BACK_N - 1)) * 0.88);
      strands[k].rx = cx + Math.cos(a) * R * 0.96;
      strands[k].ry = cy + Math.sin(a) * R * 0.96 - bounce;
    }
    var arcs = [Math.PI * 1.11, Math.PI * 1.17, Math.PI * 1.23, Math.PI * 1.29, Math.PI * 1.35,
                Math.PI * 1.65, Math.PI * 1.71, Math.PI * 1.77, Math.PI * 1.83, Math.PI * 1.89];
    for (f = 0; f < FRONT_N; f++, k++) {
      var fa = arcs[f];
      strands[k].rx = cx + Math.cos(fa) * R * 0.94;
      strands[k].ry = cy + Math.sin(fa) * R * 0.94 - bounce;
    }
  }

  /* ============================================================
     TOOLS
     ============================================================ */
  var TOOLS = [
    { id: "brush", icon: "brush" },
    { id: "curl", icon: "curl" },
    { id: "dry", icon: "dry" },
    { id: "grow", icon: "grow", variant: true },
    { id: "color", icon: "color", variant: true },
    { id: "cut", icon: "cut" },
    { id: "lips", icon: "lips", variant: true },
    { id: "shadow", icon: "shadow", variant: true },
    { id: "blush", icon: "blush", variant: true, tap: true },
    { id: "freck", icon: "freck", tap: true },
    { id: "bow", icon: "bow", variant: true, tap: true },
  ];
  var toolRects = [];

  function selectTool(id) {
    var t = null;
    for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) t = TOOLS[i];
    if (!t) return;
    if (tool === id && t.variant) {
      // tap the active tool again -> cycle its variant
      if (id === "color") { dyeIdx = (dyeIdx + 1) % DYE.length; tone(700 + dyeIdx * 90, 0.08, { type: "triangle", vol: 0.12 }); }
      if (id === "grow") {
        // cycle the hair LENGTH: bob -> short -> long -> SUPER long,
        // keeping every strand's color and curl
        lengthIdx = (lengthIdx + 1) % LENGTHS.length;
        restyleLength();
        tone(500 + lengthIdx * 120, 0.1, { type: "triangle", vol: 0.12 });
      }
      if (id === "lips") { lipIdx = (lipIdx + 1) % LIPS.length; tone(600 + lipIdx * 110, 0.08, { type: "triangle", vol: 0.12 }); }
      if (id === "shadow") { shadowIdx = (shadowIdx + 1) % EYESHADOWS.length; tone(800 + shadowIdx * 100, 0.08, { type: "sine", vol: 0.12 }); }
      if (id === "blush") { blushIdx = (blushIdx + 1) % BLUSHES.length; if (model) model.blushColor = BLUSHES[blushIdx]; tone(760 + blushIdx * 100, 0.08, { type: "sine", vol: 0.12 }); }
      if (id === "bow") { bowIdx = (bowIdx + 1) % BOWS.length; tone(900 + bowIdx * 120, 0.1, { type: "sine", vol: 0.14 }); }
      return;
    }
    tool = id;
    tone(520, 0.07, { type: "triangle", vol: 0.1 });
  }

  /* ---------------- tool effects on hair ---------------- */
  function forStrandsNear(x, y, rad, fn) {
    for (var i = 0; i < strands.length; i++) {
      var s = strands[i], hit = false;
      for (var j = 0; j < s.n; j++) {
        var p = s.pts[j];
        var dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy < rad * rad) { hit = true; break; }
      }
      if (hit) fn(s);
    }
  }

  function sparkle(x, y, color, n) {
    for (var i = 0; i < (n || 6); i++) {
      var a = Math.random() * 6.28, sp = 40 + Math.random() * 120;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.6 + Math.random() * 0.5, t: 0,
        c: color || "#fff7ae", r: 2 + Math.random() * 3, spark: true,
      });
    }
  }

  function heart(x, y) {
    parts.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 40, vy: -90 - Math.random() * 60,
      life: 1.1, t: 0, c: "#ff6f9e", r: 7 + Math.random() * 4, heart: true,
    });
  }

  function addStyle(n) {
    if (celebrating > 0) return;
    styleCool -= 0; // points flow freely; each stroke is a little joy
    style = Math.min(100, style + n);
    model.happy = Math.min(1, model.happy + n * 0.004);
    if (style >= 100) startCelebration();
  }

  function giggle() {
    if (giggleT > 0) return;
    giggleT = 0.9;
    arp([660, 880, 990, 1170], 0.09, "triangle", 0.12);
    bounce = 14;
    for (var i = 0; i < 3; i++) heart(cx + (Math.random() - 0.5) * R, cy - R * 0.7);
  }

  // called every frame while a drag-tool is active on the canvas
  function applyDragTool(dt) {
    var x = pointer.x, y = pointer.y;
    var dx = x - pointer.px, dy = y - pointer.py;
    if (tool === "brush") {
      for (var i = 0; i < strands.length; i++) {
        var s = strands[i];
        for (var j = 1; j < s.n; j++) {
          var p = s.pts[j];
          var ddx = p.x - x, ddy = p.y - y;
          var d2 = ddx * ddx + ddy * ddy;
          if (d2 < 95 * 95) {
            var pull = 0.28 * (1 - Math.sqrt(d2) / 95);
            p.x += (x + dx * 0.6 - p.x) * pull;
            p.y += (y + dy * 0.6 - p.y) * pull;
          }
        }
        s.curl = Math.max(0, s.curl - dt * 1.2); // brushing smooths curls
      }
      if (Math.random() < dt * 14) sparkle(x, y, "#ffffff", 2);
      addStyle(dt * 7);
    } else if (tool === "curl") {
      forStrandsNear(x, y, 80, function (s) {
        if (s.curl < 1) {
          s.curl = Math.min(1, s.curl + dt * 2.2);
          if (Math.random() < dt * 10) sparkle(x, y, "#ffd7a8", 2);
        }
      });
      addStyle(dt * 9);
    } else if (tool === "dry") {
      var wx = dx * 9, wy = dy * 9 - 30;
      for (var k = 0; k < strands.length; k++) {
        var s2 = strands[k];
        for (var m = 1; m < s2.n; m++) {
          var q = s2.pts[m];
          var qdx = q.x - x, qdy = q.y - y;
          var qd2 = qdx * qdx + qdy * qdy;
          if (qd2 < 120 * 120) {
            var f = (1 - Math.sqrt(qd2) / 120) * dt * 60;
            q.x += wx * f * 0.06; q.y += wy * f * 0.06;
            q.x += Math.sin(time * 22 + s2.phase + m) * 26 * dt * (1 - Math.sqrt(qd2) / 120);
          }
        }
        s2.curl = Math.min(1, s2.curl + dt * 0.25); // a little natural wave
      }
      addStyle(dt * 7);
    } else if (tool === "color") {
      var col = DYE[dyeIdx], changed = false;
      forStrandsNear(x, y, 65, function (s) {
        if (s.color !== col) { s.color = col; changed = true; }
      });
      if (changed) {
        sparkle(x, y, col, 5);
        arp([880, 1174, 1568], 0.07, "sine", 0.1);
        addStyle(4);
      }
    } else if (tool === "cut") {
      // SCISSORS: drag through the hair and everything near the blades
      // gets snipped AT the pointer — short, satisfying chops, locks fall
      var cutAny = false;
      for (var c = 0; c < strands.length; c++) {
        var s3 = strands[c];
        var bestJ = -1, bestD2 = 60 * 60;
        for (var q = 3; q < s3.n; q++) {
          var pp = s3.pts[q];
          var pdx = pp.x - x, pdy = pp.y - y;
          var pd2 = pdx * pdx + pdy * pdy;
          if (pd2 < bestD2) { bestD2 = pd2; bestJ = q; }
        }
        if (bestJ > 0 && s3.n > 4 && (!s3.lastCut || time - s3.lastCut > 0.3)) {
          var cutP = s3.pts[bestJ];
          s3.n = Math.max(3, bestJ + 1);
          s3.grow = 0; s3.lastCut = time;
          noise(0.05, { filter: "highpass", freq: 3200, vol: 0.22 });
          sparkle(cutP.x, cutP.y, "#ffffff", 4);
          // the snipped lock flutters down
          parts.push({ x: cutP.x, y: cutP.y, vx: (Math.random() - 0.5) * 90, vy: 60,
                       life: 1.3, t: 0, c: s3.color, r: 3, lock: true });
          cutAny = true;
        }
      }
      if (cutAny) { addStyle(6); if (Math.random() < 0.25) giggle(); }
    } else if (tool === "lips") {
      // only the mouth takes lipstick
      var mx = cx, my = cy + R * 0.52;
      var ex = (x - mx) / (R * 0.30), ey = (y - my) / (R * 0.16);
      if (ex * ex + ey * ey < 1.6) {
        if (model.lipColor !== LIPS[lipIdx]) {
          model.lipColor = LIPS[lipIdx];
          tone(700, 0.08, { type: "sine", vol: 0.14, slideTo: 1050 });
          sparkle(mx, my, LIPS[lipIdx], 6);
          giggle();
          addStyle(6);
        }
      }
    } else if (tool === "shadow") {
      // eyeshadow: sweep over the eyes to paint the lids
      var eyeY = cy - R * 0.10, eyeX = R * 0.36, applied = false;
      for (var es = -1; es <= 1; es += 2) {
        var eex = cx + es * eyeX;
        var dex = (x - eex) / (R * 0.30), dey = (y - (eyeY - R * 0.10)) / (R * 0.22);
        if (dex * dex + dey * dey < 1.3) {
          if (model.eyeShadowColor !== EYESHADOWS[shadowIdx] || model.eyeShadow < 1) {
            model.eyeShadowColor = EYESHADOWS[shadowIdx];
            model.eyeShadow = Math.min(1, model.eyeShadow + dt * 3);
            applied = true;
          }
        }
      }
      if (applied) {
        sparkle(x, y, EYESHADOWS[shadowIdx], 2);
        addStyle(dt * 10);
        if (model.eyeShadow >= 1 && Math.random() < dt * 2) giggle();
      }
    }
  }

  // called once on tap for tap-tools
  function applyTapTool(x, y) {
    if (tool === "blush") {
      var chx = R * 0.52, chy = cy + R * 0.30, chr = R * 0.30;
      var dl = Math.hypot(x - (cx - chx), y - chy), dr = Math.hypot(x - (cx + chx), y - chy);
      if ((dl < chr * 1.8 || dr < chr * 1.8) && model.blush < 1) {
        model.blush = Math.min(1, model.blush + 0.34);
        giggle();
        addStyle(5);
      }
    } else if (tool === "freck") {
      // tap the face: freckles bloom across the nose and cheeks
      var fdx = x - cx, fdy = y - cy;
      if (fdx * fdx + fdy * fdy < R * R && model.freckles < 1) {
        model.freckles = Math.min(1, model.freckles + 0.25);
        tone(980, 0.08, { type: "sine", vol: 0.1 });
        sparkle(x, y, "#ffcf9e", 3);
        giggle();
        addStyle(4);
      }
    } else if (tool === "bow") {
      var hx = x - cx, hy = y - (cy - bounce);
      if (hx * hx + hy * hy < (R * 1.25) * (R * 1.25)) {
        // accessories STACK — wear them all at once!
        model.accs.push({ kind: BOWS[bowIdx], x: hx, y: hy });
        if (model.accs.length > 8) model.accs.shift();
        tone(1320, 0.16, { type: "triangle", vol: 0.14 });
        sparkle(x, y, "#fff7ae", 8);
        giggle();
        addStyle(6);
      }
    }
  }

  function toolSounds(dt) {
    // looping-ish sounds while dragging
    if (!pointer.down || celebrating > 0) return;
    if (tool === "brush" && Math.random() < dt * 6)
      noise(0.12, { filter: "bandpass", freq: 1100, vol: 0.07 });
    if (tool === "curl" && Math.random() < dt * 5)
      noise(0.15, { filter: "highpass", freq: 5200, vol: 0.045 });
    if (tool === "dry" && Math.random() < dt * 8)
      noise(0.2, { filter: "lowpass", freq: 750, vol: 0.08 });
    if (tool === "cut" && Math.random() < dt * 3)
      noise(0.04, { filter: "highpass", freq: 3400, vol: 0.06 }); // snip-snip
  }

  /* ---------------- celebration: the style is DONE ---------------- */
  function startCelebration() {
    celebrating = 3.2;
    newModelT = 2.6;
    arp([523, 659, 784, 1046, 784, 1046, 1318], 0.12, "triangle", 0.16);
    setTimeout(function () { arp([1046, 1318, 1568, 2093], 0.14, "sine", 0.14); }, 500);
    for (var i = 0; i < 90; i++) {
      parts.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.3,
        vx: (Math.random() - 0.5) * 60, vy: 130 + Math.random() * 160,
        life: 2.6, t: 0,
        c: ["#ff6f9e", "#ffd740", "#69f0ae", "#40c4ff", "#b388ff"][i % 5],
        r: 3 + Math.random() * 4, confetti: true,
      });
    }
    for (var h = 0; h < 12; h++) heart(cx + (Math.random() - 0.5) * R * 2, cy + (Math.random() - 0.5) * R);
    bounce = 26;
    model.happy = 1;
  }

  /* ============================================================
     INPUT
     ============================================================ */
  function toolAt(x, y) {
    for (var i = 0; i < toolRects.length; i++) {
      var r = toolRects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
    }
    return null;
  }

  function isTapTool(id) {
    for (var i = 0; i < TOOLS.length; i++)
      if (TOOLS[i].id === id) return !!TOOLS[i].tap;
    return false;
  }

  function onDown(x, y, id) {
    beep();
    var tid = toolAt(x, y);
    if (tid) { selectTool(tid); return; }
    pointer.down = true; pointer.x = pointer.px = x; pointer.y = pointer.py = y; pointer.id = id;
    usedCanvas = true;
    if (isTapTool(tool)) applyTapTool(x, y);
  }

  function onMove(x, y, id) {
    if (!pointer.down || pointer.id !== id) return;
    pointer.px = pointer.x; pointer.py = pointer.y;
    pointer.x = x; pointer.y = y;
  }

  function onUp(id) {
    if (pointer.id === id) { pointer.down = false; pointer.id = null; }
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    onDown((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height), e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    onMove((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height), e.pointerId);
  });
  canvas.addEventListener("pointerup", function (e) { onUp(e.pointerId); });
  canvas.addEventListener("pointercancel", function (e) { onUp(e.pointerId); });
  window.addEventListener("resize", resize);

  /* ============================================================
     UPDATE
     ============================================================ */
  function update(dt) {
    time += dt;
    if (celebrating > 0) {
      celebrating -= dt;
      bounce = Math.abs(Math.sin(time * 9)) * 22;
      if (newModelT > 0) {
        newModelT -= dt;
        if (newModelT <= 0) {
          newModel(); style = 0; celebrating = 0; bounce = 0;
          tone(880, 0.2, { type: "sine", vol: 0.12, slideTo: 1320 });
        }
      }
    } else {
      bounce += (0 - bounce) * Math.min(1, dt * 5);
    }
    if (giggleT > 0) giggleT -= dt;

    // blink
    blinkT -= dt;
    if (blinkT <= 0) { blink = 0.14; blinkT = 2 + Math.random() * 3; }
    if (blink > 0) blink -= dt;

    pinRoots();
    stepStrands(dt);
    if (pointer.down && !isTapTool(tool) && celebrating <= 0) applyDragTool(dt);
    toolSounds(dt);

    // particles
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += (p.confetti ? 60 : p.lock ? 160 : -30) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }

    model.happy += ((celebrating > 0 ? 1 : 0.5) - model.happy) * Math.min(1, dt * 2);
  }

  /* ============================================================
     DRAWING
     ============================================================ */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function strandPath(s) {
    ctx.beginPath();
    var n = s.n;
    for (var j = 0; j < n; j++) {
      var p = s.pts[j];
      var ox = 0, oy = 0;
      if (s.curl > 0.02 && j > 0) {
        // curls: spiral wave perpendicular to the strand
        var q = s.pts[Math.max(0, j - 1)];
        var dx = p.x - q.x, dy = p.y - q.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var w = Math.sin(j * 1.35 + s.phase) * 8 * s.curl;
        ox = (-dy / d) * w; oy = (dx / d) * w;
      }
      var X = p.x + ox, Y = p.y + oy;
      if (j === 0) ctx.moveTo(X, Y);
      else {
        var pr = s.pts[j - 1];
        ctx.quadraticCurveTo(pr.x, pr.y, (pr.x + X) / 2, (pr.y + Y) / 2);
      }
    }
    // note: path ends at midpoint smoothing; good enough for hair
  }

  function drawStrand(s, width) {
    strandPath(s);
    ctx.strokeStyle = shade(s.color, -38);
    ctx.lineWidth = width + 2.5;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
    strandPath(s);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = width;
    ctx.stroke();
    strandPath(s);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = width * 0.32;
    ctx.stroke();
  }

  function drawBackHair() {
    for (var i = 0; i < strands.length; i++)
      if (!strands[i].front) drawStrand(strands[i], 7);
  }
  function drawFrontHair() {
    for (var i = 0; i < strands.length; i++)
      if (strands[i].front) drawStrand(strands[i], 6);
  }

  function drawGirl() {
    var by = bounce;
    // shoulders / dress
    ctx.fillStyle = model.dress;
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 1.75 - by * 0.4, R * 1.05, R * 0.62, 0, 0, 6.29);
    ctx.fill();
    // neck
    ctx.fillStyle = shade(model.skin, -12);
    ctx.fillRect(cx - R * 0.20, cy + R * 0.78 - by, R * 0.40, R * 0.5);
    // ears
    ctx.fillStyle = model.skin;
    ctx.beginPath(); ctx.arc(cx - R * 0.98, cy + R * 0.08 - by, R * 0.16, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + R * 0.98, cy + R * 0.08 - by, R * 0.16, 0, 6.29); ctx.fill();
    // head
    ctx.beginPath(); ctx.arc(cx, cy - by, R, 0, 6.29);
    ctx.fillStyle = model.skin; ctx.fill();

    var happy = model.happy;
    // eyeshadow — a wash of color over the lids, painted with the shadow tool
    if (model.eyeShadow > 0.01 && model.eyeShadowColor) {
      var shEx = R * 0.36, shEy = cy - R * 0.10 - by;
      ctx.fillStyle = model.eyeShadowColor;
      ctx.globalAlpha = 0.5 * model.eyeShadow;
      for (var ss2 = -1; ss2 <= 1; ss2 += 2) {
        ctx.beginPath();
        ctx.ellipse(cx + ss2 * shEx, shEy - R * 0.07, R * 0.155, R * 0.11, 0, 0, 6.29);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // eyes
    var ex = R * 0.36, ey = cy - R * 0.10 - by, er = R * 0.20;
    for (var s = -1; s <= 1; s += 2) {
      var eex = cx + s * ex;
      if (blink > 0) {
        ctx.strokeStyle = "#5b3a29"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(eex - er * 0.7, ey); ctx.quadraticCurveTo(eex, ey + 5, eex + er * 0.7, ey); ctx.stroke();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.ellipse(eex, ey, er * 0.72, er, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = model.eye;
        ctx.beginPath(); ctx.arc(eex, ey + er * 0.12, er * 0.52, 0, 6.29); ctx.fill();
        ctx.fillStyle = "#1d1d2b";
        ctx.beginPath(); ctx.arc(eex, ey + er * 0.12, er * 0.26, 0, 6.29); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath(); ctx.arc(eex - er * 0.16, ey - er * 0.06, er * 0.14, 0, 6.29); ctx.fill();
      }
    }
    // brows
    ctx.strokeStyle = "rgba(70,40,25,0.75)"; ctx.lineWidth = 4; ctx.lineCap = "round";
    for (var b2 = -1; b2 <= 1; b2 += 2) {
      var bx = cx + b2 * ex;
      ctx.beginPath(); ctx.moveTo(bx - er * 0.6, ey - er * 1.15); ctx.quadraticCurveTo(bx, ey - er * 1.4, bx + er * 0.6, ey - er * 1.15); ctx.stroke();
    }
    // nose
    ctx.fillStyle = "rgba(120,70,45,0.5)";
    ctx.beginPath(); ctx.arc(cx, cy + R * 0.22 - by, R * 0.045, 0, 6.29); ctx.fill();
    // freckles — little sun-kissed dots across the nose and cheeks
    if (model.freckles > 0) {
      ctx.fillStyle = "rgba(150,90,50,0.75)";
      var fn = Math.floor(model.freckles * model.freckSpots.length);
      for (var fk = 0; fk < fn; fk++) {
        var sp = model.freckSpots[fk];
        ctx.beginPath();
        ctx.arc(cx + sp.dx * R, cy + sp.dy * R - by, sp.r + 0.6, 0, 6.29);
        ctx.fill();
      }
    }
    // blush
    if (model.blush > 0.01) {
      ctx.fillStyle = model.blushColor;
      ctx.globalAlpha = 0.55 * model.blush;
      ctx.beginPath(); ctx.ellipse(cx - R * 0.52, cy + R * 0.30 - by, R * 0.20, R * 0.13, 0, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + R * 0.52, cy + R * 0.30 - by, R * 0.20, R * 0.13, 0, 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // mouth — smile grows with happiness, lipstick paints it
    var mw = R * (0.22 + happy * 0.22), mh = R * (0.05 + happy * 0.13);
    var myy = cy + R * 0.52 - by;
    ctx.fillStyle = model.lipColor || "#c96f6f";
    ctx.beginPath(); ctx.ellipse(cx, myy, mw, mh, 0, 0, 6.29); ctx.fill();
    if (happy > 0.55) { // open happy smile shows a little tongue
      ctx.fillStyle = "#e88a8a";
      ctx.beginPath(); ctx.ellipse(cx, myy + mh * 0.35, mw * 0.45, mh * 0.45, 0, 0, 6.29); ctx.fill();
    }
    // accessory
    for (var ai = 0; ai < model.accs.length; ai++) {
      var ac = model.accs[ai];
      drawAccessory(cx + ac.x, cy - by + ac.y, ac.kind);
    }
  }

  function drawAccessory(x, y, kind) {
    ctx.save();
    ctx.translate(x, y);
    if (kind === "bow") {
      ctx.fillStyle = "#ff5f9e";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-26, -16); ctx.lineTo(-26, 16); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, -16); ctx.lineTo(26, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e0447c";
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.29); ctx.fill();
    } else if (kind === "headband") {
      ctx.strokeStyle = "#ffd740"; ctx.lineWidth = 12; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.fillStyle = "#ff5f9e";
      ctx.beginPath(); ctx.arc(0, -26, 9, 0, 6.29); ctx.fill();
    } else if (kind === "star") {
      ctx.fillStyle = "#ffd740";
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var rr = i % 2 === 0 ? 20 : 9, aa = -Math.PI / 2 + i * Math.PI / 5;
        var sx = Math.cos(aa) * rr, sy = Math.sin(aa) * rr;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath(); ctx.fill();
    } else if (kind === "flower") {
      ctx.fillStyle = "#ff9ec6";
      for (var p = 0; p < 5; p++) {
        var pa = p * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.arc(Math.cos(pa) * 14, Math.sin(pa) * 14, 11, 0, 6.29); ctx.fill();
      }
      ctx.fillStyle = "#ffd740";
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.29); ctx.fill();
    } else if (kind === "tiara") {
      // golden crown
      ctx.fillStyle = "#ffd740";
      ctx.shadowColor = "#ffd740"; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-24, 8); ctx.lineTo(-24, -8);
      ctx.lineTo(-16, 2); ctx.lineTo(-8, -14); ctx.lineTo(0, 2);
      ctx.lineTo(8, -14); ctx.lineTo(16, 2); ctx.lineTo(24, -8);
      ctx.lineTo(24, 8); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ff5f9e";
      ctx.beginPath(); ctx.arc(-8, -5, 3.5, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -5, 3.5, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#40c4ff";
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.29); ctx.fill();
    } else if (kind === "butterfly") {
      // butterfly hair clip
      for (var w = -1; w <= 1; w += 2) {
        ctx.save(); ctx.scale(w, 1);
        ctx.fillStyle = "#b388ff";
        ctx.beginPath(); ctx.ellipse(13, -8, 12, 16, 0.5, 0, 6.29); ctx.fill();
        ctx.fillStyle = "#ffd740";
        ctx.beginPath(); ctx.arc(15, -12, 4.5, 0, 6.29); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#3e2723";
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 11, 0, 0, 6.29); ctx.fill();
    } else if (kind === "heart") {
      // big sparkly heart clip
      ctx.fillStyle = "#ff5f8a";
      ctx.shadowColor = "#ff5f8a"; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.bezierCurveTo(-26, -2, -16, -22, 0, -8);
      ctx.bezierCurveTo(16, -22, 26, -2, 0, 16);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath(); ctx.arc(-7, -8, 4, 0, 6.29); ctx.fill();
    } else if (kind === "catears") {
      // cat ears!
      ctx.fillStyle = "#2b2b3a";
      for (var e = -1; e <= 1; e += 2) {
        ctx.save(); ctx.translate(e * 16, -4); ctx.rotate(e * 0.35);
        ctx.beginPath();
        ctx.moveTo(-13, 8); ctx.lineTo(0, -22); ctx.lineTo(13, 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ff8fab";
        ctx.beginPath();
        ctx.moveTo(-7, 4); ctx.lineTo(0, -12); ctx.lineTo(7, 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2b2b3a";
        ctx.restore();
      }
    } else if (kind === "horn") {
      // unicorn horn — golden spiral
      ctx.fillStyle = "#ffd740";
      ctx.shadowColor = "#ffd740"; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-9, 6); ctx.quadraticCurveTo(-2, -14, 0, -26);
      ctx.quadraticCurveTo(2, -14, 9, 6);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ff9ec6"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(0, 0, 6, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(0, -8, 4, -10); ctx.stroke();
      ctx.fillStyle = "#ff5f9e";
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        ctx.beginPath(); ctx.arc(s2 * 14, 4, 3, 0, 6.29); ctx.fill();
      }
    } else if (kind === "gem") {
      // big diamond clip
      ctx.fillStyle = "#b3e5fc";
      ctx.shadowColor = "#b3e5fc"; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(13, -4); ctx.lineTo(0, 14); ctx.lineTo(-13, -4);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(13, -4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 14); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-4, -8, 2.5, 0, 6.29); ctx.fill();
    } else if (kind === "ribbon") {
      // flowing ribbon bow
      ctx.fillStyle = "#e040fb";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, -12); ctx.lineTo(-24, 10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, -12); ctx.lineTo(24, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ab47bc";
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#e040fb"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(6, 6); ctx.quadraticCurveTo(14, 22, 6, 30); ctx.stroke();
    } else if (kind === "halo") {
      // glowing angel halo
      ctx.strokeStyle = "#fff176"; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.shadowColor = "#fff176"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(0, -6, 22, 8, 0, 0, 6.29); ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (kind === "moon") {
      // crescent moon clip
      ctx.fillStyle = "#fff9c4";
      ctx.shadowColor = "#fff9c4"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 0, 15, 0.9, 5.4); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffd740";
      ctx.beginPath(); ctx.arc(6, -12, 2.6, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(-8, 8, 2, 0, 6.29); ctx.fill();
    } else if (kind === "rainbow") {
      // mini rainbow clip
      ctx.lineWidth = 5; ctx.lineCap = "round";
      var hues = [0, 35, 130, 205, 280];
      for (var h2 = 0; h2 < hues.length; h2++) {
        ctx.strokeStyle = "hsl(" + hues[h2] + ", 90%, 62%)";
        ctx.beginPath();
        ctx.arc(0, 10, 22 - h2 * 5, Math.PI, 0);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-20, 10, 6, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(20, 10, 6, 0, 6.29); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- tool bar ---------------- */
  function layoutBar() {
    toolRects = [];
    var n = TOOLS.length;
    var gap = 8, bw = Math.min(92, (W - gap * (n + 1)) / n);
    var total = bw * n + gap * (n - 1);
    var x0 = (W - total) / 2;
    barY = H - barH + 14;
    for (var i = 0; i < n; i++) {
      toolRects.push({ id: TOOLS[i].id, x: x0 + i * (bw + gap), y: barY, w: bw, h: barH - 28 });
    }
  }

  function drawToolIcon(id, x, y, s, variantColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.strokeStyle = "#eaf6ff";
    ctx.fillStyle = "#eaf6ff";
    if (id === "brush") {
      ctx.save(); ctx.rotate(-0.5);
      ctx.fillRect(-4, -s * 0.42, 8, s * 0.5);           // handle
      ctx.fillStyle = "#ffb74d";
      ctx.fillRect(-11, s * 0.08, 22, s * 0.30);          // bristle block
      ctx.strokeStyle = "#eaf6ff"; ctx.lineWidth = 3;
      for (var b = -8; b <= 8; b += 4) { ctx.beginPath(); ctx.moveTo(b, s * 0.38); ctx.lineTo(b, s * 0.48); ctx.stroke(); }
      ctx.restore();
    } else if (id === "curl") {
      ctx.beginPath();
      for (var a = 0; a < 6.28 * 2.2; a += 0.15) {
        var rr = 5 + a * 3.4, px = Math.cos(a) * rr * 0.55, py = Math.sin(a) * rr * 0.55;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (id === "dry") {
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, -s * 0.18); ctx.lineTo(s * 0.1, -s * 0.30);
      ctx.lineTo(s * 0.1, s * 0.30); ctx.lineTo(-s * 0.35, s * 0.18);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(-s * 0.42, -s * 0.10, s * 0.10, s * 0.42); // handle
      ctx.lineWidth = 4;
      for (var w = 0; w < 3; w++) {
        ctx.beginPath(); ctx.moveTo(s * 0.18, -s * 0.22 + w * s * 0.22);
        ctx.quadraticCurveTo(s * 0.38, -s * 0.22 + w * s * 0.22 + 6, s * 0.52, -s * 0.22 + w * s * 0.22);
        ctx.stroke();
      }
    } else if (id === "grow") {
      // hair strands of different lengths + an up-down arrow
      ctx.strokeStyle = "#eaf6ff"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-14, -s * 0.3); ctx.lineTo(-14, -s * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(0, s * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, -s * 0.3); ctx.lineTo(14, s * 0.48); ctx.stroke();
      ctx.fillStyle = "#ffd740";
      ctx.beginPath(); ctx.moveTo(-8, s * 0.38); ctx.lineTo(8, s * 0.38); ctx.lineTo(0, s * 0.55); ctx.closePath(); ctx.fill();
    } else if (id === "freck") {
      // a cheek sprinkled with freckles
      ctx.fillStyle = "#ffd9b3";
      ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#96643c";
      var fdots = [[-10, -2], [-3, 3], [4, -3], [10, 2], [0, -8], [7, 7], [-8, 7]];
      for (var fd = 0; fd < fdots.length; fd++) {
        ctx.beginPath(); ctx.arc(fdots[fd][0], fdots[fd][1], 2.6, 0, 6.29); ctx.fill();
      }
    } else if (id === "color") {
      ctx.fillStyle = variantColor;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.42);
      ctx.quadraticCurveTo(s * 0.34, s * 0.05, s * 0.28, s * 0.22);
      ctx.quadraticCurveTo(s * 0.22, s * 0.44, 0, s * 0.44);
      ctx.quadraticCurveTo(-s * 0.22, s * 0.44, -s * 0.28, s * 0.22);
      ctx.quadraticCurveTo(-s * 0.34, s * 0.05, 0, -s * 0.42);
      ctx.fill();
    } else if (id === "cut") {
      ctx.save(); ctx.rotate(0.5);
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.35); ctx.lineTo(s * 0.3, s * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.35); ctx.lineTo(s * 0.3, -s * 0.35); ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.30, 7, 0, 6.29); ctx.stroke();
      ctx.beginPath(); ctx.arc(-s * 0.32, s * 0.30, 7, 0, 6.29); ctx.stroke();
    } else if (id === "lips") {
      ctx.fillStyle = "#3a3a4a";
      ctx.fillRect(-9, -s * 0.05, 18, s * 0.45);          // tube
      ctx.fillStyle = variantColor;
      ctx.beginPath();
      ctx.moveTo(-9, -s * 0.05); ctx.lineTo(9, -s * 0.05);
      ctx.lineTo(9, -s * 0.28); ctx.lineTo(-9, -s * 0.14);
      ctx.closePath(); ctx.fill();                        // slanted bullet
    } else if (id === "shadow") {
      // an eye wearing the current shadow color
      ctx.fillStyle = variantColor;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.10, s * 0.30, s * 0.12, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(0, s * 0.04, s * 0.28, s * 0.16, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#3a3a4a";
      ctx.beginPath(); ctx.arc(0, s * 0.04, s * 0.11, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-s * 0.04, 0, s * 0.04, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#3a3a4a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.22); ctx.lineTo(-s * 0.11, -s * 0.32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.22); ctx.lineTo(s * 0.11, -s * 0.32); ctx.stroke();
    } else if (id === "blush") {
      ctx.fillStyle = "#ff9ec6";
      ctx.beginPath(); ctx.arc(0, 0, s * 0.30, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.08, s * 0.10, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#ff6f9e";
      for (var d = 0; d < 3; d++) {
        ctx.beginPath(); ctx.arc((d - 1) * 16, s * 0.34, 3.5, 0, 6.29); ctx.fill();
      }
    } else if (id === "bow") {
      ctx.fillStyle = variantColor;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.34, -s * 0.22); ctx.lineTo(-s * 0.34, s * 0.22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.34, -s * 0.22); ctx.lineTo(s * 0.34, s * 0.22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.29); ctx.fill();
    }
    ctx.restore();
  }

  function variantColorFor(id) {
    if (id === "color") return DYE[dyeIdx];
    if (id === "lips") return LIPS[lipIdx];
    if (id === "shadow") return EYESHADOWS[shadowIdx];
    if (id === "blush") return BLUSHES[blushIdx];
    if (id === "bow") return ["#ff5f9e", "#ffd740", "#ffd740", "#ff9ec6",
                              "#ffd740", "#b388ff", "#ff5f8a", "#2b2b3a",
                              "#ffd740", "#b3e5fc", "#e040fb", "#fff176",
                              "#fff9c4", "#ff8a65"][bowIdx];
    return "#eaf6ff";
  }

  function drawBar() {
    for (var i = 0; i < toolRects.length; i++) {
      var r = toolRects[i], active = tool === r.id;
      var rad = 18;
      ctx.fillStyle = active ? "rgba(41,250,255,0.28)" : "rgba(10,10,26,0.55)";
      ctx.strokeStyle = active ? "#29faff" : "rgba(234,246,255,0.35)";
      ctx.lineWidth = active ? 4 : 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, rad);
      else ctx.rect(r.x, r.y, r.w, r.h);
      ctx.fill(); ctx.stroke();
      drawToolIcon(r.id, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.62, variantColorFor(r.id));
      if (active) {
        ctx.fillStyle = "#29faff";
        ctx.beginPath(); ctx.arc(r.x + r.w - 12, r.y + 12, 5, 0, 6.29); ctx.fill();
      }
    }
  }

  /* ---------------- stars (style meter) ---------------- */
  function drawStars() {
    var n = 5, sx = W / 2 - (n - 1) * 30, sy = 44;
    for (var i = 0; i < n; i++) {
      var fill = Math.max(0, Math.min(1, (style - i * 20) / 20));
      var X = sx + i * 60;
      ctx.save();
      ctx.translate(X, sy);
      if (fill >= 1 && celebrating > 0) {
        var sc = 1 + Math.sin(time * 10 + i) * 0.12;
        ctx.scale(sc, sc);
      }
      star(0, 0, 20, fill >= 1 ? "#ffd740" : "rgba(255,255,255,0.22)");
      if (fill > 0 && fill < 1) {
        ctx.fillStyle = "rgba(255,215,64,0.85)";
        ctx.fillRect(-20, -20, 40 * fill, 40);
      }
      ctx.restore();
    }
  }

  function star(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 === 0 ? r : r * 0.45, a = -Math.PI / 2 + i * Math.PI / 5;
      var sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath(); ctx.fill();
  }

  /* ---------------- particles ---------------- */
  function drawParts() {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, a);
      if (p.heart) {
        ctx.fillStyle = p.c;
        var s = p.r;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + s * 0.7);
        ctx.bezierCurveTo(p.x - s * 1.2, p.y - s * 0.2, p.x - s * 0.6, p.y - s * 1.1, p.x, p.y - s * 0.35);
        ctx.bezierCurveTo(p.x + s * 0.6, p.y - s * 1.1, p.x + s * 1.2, p.y - s * 0.2, p.x, p.y + s * 0.7);
        ctx.fill();
      } else if (p.lock) {
        ctx.strokeStyle = p.c; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.quadraticCurveTo(p.x + 6, p.y, p.x + 2, p.y + 10); ctx.stroke();
      } else if (p.confetti) {
        ctx.fillStyle = p.c;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 6);
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      } else {
        // sparkle: 4-point glint
        ctx.strokeStyle = p.c; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        var g = p.r * (0.6 + 0.4 * Math.sin(p.t * 20));
        ctx.beginPath();
        ctx.moveTo(p.x - g, p.y); ctx.lineTo(p.x + g, p.y);
        ctx.moveTo(p.x, p.y - g); ctx.lineTo(p.x, p.y + g);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- first-run hint ---------------- */
  function drawHint() {
    if (usedCanvas || celebrating > 0) return;
    var hx = cx + R * 0.9, hy = cy - R * 0.4 + Math.sin(time * 3) * 12;
    ctx.save();
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 5);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(hx, hy - 34); ctx.lineTo(hx - 13, hy - 12); ctx.lineTo(hx - 5, hy - 12);
    ctx.lineTo(hx - 5, hy + 12); ctx.lineTo(hx + 5, hy + 12); ctx.lineTo(hx + 5, hy - 12);
    ctx.lineTo(hx + 13, hy - 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     BACKGROUND + MAIN LOOP
     ============================================================ */
  function drawBG() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3b2b5e");
    g.addColorStop(0.55, "#7b4b8f");
    g.addColorStop(1, "#2b1b3e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // vanity mirror glow behind her
    var rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, R * 3.2);
    rg.addColorStop(0, "rgba(255,215,230,0.20)");
    rg.addColorStop(1, "rgba(255,215,230,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(cx - R * 3.2, cy - R * 3.2, R * 6.4, R * 6.4);
    // floating dust sparkles
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    for (var i = 0; i < 24; i++) {
      var sx = (i * 197.3 + time * 12) % (W + 40) - 20;
      var sy = (i * 331.7) % H;
      ctx.beginPath(); ctx.arc(sx, sy + Math.sin(time + i) * 8, 2, 0, 6.29); ctx.fill();
    }
  }

  function frame(t) {
    var dt = Math.min(0.05, (t - (frame.last || t)) / 1000 || 0.016);
    frame.last = t;
    if (MUSIC) MUSIC.tick(dt);
    update(dt);
    drawBG();
    drawBackHair();
    drawGirl();
    drawFrontHair();
    drawParts();
    drawStars();
    drawBar();
    drawHint();
    requestAnimationFrame(frame);
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    barH = Math.max(104, Math.min(132, H * 0.15));
    R = Math.min(W, H - barH) * 0.215;
    cx = W / 2;
    cy = (H - barH) * 0.44;
    layoutBar();
    if (model) buildHair();
  }

  resize();
  newModel();
  hintT = 0;
  requestAnimationFrame(frame);

  /* Test hook: pure-ish logic for node tests. */
  if (typeof window !== "undefined") {
    window.__glam = {
      createStrand: createStrand,
      stepStrands: stepStrands,
      pinRoots: pinRoots,
      strands: function () { return strands; },
      _newModel: newModel,
      _model: function () { return model; },
      _selectTool: selectTool,
      _applyDragTool: applyDragTool,
      _applyTapTool: applyTapTool,
      _tool: function () { return tool; },
      _setPointer: function (x, y) { pointer.down = true; pointer.x = pointer.px = x; pointer.y = pointer.py = y; },
      _clearPointer: function () { pointer.down = false; },
      _style: function () { return style; },
      _setStyle: function (v) { style = v; celebrating = 0; },
      _counts: function () {
        return {
          tools: TOOLS.length, dye: DYE.length, lips: LIPS.length,
          shadows: EYESHADOWS.length, bows: BOWS.length, strands: strands.length,
          blushes: BLUSHES.length, lengths: LENGTHS.length,
        };
      },
      _dye: function () { return DYE[dyeIdx]; },
      _layout: function (w, h) { W = w; H = h; barH = 116; R = Math.min(W, H - barH) * 0.215; cx = W / 2; cy = (H - barH) * 0.44; if (model) buildHair(); },
    };
  }
})();
