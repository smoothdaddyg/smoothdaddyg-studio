/* ============================================================
   Miss Munch — a maze-chase arcade game from SmoothDaddyG.
   Swipe anywhere to steer Miss Munch through the maze and gobble
   every dot. Four goofy monsters chase her — grab a power pellet
   and SHE chases THEM. 5 levels, 5 mazes, monsters get faster.
   Clear all 5 for a big surprise.
   - No reading required: one interaction (swipe to steer).
   - Sound on by default, no in-game volume control.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
  }
  window.addEventListener("resize", resize);

  var audio = makeAudio();
  /* Background music (2026-10-30 rollout): an original chiptune loop —
     distinct chiptune voice, kept under the SFX. Starts at load; the
     synth stays silent until the first tap, then plays mid-loop. */
  var MUSIC = audio.makeMusic({
    bpm: 148, div: 4, steps: 64,
    bassType: "triangle", bassVol: 0.2,
    leadType: "square", leadVol: 0.045,
    kickVol: 0.16, snareVol: 0.05, hatVol: 0.02,
    kicks: [0, 4, 8, 12, 14, 16, 20, 24, 28, 30, 32, 36, 40, 44, 46, 48, 52, 56, 60, 62],
    snares: [4, 12, 20, 28, 36, 44, 52, 60],
    hats: "all",
    bass: [110, 0, 110, 0, 110, 0, 220, 0, 110, 0, 110, 0, 110, 0, 220, 0,
           110, 0, 110, 0, 110, 0, 220, 0, 110, 0, 110, 0, 110, 0, 220, 0,
           87.31, 0, 87.31, 0, 87.31, 0, 174.61, 0, 87.31, 0, 87.31, 0, 87.31, 0, 174.61, 0,
           82.41, 0, 82.41, 0, 82.41, 0, 164.81, 0, 82.41, 0, 82.41, 0, 82.41, 0, 164.81, 0],
    lead: [440, 0, 523.25, 440, 0, 523.25, 659.25, 0, 523.25, 440, 0, 523.25, 440, 0, 0, 0,
           659.25, 0, 783.99, 659.25, 0, 783.99, 880, 0, 783.99, 659.25, 0, 783.99, 659.25, 0, 0, 0,
           349.23, 0, 440, 349.23, 0, 440, 523.25, 0, 440, 349.23, 0, 440, 349.23, 0, 0, 0,
           659.25, 783.99, 659.25, 783.99, 880, 783.99, 880, 1046.5, 880, 783.99, 659.25, 783.99, 659.25, 0, 0, 0]
  });
  MUSIC.start();

  /* ---------------- mazes ---------------- */
  var COLS = 13, ROWS = 13;
  // # wall, . dot, o power pellet, P player start, G monster house,
  // - house door, space walkable (no dot)
  // A REAL maze: 1-wide corridors with walls on both sides, 1-block-thick
  // walls, no open bands. Fully connected; every dot reachable.
  var MAZE_GRID = [
    "#############",
    "#.#.#.#.#.#.#",
    "#.o.#.#.#.o.#",
    "#.#...#..#..#",
    "#.#.#.#.#.#.#",
    "#.#.#...#.#.#",
    "#.#.#GGG#.#.#",
    "#.#..---..#.#",
    "#.#.#...#.#.#",
    "#.#..#.#..#.#",
    "#.o#.#P.#.o.#",
    "#.#.......#.#",
    "#############",
  ];
  // monster house center (the middle G tile); the door is the row below
  var HOUSE = { x: 6, y: 6 };
  var MAZES = [
    { pal: ["#ff5c7a", "#ffb340", "#35c4ff", "#7dff6a"], grid: MAZE_GRID },
    { pal: ["#b45cff", "#5cff8a", "#ffd23b", "#3b8aff"], grid: MAZE_GRID },
    { pal: ["#ff8a3b", "#8a5cff", "#5cff5c", "#ff5c8a"], grid: MAZE_GRID },
  ];
  var LEVELS = MAZES.length;

  function levelParams(l) {
    return {
      ghostSpeed: 3.2 + 0.3 * (l - 1),    // calm pace — his daughter plays this
      playerSpeed: 4.2,
      frightTime: 7 - 0.5 * (l - 1),      // power pellets wear off sooner
      releaseGap: Math.max(0.9, 2.4 - 0.4 * (l - 1)),
    };
  }

  var DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  function opposite(a, b) { return a.x === -b.x && a.y === -b.y; }

  /* ---------------- state ---------------- */
  var state = "ready"; // ready | play | dying | clear | win
  var level = 1, score = 0, shown = 0;
  var grid = [], dots = [], dotsLeft = 0, dotsEaten = 0;
  var player = null, ghosts = [];
  var frightT = 0, wakaHi = false;
  var fruit = null, fruitT = 0;
  var stateT = 0;           // timer for dying/clear/win/over states
  var parts = [];           // confetti / fireworks
  var fanfare = [], fanfareIdx = 0, fwT = 0;
  var flashT = 0;
  var P = levelParams(1);

  // layout: tile size + maze origin
  var ts = 20, ox = 0, oy = 0;
  var wallCache = null, bgCache = null;
  function layout() {
    // the maze is as large as the screen allows — no reserved HUD band;
    // the brick field behind it fills every leftover pixel edge to edge
    ts = Math.floor(Math.min(W / COLS, H / ROWS));
    ox = Math.round((W - ts * COLS) / 2);
    oy = Math.round((H - ts * ROWS) / 2);
    wallCache = null;
    bgCache = null;
  }

  /* ---------------- tiles ---------------- */
  function charAt(cx, cy) {
    if (cy < 0 || cy >= ROWS) return "#";
    cx = ((cx % COLS) + COLS) % COLS;
    return grid[cy][cx];
  }
  // ghost=true for monsters; eyes=true for leaving/entering monsters
  function walkable(cx, cy, ghost, eyes) {
    var ch = charAt(cx, cy);
    if (ch === "#") return false;
    if (ch === "G") return !!ghost;
    if (ch === "-") return !!eyes;
    return true;
  }

  function findChar(ch) {
    for (var r = 0; r < ROWS; r++)
      for (var c = 0; c < COLS; c++)
        if (grid[r][c] === ch) return { x: c, y: r };
    return { x: 6, y: 8 };
  }

  function buildLevel(lv) {
    P = levelParams(lv);
    grid = MAZES[lv - 1].grid;
    dots = [];
    dotsLeft = 0; dotsEaten = 0;
    for (var r = 0; r < ROWS; r++) {
      dots.push([]);
      for (var c = 0; c < COLS; c++) {
        var ch = grid[r][c];
        var v = ch === "." ? 1 : ch === "o" ? 2 : 0;
        dots[r].push(v);
        if (v) dotsLeft++;
      }
    }
    var ps = findChar("P");
    player = { x: ps.x, y: ps.y, dir: { x: 0, y: 0 }, want: { x: -1, y: 0 }, mouth: 0, speed: P.playerSpeed };
    ghosts = [];
    var pal = MAZES[lv - 1].pal;
    var homes = [HOUSE.x - 1, HOUSE.x, HOUSE.x + 1, HOUSE.x];
    for (var i = 0; i < 4; i++) {
      ghosts.push({
        x: homes[i], y: HOUSE.y, dir: { x: -1, y: 0 }, mode: "house",
        color: pal[i], pers: i, releaseT: i * P.releaseGap,
        bob: Math.random() * 6.28, speed: P.ghostSpeed,
      });
    }
    frightT = 0; fruit = null; fruitT = 0; flashT = 0;
    wallCache = null;
  }

  function resetPositions() {
    var ps = findChar("P");
    player.x = ps.x; player.y = ps.y;
    player.dir = { x: 0, y: 0 }; player.want = { x: -1, y: 0 };
    var homes = [HOUSE.x - 1, HOUSE.x, HOUSE.x + 1, HOUSE.x];
    for (var i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      g.x = homes[i]; g.y = HOUSE.y; g.dir = { x: -1, y: 0 };
      g.mode = "house"; g.releaseT = i * P.releaseGap; g.speed = P.ghostSpeed;
    }
    frightT = 0; fruit = null;
  }

  /* ---------------- movement ---------------- */
  function decidePlayer(cx, cy) {
    var w = player.want;
    if ((w.x || w.y) && walkable(cx + w.x, cy + w.y, false, false)) {
      player.dir = { x: w.x, y: w.y };
    } else if (!(player.dir.x || player.dir.y) ||
               !walkable(cx + player.dir.x, cy + player.dir.y, false, false)) {
      player.dir = { x: 0, y: 0 };
    }
  }

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }
  function minDistOpt(opts, cx, cy, tx, ty) {
    var best = opts[0], bd = Infinity;
    for (var i = 0; i < opts.length; i++) {
      var d = dist2(cx + opts[i].x, cy + opts[i].y, tx, ty);
      if (d < bd) { bd = d; best = opts[i]; }
    }
    return best;
  }

  function ghostTarget(g) {
    if (g.pers === 0) return { x: player.x, y: player.y };                       // chaser
    if (g.pers === 1) return { x: player.x + player.dir.x * 4,                   // ambusher
                               y: player.y + player.dir.y * 4 };
    return null;                                                                // shy & lazy: random
  }

  // Breadth-first search: the first step from (sx,sy) toward (tx,ty)
  // through tiles eyes can travel. U-turns allowed — every step strictly
  // shortens the trip, so eyes can never get stuck in a loop.
  function bfsStepTo(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return null;
    var seen = {}, prev = {};
    var sk = sx + "," + sy;
    seen[sk] = true;
    var qx = [sx], qy = [sy], qh = 0, found = false;
    while (qh < qx.length) {
      var x = qx[qh], y = qy[qh]; qh++;
      if (x === tx && y === ty) { found = true; break; }
      for (var i = 0; i < 4; i++) {
        var nx = x + DIRS[i].x, ny = y + DIRS[i].y;
        if (ny < 0 || ny >= ROWS) continue;
        nx = ((nx % COLS) + COLS) % COLS;
        var k = nx + "," + ny;
        if (seen[k] || !walkable(nx, ny, true, true)) continue;
        seen[k] = true;
        prev[k] = x + "," + y;
        qx.push(nx); qy.push(ny);
      }
    }
    if (!found) return null;
    // walk back from the target; the last hop is the first step
    var cx = tx, cy = ty;
    for (;;) {
      var pk = prev[cx + "," + cy].split(",");
      var px = +pk[0], py = +pk[1];
      if (px === sx && py === sy) {
        var dx = cx - sx, dy = cy - sy;
        if (dx > 1) dx = -1; else if (dx < -1) dx = 1;  // tunnel wrap
        return { x: dx, y: dy };
      }
      cx = px; cy = py;
    }
  }

  function decideGhost(g, cx, cy) {
    var eyes = g.mode === "eyes";
    if (eyes) {
      // Eyes take the shortest maze path home (BFS, U-turns allowed):
      // every step shortens the trip, so eyes ALWAYS make it back and
      // eaten monsters always regenerate.
      var hd = bfsStepTo(cx, cy, HOUSE.x, HOUSE.y);
      if (hd) { g.dir = hd; return; }
      // already home (or unreachable): hold still; the update loop
      // walks us into the house as soon as we're close
      g.dir = { x: 0, y: 0 };
      return;
    }
    var opts = [];
    for (var i = 0; i < 4; i++) {
      var d = DIRS[i];
      if (opposite(d, g.dir)) continue;                 // no U-turns
      if (walkable(cx + d.x, cy + d.y, true, false)) opts.push(d);
    }
    if (!opts.length) { g.dir = { x: -g.dir.x, y: -g.dir.y }; return; }
    var pick;
    if (frightT > 0) {
      pick = opts[(Math.random() * opts.length) | 0];   // scared: run anywhere
    } else {
      var t = ghostTarget(g);
      if (t && (g.pers !== 2 || Math.random() < 0.5)) pick = minDistOpt(opts, cx, cy, t.x, t.y);
      else pick = opts[(Math.random() * opts.length) | 0];
    }
    g.dir = { x: pick.x, y: pick.y };
  }

  function tunnelWrap(e) {
    if (e.x < 0) e.x += COLS;
    else if (e.x >= COLS) e.x -= COLS;
  }

  function canEnter(e, tx, ty, isPlayer) {
    return isPlayer ? walkable(tx, ty, false, false)
                    : walkable(tx, ty, true, e.mode === "eyes" || e.mode === "leaving");
  }

  function stepEntity(e, dt, isPlayer) {
    // Tile-center to tile-center movement: the entity always travels
    // toward the next tile center ahead, and reconsiders its direction
    // every time it arrives (so the player can turn at intersections
    // and monsters/eyes repath at every tile, not just at walls).
    var sp = e.speed * dt;
    if (e.dir.x === 0 && e.dir.y === 0) {
      var cx0 = Math.round(e.x), cy0 = Math.round(e.y);
      e.x = cx0; e.y = cy0;
      if (isPlayer) decidePlayer(cx0, cy0);
      else if (e.mode === "active" || e.mode === "eyes") decideGhost(e, cx0, cy0);
      if (e.dir.x === 0 && e.dir.y === 0) return;
    }
    // next tile center in the direction of travel
    var nx, ny;
    if (e.dir.x > 0) { nx = Math.floor(e.x) + 1; ny = Math.round(e.y); }
    else if (e.dir.x < 0) { nx = Math.ceil(e.x) - 1; ny = Math.round(e.y); }
    else if (e.dir.y > 0) { nx = Math.round(e.x); ny = Math.floor(e.y) + 1; }
    else { nx = Math.round(e.x); ny = Math.ceil(e.y) - 1; }
    if (!canEnter(e, nx, ny, isPlayer)) {
      // wall ahead: stop at this tile's center and reconsider
      e.x = nx - e.dir.x; e.y = ny - e.dir.y;
      tunnelWrap(e);
      var sx = Math.round(e.x), sy = Math.round(e.y);
      if (isPlayer) decidePlayer(sx, sy);
      else decideGhost(e, sx, sy);
      return;
    }
    var distC = Math.abs(nx - e.x) + Math.abs(ny - e.y);
    if (sp >= distC) {
      e.x = nx; e.y = ny;
      tunnelWrap(e);
      var ncx = Math.round(e.x), ncy = Math.round(e.y);
      if (isPlayer) decidePlayer(ncx, ncy);
      else decideGhost(e, ncx, ncy);
    } else {
      e.x += e.dir.x * sp;
      e.y += e.dir.y * sp;
    }
  }

  /* ---------------- scoring / fx ---------------- */
  function addScore(n) { score += n; }

  function boom(x, y, big) {
    // tile coords -> pixel burst (centered in the tile)
    var px = ox + (x + 0.5) * ts, py = oy + (y + 0.5) * ts;
    var n = big ? 46 : 22;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = (0.5 + Math.random()) * ts * (big ? 9 : 5);
      parts.push({
        x: px, y: py,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - ts * 2,
        life: 0.7 + Math.random() * 0.5, t: 0,
        c: ["#ffeb3b", "#ff9800", "#ff3b30", "#ffffff"][(Math.random() * 4) | 0],
        r: 2 + Math.random() * 3,
      });
    }
    audio.noise(big ? 0.5 : 0.25, { filter: "lowpass", freq: 1200, vol: 0.35 });
  }

  function confetti(n) {
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
        life: 2.5, t: 0,
        c: "hsl(" + ((Math.random() * 360) | 0) + ",90%,60%)",
        r: 3 + Math.random() * 4,
      });
    }
  }

  /* ---------------- rules ---------------- */
  function eatAt(cx, cy) {
    var v = dots[cy] && dots[cy][cx];
    if (!v) return;
    dots[cy][cx] = 0;
    dotsLeft--; dotsEaten++;
    if (v === 2) {
      addScore(50);
      frightT = P.frightTime;
      for (var i = 0; i < ghosts.length; i++) {
        var g = ghosts[i];
        if (g.mode === "active") g.dir = { x: -g.dir.x, y: -g.dir.y };
      }
      audio.tone(150, 0.35, { type: "sawtooth", vol: 0.12, slideTo: 620 });
    } else {
      addScore(10);
      wakaHi = !wakaHi;
      audio.tone(wakaHi ? 520 : 380, 0.055, { type: "square", vol: 0.09 });
    }
    if (dotsEaten === 70 && !fruit) {
      var ps = findChar("P");
      fruit = { x: ps.x, y: ps.y, t: 9 };
      audio.arp([660, 880], 0.08, "square", 0.1);
    }
    if (dotsLeft <= 0) {
      addScore(1000);
      if (level >= LEVELS) startWin();
      else { state = "clear"; stateT = 0; confetti(90); audio.arp([523, 659, 784, 1047], 0.09, "square", 0.12); }
    }
  }

  function hurt() {
    // No game over, ever — she just gets recreated and keeps going.
    // The "dying" pause breaks momentum, but dots/score/level are kept.
    audio.tone(520, 0.7, { type: "sawtooth", vol: 0.14, slideTo: 90 });
    boom(player.x, player.y, false);
    state = "dying"; stateT = 0;
  }

  function startWin() {
    state = "win"; stateT = 0;
    // THE BIG SURPRISE: a fanfare of fireworks, two octaves up
    fanfare = [];
    var notes = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 2093];
    for (var i = 0; i < 24; i++) fanfare.push({ t: 0.15 + i * 0.26, f: notes[i % notes.length] });
    fanfareIdx = 0; fwT = 0;
    audio.arp([523, 659, 784, 1047, 1319], 0.08, "square", 0.14);
  }

  function firework() {
    var sx = ox + Math.random() * COLS * ts;
    var tx = ox + Math.random() * COLS * ts;
    var ty = oy + Math.random() * ROWS * ts * 0.6;
    var hue = (Math.random() * 360) | 0;
    for (var i = 0; i < 34; i++) {
      var a = Math.random() * 6.283, s = (0.4 + Math.random()) * ts * 7;
      parts.push({
        x: tx, y: ty,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.9 + Math.random() * 0.6, t: 0,
        c: "hsl(" + hue + ",95%," + (55 + (Math.random() * 20 | 0)) + "%)",
        r: 2 + Math.random() * 3,
      });
    }
    audio.noise(0.3, { filter: "lowpass", freq: 2000, vol: 0.25 });
    audio.tone(300 + Math.random() * 500, 0.12, { type: "square", vol: 0.07, slideTo: 1200 });
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    // score count-up always eases
    shown += (score - shown) * Math.min(1, dt * 8);
    if (score - shown < 1) shown = score;

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += ts * 6 * dt;
      if (p.t >= p.life) parts.splice(i, 1);
    }

    if (state === "play") {
      // instant reverse feels right
      var w = player.want;
      if ((w.x || w.y) && opposite(w, player.dir)) player.dir = { x: w.x, y: w.y };

      stepEntity(player, dt, true);
      player.mouth += dt * (player.dir.x || player.dir.y ? 10 : 2);

      var pcx = Math.round(player.x), pcy = Math.round(player.y);
      eatAt(((pcx % COLS) + COLS) % COLS, pcy);

      if (frightT > 0) {
        frightT -= dt;
        if (frightT < 0) frightT = 0;
      }

      // monsters
      for (var gi = 0; gi < ghosts.length; gi++) {
        var g = ghosts[gi];
        if (g.mode === "house") {
          g.bob += dt * 6;
          g.releaseT -= dt;
          if (g.releaseT <= 0) g.mode = "leaving";
        } else if (g.mode === "leaving") {
          // scoot to the door, then out (door is below the house)
          var sp = g.speed * dt;
          if (Math.abs(g.x - HOUSE.x) > 0.08) g.x += Math.sign(HOUSE.x - g.x) * Math.min(sp, Math.abs(HOUSE.x - g.x));
          else if (g.y < HOUSE.y + 1.98) g.y += sp;
          else { g.y = HOUSE.y + 2; g.mode = "active"; g.dir = { x: 0, y: 1 }; }
        } else {
          g.speed = (g.mode === "eyes" ? 7 : P.ghostSpeed) * (frightT > 0 && g.mode === "active" ? 0.72 : 1);
          stepEntity(g, dt, false);
          if (g.mode === "eyes" && Math.abs(g.x - HOUSE.x) < 0.25 && Math.abs(g.y - HOUSE.y) < 0.25) {
            g.x = HOUSE.x; g.y = HOUSE.y; g.mode = "leaving";
          }
        }

        // caught?
        if (g.mode === "active") {
          var dx = g.x - player.x, dy = g.y - player.y;
          if (dx * dx + dy * dy < 0.42) {
            if (frightT > 0) {
              g.mode = "eyes";
              addScore(400);
              boom(g.x, g.y, false);
              audio.arp([400, 650, 950], 0.06, "square", 0.12);
            } else {
              hurt();
              return;
            }
          }
        }
      }

      // fruit
      if (fruit) {
        fruit.t -= dt;
        if (fruit.t <= 0) fruit = null;
        else if (Math.round(player.x) === fruit.x && Math.round(player.y) === fruit.y) {
          addScore(500);
          audio.arp([660, 880, 1320], 0.07, "square", 0.12);
          confetti(24);
          fruit = null;
        }
      }
    } else if (state === "dying") {
      stateT += dt;
      // brief pause (breaks momentum), then she's recreated and play continues
      if (stateT > 1.6) { resetPositions(); state = "play"; }
    } else if (state === "clear") {
      stateT += dt;
      flashT += dt;
      if (stateT > 2.6) {
        level++;
        buildLevel(level);
        state = "ready";
      }
    } else if (state === "win") {
      stateT += dt;
      fwT -= dt;
      if (fwT <= 0 && stateT < 6) { firework(); fwT = 0.24; }
      while (fanfareIdx < fanfare.length && fanfare[fanfareIdx].t <= stateT) {
        audio.tone(fanfare[fanfareIdx].f, 0.22, { type: "square", vol: 0.11 });
        fanfareIdx++;
      }
    }
  }

  /* ---------------- drawing ---------------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // one chunky toy brick: bright rounded cap + glossy highlight
  function brickCap(c, x, y, alpha) {
    var inset = Math.max(2, ts * 0.10);
    var rad = ts * 0.22;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = "#6f5bff";
    c.beginPath();
    c.moveTo(x + inset + rad, y + inset);
    c.arcTo(x + ts - inset, y + inset, x + ts - inset, y + ts - inset, rad);
    c.arcTo(x + ts - inset, y + ts - inset, x + inset, y + ts - inset, rad);
    c.arcTo(x + inset, y + ts - inset, x + inset, y + inset, rad);
    c.arcTo(x + inset, y + inset, x + ts - inset, y + inset, rad);
    c.closePath(); c.fill();
    // glossy top highlight
    c.fillStyle = "rgba(255,255,255,0.28)";
    c.beginPath();
    c.moveTo(x + inset + rad, y + inset);
    c.arcTo(x + ts - inset, y + inset, x + ts - inset, y + inset + ts * 0.30, rad * 0.6);
    c.lineTo(x + inset, y + inset + ts * 0.30);
    c.arcTo(x + inset, y + inset, x + inset + rad, y + inset, rad * 0.6);
    c.closePath(); c.fill();
    c.restore();
  }

  function renderBackground() {
    // full-screen brick field on the maze's own tile grid, so the game
    // fills the entire screen on any phone or tablet; the blue maze
    // floor is carved out of it, maze walls drawn bright on top
    bgCache = document.createElement("canvas");
    bgCache.width = W; bgCache.height = H;
    var c = bgCache.getContext("2d");
    c.fillStyle = "#241d5e";
    c.fillRect(0, 0, W, H);
    var q0 = Math.floor((0 - ox) / ts) - 1, q1 = Math.ceil((W - ox) / ts) + 1;
    var r0 = Math.floor((0 - oy) / ts) - 1, r1 = Math.ceil((H - oy) / ts) + 1;
    for (var r = r0; r <= r1; r++)
      for (var q = q0; q <= q1; q++)
        brickCap(c, ox + q * ts, oy + r * ts, 0.45);
    var bg = c.createLinearGradient(0, oy, 0, oy + ROWS * ts);
    bg.addColorStop(0, "#070a24"); bg.addColorStop(1, "#101a4e");
    c.fillStyle = bg;
    c.fillRect(ox, oy, COLS * ts, ROWS * ts);
  }

  function renderWalls() {
    // chunky toy bricks: deep purple blocks with a bright rounded cap
    wallCache = document.createElement("canvas");
    wallCache.width = COLS * ts; wallCache.height = ROWS * ts;
    var c = wallCache.getContext("2d");
    for (var r = 0; r < ROWS; r++) {
      for (var q = 0; q < COLS; q++) {
        if (grid[r][q] !== "#") continue;
        c.fillStyle = "#241d5e";
        c.fillRect(q * ts, r * ts, ts, ts);
        brickCap(c, q * ts, r * ts, 1);
      }
    }
  }

  function drawMunch(px, py, r, dir, mouthPhase, happy) {
    // Miss Munch: unmistakably a girl — long brown hair (two thick locks
    // flowing past her chin, clearly hair not fur), a big red bow,
    // eyelashes, blush. Her smile munches open/closed (mouthPhase),
    // leaning toward her direction.
    var mx = px + dir.x * r * 0.18, my = py + dir.y * r * 0.18;
    var hair = "#7a4f24";
    // long hair: two thick locks behind her face, from above her head
    // to well below her chin — elongated so they read as hair, not ears
    ctx.fillStyle = hair;
    roundRect(px - r * 1.08, py - r * 0.92, r * 0.52, r * 2.24, r * 0.26); ctx.fill();
    roundRect(px + r * 0.56, py - r * 0.92, r * 0.52, r * 2.24, r * 0.26); ctx.fill();
    // face: the dominant round shape, warm skin tone
    var fr = r * 0.88;
    ctx.fillStyle = "#ffd9b3";
    ctx.beginPath(); ctx.arc(px, py, fr, 0, 6.29); ctx.fill();
    // fringe across her forehead (hair, on top only)
    ctx.fillStyle = "#a06a35";
    ctx.beginPath(); ctx.arc(px, py - fr * 0.10, fr * 0.98, Math.PI * 1.04, Math.PI * 1.96); ctx.fill();
    // big bow on the upper right — unmistakable
    var bowX = px + r * 0.48, bowY = py - r * 0.92;
    ctx.fillStyle = "#ff3b6b";
    ctx.beginPath();
    ctx.ellipse(bowX - r * 0.32, bowY, r * 0.32, r * 0.21, -0.5, 0, 6.29);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bowX + r * 0.32, bowY, r * 0.32, r * 0.21, 0.5, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = "#d41e4e";
    ctx.beginPath(); ctx.arc(bowX, bowY, r * 0.15, 0, 6.29); ctx.fill();
    // big friendly eyes with eyelashes
    var ex = fr * 0.34, ey = -fr * 0.06;
    ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.lineCap = "round";
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var exx = mx + s2 * ex - dir.x * fr * 0.1, eyy = my + ey;
      // three lashes fanning up and out from each eye's outer corner
      for (var li = 0; li < 3; li++) {
        var lx0 = exx + s2 * fr * (0.16 + li * 0.02), ly0 = eyy - fr * 0.14 + li * fr * 0.09;
        ctx.beginPath();
        ctx.moveTo(lx0, ly0);
        ctx.lineTo(lx0 + s2 * fr * 0.14, ly0 - fr * 0.14);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(exx, eyy, fr * 0.22, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#3a2a1a";
      ctx.beginPath(); ctx.arc(exx + dir.x * fr * 0.06, eyy + fr * 0.04, fr * 0.11, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(exx + dir.x * fr * 0.06 - fr * 0.03, eyy, fr * 0.04, 0, 6.29); ctx.fill();
    }
    // rosy cheeks
    ctx.fillStyle = "rgba(255,120,150,0.55)";
    ctx.beginPath(); ctx.arc(mx - fr * 0.52, my + fr * 0.28, fr * 0.17, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + fr * 0.52, my + fr * 0.28, fr * 0.17, 0, 6.29); ctx.fill();
    // the munching smile: opens and closes with mouthPhase
    var mo = 0.25 + 0.75 * Math.abs(Math.sin(mouthPhase));
    ctx.fillStyle = "#7a2e2e";
    ctx.beginPath();
    ctx.ellipse(mx + dir.x * fr * 0.12, my + fr * 0.42 + dir.y * fr * 0.1, fr * 0.30, fr * 0.30 * mo + fr * 0.05, 0, 0, 6.29);
    ctx.fill();
    if (happy) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(mx - fr * 0.30, my - fr * 0.32, fr * 0.09, 0, 6.29); ctx.fill();
    }
  }

  function drawGhost(g) {
    // Grumpy blobs: chunky round bodies with stubby feet — no ghost
    // skirt anywhere. Angry brows when chasing, dizzy when frightened.
    var px = ox + (g.x + 0.5) * ts, py = oy + (g.y + 0.5) * ts;
    var r = ts * 0.46;
    var fright = frightT > 0 && g.mode === "active";
    var flash = fright && frightT < 1.5 && ((frightT * 6) | 0) % 2 === 0;
    if (g.mode === "eyes") {
      drawEyes(px, py, r, g.dir, "#fff");
      return;
    }
    var yb = py + (g.mode === "house" ? Math.sin(g.bob) * ts * 0.08 : 0);
    var body = fright ? (flash ? "#ffffff" : "#3d5afe") : g.color;
    // stubby feet
    ctx.fillStyle = body;
    var fw = r * 0.42;
    roundRect(px - r * 0.62, yb + r * 0.52, fw, r * 0.42, r * 0.2); ctx.fill();
    roundRect(px + r * 0.62 - fw, yb + r * 0.52, fw, r * 0.42, r * 0.2); ctx.fill();
    // round body
    ctx.beginPath(); ctx.arc(px, yb, r, 0, 6.29); ctx.fill();
    // lighter belly
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.ellipse(px, yb + r * 0.42, r * 0.55, r * 0.38, 0, 0, 6.29); ctx.fill();
    // little horns
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(px - r * 0.55, yb - r * 0.72); ctx.lineTo(px - r * 0.38, yb - r * 1.08); ctx.lineTo(px - r * 0.22, yb - r * 0.70);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + r * 0.55, yb - r * 0.72); ctx.lineTo(px + r * 0.38, yb - r * 1.08); ctx.lineTo(px + r * 0.22, yb - r * 0.70);
    ctx.closePath(); ctx.fill();
    if (fright) {
      // dizzy: dot eyes + wavy mouth
      ctx.fillStyle = flash ? "#3d5afe" : "#ffd7e6";
      ctx.beginPath(); ctx.arc(px - r * 0.30, yb - r * 0.18, r * 0.11, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(px + r * 0.30, yb - r * 0.18, r * 0.11, 0, 6.29); ctx.fill();
      ctx.strokeStyle = flash ? "#3d5afe" : "#ffd7e6"; ctx.lineWidth = Math.max(2, r * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px - r * 0.45, yb + r * 0.38);
      for (var k = 0; k < 4; k++) ctx.lineTo(px - r * 0.45 + (k + 0.5) * r * 0.225, yb + r * 0.38 + (k % 2 ? -r * 0.1 : r * 0.1));
      ctx.stroke();
    } else {
      // grumpy: big eyes with angry brows + frown
      drawEyes(px, yb - r * 0.12, r, g.dir, "#fff");
      ctx.strokeStyle = "rgba(30,20,40,0.85)"; ctx.lineWidth = Math.max(3, r * 0.13);
      ctx.lineCap = "round";
      var ex2 = r * 0.34;
      ctx.beginPath(); // left brow slants down toward center
      ctx.moveTo(px - ex2 - r * 0.26, yb - r * 0.62); ctx.lineTo(px - ex2 + r * 0.22, yb - r * 0.44);
      ctx.stroke();
      ctx.beginPath(); // right brow
      ctx.moveTo(px + ex2 + r * 0.26, yb - r * 0.62); ctx.lineTo(px + ex2 - r * 0.22, yb - r * 0.44);
      ctx.stroke();
      ctx.beginPath(); // frown
      ctx.arc(px, yb + r * 0.72, r * 0.30, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  function drawEyes(px, py, r, dir, white) {
    ctx.fillStyle = white;
    var ex = r * 0.34, ey = r * 0.22;
    var ox2 = dir.x * r * 0.14, oy2 = dir.y * r * 0.12;
    ctx.beginPath(); ctx.ellipse(px - ex + ox2, py - ey + oy2, r * 0.24, r * 0.3, 0, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px + ex + ox2, py - ey + oy2, r * 0.24, r * 0.3, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = "#2431ff";
    ctx.beginPath(); ctx.arc(px - ex + ox2 * 2, py - ey + oy2 * 2, r * 0.12, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(px + ex + ox2 * 2, py - ey + oy2 * 2, r * 0.12, 0, 6.29); ctx.fill();
  }

  function drawStar(px, py, r, rot, color) {
    ctx.save();
    ctx.translate(px, py); ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function draw() {
    // background: full-screen brick field with the maze floor carved out
    if (!bgCache) renderBackground();
    ctx.drawImage(bgCache, 0, 0);

    if (!wallCache) renderWalls();
    var flash = state === "clear" && ((flashT * 5) | 0) % 2 === 0;
    if (flash) { ctx.save(); ctx.globalAlpha = 0.35; }
    ctx.drawImage(wallCache, ox, oy);
    if (flash) ctx.restore();

    // dots (centered in the middle of each lane)
    var dotR = Math.max(2, ts * 0.09);
    ctx.fillStyle = "#ffc78f";
    for (var r = 0; r < ROWS; r++) {
      for (var q = 0; q < COLS; q++) {
        if (dots[r][q] !== 1) continue;
        ctx.beginPath(); ctx.arc(ox + (q + 0.5) * ts, oy + (r + 0.5) * ts, dotR, 0, 6.29); ctx.fill();
      }
    }
    // power pellets (pulse)
    var pr = ts * (0.26 + 0.06 * Math.sin(performance.now() / 180));
    ctx.fillStyle = "#fff3b0";
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var q2 = 0; q2 < COLS; q2++) {
        if (dots[r2][q2] !== 2) continue;
        ctx.beginPath(); ctx.arc(ox + (q2 + 0.5) * ts, oy + (r2 + 0.5) * ts, pr, 0, 6.29); ctx.fill();
      }
    }

    // fruit
    if (fruit) {
      var fx = ox + (fruit.x + 0.5) * ts, fy = oy + (fruit.y + 0.5) * ts;
      var fr = ts * 0.3 * (1 + 0.08 * Math.sin(performance.now() / 150));
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath(); ctx.arc(fx - fr * 0.5, fy + fr * 0.2, fr * 0.62, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(fx + fr * 0.5, fy + fr * 0.35, fr * 0.62, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#4caf50"; ctx.lineWidth = Math.max(2, ts * 0.06);
      ctx.beginPath(); ctx.moveTo(fx, fy - fr * 0.2); ctx.quadraticCurveTo(fx + fr * 0.3, fy - fr, fx + fr * 0.7, fy - fr * 0.9); ctx.stroke();
    }

    if (state === "win") {
      // rainbow celebration wash
      ctx.fillStyle = "hsla(" + ((stateT * 140) % 360) + ",90%,60%,0.10)";
      ctx.fillRect(0, 0, W, H);
      // monsters as spinning stars orbiting the middle
      for (var si = 0; si < ghosts.length; si++) {
        var sa = stateT * 2.2 + si * Math.PI / 2;
        drawStar(ox + COLS / 2 * ts + Math.cos(sa) * ts * 2.6, oy + ROWS / 2 * ts + Math.sin(sa) * ts * 1.8,
                 ts * 0.5, stateT * 5 + si, ghosts[si].color);
      }
      drawMunch(ox + COLS / 2 * ts, oy + ROWS / 2 * ts + Math.sin(stateT * 8) * ts * 0.2,
                ts * 0.5, { x: 1, y: 0 }, stateT * 14, true);
    } else {
      // Miss Munch
      if (!(state === "dying" && stateT > 1.0)) {
        var shrink = state === "dying" ? Math.max(0.05, 1 - stateT / 1.1) : 1;
        drawMunch(ox + (player.x + 0.5) * ts, oy + (player.y + 0.5) * ts, ts * 0.46 * shrink,
                  player.dir.x || player.dir.y ? player.dir : { x: 1, y: 0 }, player.mouth, false);
      }
      for (var gi = 0; gi < ghosts.length; gi++) drawGhost(ghosts[gi]);
    }

    // particles
    for (var pi = 0; pi < parts.length; pi++) {
      var pt = parts[pi];
      ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
      ctx.fillStyle = pt.c;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawHUD();

    // overlays
    ctx.textAlign = "center";
    if (state === "ready") {
      ctx.fillStyle = "rgba(4,6,20,0.55)"; ctx.fillRect(0, 0, W, H);
      drawPixelNumber(ctx, level, W / 2, H * 0.3, 8, "#ffd740", true);
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px 'Press Start 2P', monospace";
      var pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      ctx.globalAlpha = pulse;
      ctx.fillText("SWIPE TO STEER", W / 2, H * 0.52);
      ctx.globalAlpha = 1;
    } else if (state === "win" && stateT > 6) {
      ctx.fillStyle = "rgba(4,6,20,0.45)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd740";
      ctx.font = "28px 'Press Start 2P', monospace";
      ctx.fillText("YOU WIN!", W / 2, H * 0.3);
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px 'Press Start 2P', monospace";
      var p2 = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      ctx.globalAlpha = p2;
      ctx.fillText("TAP TO PLAY AGAIN", W / 2, H * 0.52);
      ctx.globalAlpha = 1;
    }
  }

  function drawHUD() {
    // floating overlay HUD — the maze fills the whole screen underneath
    ctx.save();
    // score pill, top-right (clear of the back button, top-left)
    ctx.fillStyle = "rgba(6,8,28,0.62)";
    roundRect(W - 118, 10, 108, 40, 12); ctx.fill();
    drawPixelNumber(ctx, Math.floor(shown), W - 64, 30, 4, "#ffffff", true);
    // level pips, top-center
    var pw = LEVELS * 26;
    ctx.fillStyle = "rgba(6,8,28,0.62)";
    roundRect(W / 2 - pw / 2 - 10, 10, pw + 20, 40, 12); ctx.fill();
    for (var l = 0; l < LEVELS; l++) {
      ctx.fillStyle = l < level ? "#ffd740" : "rgba(255,255,255,0.25)";
      var lx = W / 2 - pw / 2 + l * 26;
      roundRect(lx, 22, 18, 18, 5); ctx.fill();
    }
    ctx.restore();
  }

  function drawMiniMunch(x, y, r) {
    // tiny version of Miss Munch for the lives HUD: long hair, bow, face
    ctx.fillStyle = "#7a4f24";
    roundRect(x - r * 1.05, y - r * 0.9, r * 0.5, r * 2.15, r * 0.25); ctx.fill();
    roundRect(x + r * 0.55, y - r * 0.9, r * 0.5, r * 2.15, r * 0.25); ctx.fill();
    ctx.fillStyle = "#ffd9b3";
    ctx.beginPath(); ctx.arc(x, y, r * 0.88, 0, 6.29); ctx.fill();
    ctx.fillStyle = "#a06a35";
    ctx.beginPath(); ctx.arc(x, y - r * 0.09, r * 0.86, Math.PI * 1.04, Math.PI * 1.96); ctx.fill();
    ctx.fillStyle = "#ff3b6b";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.18, y - r * 0.9, r * 0.28, r * 0.18, -0.5, 0, 6.29);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.74, y - r * 0.9, r * 0.28, r * 0.18, 0.5, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = "#d41e4e";
    ctx.beginPath(); ctx.arc(x + r * 0.46, y - r * 0.9, r * 0.13, 0, 6.29); ctx.fill();
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.02, r * 0.12, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.02, r * 0.12, 0, 6.29); ctx.fill();
    ctx.fillStyle = "#7a2e2e";
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.38, r * 0.27, r * 0.16, 0, 0, 6.29); ctx.fill();
  }

  /* ---------------- input: swipe anywhere to steer ---------------- */
  var touchId = null, lastTX = 0, lastTY = 0, movedFar = false;

  function dirFromSwipe(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? 1 : -1, y: 0 };
    return { x: 0, y: dy > 0 ? 1 : -1 };
  }

  function press(x, y) {
    audio.unlock();
    if (state === "ready") { state = "play"; }
    else if (state === "win" && stateT > 6) {
      if (window.SDGplays) SDGplays.played("missmunch");
      score = 0; shown = 0; level = 1;
      buildLevel(1); state = "ready"; parts = [];
    }
  }

  canvas.addEventListener("pointerdown", function (e) {
    touchId = e.pointerId; lastTX = e.clientX; lastTY = e.clientY; movedFar = false;
    press(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerId !== touchId) return;
    var dx = e.clientX - lastTX, dy = e.clientY - lastTY;
    if (Math.hypot(dx, dy) > 26) {
      player.want = dirFromSwipe(dx, dy);
      lastTX = e.clientX; lastTY = e.clientY; movedFar = true;
    }
  });
  function endTouch(e) { if (e.pointerId === touchId) touchId = null; }
  canvas.addEventListener("pointerup", endTouch);
  canvas.addEventListener("pointercancel", endTouch);

  window.addEventListener("keydown", function (e) {
    var k = e.key;
    var d = k === "ArrowLeft" || k === "a" ? { x: -1, y: 0 }
          : k === "ArrowRight" || k === "d" ? { x: 1, y: 0 }
          : k === "ArrowUp" || k === "w" ? { x: 0, y: -1 }
          : k === "ArrowDown" || k === "s" ? { x: 0, y: 1 } : null;
    if (d) { player.want = d; press(0, 0); e.preventDefault(); }
  });

  /* ---------------- main loop ---------------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (MUSIC) MUSIC.tick(dt);
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  buildLevel(1);
  resize();
  requestAnimationFrame(frame);

  /* ---------------- test hooks ---------------- */
  window.__munch = {
    COLS: COLS, ROWS: ROWS, LEVELS: LEVELS,
    levelParams: levelParams,
    mazeGrid: function (l) { return MAZES[l - 1].grid; },
    ghostPalettes: function () { return MAZES.map(function (m) { return m.pal; }); },
    _grid: function () { return grid; },
    _setGrid: function (g) { grid = g; },
    charAt: charAt, walkable: walkable, opposite: opposite,
    ghostTarget: function (g) { return ghostTarget(g); },
    _setPlayer: function (p) { player = p; },
    _player: function () { return player; },
    _ghosts: function () { return ghosts; },
    _setFright: function (t) { frightT = t; },
    _frame: function (dt) { update(dt); draw(); },
    _press: press,
    _state: function (s) { if (s !== undefined) state = s; return state; },
    _dotsLeft: function () { return dotsLeft; },
  };
})();
