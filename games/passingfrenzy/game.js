/* ============================================================
   PASSING FRENZY — SmoothDaddyG
   A fast, joyful basketball-passing arcade game.
   Blue team (you) streams bottom -> top. Red team (computer)
   streams top -> bottom. Nobody stops moving — ever.
   ONE interaction: tap anywhere to throw the ball there.
   Lead your teammates, dodge interceptions, tap the top basket
   to shoot. First to 10 wins. No timers, no fouls, no losing
   on a mistake — just pure passing fun.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- tuning (all gameplay numbers live here) ---------------- */
  const CFG = {
    BLUE_COUNT: 6,        // visible blue players
    RED_COUNT: 6,         // visible red players
    PLAYER_R: 18,         // player body radius (px)
    CATCH_R: 30,          // catch/pickup radius — a touch bigger than the body
    SPEED_MIN: 40,        // player speed px/s — wide range, some much faster
    SPEED_MAX: 140,
    DRIFT: 26,            // max horizontal drift px/s
    BALL_MUL: 2.5,        // ball speed = BALL_MUL x average player speed
    WIN_SCORE: 10,
    PTS: 2,               // points per basket / per interception
    SHOOT_ZONE: 85,       // tap within this of a basket = a shot attempt
    SCORE_R: 30,          // ball within this of basket center = bucket
    THROWER_GRACE: 0.20,  // s before the thrower can re-catch their own pass
    CELEBRATE_T: 1.7,     // basket celebration (s)
    SPAWN_MARGIN: 36,     // players spawn/despawn this far off-screen
  };

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  // state: 'title' | 'play' | 'celebrate' | 'win'
  let state = "title";
  let blueScore = 0, redScore = 0;
  let winner = null;           // 'blue' | 'red'
  let celebrateT = 0;
  let scoredBy = null;         // who just scored (for the reset)

  let players = [];            // {team,x,y,vx,vy,speed,phase,hasBall}
  let parts = [];              // particles {x,y,vx,vy,t,life,hue,r}
  let rings = [];              // expanding rings {x,y,r,t,life,hue}

  // ball modes: 'none' | 'carried' | 'flying'
  let ball = { mode: "none", x: 0, y: 0, carrier: null,
               tx: 0, ty: 0, dx: 0, dy: 0, dist: 0,
               shotBy: null, shotTarget: null,
               thrower: null, throwerT: 0, trail: [] };

  let basketTop = { x: 0, y: 0 };
  let basketBottom = { x: 0, y: 0 };

  // big-canvas buttons (title + win screens)
  let playBtn = { x: 0, y: 0, w: 0, h: 0 };

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

  function ballSpeed() {
    return ((CFG.SPEED_MIN + CFG.SPEED_MAX) / 2) * CFG.BALL_MUL;
  }

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
    basketTop.x = W / 2;    basketTop.y = 108;
    basketBottom.x = W / 2;  basketBottom.y = H - 108;
    playBtn.w = Math.min(300, W * 0.62); playBtn.h = 84;
    playBtn.x = W / 2 - playBtn.w / 2;  playBtn.y = H * 0.62;
  }
  window.addEventListener("resize", resize);

  /* ---------------- players ---------------- */
  function spawnPlayer(team, withBall) {
    const speed = rnd(CFG.SPEED_MIN, CFG.SPEED_MAX);
    const p = {
      team: team,
      x: rnd(50, Math.max(51, W - 50)),
      y: team === "blue" ? H + CFG.SPAWN_MARGIN : -CFG.SPAWN_MARGIN,
      vx: rnd(-CFG.DRIFT, CFG.DRIFT),
      vy: team === "blue" ? -speed : speed,
      speed: speed,
      phase: Math.random() * 6.283,
      hasBall: !!withBall,
    };
    players.push(p);
    if (withBall) {
      ball.mode = "carried";
      ball.carrier = p;
      ball.x = p.x; ball.y = p.y;
      ball.shotBy = null; ball.shotTarget = null;
    }
    return p;
  }

  function keepRoster() {
    let nb = 0, nr = 0;
    for (const p of players) {
      if (p.team === "blue") nb++; else nr++;
    }
    if (nb < CFG.BLUE_COUNT) spawnPlayer("blue", false);
    if (nr < CFG.RED_COUNT) spawnPlayer("red", false);
  }

  /* Give `team` the ball at their own starting edge (after a basket or a
     carrier running off the edge). Spawns a fresh player holding it. */
  function resetBallToEdge(team) {
    // clear any old carrier flag
    for (const p of players) p.hasBall = false;
    ball.trail = [];
    spawnPlayer(team, true);
    ball.shotBy = null; ball.shotTarget = null;
    ball.thrower = null; ball.throwerT = 0;
  }

  /* ---------------- throwing & catching ---------------- */
  function throwBall(fromX, fromY, toX, toY, byTeam, thrower, isShot, shotTarget) {
    // release from the old carrier
    if (ball.carrier) ball.carrier.hasBall = false;
    const d = Math.max(1, dist(fromX, fromY, toX, toY));
    const sp = ballSpeed();
    ball.mode = "flying";
    ball.carrier = null;
    ball.x = fromX; ball.y = fromY;
    ball.tx = toX; ball.ty = toY;
    ball.dx = (toX - fromX) / d; ball.dy = (toY - fromY) / d;
    ball.dist = d;
    ball.shotBy = isShot ? byTeam : null;
    ball.shotTarget = isShot ? shotTarget : null; // 'top' | 'bottom'
    ball.thrower = thrower || null;
    ball.throwerT = 0;
    ball.trail = [];
    audio.tone(300, 0.12, { type: "square", vol: 0.08, slideTo: 620 });
  }

  function giveBall(p, intercepted) {
    if (ball.carrier) ball.carrier.hasBall = false;
    ball.mode = "carried";
    ball.carrier = p;
    p.hasBall = true;
    ball.x = p.x; ball.y = p.y;
    ball.trail = [];
    // a catch kills any shot in progress
    ball.shotBy = null; ball.shotTarget = null;
    if (intercepted) {
      audio.tone(180, 0.25, { type: "sawtooth", vol: 0.12, slideTo: 90 });
      burst(p.x, p.y, 0, 22, 300);
      rings.push({ x: p.x, y: p.y, r: 12, t: 0, life: 0.4, hue: 0 });
    } else {
      audio.arp([660, 880], 0.06, "triangle", 0.10);
      burst(p.x, p.y, 210, 10, 180);
    }
  }

  /* closest player within catch radius, excluding the just-thrown grace */
  function catcherAt(x, y) {
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p === ball.thrower && ball.throwerT < CFG.THROWER_GRACE) continue;
      const d = dist(x, y, p.x, p.y);
      if (d < CFG.CATCH_R && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function updateBall(dt) {
    if (ball.mode === "carried") {
      if (ball.carrier) { ball.x = ball.carrier.x; ball.y = ball.carrier.y; }
      return;
    }
    if (ball.mode === "flying") {
      ball.throwerT += dt;
      const sp = ballSpeed();
      const step = sp * dt;
      // trail
      ball.trail.push({ x: ball.x, y: ball.y, t: 0 });
      if (ball.trail.length > 14) ball.trail.shift();
      for (const tr of ball.trail) tr.t += dt;

      ball.x += ball.dx * step;
      ball.y += ball.dy * step;

      // shot reaching the basket?
      if (ball.shotBy) {
        const b = ball.shotTarget === "top" ? basketTop : basketBottom;
        if (dist(ball.x, ball.y, b.x, b.y) < CFG.SCORE_R) {
          scoreBasket(ball.shotBy);
          return;
        }
      }
      // anyone catch it mid-flight?
      const c = catcherAt(ball.x, ball.y);
      if (c) {
        if (c.team === "red") {
          // Red interception = instant 2 points, ball resets to blue at bottom
          scoreBasket("red");
        } else {
          giveBall(c, false);
        }
        return;
      }
      // missed pass flies off-screen, then reappears at the bottom
      // with a fresh blue player just coming on
      const M = 60;
      if (ball.x < -M || ball.x > W + M || ball.y < -M || ball.y > H + M) {
        resetBallToEdge("blue");
        return;
      }
      return;
    }
  }

  function lastThrowTeam() {
    // who threw the ball that's currently flying/loose? Track via thrower.
    return ball.thrower ? ball.thrower.team : null;
  }

  /* ---------------- scoring ---------------- */
  function scoreBasket(team) {
    if (team === "blue") blueScore += CFG.PTS;
    else redScore += CFG.PTS;
    scoredBy = team;
    state = "celebrate";
    celebrateT = CFG.CELEBRATE_T;
    const b = team === "blue" ? basketTop : basketBottom;
    confettiBlast(b.x, b.y, 110);
    audio.arp([523, 659, 784, 1047, 1319], 0.09, "square", 0.12);
    audio.noise(0.5, { vol: 0.06 });
    ball.mode = "none";
    ball.carrier = null;
    for (const p of players) p.hasBall = false;
    if (blueScore >= CFG.WIN_SCORE || redScore >= CFG.WIN_SCORE) {
      winner = blueScore >= CFG.WIN_SCORE ? "blue" : "red";
      // the win screen takes over after the celebration beat
    }
  }

  /* ---------------- input ---------------- */
  function onTap(x, y) {
    audio.unlock && audio.unlock();
    if (state === "title" || state === "win") {
      if (x >= playBtn.x && x <= playBtn.x + playBtn.w &&
          y >= playBtn.y && y <= playBtn.y + playBtn.h) {
        startGame();
      }
      return;
    }
    if (state !== "play") return; // ignore taps during celebrations
    // only throw when blue actually has the ball
    if (ball.mode !== "carried" || !ball.carrier || ball.carrier.team !== "blue") return;
    const c = ball.carrier;
    // tap on (or near) the top basket = shoot
    if (dist(x, y, basketTop.x, basketTop.y) < CFG.SHOOT_ZONE) {
      throwBall(c.x, c.y, basketTop.x, basketTop.y, "blue", c, true, "top");
    } else {
      throwBall(c.x, c.y, clamp(x, 20, W - 20), clamp(y, 60, H - 20), "blue", c, false, null);
    }
  }
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    onTap(e.clientX, e.clientY);
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  function startGame() {
    blueScore = 0; redScore = 0; winner = null; scoredBy = null;
    players = []; parts = []; rings = [];
    ball = { mode: "none", x: 0, y: 0, carrier: null,
             tx: 0, ty: 0, dx: 0, dy: 0, dist: 0,
             shotBy: null, shotTarget: null, thrower: null, throwerT: 0, trail: [] };
    for (let i = 0; i < CFG.BLUE_COUNT; i++) {
      const p = spawnPlayer("blue", false);
      p.y = rnd(H * 0.15, H + CFG.SPAWN_MARGIN); // scatter them up the court
    }
    for (let i = 0; i < CFG.RED_COUNT; i++) {
      const p = spawnPlayer("red", false);
      p.y = rnd(-CFG.SPAWN_MARGIN, H * 0.85);
    }
    resetBallToEdge("blue"); // human starts with the ball
    state = "play";
    if (window.SDGplays) window.SDGplays.played("passingfrenzy");
    audio.arp([392, 523, 659], 0.08, "square", 0.10);
  }

  /* ---------------- update ---------------- */
  function tick(dt) {
    time += dt;

    // players always stream, in every state (keeps title/win screens alive)
    for (let i = players.length - 1; i >= 0; i--) {
      const p = players[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.phase += dt * (4 + p.speed * 0.05);
      // gentle horizontal wander
      p.vx += rnd(-30, 30) * dt;
      p.vx = clamp(p.vx, -CFG.DRIFT, CFG.DRIFT);
      if (p.x < 30) { p.x = 30; p.vx = Math.abs(p.vx); }
      if (p.x > W - 30) { p.x = W - 30; p.vx = -Math.abs(p.vx); }
      // exit the far edge
      if ((p.team === "blue" && p.y < -CFG.SPAWN_MARGIN) ||
          (p.team === "red" && p.y > H + CFG.SPAWN_MARGIN)) {
        if (p.hasBall && (state === "play")) {
          // carrier ran off with it — turnover to the other team at THEIR edge
          const toTeam = p.team === "blue" ? "red" : "blue";
          players.splice(i, 1);
          resetBallToEdge(toTeam);
          audio.tone(220, 0.2, { type: "square", vol: 0.08, slideTo: 140 });
        } else {
          players.splice(i, 1);
        }
      }
    }
    if (state === "play" || state === "title" || state === "celebrate" || state === "win") keepRoster();

    if (state === "play" || state === "celebrate") updateBall(dt);

    // celebration beat, then hand the ball to the scored-on team
    if (state === "celebrate") {
      celebrateT -= dt;
      if (celebrateT <= 0) {
        if (winner) {
          state = "win";
          if (winner === "blue") {
            confettiBlast(W / 2, H * 0.4, 160);
            audio.arp([523, 587, 659, 784, 880, 1047, 1175, 1319, 1568], 0.11, "square", 0.12);
          } else {
            audio.arp([392, 370, 349, 311], 0.14, "triangle", 0.10);
          }
        } else {
          resetBallToEdge("blue"); // blue always has the ball
          state = "play";
        }
      }
    }

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= 0.98;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) rings.splice(i, 1);
    }
  }

  /* ---------------- drawing ---------------- */
  function drawCourt() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0f4c50");
    g.addColorStop(0.5, "#0d3f43");
    g.addColorStop(1, "#0a3134");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // subtle wood-plank stripes
    ctx.fillStyle = "rgba(255,255,255,0.022)";
    for (let y = 0; y < H; y += 46) ctx.fillRect(0, y, W, 20);
    // court lines
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 54, 0, 6.2832); ctx.stroke();
    // paint rectangles near each basket
    ctx.strokeRect(W / 2 - 60, 60, 120, 84);
    ctx.strokeRect(W / 2 - 60, H - 144, 120, 84);
  }

  function drawBasket(b, flip) {
    const x = b.x, y = b.y;
    // backboard
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const bw = 92, bh = 12;
    if (!flip) ctx.fillRect(x - bw / 2, y - 44, bw, bh);
    else ctx.fillRect(x - bw / 2, y + 32, bw, bh);
    // rim
    ctx.strokeStyle = "#ff7b1c";
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(x, y, 24, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = "#ffb066";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 24, 0, 6.2832); ctx.stroke();
    // net
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    const ny = flip ? -1 : 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 10, y + ny * 20);
      ctx.lineTo(x + i * 6, y + ny * 44);
      ctx.stroke();
    }
  }

  function drawPlayer(p) {
    const r = CFG.PLAYER_R;
    const bob = Math.abs(Math.sin(p.phase)) * 3;
    const x = p.x, y = p.y - bob;
    const col = p.team === "blue" ? "#2f9dff" : "#ff5252";
    const dark = p.team === "blue" ? "#1a6fd0" : "#c62828";
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y + r + 8, r * 0.8, 5, 0, 0, 6.2832); ctx.fill();
    // legs (running)
    const lp = Math.sin(p.phase) * 9;
    ctx.strokeStyle = "#20242e";
    ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 6, y + r - 4); ctx.lineTo(x - 6 + lp * 0.5, y + r + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 6, y + r - 4); ctx.lineTo(x + 6 - lp * 0.5, y + r + 12); ctx.stroke();
    // body (jersey)
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, col); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    // arms
    const ap = Math.sin(p.phase + 1.2) * 8;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - r + 2, y); ctx.lineTo(x - r - 4, y + 8 + ap * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r - 2, y); ctx.lineTo(x + r + 4, y + 8 - ap * 0.4); ctx.stroke();
    // face
    ctx.fillStyle = "#ffd9b3";
    ctx.beginPath(); ctx.arc(x, y - 4, r * 0.52, 0, 6.2832); ctx.fill();
    // eyes look toward travel direction
    const ey = p.team === "blue" ? -2 : 2;
    ctx.fillStyle = "#20242e";
    ctx.beginPath(); ctx.arc(x - 5, y - 4 + ey, 2.6, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5, y - 4 + ey, 2.6, 0, 6.2832); ctx.fill();
    // ball-carrier highlight ring
    if (p.hasBall) {
      const pulse = 0.65 + 0.35 * Math.sin(time * 8);
      ctx.strokeStyle = "rgba(255,225,77," + pulse.toFixed(2) + ")";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 6.2832); ctx.stroke();
    }
  }

  function drawBall() {
    if (ball.mode === "none") return;
    // trail
    for (let i = 0; i < ball.trail.length; i++) {
      const tr = ball.trail[i];
      const k = i / ball.trail.length;
      ctx.fillStyle = "rgba(255,150,40," + (k * 0.35 * Math.max(0, 1 - tr.t * 3)).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(tr.x, tr.y, 11 * k + 2, 0, 6.2832); ctx.fill();
    }
    const x = ball.x, y = ball.y, r = 12;
    const bob = 0;
    ctx.save();
    ctx.shadowColor = "#ff9500"; ctx.shadowBlur = 16;
    const g = ctx.createRadialGradient(x - 4, y - 4 + bob, 2, x, y + bob, r);
    g.addColorStop(0, "#ffc46b"); g.addColorStop(1, "#e07b00");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y + bob, r, 0, 6.2832); ctx.fill();
    ctx.restore();
    // seams
    ctx.strokeStyle = "rgba(90,40,0,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + bob, r, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r, y + bob); ctx.lineTo(x + r, y + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + bob - r); ctx.lineTo(x, y + bob + r); ctx.stroke();
  }

  function drawScoreboard() {
    // blue score left, red score right — numbers only, no reading needed
    ctx.fillStyle = "rgba(4,8,18,0.55)";
    const bw = 150, bh = 52;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(12, 12, bw, bh, 14); else ctx.rect(12, 12, bw, bh);
    ctx.fill();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W - 12 - bw, 12, bw, bh, 14); else ctx.rect(W - 12 - bw, 12, bw, bh);
    ctx.fill();
    drawPixelNumber(ctx, blueScore, 12 + bw / 2, 38, 5, "#4db2ff", true);
    drawPixelNumber(ctx, redScore, W - 12 - bw / 2, 38, 5, "#ff6b6b", true);
    // tiny team dots under the scores
    ctx.fillStyle = "#2f9dff";
    ctx.beginPath(); ctx.arc(12 + bw / 2, 66, 5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#ff5252";
    ctx.beginPath(); ctx.arc(W - 12 - bw / 2, 66, 5, 0, 6.2832); ctx.fill();
  }

  function bigButton(label) {
    const pulse = 1 + Math.sin(time * 4) * 0.03;
    const w = playBtn.w * pulse, h = playBtn.h;
    const x = W / 2 - w / 2, y = playBtn.y;
    ctx.save();
    ctx.shadowColor = "#29faff"; ctx.shadowBlur = 26;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#22d3ee"); g.addColorStop(1, "#0e7490");
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 20); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#04121a";
    ctx.font = "26px 'Press Start 2P', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, W / 2, y + h / 2 + 2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  function drawTitle() {
    ctx.fillStyle = "rgba(4,8,18,0.62)";
    ctx.fillRect(0, 0, W, H);
    // bouncing ball logo
    const bx = W / 2, by = H * 0.30 + Math.abs(Math.sin(time * 2.4)) * -26;
    ctx.save();
    ctx.shadowColor = "#ff9500"; ctx.shadowBlur = 30;
    ctx.fillStyle = "#ff9500";
    ctx.beginPath(); ctx.arc(bx, by, 34, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(90,40,0,0.8)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx, by, 34, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 34, by); ctx.lineTo(bx + 34, by); ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "34px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("PASSING", W / 2, H * 0.44);
    ctx.fillText("FRENZY", W / 2, H * 0.44 + 44);
    ctx.font = "13px 'Press Start 2P', monospace";
    ctx.fillStyle = "#9be8ff";
    ctx.fillText("TAP TO PASS - FIRST TO 10", W / 2, H * 0.44 + 84);
    ctx.textAlign = "left";
    bigButton("PLAY");
  }

  function drawWin() {
    ctx.fillStyle = "rgba(4,8,18,0.66)";
    ctx.fillRect(0, 0, W, H);
    const blueWon = winner === "blue";
    ctx.fillStyle = blueWon ? "#4db2ff" : "#ff6b6b";
    ctx.font = "34px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText(blueWon ? "BLUE WINS!" : "RED WINS!", W / 2, H * 0.34);
    ctx.font = "20px 'Press Start 2P', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(blueScore + " - " + redScore, W / 2, H * 0.34 + 52);
    if (!blueWon) {
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.fillStyle = "#9be8ff";
      ctx.fillText("GOOD GAME - RUN IT BACK!", W / 2, H * 0.34 + 88);
    }
    ctx.textAlign = "left";
    bigButton("PLAY AGAIN");
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
      const k = clamp(r.t / r.life, 0, 1);
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,65%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 80, 0, 6.2832);
      ctx.stroke();
    }
  }

  function render() {
    drawCourt();
    drawBasket(basketTop, false);
    drawBasket(basketBottom, true);
    for (const p of players) drawPlayer(p);
    drawBall();
    drawParts();
    drawScoreboard();
    if (state === "title") drawTitle();
    else if (state === "win") drawWin();
    else if (state === "celebrate") {
      // flash the scorer's basket
      const b = scoredBy === "blue" ? basketTop : basketBottom;
      const a = 0.35 + 0.3 * Math.sin(time * 18);
      ctx.strokeStyle = "rgba(255,225,77," + a.toFixed(2) + ")";
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, 34, 0, 6.2832); ctx.stroke();
    }
  }

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
  // pre-scatter players so the title screen is alive
  for (let i = 0; i < CFG.BLUE_COUNT; i++) {
    const p = spawnPlayer("blue", false);
    p.y = rnd(0, H);
  }
  for (let i = 0; i < CFG.RED_COUNT; i++) {
    const p = spawnPlayer("red", false);
    p.y = rnd(0, H);
  }
  requestAnimationFrame(frame);

  /* Read-only test hook. */
  window.__frenzyTest = {
    get state() { return state; },
    get blueScore() { return blueScore; },
    get redScore() { return redScore; },
    get players() { return players.length; },
    get ballMode() { return ball.mode; },
    get cfg() { return CFG; },
    tap: function (x, y) { onTap(x, y); },
    start: function () { startGame(); },
    step: function (dt) { tick(dt || 0.016); },
    forceScore: function (team, pts) { // test-only: jump the scoreboard
      if (team === "blue") blueScore = pts; else redScore = pts;
      scoreBasket(team);
    },
  };
})();
