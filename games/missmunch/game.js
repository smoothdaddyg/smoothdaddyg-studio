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

  /* ---------------- mazes ---------------- */
  var COLS = 19, ROWS = 15;
  // # wall, . dot, o power pellet, P player start, G monster house,
  // - house door, space walkable (no dot, incl. tunnels)
  var MAZES = [
    {
      pal: ["#ff3b30", "#ff8ac2", "#35c4ff", "#ffb340"],
      grid: [
        "###################",
        "#........#........#",
        "#.##.###.#.###.##.#",
        "#o...............o#",
        "#.##.#.#####.#.##.#",
        "#....#...#...#....#",
        "####.###.#.###.####",
        "####.#.......#.####",
        "####.#.##-##.#.####",
        "#......#GGG#......#",
        "####.#.#####.#.####",
        "#........#........#",
        "#.##.###.#.###.##.#",
        "#o.#.....P.....#.o#",
        "###################",
      ],
    },
    {
      pal: ["#b45cff", "#5cff8a", "#ffd23b", "#3b8aff"],
      grid: [
        "###################",
        "#..#.....#.....#..#",
        "#.##.###.#.###.##.#",
        "#o...#.......#...o#",
        "##.#.#.#####.#.#.##",
        "#....#...#...#....#",
        "#.##.###.#.###.##.#",
        " ...#.........#... ",
        "####.#.##-##.#.####",
        "#......#GGG#......#",
        "####.#.#####.#.####",
        "#........#........#",
        "#.##.###.#.###.##.#",
        "#o.#.....P.....#.o#",
        "###################",
      ],
    },
    {
      pal: ["#ff5c5c", "#c2ff5c", "#5cffc2", "#5c8aff"],
      grid: [
        "###################",
        "#........#........#",
        "#.######.#.######.#",
        "#o#....#.#.#....#o#",
        "#.#.##.#.#.#.##.#.#",
        "#...#..#.#.#..#...#",
        "###.#.##.#.##.#.###",
        "#.....#.....#.....#",
        "####.#.##-##.#.####",
        "#......#GGG#......#",
        "####.#.#####.#.####",
        "#........#........#",
        "#.##.###.#.###.##.#",
        "#o.#.....P.....#.o#",
        "###################",
      ],
    },
    {
      pal: ["#ff8a3b", "#8a5cff", "#5cff5c", "#ff5c8a"],
      grid: [
        "###################",
        "#........#........#",
        "#.####.#.#.#.####.#",
        "#o...............o#",
        "#.#....#####....#.#",
        "#.....#.....#.....#",
        "#####.##.#.##.#####",
        " ................. ",
        "####.#.##-##.#.####",
        "#......#GGG#......#",
        "####.#.#####.#.####",
        "#........#........#",
        "#.##.###.#.###.##.#",
        "#o.#.....P.....#.o#",
        "###################",
      ],
    },
    {
      pal: ["#ff3bd4", "#d4ff3b", "#3bffd4", "#8a8aff"],
      grid: [
        "###################",
        "#.#....#.#....#.#.#",
        "#.#.##.#.#.#.##.#.#",
        "#o..#.....#.....#o#",
        "##.#.#.#...#.#.##.#",
        "#.....#.....#.....#",
        "#.###.#.#.#.#.###.#",
        "#.....#.....#.....#",
        "####.#.##-##.#.####",
        "#......#GGG#......#",
        "####.#.#####.#.####",
        "#........#........#",
        "#.##.###.#.###.##.#",
        "#o.#.....P.....#.o#",
        "###################",
      ],
    },
  ];
  var LEVELS = MAZES.length;

  function levelParams(l) {
    return {
      ghostSpeed: 5.3 + 0.45 * (l - 1),   // monsters get faster every level
      playerSpeed: 7.0,
      frightTime: 6.5 - 0.6 * (l - 1),    // power pellets wear off sooner
      releaseGap: Math.max(0.7, 2.2 - 0.35 * (l - 1)),
    };
  }

  var DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  function opposite(a, b) { return a.x === -b.x && a.y === -b.y; }

  /* ---------------- state ---------------- */
  var state = "ready"; // ready | play | dying | clear | win | over
  var level = 1, score = 0, shown = 0, shields = 3;
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
  var wallCache = null;
  function layout() {
    ts = Math.floor(Math.min(W / COLS, (H - 180) / ROWS));
    ox = Math.round((W - ts * COLS) / 2);
    oy = Math.round(96 + (H - 180 - ts * ROWS) / 2);
    wallCache = null;
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
    return { x: 9, y: 7 };
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
    var homes = [8, 9, 10, 9];
    for (var i = 0; i < 4; i++) {
      ghosts.push({
        x: homes[i], y: 9, dir: { x: -1, y: 0 }, mode: "house",
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
    var homes = [8, 9, 10, 9];
    for (var i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      g.x = homes[i]; g.y = 9; g.dir = { x: -1, y: 0 };
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

  function decideGhost(g, cx, cy) {
    var eyes = g.mode === "eyes";
    var opts = [];
    for (var i = 0; i < 4; i++) {
      var d = DIRS[i];
      if (opposite(d, g.dir)) continue;                 // no U-turns
      if (walkable(cx + d.x, cy + d.y, true, eyes)) opts.push(d);
    }
    if (!opts.length) { g.dir = { x: -g.dir.x, y: -g.dir.y }; return; }
    var pick;
    if (eyes) {
      pick = minDistOpt(opts, cx, cy, 9, 8);            // eyes fly home to the door
    } else if (frightT > 0) {
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
    var sp = e.speed * dt;
    if (e.dir.x === 0 && e.dir.y === 0) {
      if (isPlayer) decidePlayer(Math.round(e.x), Math.round(e.y));
      else if (e.mode === "active" || e.mode === "eyes") decideGhost(e, Math.round(e.x), Math.round(e.y));
      if (e.dir.x === 0 && e.dir.y === 0) return;
    }
    var cx = Math.round(e.x), cy = Math.round(e.y);
    var tx = cx + e.dir.x, ty = cy + e.dir.y;
    if (!canEnter(e, tx, ty, isPlayer)) {
      // wall ahead: stop at this tile and reconsider
      e.x = cx; e.y = cy;
      if (isPlayer) decidePlayer(cx, cy);
      else decideGhost(e, cx, cy);
      return;
    }
    var distC = Math.abs(tx - e.x) + Math.abs(ty - e.y);
    if (sp >= distC) {
      e.x = tx; e.y = ty;
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
    // tile coords -> pixel burst
    var px = ox + x * ts, py = oy + y * ts;
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
    shields--;
    audio.tone(520, 0.7, { type: "sawtooth", vol: 0.14, slideTo: 90 });
    boom(player.x, player.y, false);
    if (shields <= 0) { state = "over"; stateT = 0; }
    else { state = "dying"; stateT = 0; }
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
          // scoot to the door, then out
          var sp = g.speed * dt;
          if (Math.abs(g.x - 9) > 0.08) g.x += Math.sign(9 - g.x) * Math.min(sp, Math.abs(9 - g.x));
          else if (g.y > 7.02) g.y -= sp;
          else { g.y = 7; g.mode = "active"; g.dir = { x: -1, y: 0 }; }
        } else {
          g.speed = (g.mode === "eyes" ? 11 : P.ghostSpeed) * (frightT > 0 && g.mode === "active" ? 0.72 : 1);
          stepEntity(g, dt, false);
          if (g.mode === "eyes" && Math.abs(g.x - 9) < 0.25 && Math.abs(g.y - 8) < 0.25) {
            g.x = 9; g.y = 8; g.mode = "leaving";
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
      if (stateT > 1.6) { resetPositions(); state = "ready"; }
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
    } else if (state === "over") {
      stateT += dt;
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

  function renderWalls() {
    wallCache = document.createElement("canvas");
    wallCache.width = COLS * ts; wallCache.height = ROWS * ts;
    var c = wallCache.getContext("2d");
    for (var r = 0; r < ROWS; r++) {
      for (var q = 0; q < COLS; q++) {
        if (grid[r][q] !== "#") continue;
        c.fillStyle = "#101a5e";
        c.fillRect(q * ts, r * ts, ts, ts);
      }
    }
    c.strokeStyle = "#4d7cff"; c.lineWidth = Math.max(2, ts * 0.09);
    c.beginPath();
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var q2 = 0; q2 < COLS; q2++) {
        if (grid[r2][q2] !== "#") continue;
        var x = q2 * ts, y = r2 * ts;
        var open = function (cc, rr) {
          if (rr < 0 || rr >= ROWS) return true;
          cc = ((cc % COLS) + COLS) % COLS;
          return grid[rr][cc] !== "#";
        };
        if (open(q2, r2 - 1)) { c.moveTo(x, y + 1); c.lineTo(x + ts, y + 1); }
        if (open(q2, r2 + 1)) { c.moveTo(x, y + ts - 1); c.lineTo(x + ts, y + ts - 1); }
        if (open(q2 - 1, r2)) { c.moveTo(x + 1, y); c.lineTo(x + 1, y + ts); }
        if (open(q2 + 1, r2)) { c.moveTo(x + ts - 1, y); c.lineTo(x + ts - 1, y + ts); }
      }
    }
    c.stroke();
  }

  function drawMunch(px, py, r, dir, mouthPhase, happy) {
    var ang = Math.atan2(dir.y, dir.x);
    var mo = (0.16 + 0.14 * Math.abs(Math.sin(mouthPhase))) * Math.PI;
    ctx.fillStyle = "#ffeb3b";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, r, ang + mo, ang + Math.PI * 2 - mo);
    ctx.closePath(); ctx.fill();
    // her bow stays on top
    ctx.fillStyle = "#ff3b6b";
    var bw = r * 0.55;
    ctx.beginPath();
    ctx.moveTo(px, py - r * 0.75);
    ctx.lineTo(px - bw, py - r * 1.35); ctx.lineTo(px - bw * 0.2, py - r * 0.95);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px, py - r * 0.75);
    ctx.lineTo(px + bw, py - r * 1.35); ctx.lineTo(px + bw * 0.2, py - r * 0.95);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d41e4e";
    ctx.beginPath(); ctx.arc(px, py - r * 0.95, r * 0.18, 0, 6.29); ctx.fill();
    if (happy) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px - r * 0.35, py - r * 0.25, r * 0.12, 0, 6.29); ctx.fill();
    }
  }

  function drawGhost(g) {
    var px = ox + g.x * ts, py = oy + g.y * ts;
    var r = ts * 0.42;
    var fright = frightT > 0 && g.mode === "active";
    var flash = fright && frightT < 1.5 && ((frightT * 6) | 0) % 2 === 0;
    if (g.mode === "eyes") {
      drawEyes(px, py, r, g.dir, "#fff");
      return;
    }
    var yb = py + (g.mode === "house" ? Math.sin(g.bob) * ts * 0.08 : 0);
    ctx.fillStyle = fright ? (flash ? "#ffffff" : "#3d5afe") : g.color;
    ctx.beginPath();
    ctx.arc(px, yb - r * 0.1, r, Math.PI, 0);
    ctx.lineTo(px + r, yb + r * 0.72);
    for (var i = 0; i < 4; i++) {
      ctx.lineTo(px + r - (i + 0.5) * (r / 2), yb + r * 0.72 - (i % 2 ? r * 0.28 : 0));
    }
    ctx.lineTo(px - r, yb + r * 0.72);
    ctx.closePath(); ctx.fill();
    if (fright) {
      ctx.fillStyle = flash ? "#3d5afe" : "#ffd7e6";
      ctx.beginPath(); ctx.arc(px - r * 0.32, yb - r * 0.25, r * 0.14, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(px + r * 0.32, yb - r * 0.25, r * 0.14, 0, 6.29); ctx.fill();
      ctx.strokeStyle = flash ? "#3d5afe" : "#ffd7e6"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - r * 0.5, yb + r * 0.25);
      for (var k = 0; k < 4; k++) ctx.lineTo(px - r * 0.5 + (k + 0.5) * r * 0.25, yb + r * 0.25 + (k % 2 ? -3 : 3));
      ctx.stroke();
    } else {
      drawEyes(px, yb - r * 0.1, r, g.dir, "#fff");
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
    // background
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#070a24"); bg.addColorStop(1, "#101a4e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    if (!wallCache) renderWalls();
    var flash = state === "clear" && ((flashT * 5) | 0) % 2 === 0;
    if (flash) { ctx.save(); ctx.globalAlpha = 0.35; }
    ctx.drawImage(wallCache, ox, oy);
    if (flash) ctx.restore();

    // dots
    var dotR = Math.max(2, ts * 0.09);
    ctx.fillStyle = "#ffc78f";
    for (var r = 0; r < ROWS; r++) {
      for (var q = 0; q < COLS; q++) {
        if (dots[r][q] !== 1) continue;
        ctx.beginPath(); ctx.arc(ox + q * ts, oy + r * ts, dotR, 0, 6.29); ctx.fill();
      }
    }
    // power pellets (pulse)
    var pr = ts * (0.26 + 0.06 * Math.sin(performance.now() / 180));
    ctx.fillStyle = "#fff3b0";
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var q2 = 0; q2 < COLS; q2++) {
        if (dots[r2][q2] !== 2) continue;
        ctx.beginPath(); ctx.arc(ox + q2 * ts, oy + r2 * ts, pr, 0, 6.29); ctx.fill();
      }
    }

    // fruit
    if (fruit) {
      var fx = ox + fruit.x * ts, fy = oy + fruit.y * ts;
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
        drawStar(ox + 9 * ts + Math.cos(sa) * ts * 3.2, oy + 7 * ts + Math.sin(sa) * ts * 2.2,
                 ts * 0.5, stateT * 5 + si, ghosts[si].color);
      }
      drawMunch(ox + 9 * ts, oy + 7 * ts + Math.sin(stateT * 8) * ts * 0.2,
                ts * 0.5, { x: 1, y: 0 }, stateT * 14, true);
    } else {
      // Miss Munch
      if (!(state === "dying" && stateT > 1.0)) {
        var shrink = state === "dying" ? Math.max(0.05, 1 - stateT / 1.1) : 1;
        drawMunch(ox + player.x * ts, oy + player.y * ts, ts * 0.46 * shrink,
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
    } else if (state === "over") {
      ctx.fillStyle = "rgba(4,6,20,0.6)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px 'Press Start 2P', monospace";
      var p3 = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      ctx.globalAlpha = p3;
      ctx.fillText("TAP TO PLAY AGAIN", W / 2, H * 0.5);
      ctx.globalAlpha = 1;
    }
  }

  function drawHUD() {
    // score
    drawPixelNumber(ctx, Math.floor(shown), 90, 44, 4, "#ffffff", false);
    // shields: little munch heads
    for (var s = 0; s < 3; s++) {
      var sx = W - 40 - s * 34, sy = 44;
      if (s < shields) {
        ctx.fillStyle = "#ffeb3b";
        ctx.beginPath(); ctx.arc(sx, sy, 11, 0.5, Math.PI * 2 - 0.5); ctx.lineTo(sx, sy); ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 11, 0, 6.29); ctx.stroke();
      }
    }
    // level pips
    for (var l = 0; l < LEVELS; l++) {
      ctx.fillStyle = l < level ? "#ffd740" : "rgba(255,255,255,0.25)";
      var lx = W / 2 - (LEVELS * 26) / 2 + l * 26;
      roundRect(lx, 34, 18, 18, 5); ctx.fill();
    }
    // dots left: a little row of dots
    var n = Math.min(20, dotsLeft);
    ctx.fillStyle = "#ffc78f";
    for (var d = 0; d < n; d++) {
      ctx.beginPath(); ctx.arc(90 + d * 16, 74, 3.5, 0, 6.29); ctx.fill();
    }
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
      score = 0; shown = 0; shields = 3; level = 1;
      buildLevel(1); state = "ready"; parts = [];
    } else if (state === "over" && stateT > 0.8) {
      shields = 3; score = 0; shown = 0;
      buildLevel(level); state = "ready"; parts = [];
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
    _setFright: function (t) { frightT = t; },
    _frame: function (dt) { update(dt); draw(); },
    _press: press,
    _state: function (s) { if (s !== undefined) state = s; return state; },
    _dotsLeft: function () { return dotsLeft; },
  };
})();
