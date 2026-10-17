/* ============================================================
   TAG! YOU'RE IT — SmoothDaddyG (game #18)
   Playground tag. YOU are IT — you wear the big bouncing star
   badge. Drag anywhere and your kid runs toward your finger.
   Five cute kids wander the grass slowly, giggling and
   dawdling — they never run away fast and never tag back.
   Touch a kid to TAG them: star burst, happy giggle, and they
   sit down smiling with a little star. Fill all 5 star slots
   at the top for the BIG celebration finale.
   ONE interaction: drag anywhere. No timer, no fail state,
   no score — tapping or dragging wrongly does nothing bad.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- tuning (all gameplay numbers live here) ---------------- */
  const CFG = {
    KID_COUNT: 5,       // friends to tag
    PLAYER_SPEED: 260,  // your kid runs toward your finger, px/s
    KID_SPEED_MIN: 60,  // friends dawdle — always slower than you
    KID_SPEED_MAX: 90,
    KID_TURN_MIN: 2,    // friends change direction every 2-4 s
    KID_TURN_MAX: 4,
    TAG_R: 70,          // generous tag radius — be kind
    KID_R: 34,          // kid body size (px) — BIG, Fisher-Price chunky
    EDGE_M: 70,         // everyone stays this far inside the field
    STAR_SLOTS: 5,      // star slots at the top (visual progress)
  };

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0;

  // state: 'title' | 'play' | 'win'
  let state = "title";

  // the tagger: {x, y, angle, phase, target:{x,y}|null}
  // drag anywhere and the kid runs toward your finger
  let player = null;

  // friends: {x, y, angle, speed, turnT, tagged, phase, color, skin, sitT}
  // they wander slowly, never run away fast, never tag back
  let kids = [];

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
  function sndWin() {
    // big surprise-finale fanfare
    audio.arp([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.11, "square", 0.12);
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
        y = rnd(CFG.EDGE_M + 90, H - CFG.EDGE_M); // clear of the star slots
        tries++;
      } while (dist(x, y, W / 2, H / 2) < 170 && tries < 20);
      kids.push({
        x: x, y: y,
        angle: rnd(0, 6.283),
        speed: rnd(CFG.KID_SPEED_MIN, CFG.KID_SPEED_MAX),
        turnT: rnd(CFG.KID_TURN_MIN, CFG.KID_TURN_MAX),
        tagged: false,
        phase: rnd(0, 6.283),
        color: KID_COLORS[i % KID_COLORS.length],
        skin: SKINS[i % SKINS.length],
        sitT: 0,
      });
    }
  }

  function taggedCount() {
    let n = 0;
    for (const k of kids) if (k.tagged) n++;
    return n;
  }

  function startGame() {
    parts = []; rings = []; confetti = [];
    resetPlayer();
    resetKids();
    state = "play";
    if (window.SDGplays) window.SDGplays.played("tag");
    sndGo();
  }

  function winGame() {
    state = "win";
    sndWin();
    confettiBlast(W / 2, H * 0.4, 130);
  }

  /* ---------------- tagging ---------------- */
  function doTag(kid) {
    kid.tagged = true;
    kid.sitT = 0;
    burst(kid.x, kid.y - 30, 45, 26, 300);
    rings.push({ x: kid.x, y: kid.y - 20, r: 22, t: 0, life: 0.55, hue: 45 });
    sndTag();
    if (taggedCount() >= CFG.KID_COUNT) winGame();
  }

  /* ---------------- input: drag anywhere ---------------- */
  function setTarget(x, y) {
    target = { x: clamp(x, CFG.EDGE_M * 0.4, W - CFG.EDGE_M * 0.4),
               y: clamp(y, CFG.EDGE_M * 0.4, H - CFG.EDGE_M * 0.4) };
  }

  function onDown(x, y) {
    if (audio.unlock) audio.unlock();
    if (state === "title") { startGame(); return; }
    if (state === "win") {
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
    const d = dist(player.x, player.y, target.x, target.y);
    if (d < 4) { target = null; return; } // arrived — happy stop
    const step = Math.min(d, CFG.PLAYER_SPEED * dt);
    player.angle = Math.atan2(target.y - player.y, target.x - player.x);
    player.x += (target.x - player.x) / d * step;
    player.y += (target.y - player.y) / d * step;
    player.x = clamp(player.x, 20, W - 20);
    player.y = clamp(player.y, 20, H - 20);
  }

  function tickKids(dt) {
    for (const k of kids) {
      k.phase += dt * (3 + k.speed * 0.03);
      if (k.tagged) { k.sitT += dt; continue; } // tagged friends sit out, smiling
      k.turnT -= dt;
      if (k.turnT <= 0) {
        // dawdle off in a new direction — never a sprint, never at you
        k.angle = rnd(0, 6.283);
        k.turnT = rnd(CFG.KID_TURN_MIN, CFG.KID_TURN_MAX);
      }
      k.x += Math.cos(k.angle) * k.speed * dt;
      k.y += Math.sin(k.angle) * k.speed * dt;
      // soft bounce off the field edges — always stay in bounds
      const m = CFG.EDGE_M;
      if (k.x < m) { k.x = m; k.angle = Math.PI - k.angle; }
      if (k.x > W - m) { k.x = W - m; k.angle = Math.PI - k.angle; }
      if (k.y < m) { k.y = m; k.angle = -k.angle; }
      if (k.y > H - m) { k.y = H - m; k.angle = -k.angle; }
    }
  }

  function tickTags() {
    for (const k of kids) {
      if (!k.tagged && dist(player.x, player.y, k.x, k.y) < CFG.TAG_R) {
        doTag(k);
        if (state !== "play") return; // win stops further tagging
      }
    }
  }

  function tick(dt) {
    time += dt;

    if (state === "play") {
      tickPlayer(dt);
      tickKids(dt);
      tickTags();
    } else if (state === "win") {
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
    drawPlayground();
  }

  // simple slide + swing set in the background (flat, muted — scenery only)
  function drawPlayground() {
    const sx = W - 150, sy = 150;
    ctx.save();
    ctx.globalAlpha = 0.55;
    // swing set: A-frame + two swings
    ctx.strokeStyle = "#7a5c3e"; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx - 70, sy + 60); ctx.lineTo(sx - 45, sy - 60);
    ctx.moveTo(sx + 70, sy + 60); ctx.lineTo(sx + 45, sy - 60);
    ctx.moveTo(sx - 45, sy - 60); ctx.lineTo(sx + 45, sy - 60);
    ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = "#5d4630";
    for (const off of [-20, 20]) {
      ctx.beginPath();
      ctx.moveTo(sx + off, sy - 58); ctx.lineTo(sx + off, sy - 10);
      ctx.stroke();
      ctx.fillStyle = "#8a6a48";
      ctx.fillRect(sx + off - 14, sy - 10, 28, 8);
    }
    // slide: ladder + chute
    const lx = 120, ly = 170;
    ctx.lineWidth = 8; ctx.strokeStyle = "#7a5c3e";
    ctx.beginPath();
    ctx.moveTo(lx - 30, ly + 50); ctx.lineTo(lx - 30, ly - 40);
    ctx.moveTo(lx + 30, ly + 50); ctx.lineTo(lx + 30, ly - 40);
    ctx.stroke();
    ctx.fillStyle = "#c9563c";
    ctx.beginPath();
    ctx.moveTo(lx + 30, ly - 40);
    ctx.lineTo(lx + 110, ly + 50);
    ctx.lineTo(lx + 80, ly + 50);
    ctx.lineTo(lx, ly - 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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
    // THE star badge: big, bouncing, impossible to miss
    const starBounce = Math.abs(Math.sin(player.phase * 1.3)) * 7;
    ctx.save();
    ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 22;
    drawStar(0, -r * 1.55 - starBounce, 26, "#ffe45e", Math.sin(time * 2) * 0.15);
    ctx.restore();
    ctx.restore();
  }

  function drawFriend(k) {
    if (k.tagged) {
      // tagged: sitting down, smiling, little star overhead
      const bob = Math.abs(Math.sin(k.sitT * 3)) * 4;
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.scale(1.15, 0.82); // sitting squish
      ctx.fillStyle = "rgba(20,60,25,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, CFG.KID_R * 1.0, CFG.KID_R * 0.9, CFG.KID_R * 0.26, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = k.color;
      ctx.beginPath(); ctx.arc(0, CFG.KID_R * 0.5, CFG.KID_R * 0.72, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(40,20,5,0.4)"; ctx.stroke();
      drawKidFace(0, -CFG.KID_R * 0.25, CFG.KID_R * 0.62, k.skin);
      ctx.restore();
      drawStar(k.x, k.y - CFG.KID_R * 1.35 - bob, 15, "#ffe45e", Math.sin(time * 3 + k.phase) * 0.2);
      return;
    }
    const bounce = Math.abs(Math.sin(k.phase)) * 7;
    // giggle wiggle while wandering
    const wig = Math.sin(k.phase * 2) * 0.06;
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(wig);
    ctx.translate(-k.x, -k.y);
    drawKidBody(k, -bounce);
    ctx.restore();
  }

  /* ---------------- drawing: HUD (star slots — visual progress, no numbers) ---------------- */
  function drawSlots() {
    const n = CFG.STAR_SLOTS;
    const r = 20, gap = 56;
    const totalW = (n - 1) * gap;
    const y = 46;
    let x0 = W / 2 - totalW / 2;
    // keep clear of the 84px back button (top-left)
    if (x0 - r < 120) x0 = 120 + r;
    const got = taggedCount();
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap;
      if (i < got) {
        ctx.save();
        ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 14;
        drawStar(x, y, r, "#ffe45e", Math.sin(time * 3 + i) * 0.12);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(10,40,20,0.45)";
        ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 6.2832); ctx.fill();
        drawStar(x, y, r, null);
      }
    }
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

  function drawWin() {
    ctx.fillStyle = "rgba(10,40,25,0.30)";
    ctx.fillRect(0, 0, W, H);
    // star shower badge
    ctx.save();
    ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 40;
    drawStar(W / 2, H * 0.2 - Math.abs(Math.sin(time * 3)) * 14, 46,
             "#ffe45e", Math.sin(time * 2.2) * 0.15);
    ctx.restore();
    drawTriangleButton(againBtn, "#ffd23f");
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
    if (state === "win") {
      // celebration: everyone jumps and cheers
      const jb = Math.abs(Math.sin(time * 6)) * 22;
      ctx.save();
      ctx.translate(0, -jb);
      drawPlayer();
      ctx.restore();
      for (const k of kids) {
        const kj = Math.abs(Math.sin(time * 6 + k.phase)) * 22;
        ctx.save();
        ctx.translate(0, -kj);
        // tagged friends pop back up to cheer
        const wasTagged = k.tagged;
        k.tagged = false;
        drawFriend(k);
        k.tagged = wasTagged;
        ctx.restore();
      }
    } else {
      if (player) drawPlayer();
      for (const k of kids) drawFriend(k);
    }
    drawParts();
    if (state !== "title") drawSlots();
    if (state === "title") drawTitle();
    else if (state === "win") drawWin();
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
    if (player) {
      player.x = clamp(player.x, 20, W - 20);
      player.y = clamp(player.y, 20, H - 20);
    }
    for (const k of kids) {
      k.x = clamp(k.x, CFG.EDGE_M, W - CFG.EDGE_M);
      k.y = clamp(k.y, CFG.EDGE_M, H - CFG.EDGE_M);
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
    get tagged() { return taggedCount(); },
    debug: {
      player: function () { return player; },
      kids: function () { return kids; },
      target: function () { return target; },
      // drag to (x, y) exactly like a finger drag (tests only)
      drag: function (x, y) {
        if (state !== "play") startGame();
        dragging = true;
        setTarget(x, y);
      },
      release: function () { onUp(); },
      // tag kid i directly (tests only)
      forceTag: function (i) {
        if (state !== "play") startGame();
        doTag(kids[i]);
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
