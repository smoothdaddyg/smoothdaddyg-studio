/* ============================================================
   UNICORN JOUST — SmoothDaddyG
   ------------------------------------------------------------
   Danny's 2026-11-06 call: "make the game joust. Make some
   unicorns or weird stuff though. Simple and five levels.
   U know the drill."

   Classic Joust, the literal rule: whoever is HIGHER wins
   the joust. You ride a unicorn; the other riders ride
   weird stuff — flying pigs, a dragon, robot chickens, a
   space llama, and (L5) the Grand Dragon. Tap FLAP to fly
   up, gravity pulls you down. Meet a rider from ABOVE and
   they get unseated in a burst of stars. Meet one from
   BELOW and YOU get knocked off — a brief pause, then a
   respawn with all progress intact. Near-equal height?
   You both bounce off each other. No game over, ever.

   ONE OBVIOUS INTERACTION: FLAP. One big FLAP button on
   EACH end of the bottom deck (mirrored — either hand),
   tap or hold. The unicorn flies forward by itself and
   wraps around the screen, so flap timing is the whole
   game. Field touches do NOTHING during play.
   Controls live in their own deck at the bottom; the sky
   sits entirely above it. 84px back button, top corner.

   NO READING: pictures, colours and sound only. Stars
   are the reward — fly through rainbow stars to collect
   them, unseat riders to earn more. 5 short levels,
   each one crazier (escalation rule): L1 pigs, L2 + a
   diving dragon, L3 + robot chickens and a golden star,
   L4 + space llamas and wind gusts, L5 the Grand Dragon
   plus everything. Clear L5 for the big finale.
   MUSIC: an original gallop chiptune loop composed here
   (square lead, triangle bass at vol 0.2, noise drums,
   a harmony voice) — its own melody, never a re-skin.
   ============================================================ */
"use strict";
(function () {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  /* ---------------- config ---------------- */
  const CFG = {
    PLAYER_R: 26, PLAYER_SPEED: 150, // px/s forward, wraps
    GRAV: 620, FLAP_V: -330, FLAP_CD: 0.14, FLAP_R: 54,
    HEARTS_MAX: 5, RESPAWN_T: 1.2, CELEB_T: 2.2,
    WIN_MARGIN: 8, // how much higher the winner must be
  };
  // Rider mounts per level. kind: pig | dragon | chicken | llama | grand.
  // dir: 1 flies right, -1 flies left. speed px/s, bob px, dive: chases
  // the player's height, zig: zig-zag, hp: hits to unseat (grand only).
  const LEVELS = [
    { riders: [ { kind: "pig", dir: -1, speed: 70, bob: 26 },
                { kind: "pig", dir: 1, speed: 80, bob: 34 },
                { kind: "pig", dir: -1, speed: 90, bob: 22 } ],
      stars: 5, wind: 0 },
    { riders: [ { kind: "pig", dir: -1, speed: 85, bob: 30 },
                { kind: "pig", dir: 1, speed: 95, bob: 26 },
                { kind: "pig", dir: -1, speed: 100, bob: 36 },
                { kind: "dragon", dir: 1, speed: 120, bob: 40, dive: true } ],
      stars: 5, wind: 0 },
    { riders: [ { kind: "pig", dir: 1, speed: 100, bob: 30 },
                { kind: "pig", dir: -1, speed: 110, bob: 34 },
                { kind: "chicken", dir: -1, speed: 150, bob: 52 },
                { kind: "chicken", dir: 1, speed: 160, bob: 46 } ],
      stars: 5, golden: true, wind: 0 },
    { riders: [ { kind: "dragon", dir: -1, speed: 135, bob: 44, dive: true },
                { kind: "dragon", dir: 1, speed: 145, bob: 40, dive: true },
                { kind: "llama", dir: 1, speed: 120, bob: 30, zig: true },
                { kind: "llama", dir: -1, speed: 130, bob: 36, zig: true } ],
      stars: 5, golden: true, wind: 1 },
    { riders: [ { kind: "grand", dir: -1, speed: 110, bob: 44, dive: true, hp: 3 },
                { kind: "pig", dir: 1, speed: 120, bob: 30 },
                { kind: "dragon", dir: 1, speed: 155, bob: 44, dive: true },
                { kind: "llama", dir: -1, speed: 140, bob: 34, zig: true } ],
      stars: 5, golden: true, wind: 1 },
  ];
  const RIDER_R = { pig: 24, dragon: 26, chicken: 22, llama: 25, grand: 44 };

  /* ---------------- helpers ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /* ---------------- audio ---------------- */
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  function sndFlap() { noiseS(0.08, { filter: "bandpass", freq: 900, vol: 0.06 }); tone(300, 0.08, { type: "triangle", vol: 0.05, slideTo: 500 }); }
  function sndUnseat() { arp([523, 659, 784, 1046], 0.06, "square", 0.10); noiseS(0.25, { filter: "highpass", freq: 2000, vol: 0.08 }); }
  function sndKnock() { tone(320, 0.3, { type: "sawtooth", vol: 0.12, slideTo: 80 }); noiseS(0.2, { filter: "lowpass", freq: 800, vol: 0.12 }); }
  function sndBounce() { tone(220, 0.12, { type: "sine", vol: 0.12, slideTo: 440 }); }
  function sndStar() { arp([1046, 1318], 0.05, "square", 0.09); }
  function sndGold() { arp([784, 988, 1175, 1568], 0.06, "square", 0.10); }
  function sndRespawn() { arp([392, 523, 659, 784], 0.07, "square", 0.10); }
  function sndFanfare() { arp([523, 659, 784, 1046, 784, 1046, 1318], 0.11, "square", 0.10); }
  function sndFinale() { arp([523, 659, 784, 1046, 1318, 1568, 2093, 2637], 0.12, "square", 0.11); noiseS(0.9, { filter: "highpass", freq: 3000, vol: 0.05, when: 0.3 }); }

  /* ---------------- background music ----------------
     An ORIGINAL gallop loop, composed here for Unicorn
     Joust: a bouncy C-major ride — short singable phrase
     with a variation at the end, rests that breathe, and
     a harmony voice a third under the lead (the NES second
     pulse channel). Bouncy bass (root, then a walk up),
     funk kicks + snare on 2 and 4. 64 sixteenth steps at
     140 BPM, bass LOUD at 0.2. */
  const C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196, A3 = 220, B3 = 246.94;
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5, E4 = 329.63, G4 = 392;
  const MUSIC_CFG = {
    bpm: 140, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 8, 16, 24, 32, 40, 48, 56, 62], snares: [4, 12, 20, 28, 36, 44, 52, 60], hats: "odd",
    bass: [C3,0,0,0, G3,0,0,0, C3,0,0,0, G3,0,C3,0,
           F3,0,0,0, C3,0,0,0, F3,0,0,0, C3,0,G3,0,
           C3,0,0,0, G3,0,0,0, C3,0,0,0, E3,0,F3,0,
           G3,0,0,0, G3,0,0,0, C3,0,0,0, G3,0,0,0],
    lead: [C5,0,E5,0, G5,0,E5,0, C5,0,0,0, E5,0,G5,0,
           A5,0,G5,0, F5,0,E5,0, D5,0,0,0, E5,0,0,0,
           C5,0,E5,0, G5,0,0,0, A5,0,G5,0, F5,0,E5,0,
           D5,0,E5,0, F5,0,G5,0, E5,0,0,0, C6,0,0,0],
    harmony: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
              0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
              0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
              0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  };
  // Harmony: a third under the lead wherever the lead sings.
  (function () {
    const third = {}; third[C5] = 415.3; third[D5] = 466.16; third[E5] = 523.25;
    third[F5] = 587.33; third[G5] = 659.25; third[A5] = 783.99; third[B5] = 880;
    third[C6] = 987.77; third[E4] = 261.63; third[G4] = 329.63;
    for (let i = 0; i < 64; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }

  /* ---------------- layout ---------------- */
  let W = 400, H = 700, DPR = 1, DECK_H = 190, PH = 510;
  let deckTop = 510, flapL = { x: 74, y: 0 }, flapR = { x: 326, y: 0 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.26, 170, 210));
    PH = H - DECK_H; deckTop = PH;
    flapL = { x: 74, y: deckTop + DECK_H / 2 };
    flapR = { x: W - 74, y: deckTop + DECK_H / 2 };
  }
  window.addEventListener("resize", resize);

  /* ---------------- state ---------------- */
  let state = "title"; // title | play | dead | levelup | win
  let level = 1, hearts = CFG.HEARTS_MAX, stars = 0;
  let time = 0, deadT = 0, celebT = 0, flapCd = 0, wingT = 0;
  let windT = 0, windDir = 0, windAmt = 0;
  let riders = [], starPickups = [], parts = [], clouds = [];
  const player = { x: 80, y: 200, vy: 0, invuln: 0 };

  function makeClouds() {
    clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({ x: rnd(0, 400), y: rnd(30, 320), s: rnd(0.6, 1.4), v: rnd(6, 16) });
    }
  }
  function startLevel(n) {
    const L = LEVELS[n - 1];
    riders = L.riders.map((r, i) => ({
      kind: r.kind, dir: r.dir, speed: r.speed, bob: r.bob,
      dive: !!r.dive, zig: !!r.zig, hp: r.hp || 1, maxHp: r.hp || 1,
      x: (i % 2 ? W * 0.75 : W * 0.25) + rnd(-40, 40),
      y: 90 + i * 70 + rnd(-20, 20),
      baseY: 90 + i * 70, phase: rnd(0, 6.28), alive: true, vy: 0,
    }));
    starPickups = [];
    for (let i = 0; i < L.stars; i++) {
      starPickups.push({ x: 60 + i * (W - 120) / Math.max(1, L.stars - 1) + rnd(-20, 20),
        y: rnd(70, PH - 90), gold: false, taken: false, phase: rnd(0, 6.28) });
    }
    if (L.golden) starPickups.push({ x: W / 2, y: 70, gold: true, taken: false, phase: 0 });
    windT = 0; windDir = 0; windAmt = 0;
    player.x = 80; player.y = PH * 0.4; player.vy = 0; player.invuln = 1.5;
    flapCd = 0;
    if (!clouds.length) makeClouds();
  }
  function startGame() {
    level = 1; hearts = CFG.HEARTS_MAX; stars = 0;
    startLevel(1); state = "play";
    if (MUSIC) MUSIC.start();
    if (window.SDGplays) window.SDGplays.played("unicornjoust");
  }

  /* ---------------- input: the bottom deck ----------------
     FLAP circles are checked first so a finger landing on one
     never does anything else. Field touches are ignored during
     play. Multi-touch: any number of FLAP pointers, tracked by
     pointerId. A tap that starts the game also engages FLAP for
     that same finger, so the unicorn lifts off immediately. */
  const flapIds = new Set();
  let testFlap = false; // test hook only
  function inFlap(x, y) {
    return dist(x, y, flapL.x, flapL.y) <= CFG.FLAP_R + 6 || dist(x, y, flapR.x, flapR.y) <= CFG.FLAP_R + 6;
  }
  function onDown(x, y, id) {
    if (state === "title") startGame();
    else if (state === "win" && celebT > 1.5) startGame();
    if (state !== "play") return;
    if (inFlap(x, y)) { flapIds.add(id); return; }
    // Field touches: deliberately ignored — the deck is the control.
  }
  function onUp(id) { flapIds.delete(id); }
  function ptrPos(e) {
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) || e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); const p = ptrPos(e); onDown(p.x, p.y, e.pointerId); });
  canvas.addEventListener("pointermove", function (e) { e.preventDefault(); });
  canvas.addEventListener("pointerup", function (e) { e.preventDefault(); onUp(e.pointerId); });
  canvas.addEventListener("pointercancel", function (e) { e.preventDefault(); onUp(e.pointerId); });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < (n || 12); i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(0.5, speed || 3);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s * 60, vy: Math.sin(a) * s * 60, t: 0, life: rnd(0.4, 0.8), color: color, size: rnd(3, 7) });
    }
  }
  function flap() {
    player.vy = CFG.FLAP_V;
    wingT = 0.25;
    sndFlap();
  }
  function knockOff(r) {
    hearts -= 1;
    burst(player.x, player.y, "#ff3b30", 16, 4);
    sndKnock();
    if (hearts <= 0) {
      // No game over, ever: hearts refill, progress stays.
      hearts = CFG.HEARTS_MAX;
    }
    state = "dead"; deadT = 0;
  }
  function tickPlayer(dt) {
    flapCd -= dt;
    if ((flapIds.size > 0 || testFlap) && flapCd <= 0) { flap(); flapCd = CFG.FLAP_CD; }
    if (wingT > 0) wingT -= dt;
    player.vy += CFG.GRAV * dt;
    if (windAmt) player.vy += windAmt * dt * 0.6;
    player.vy = clamp(player.vy, -420, 420);
    player.y += player.vy * dt;
    player.x += CFG.PLAYER_SPEED * dt;
    if (player.x > W + 40) player.x = -40;
    // Soft cloud floor: landing bounces you back up gently.
    if (player.y > PH - 34) { player.y = PH - 34; player.vy = -140; }
    if (player.y < 30) { player.y = 30; player.vy = 60; }
    if (player.invuln > 0) player.invuln -= dt;
    // Rainbow stars: fly through to collect.
    for (const s of starPickups) {
      if (s.taken) continue;
      if (dist(player.x, player.y, s.x, s.y) < CFG.PLAYER_R + 16) {
        s.taken = true;
        stars += s.gold ? 3 : 1;
        burst(s.x, s.y, s.gold ? "#ffe14d" : "#ff3df0", 14, 3);
        if (s.gold) sndGold(); else sndStar();
      }
    }
  }
  function tickRiders(dt) {
    const speedMul = 1 + (level - 1) * 0.08;
    for (const r of riders) {
      if (!r.alive) continue;
      r.phase += dt;
      r.x += r.dir * r.speed * speedMul * dt;
      if (r.x > W + 50) r.x = -50;
      if (r.x < -50) r.x = W + 50;
      // Bobbing: each mount bobs at its own height and rhythm.
      let targetY = r.baseY + Math.sin(r.phase * 2) * r.bob;
      if (r.zig) targetY = r.baseY + Math.sin(r.phase * 4) * r.bob;
      if (r.dive && state === "play") {
        // Dragons dive toward the player's height, then pull up.
        targetY = player.y + Math.sin(r.phase * 2) * 20;
      }
      r.y += (targetY - r.y) * Math.min(1, dt * 2.2);
      // Joust! Whoever is HIGHER wins. Near-equal: bounce apart.
      if (state === "play" && player.invuln <= 0) {
        const d = dist(player.x, player.y, r.x, r.y);
        if (d < CFG.PLAYER_R + RIDER_R[r.kind]) {
          if (player.y < r.y - CFG.WIN_MARGIN) {
            // Player above: rider unseated!
            r.hp -= 1;
            if (r.hp <= 0) {
              r.alive = false;
              stars += 1;
              burst(r.x, r.y, "#ffe14d", 24, 4);
              burst(r.x, r.y, "#ff3df0", 14, 3);
              sndUnseat();
            } else {
              burst(r.x, r.y, "#ff9f2e", 12, 3);
              sndBounce();
              r.y += 30; // Grand Dragon shudders down a step
            }
          } else if (r.y < player.y - CFG.WIN_MARGIN) {
            knockOff(r);
          } else {
            // Dead level: both bounce off, no harm.
            player.vy = -220; r.y += 26;
            sndBounce();
            burst((player.x + r.x) / 2, (player.y + r.y) / 2, "#ffffff", 8, 2);
          }
        }
      }
    }
    // Level clear: every rider unseated.
    if (state === "play" && riders.length && riders.every((r) => !r.alive)) {
      state = "levelup"; celebT = 0; sndFanfare();
      burst(W / 2, PH / 2, "#ffe14d", 40, 5);
    }
  }
  function tick(dt) {
    time += dt;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > W + 80) { c.x = -80; c.y = rnd(30, 320); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) parts.splice(i, 1);
    }
    // Wind gusts (L4+): push the unicorn up or down, telegraphed.
    if (LEVELS[level - 1].wind) {
      windT += dt;
      if (windT > 4) {
        windT = 0;
        windDir = windDir === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        windAmt = windDir * 260;
      }
    }
    if (state === "play") { tickPlayer(dt); tickRiders(dt); }
    else if (state === "dead") {
      deadT += dt;
      if (deadT >= CFG.RESPAWN_T) {
        player.x = 80; player.y = PH * 0.4; player.vy = 0; player.invuln = 1.5;
        sndRespawn(); state = "play";
      }
    } else if (state === "levelup") {
      celebT += dt;
      if (Math.random() < dt * 8) parts.push({ x: rnd(20, W - 20), y: rnd(20, 120), vx: rnd(-30, 30), vy: rnd(60, 150), t: 0, life: rnd(0.8, 1.4), color: ["#ffe14d", "#29faff", "#ff3df0", "#3dff7a"][Math.floor(rnd(0, 4))], size: rnd(4, 8) });
      if (celebT >= CFG.CELEB_T) {
        if (level >= 5) { state = "win"; celebT = 0; sndFinale(); }
        else { level++; startLevel(level); state = "play"; }
      }
    } else if (state === "win") {
      celebT += dt;
      if (Math.random() < dt * 10) parts.push({ x: rnd(20, W - 20), y: rnd(20, 120), vx: rnd(-30, 30), vy: rnd(60, 150), t: 0, life: rnd(0.8, 1.4), color: ["#ffe14d", "#29faff", "#ff3df0", "#3dff7a"][Math.floor(rnd(0, 4))], size: rnd(4, 8) });
    }
  }

  /* ---------------- render ---------------- */
  function drawHeart(cx, cy, s, filled) {
    ctx.fillStyle = filled ? "#ff3b30" : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.2, cy, cx - s * 0.6, cy - s * 0.9, cx, cy - s * 0.3);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 0.9, cx + s * 1.2, cy, cx, cy + s * 0.9);
    ctx.fill();
  }
  function drawStar(cx, cy, r, color, rot) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (rot || -Math.PI / 2) + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  // The player unicorn, facing right, wings mid-flap.
  function drawUnicorn(cx, cy, s, flap) {
    const bob = Math.sin(time * 6) * 2;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(s / 26, s / 26);
    // Wing: flaps up right after a flap, settles back down.
    const wa = flap > 0 ? -0.9 : -0.2;
    ctx.fillStyle = "#ffffff";
    ctx.save();
    ctx.translate(-2, -8); ctx.rotate(wa);
    ctx.beginPath(); ctx.ellipse(-8, -6, 16, 7, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Tail: rainbow ribbons.
    const tailCols = ["#ff3b30", "#ffe14d", "#3dff7a", "#29faff", "#ff3df0"];
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = tailCols[i];
      ctx.beginPath(); ctx.moveTo(-20, -2 + i * 2);
      ctx.quadraticCurveTo(-32, 2 + i * 3, -26, 12 + i * 2); ctx.stroke();
    }
    // Legs, tucked back in flight.
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-12, 8); ctx.lineTo(-20, 16); ctx.moveTo(-4, 10); ctx.lineTo(-10, 18);
    ctx.moveTo(8, 10); ctx.lineTo(4, 18); ctx.moveTo(14, 8); ctx.lineTo(10, 16);
    ctx.stroke();
    // Body.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 13, 0, 0, Math.PI * 2); ctx.fill();
    // Neck + head.
    ctx.beginPath(); ctx.ellipse(18, -12, 9, 13, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(26, -22, 11, 7, 0.4, 0, Math.PI * 2); ctx.fill();
    // Horn: gold.
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.moveTo(28, -30); ctx.lineTo(38, -44); ctx.lineTo(34, -27); ctx.closePath(); ctx.fill();
    // Mane: rainbow arcs down the neck.
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = tailCols[i]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(14 - i * 2, -14 + i * 2, 10 - i, 0.6, 2.6); ctx.stroke();
    }
    // Eye.
    ctx.fillStyle = "#0a0a13";
    ctx.beginPath(); ctx.arc(28, -24, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Weird mounts. Each is drawn facing its flight direction.
  function drawRider(r) {
    const cx = r.x, cy = r.y, s = RIDER_R[r.kind] / 24;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(r.dir * s, s);
    if (r.kind === "pig") {
      ctx.fillStyle = "#ffb3d9";
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(22, -2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff8fc7";
      ctx.beginPath(); ctx.ellipse(30, 0, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(-6, -14, 10, 5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2, -15, 10, 5, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ff8fc7"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-24, 0, 5, 0, 4.5); ctx.stroke();
      ctx.fillStyle = "#0a0a13"; ctx.beginPath(); ctx.arc(24, -4, 2, 0, Math.PI * 2); ctx.fill();
    } else if (r.kind === "dragon") {
      ctx.fillStyle = "#3ddc5f";
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(18, -10, 8, 11, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(26, -18, 10, 6, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.moveTo(22, -24); ctx.lineTo(26, -32); ctx.lineTo(28, -23); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2bb84a";
      ctx.save(); ctx.translate(-4, -8); ctx.rotate(Math.sin(time * 8 + r.phase) * 0.5 - 0.4);
      ctx.beginPath(); ctx.ellipse(-8, -8, 15, 6, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "#2bb84a"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-34, 6, -30, 14); ctx.stroke();
      ctx.fillStyle = "#0a0a13"; ctx.beginPath(); ctx.arc(28, -20, 2, 0, Math.PI * 2); ctx.fill();
    } else if (r.kind === "chicken") {
      ctx.fillStyle = "#e8e8e8";
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(18, -6, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff9f2e";
      ctx.beginPath(); ctx.moveTo(26, -8); ctx.lineTo(34, -4); ctx.lineTo(26, -1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath(); ctx.arc(16, -14, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a8a9e"; ctx.lineWidth = 3;
      const pa = time * 20 + r.phase;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(Math.cos(pa) * 14, -14 + Math.sin(pa) * 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-Math.cos(pa) * 14, -14 - Math.sin(pa) * 4); ctx.stroke();
      ctx.fillStyle = "#0a0a13"; ctx.beginPath(); ctx.arc(20, -8, 2, 0, Math.PI * 2); ctx.fill();
    } else if (r.kind === "llama") {
      ctx.fillStyle = "#c86bff";
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(16, -14, 7, 14, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(22, -26, 10, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#29faff";
      ctx.beginPath(); ctx.arc(20, -28, 7, Math.PI, 0); ctx.fill();
      ctx.fillRect(13, -28, 14, 3);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(-4, -12, 9, 5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0a0a13"; ctx.beginPath(); ctx.arc(25, -27, 2, 0, Math.PI * 2); ctx.fill();
    } else { // grand dragon
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath(); ctx.ellipse(0, 0, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, -16, 13, 18, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(44, -30, 16, 10, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.moveTo(38, -40); ctx.lineTo(44, -54); ctx.lineTo(48, -38); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(50, -42); ctx.lineTo(58, -54); ctx.lineTo(58, -38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#c81e1e";
      ctx.save(); ctx.translate(-6, -12); ctx.rotate(Math.sin(time * 6 + r.phase) * 0.4 - 0.4);
      ctx.beginPath(); ctx.ellipse(-14, -12, 24, 10, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "#c81e1e"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-36, 0); ctx.quadraticCurveTo(-58, 10, -50, 26); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(56, -26); ctx.lineTo(62, -20); ctx.lineTo(56, -18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0a0a13"; ctx.beginPath(); ctx.arc(47, -32, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // The rider: a tiny helmeted dot on top, so it reads as a JOUST.
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.arc(cx - 2 * r.dir, cy - RIDER_R[r.kind] * 0.75, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0a13";
    ctx.beginPath(); ctx.arc(cx - 2 * r.dir + 2 * r.dir, cy - RIDER_R[r.kind] * 0.75 - 1, 2.5, 0, Math.PI * 2); ctx.fill();
    // Grand Dragon health bar (hits left, pictorial).
    if (r.kind === "grand" && r.alive) {
      for (let i = 0; i < r.maxHp; i++) {
        ctx.fillStyle = i < r.hp ? "#ffe14d" : "rgba(255,255,255,0.25)";
        ctx.beginPath(); ctx.arc(cx - 16 + i * 16, cy - RIDER_R.grand - 16, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    // Sky: three bands, day blue to horizon peach.
    ctx.fillStyle = "#6ec1ff"; ctx.fillRect(0, 0, W, PH * 0.55);
    ctx.fillStyle = "#a8dcff"; ctx.fillRect(0, PH * 0.55, W, PH * 0.3);
    ctx.fillStyle = "#ffe9c9"; ctx.fillRect(0, PH * 0.85, W, PH * 0.15);
    // Sun.
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.arc(W - 56, 56, 26, 0, Math.PI * 2); ctx.fill();
    // Drifting clouds.
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const c of clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 34 * c.s, 14 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 22 * c.s, c.y + 4, 24 * c.s, 11 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 22 * c.s, c.y + 5, 20 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cloud floor at the bottom of the playfield.
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (let x = -20; x < W + 20; x += 56) {
      ctx.beginPath(); ctx.ellipse(x, PH - 8, 34, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Rainbow stars to collect.
    const starCols = ["#ff3b30", "#ff9f2e", "#ffe14d", "#3dff7a", "#29faff", "#ff3df0"];
    for (let i = 0; i < starPickups.length; i++) {
      const s = starPickups[i];
      if (s.taken) continue;
      const bob = Math.sin(time * 3 + s.phase) * 5;
      drawStar(s.x, s.y + bob, s.gold ? 18 : 13, s.gold ? "#ffe14d" : starCols[i % starCols.length], time * 0.8);
    }
    // Wind gusts (L4+): chevrons at the edges, up or down.
    if (windAmt) {
      ctx.fillStyle = "rgba(41,250,255,0.85)";
      const up = windAmt < 0;
      for (let i = 0; i < 3; i++) {
        const y = 60 + i * 90;
        ctx.beginPath();
        if (up) { ctx.moveTo(18, y - 12); ctx.lineTo(30, y + 6); ctx.lineTo(6, y + 6); }
        else { ctx.moveTo(18, y + 12); ctx.lineTo(30, y - 6); ctx.lineTo(6, y - 6); }
        ctx.closePath(); ctx.fill();
      }
    }
    // Riders.
    for (const r of riders) if (r.alive) drawRider(r);
    // Player unicorn (blink while invulnerable).
    if (state !== "win") {
      const blink = player.invuln > 0 && state === "play" && Math.floor(time * 12) % 2 === 0;
      ctx.globalAlpha = blink ? 0.4 : 1;
      drawUnicorn(player.x, player.y, CFG.PLAYER_R, wingT);
      ctx.globalAlpha = 1;
    }
    // Particles.
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // HUD: stars collected top-left (star + pixel number), hearts
    // top-centre, level digit top-right.
    if (state !== "title") {
      drawStar(26, 22, 11, "#ffe14d", 0);
      if (typeof drawPixelNumber === "function") {
        drawPixelNumber(ctx, stars, 44, 14, 6, "rgba(255,255,255,0.9)", false);
        drawPixelNumber(ctx, level, W - 40, 14, 6, "rgba(255,255,255,0.55)", false);
      }
      for (let i = 0; i < CFG.HEARTS_MAX; i++) drawHeart(W / 2 + (i - 2) * 34, 22, 11, i < hearts);
    }
    // ---- the bottom control deck (never gameplay, only controls) ----
    ctx.fillStyle = "#12121f"; ctx.fillRect(0, deckTop, W, DECK_H);
    ctx.fillStyle = "#ff3df0"; ctx.fillRect(0, deckTop, W, 3);
    // FLAP buttons, mirrored: identical circles on both ends.
    for (const f of [flapL, flapR]) {
      const held = flapIds.size > 0;
      ctx.fillStyle = held ? "#ff7df2" : "#ff3df0";
      ctx.beginPath(); ctx.arc(f.x, f.y, CFG.FLAP_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, CFG.FLAP_R, 0, Math.PI * 2); ctx.stroke();
      // Wing icon, not a word — no reading required.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(f.x - 4, f.y - 4, 20, 9, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(f.x + 2, f.y + 8, 14, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // Overlays: title / level-up / win — pictures first.
    if (state === "title") {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, PH);
      ctx.fillStyle = "#ffffff"; ctx.font = Math.min(40, W / 10) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("UNICORN", W / 2, PH * 0.28);
      ctx.fillText("JOUST", W / 2, PH * 0.28 + 48);
      drawUnicorn(W / 2, PH * 0.55, 40, 0.2);
      ctx.fillStyle = "#ff3df0";
      ctx.beginPath(); ctx.ellipse(W / 2, PH * 0.78, 20, 9, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W / 2 + 6, PH * 0.78 + 12, 14, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (state === "levelup") {
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, PH);
      drawStar(W / 2, PH * 0.4, 54, "#ffe14d", time * 2);
    } else if (state === "win") {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, PH);
      drawStar(W / 2, PH * 0.4, 80, "#ffe14d", time * 1.5);
      ctx.fillStyle = "#ffffff"; ctx.font = Math.min(30, W / 12) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("YOU WIN", W / 2, PH * 0.62);
    }
  }

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (MUSIC) MUSIC.tick(dt);
    tick(dt);
    render();
  }
  resize();
  startLevel(1);
  makeClouds();
  requestAnimationFrame(frame);

  /* Test hook (test-only, never used by the game). */
  window.__joustTest = {
    get state() { return state; },
    get level() { return level; },
    get hearts() { return hearts; },
    get stars() { return stars; },
    get riders() { return riders; },
    get starPickups() { return starPickups; },
    get player() { return player; },
    get levels() { return LEVELS; },
    get windAmt() { return windAmt; },
    get cfg() { return { DECK_H: DECK_H, FLAP_R: CFG.FLAP_R, deckTop: deckTop, flapL: flapL, flapR: flapR, WIN_MARGIN: CFG.WIN_MARGIN }; },
    get music() { return MUSIC_CFG; },
    start: function () { startGame(); },
    toTitle: function () { state = "title"; },
    step: function (dt) { tick(dt || 0.016); },
    debug: {
      setFlap: function (v) { testFlap = !!v; },
      placePlayer: function (x, y) { player.x = x; player.y = y; player.vy = 0; },
      placeRider: function (i, x, y) { const r = riders[i]; r.x = x; r.y = y; r.baseY = y; },
      setHearts: function (n) { hearts = n; },
      clearInvuln: function () { player.invuln = 0; },
      forceLevel: function (n) { level = n; startLevel(n); state = "play"; },
      setWind: function (a) { windAmt = a; },
      // A tap in the playfield during play — must change nothing.
      fieldTap: function (x, y) { onDown(x, y, 999); onUp(999); },
      deckTap: function (x, y) { onDown(x, y, 998); },
      deckRelease: function () { onUp(998); },
      flapHeld: function () { return flapIds.size > 0; },
    },
  };
})();
