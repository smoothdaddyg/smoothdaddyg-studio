/* ============================================================
   VAULT BLASTER — SmoothDaddyG
   ------------------------------------------------------------
   Juan's 2026-10-30 bedtime blank-check: a top-down 2D
   adventure, Doom-like in spirit but NOT 3D. You move through
   rooms, push a wall button and a door somewhere else opens,
   you carry a gun and find better guns as you go, levels get
   harder and harder, and sometimes you pick up a shield or a
   health pack. 5 levels, then the big finale.

   THE CONTROLS (his words, twice: "buttons need to be on the
   bottom of the screen" / "think about controls on bottom of
   screen") — the lesson from Crazy Traffic / Time Wings: a
   thumb on the playfield covers the action, so ALL controls
   live in their own deck at the bottom and the playfield sits
   entirely ABOVE it. Field touches do NOTHING during play.
   - Movement: a floating thumb-circle in the deck. Drag
     anywhere in the deck (outside the FIRE buttons) and the
     stick floats to that finger; tilt = direction + speed.
     Works with either hand, anywhere in the deck.
   - FIRE: one big FIRE button on EACH end of the deck (left
     and right, identical/mirrored), so either hand can shoot
     while the other moves. Tap or hold to shoot.
   - Aiming kept simple: shots go toward the nearest enemy in
     range, otherwise in the direction you last moved. No
     twin-stick aiming, no third button.
   - Wall buttons, doors, guns, shields and health packs all
     work by walking into / over them — no INTERACT button.
     Move + fire is the whole control set.
   - The 84px back button stays outside the deck (top corner,
     as in other games) so it never clutters the controls.

   NO READING: colours, shapes, animation and sound only.
   A wall button is the SAME colour as the door it opens.
   Press it and that door pulses, sounds, and slides open.
   NO-GAME-OVER: dying is a brief pause and a respawn with
   ALL progress intact — doors opened, gun kept, level kept,
   enemies you killed stay dead. Never a restart.
   MUSIC: an original chiptune loop composed here (square
   lead, triangle bass at vol 0.2, noise drums, a harmony
   voice) — its own melody, never a re-skin of another game.
   ============================================================ */
"use strict";
(function () {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  /* ---------------- config ---------------- */
  const COLS = 13, ROWS = 9;
  const DOOR_COLORS = ["#ff3b30", "#29faff", "#ffe14d", "#c86bff"];
  const GUNS = [
    { rate: 0.38, dmg: 1, shots: 1, spread: 0,    pierce: false, color: "#ffe14d", speed: 9, size: 0.09 },
    { rate: 0.45, dmg: 1, shots: 3, spread: 0.21, pierce: false, color: "#ff9f2e", speed: 9, size: 0.09 },
    { rate: 0.16, dmg: 1, shots: 1, spread: 0,    pierce: false, color: "#29faff", speed: 10, size: 0.09 },
    { rate: 0.30, dmg: 2, shots: 1, spread: 0,    pierce: true,  color: "#ff3df0", speed: 10, size: 0.14 },
  ];
  const CFG = {
    PLAYER_R: 0.30, PLAYER_SPEED: 4.6, // tiles / second at full tilt
    BULLET_LIFE: 1.2, AIM_RANGE: 7,
    STICK_R: 60, STICK_DEAD: 0.18, FIRE_R: 54,
    HEARTS_MAX: 5, SHIELD_T: 6, RESPAWN_T: 1.2, DOOR_T: 0.5,
  };
  // Map legend: # wall, . floor, P start, X exit, 1-4 doors (red, cyan,
  // yellow, purple), a-d buttons matching those doors, E chaser,
  // F speeder, B brute, T turret, g spread gun, r rapid gun, m mega
  // gun, S shield, H health pack, ^ spike hazard. Every map is 9
  // rows of 13 — flood-fill validated in tools/tests (buttons
  // reachable with doors closed, exit reachable only once its
  // doors are opened, no door without its button).
  const MAPS = [
    [ // L1 — one red door, two chasers, shield + health
      "#############",
      "#P...#..E...#",
      "#.##.#.##.#.#",
      "#....#...#.##",
      "##.###.##.#.#",
      "#..a.#..1.X.#",
      "#.##...######",
      "#..S..H..E..#",
      "#############",
    ],
    [ // L2 — adds the cyan door (guards the shield) + spread gun + a speeder
      "#############",
      "#P..#..g#...#",
      "#.##.#.E#.###",
      "#......F.#.##",
      "##.###b##.#.#",
      "#..a##..1.X.#",
      "#.##S2.######",
      "#...#.H..E..#",
      "#############",
    ],
    [ // L3 — adds the yellow door (guards the exit) + rapid gun + spikes
      "#############",
      "#P..#..r#.^E#",
      "#.##.#.##.#.#",
      "#....#b.F.#.#",
      "##.###c###.##",
      "#..a.#..1..H#",
      "#.##.2.##3X##",
      "#..S..H..E###",
      "#############",
    ],
    [ // L4 — adds the purple door (guards the exit) + mega gun + turret + brute
      "#############",
      "#P..#..m#..B#",
      "#.##.#.##.#T#",
      "#....#..F.#.#",
      "##.###d##.#.#",
      "#..a.#..1..H#",
      "#.##...##..##",
      "#..S..H..E4X#",
      "#############",
    ],
    [ // L5 — everything: all four doors, brute + turret + speeder + spikes
      "#############",
      "#P..#..m#..B#",
      "#.##.#.##.#T#",
      "#..F..b.^c#.#",
      "##.###d##.#.#",
      "#..a##..1..H#",
      "#.##S2.##3.##",
      "#...#.H..E4X#",
      "#############",
    ],
  ];

  /* ---------------- helpers ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /* ---------------- audio ---------------- */
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  function sndShoot() { tone(880, 0.12, { type: "square", vol: 0.09, slideTo: 220 }); }
  function sndHit() { noiseS(0.12, { filter: "lowpass", freq: 1200, vol: 0.14 }); tone(300, 0.15, { type: "square", vol: 0.09, slideTo: 90 }); }
  function sndHurt() { tone(320, 0.3, { type: "sawtooth", vol: 0.12, slideTo: 80 }); }
  function sndPickup() { arp([660, 880, 1100], 0.06, "square", 0.09); }
  function sndGun() { arp([523, 659, 784, 1046], 0.05, "square", 0.10); }
  function sndShield() { arp([880, 1108, 1318, 1760], 0.07, "sine", 0.09); }
  function sndHealth() { tone(523, 0.12, { type: "sine", vol: 0.11 }); tone(784, 0.18, { type: "sine", vol: 0.11, when: 0.12 }); }
  function sndButton() { arp([392, 523, 659], 0.05, "square", 0.10); }
  function sndDoor() { noiseS(0.35, { filter: "bandpass", freq: 500, vol: 0.12, slideTo: 1600 }); tone(196, 0.3, { type: "triangle", vol: 0.12, slideTo: 392 }); }
  function sndRespawn() { arp([392, 523, 659, 784, 1046], 0.07, "square", 0.10); }
  function sndFanfare() { arp([523, 659, 784, 1046, 784, 1046, 1318], 0.11, "square", 0.10); }
  function sndFinale() { arp([523, 659, 784, 1046, 1318, 1568, 2093, 2637], 0.12, "square", 0.11); noiseS(0.9, { filter: "highpass", freq: 3000, vol: 0.05, when: 0.3 }); }

  /* ---------------- background music ----------------
     An ORIGINAL loop, composed here for Vault Blaster: a
     stalking A-minor crawl — short singable phrase, rests
     that breathe, a variation at the end of the phrase, and
     a harmony voice a third under the lead (the NES second
     pulse channel). Pedal-point bass (A, then F-C-G) drives
     it forward; swung hats + funk kicks keep it moving.
     64 sixteenth steps at 132 BPM, bass LOUD at 0.2. */
  const A2 = 110, C3 = 130.81, F2 = 87.31, G2 = 98;
  const A4 = 440, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, E4 = 329.63, G4 = 392;
  const MUSIC_CFG = {
    bpm: 132, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.055, harmonyVol: 0.025,
    kicks: [0, 8, 16, 24, 32, 40, 48, 56, 62], snares: [4, 12, 20, 28, 36, 44, 52, 60], hats: "odd",
    bass: [A2,0,0,A2,0,A2,0,0, A2,0,0,A2,0,0,A2,0,
           F2,0,0,F2,0,F2,0,0, F2,0,0,F2,0,0,F2,0,
           C3,0,0,C3,0,C3,0,0, C3,0,0,C3,0,0,C3,0,
           G2,0,0,G2,0,G2,0,0, G2,0,0,G2,0,0,G2,0],
    lead: [A4,0,C5,0, E5,0,0,D5, C5,0,0,0, A4,0,0,0,
           A4,0,C5,0, E5,0,D5,0, C5,0,E5,0, D5,0,0,0,
           F5,0,0,E5, D5,0,0,0, E5,0,0,G5, A5,0,G5,0,
           E5,0,D5,0, C5,0,0,0, E4,0,G4,0, A4,0,0,0],
    harmony: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
              0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
              0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
              0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  };
  // Harmony: a third under the lead wherever the lead sings.
  (function () {
    const third = {}; third[A4] = 329.63; third[C5] = 392; third[D5] = 440;
    third[E5] = 523.25; third[F5] = 587.33; third[G5] = 659.25; third[A5] = 783.99;
    third[E4] = 261.63; third[G4] = 329.63;
    for (let i = 0; i < 64; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }

  /* ---------------- layout ---------------- */
  let W = 400, H = 700, DPR = 1, DECK_H = 190, PH = 510, TILE = 30, OX = 0, OY = 0;
  let deckTop = 510, fireL = { x: 74, y: 0 }, fireR = { x: 326, y: 0 };
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    DECK_H = Math.round(clamp(H * 0.26, 170, 210));
    PH = H - DECK_H; deckTop = PH;
    TILE = Math.max(20, Math.floor(Math.min(W / COLS, PH / ROWS)));
    OX = Math.round((W - TILE * COLS) / 2); OY = Math.round((PH - TILE * ROWS) / 2);
    fireL = { x: 74, y: deckTop + DECK_H / 2 };
    fireR = { x: W - 74, y: deckTop + DECK_H / 2 };
  }
  window.addEventListener("resize", resize);
  const px = (tx) => OX + tx * TILE;
  const py = (ty) => OY + ty * TILE;

  /* ---------------- state ---------------- */
  let state = "title"; // title | play | dead | levelup | win
  let level = 1, gun = 0, hearts = CFG.HEARTS_MAX;
  let time = 0, deadT = 0, celebT = 0, fireCd = 0, bulletId = 0;
  let walls = new Set(), doors = [], buttons = [], spikes = new Set();
  let exit = { x: 0, y: 0 }, start = { x: 1, y: 1 };
  let enemies = [], pickups = [], bullets = [], ebullets = [], parts = [];
  let doorPulse = null; // {color, t} — the just-opened door flashes
  const player = { x: 1.5, y: 1.5, fx: 0, fy: -1, invuln: 0, shieldT: 0, spikeGrace: 0 };
  const key = (x, y) => x + "," + y;

  function parseMap(n) {
    const rows = MAPS[n - 1];
    walls = new Set(); doors = []; buttons = []; spikes = new Set();
    enemies = []; pickups = [];
    const gunChar = { g: 1, r: 2, m: 3 };
    rows.forEach((row, y) => {
      for (let x = 0; x < COLS; x++) {
        const c = row[x];
        if (c === "#") walls.add(key(x, y));
        else if (c >= "1" && c <= "4") doors.push({ x: x, y: y, color: c.charCodeAt(0) - 49, open: false, openT: 0, opening: false });
        else if (c >= "a" && c <= "d") buttons.push({ x: x, y: y, color: c.charCodeAt(0) - 97, pressed: false });
        else if (c === "^") spikes.add(key(x, y));
        else if (c === "X") exit = { x: x, y: y };
        else if (c === "P") start = { x: x, y: y };
        else if (c === "E") enemies.push({ type: "chaser", x: x + 0.5, y: y + 0.5, hp: 1, r: 0.32, alive: true, stun: 0, phase: rnd(0, 6) });
        else if (c === "F") enemies.push({ type: "speeder", x: x + 0.5, y: y + 0.5, hp: 1, r: 0.26, alive: true, stun: 0, phase: rnd(0, 6) });
        else if (c === "B") enemies.push({ type: "brute", x: x + 0.5, y: y + 0.5, hp: 3, r: 0.42, alive: true, stun: 0, phase: rnd(0, 6) });
        else if (c === "T") enemies.push({ type: "turret", x: x + 0.5, y: y + 0.5, hp: 2, r: 0.36, alive: true, stun: 0, cd: 1.2, phase: 0 });
        else if (gunChar[c] != null) pickups.push({ kind: "gun", gun: gunChar[c], x: x + 0.5, y: y + 0.5 });
        else if (c === "S") pickups.push({ kind: "shield", x: x + 0.5, y: y + 0.5 });
        else if (c === "H") pickups.push({ kind: "health", x: x + 0.5, y: y + 0.5 });
      }
    });
  }
  function startLevel(n) {
    parseMap(n);
    player.x = start.x + 0.5; player.y = start.y + 0.5;
    player.fx = 0; player.fy = -1; player.invuln = 1.0; player.spikeGrace = 0;
    bullets = []; ebullets = []; parts = []; fireCd = 0;
  }
  function startGame() {
    level = 1; gun = 0; hearts = CFG.HEARTS_MAX; player.shieldT = 0;
    startLevel(1); state = "play";
    if (MUSIC) MUSIC.start();
    if (window.SDGplays) window.SDGplays.played("vaultblaster");
  }
  function isSolidTile(tx, ty) {
    if (walls.has(key(tx, ty))) return true;
    for (const d of doors) if (d.x === tx && d.y === ty && !d.open) return true;
    return false;
  }
  // Circle (tile units) vs solid tiles — push out along the smallest axis.
  function collide(ent, r) {
    for (let ty = Math.floor(ent.y - r); ty <= Math.floor(ent.y + r); ty++) {
      for (let tx = Math.floor(ent.x - r); tx <= Math.floor(ent.x + r); tx++) {
        if (!isSolidTile(tx, ty)) continue;
        const nx = clamp(ent.x, tx, tx + 1), ny = clamp(ent.y, ty, ty + 1);
        const dx = ent.x - nx, dy = ent.y - ny, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 === 0) { ent.y = ty - r - 0.001; continue; }
        const d = Math.sqrt(d2), push = (r - d) / d;
        ent.x += dx * push; ent.y += dy * push;
      }
    }
    ent.x = clamp(ent.x, 0.3, COLS - 0.3); ent.y = clamp(ent.y, 0.3, ROWS - 0.3);
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < (n || 12); i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(0.5, speed || 3);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rnd(0.4, 0.8), color: color, size: rnd(0.05, 0.11) });
    }
  }

  /* ---------------- input: the bottom deck ----------------
     Stick floats to the finger anywhere in the deck (outside
     the FIRE circles). Field touches are ignored during play.
     FIRE circles are checked FIRST so a finger landing on one
     never becomes a stick. Multi-touch: one stick pointer +
     any number of FIRE pointers, tracked by pointerId. */
  const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  const fireIds = new Set();
  let testMove = null, testFire = false; // test hooks only
  function inFire(x, y) {
    return dist(x, y, fireL.x, fireL.y) <= CFG.FIRE_R + 6 || dist(x, y, fireR.x, fireR.y) <= CFG.FIRE_R + 6;
  }
  function onDown(x, y, id) {
    if (state === "title") { startGame(); return; }
    if (state === "win" && celebT > 1.5) { startGame(); return; }
    if (state !== "play") return;
    if (inFire(x, y)) { fireIds.add(id); return; }
    if (y >= deckTop && stick.id === null) { stick.id = id; stick.ox = x; stick.oy = y; stick.dx = 0; stick.dy = 0; }
    // Field touches: deliberately ignored — the deck is the control.
  }
  function onMove(x, y, id) {
    if (stick.id !== id) return;
    let dx = (x - stick.ox) / CFG.STICK_R, dy = (y - stick.oy) / CFG.STICK_R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    if (Math.hypot(dx, dy) < CFG.STICK_DEAD) { dx = 0; dy = 0; }
    stick.dx = dx; stick.dy = dy;
  }
  function onUp(id) {
    if (stick.id === id) { stick.id = null; stick.dx = 0; stick.dy = 0; }
    fireIds.delete(id);
  }
  function ptrPos(e) {
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) || e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); const p = ptrPos(e); onDown(p.x, p.y, e.pointerId); });
  canvas.addEventListener("pointermove", function (e) { e.preventDefault(); const p = ptrPos(e); onMove(p.x, p.y, e.pointerId); });
  canvas.addEventListener("pointerup", function (e) { e.preventDefault(); onUp(e.pointerId); });
  canvas.addEventListener("pointercancel", function (e) { e.preventDefault(); onUp(e.pointerId); });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- update ---------------- */
  function hurtPlayer(dmg, sx, sy) {
    if (player.invuln > 0 || player.shieldT > 0 || state !== "play") return;
    hearts -= dmg;
    player.invuln = 1.0;
    sndHurt();
    const d = Math.hypot(player.x - sx, player.y - sy) || 1;
    player.x += (player.x - sx) / d * 0.5; player.y += (player.y - sy) / d * 0.5;
    collide(player, CFG.PLAYER_R);
    burst(player.x, player.y, "#ff3b30", 10, 3);
    if (hearts <= 0) {
      state = "dead"; deadT = 0;
      burst(player.x, player.y, "#29faff", 30, 4);
      sndHurt();
    }
  }
  function shoot() {
    const g = GUNS[gun];
    let ax = player.fx, ay = player.fy, best = CFG.AIM_RANGE + 1;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < best) { best = d; ax = (e.x - player.x) / (d || 1); ay = (e.y - player.y) / (d || 1); }
    }
    if (best > CFG.AIM_RANGE) { ax = player.fx; ay = player.fy; }
    player.fx = ax; player.fy = ay;
    const base = Math.atan2(ay, ax);
    for (let i = 0; i < g.shots; i++) {
      const a = base + (i - (g.shots - 1) / 2) * g.spread;
      bullets.push({ x: player.x + Math.cos(a) * 0.4, y: player.y + Math.sin(a) * 0.4,
        vx: Math.cos(a) * g.speed, vy: Math.sin(a) * g.speed, dmg: g.dmg, pierce: g.pierce,
        color: g.color, size: g.size, life: CFG.BULLET_LIFE, id: ++bulletId, hit: new Set() });
    }
    fireCd = g.rate;
    sndShoot();
  }
  function tickPlayer(dt) {
    let mx = testMove ? testMove.x : stick.dx, my = testMove ? testMove.y : stick.dy;
    const m = Math.hypot(mx, my);
    if (m > 0.01) {
      player.fx = mx / m; player.fy = my / m;
      player.x += mx * CFG.PLAYER_SPEED * dt; player.y += my * CFG.PLAYER_SPEED * dt;
      collide(player, CFG.PLAYER_R);
    }
    if (player.invuln > 0) player.invuln -= dt;
    if (player.shieldT > 0) player.shieldT -= dt;
    if (player.spikeGrace > 0) player.spikeGrace -= dt;
    // Wall buttons: walking onto one presses it; its doors slide open.
    const tx = Math.floor(player.x), ty = Math.floor(player.y);
    for (const b of buttons) {
      if (!b.pressed && b.x === tx && b.y === ty) {
        b.pressed = true; sndButton();
        burst(b.x + 0.5, b.y + 0.5, DOOR_COLORS[b.color], 14, 3);
        for (const d of doors) if (d.color === b.color && !d.open) d.opening = true;
        doorPulse = { color: b.color, t: 1 };
        sndDoor();
      }
    }
    // Pickups by walking over them.
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (dist(player.x, player.y, p.x, p.y) > 0.5) continue;
      if (p.kind === "gun") { gun = p.gun; sndGun(); burst(p.x, p.y, GUNS[p.gun].color, 16, 3); }
      else if (p.kind === "shield") { player.shieldT = CFG.SHIELD_T; sndShield(); burst(p.x, p.y, "#29faff", 16, 3); }
      else if (p.kind === "health") { hearts = Math.min(CFG.HEARTS_MAX, hearts + 2); sndHealth(); burst(p.x, p.y, "#ff3b30", 16, 3); }
      pickups.splice(i, 1);
    }
    // Spikes: one heart, then a grace second.
    if (spikes.has(key(tx, ty)) && player.spikeGrace <= 0 && player.invuln <= 0) {
      player.spikeGrace = 1.0;
      hurtPlayer(1, tx + 0.5, ty + 0.5);
    }
    // Firing while a FIRE button is held (or the test flag).
    fireCd -= dt;
    if ((fireIds.size > 0 || testFire) && fireCd <= 0) shoot();
    // Exit: reaching it clears the level.
    if (tx === exit.x && ty === exit.y && state === "play") {
      state = "levelup"; celebT = 0; sndFanfare();
      burst(exit.x + 0.5, exit.y + 0.5, "#ffe14d", 40, 5);
    }
  }
  function tickEnemies(dt) {
    const speedMul = 1 + (level - 1) * 0.12;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.stun > 0) e.stun -= dt;
      if (e.type === "turret") {
        e.cd -= dt;
        const d = dist(player.x, player.y, e.x, e.y);
        if (e.cd <= 0 && d < 7 && state === "play") {
          e.cd = Math.max(1.2, 1.6 - level * 0.05);
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          ebullets.push({ x: e.x + Math.cos(a) * 0.4, y: e.y + Math.sin(a) * 0.4, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4 });
        }
        continue;
      }
      if (e.stun > 0) continue;
      let dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      let sp = (e.type === "chaser" ? 1.5 : e.type === "speeder" ? 2.4 : 1.0) * speedMul;
      if (e.type === "speeder") { // wobble: weaves side to side as it closes in
        const w = Math.sin(time * 6 + e.phase) * 0.6;
        const nx = dx - dy * w, ny = dy + dx * w, nm = Math.hypot(nx, ny) || 1;
        dx = nx / nm; dy = ny / nm;
      }
      e.x += dx * sp * dt; e.y += dy * sp * dt;
      collide(e, e.r);
    }
    // Keep enemies from stacking on one tile.
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (!a.alive || !b.alive || a.type === "turret" || b.type === "turret") continue;
      const d = dist(a.x, a.y, b.x, b.y), min = a.r + b.r;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2 / d;
        a.x -= (b.x - a.x) * push; a.y -= (b.y - a.y) * push;
        b.x += (b.x - a.x) * push; b.y += (b.y - a.y) * push;
      }
    }
    // Touch damage (shield bounces the enemy back instead).
    if (state === "play") {
      for (const e of enemies) {
        if (!e.alive || e.type === "turret") continue;
        if (dist(player.x, player.y, e.x, e.y) < e.r + CFG.PLAYER_R) {
          if (player.shieldT > 0) {
            const d = dist(player.x, player.y, e.x, e.y) || 1;
            e.x += (e.x - player.x) / d * 0.8; e.y += (e.y - player.y) / d * 0.8;
            e.stun = 0.5; collide(e, e.r);
            burst(e.x, e.y, "#29faff", 8, 2);
          } else hurtPlayer(1, e.x, e.y);
        }
      }
    }
  }
  function tickBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      const tx = Math.floor(b.x), ty = Math.floor(b.y);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || isSolidTile(tx, ty)) {
        burst(b.x, b.y, b.color, 4, 1.5); bullets.splice(i, 1); continue;
      }
      let dead = false;
      for (const e of enemies) {
        if (!e.alive || b.hit.has(e)) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + b.size) {
          b.hit.add(e); e.hp -= b.dmg;
          burst(e.x, e.y, "#ff9f2e", 8, 2.5); sndHit();
          if (e.hp <= 0) { e.alive = false; burst(e.x, e.y, "#ff3df0", 22, 4); }
          if (!b.pierce) { dead = true; }
          break;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      const tx = Math.floor(b.x), ty = Math.floor(b.y);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || isSolidTile(tx, ty)) { ebullets.splice(i, 1); continue; }
      if (state === "play" && dist(b.x, b.y, player.x, player.y) < CFG.PLAYER_R + 0.12) {
        ebullets.splice(i, 1);
        if (player.shieldT > 0) burst(b.x, b.y, "#29faff", 6, 2);
        else hurtPlayer(1, b.x, b.y);
      }
    }
  }
  function tick(dt) {
    time += dt;
    if (doorPulse) { doorPulse.t -= dt * 0.8; if (doorPulse.t <= 0) doorPulse = null; }
    for (const d of doors) {
      if (d.opening && !d.open) {
        d.openT += dt / CFG.DOOR_T;
        if (d.openT >= 1) { d.open = true; d.opening = false; d.openT = 1; }
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) parts.splice(i, 1);
    }
    if (state === "play") { tickPlayer(dt); tickEnemies(dt); tickBullets(dt); }
    else if (state === "dead") {
      deadT += dt;
      if (deadT >= CFG.RESPAWN_T) {
        // Respawn with ALL progress intact: doors, gun, kills, pickups kept.
        player.x = start.x + 0.5; player.y = start.y + 0.5;
        hearts = CFG.HEARTS_MAX; player.invuln = 1.5;
        bullets = []; ebullets = [];
        sndRespawn(); state = "play";
      }
    } else if (state === "levelup") {
      celebT += dt;
      if (Math.random() < dt * 8) parts.push({ x: rnd(1, COLS - 1), y: rnd(0.5, 2), vx: rnd(-0.5, 0.5), vy: rnd(1, 2.5), t: 0, life: rnd(0.8, 1.4), color: ["#ffe14d", "#29faff", "#ff3df0", "#3dff7a"][Math.floor(rnd(0, 4))], size: rnd(0.06, 0.12) });
      if (celebT >= 2.2) {
        if (level >= 5) { state = "win"; celebT = 0; sndFinale(); }
        else { level++; startLevel(level); state = "play"; }
      }
    } else if (state === "win") {
      celebT += dt;
      if (Math.random() < dt * 10) parts.push({ x: rnd(1, COLS - 1), y: rnd(0.5, 2), vx: rnd(-0.5, 0.5), vy: rnd(1, 2.5), t: 0, life: rnd(0.8, 1.4), color: ["#ffe14d", "#29faff", "#ff3df0", "#3dff7a"][Math.floor(rnd(0, 4))], size: rnd(0.06, 0.12) });
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
  function drawGunIcon(cx, cy, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - s, cy - s * 0.25, s * 1.6, s * 0.5);
    ctx.fillRect(cx + s * 0.4, cy - s * 0.6, s * 0.5, s * 1.2);
    ctx.fillStyle = "#0a0a13";
    ctx.fillRect(cx - s * 0.7, cy - s * 0.1, s * 0.5, s * 0.2);
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0a13"; ctx.fillRect(0, 0, W, H);
    // Floor: subtle checker so rooms read as rooms, not void.
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (walls.has(key(x, y))) continue;
      ctx.fillStyle = (x + y) % 2 ? "#12121f" : "#0f0f1a";
      ctx.fillRect(px(x), py(y), TILE, TILE);
    }
    // Walls: chunky neon-edged blocks, exactly one tile thick.
    for (const w of walls) {
      const partsW = w.split(","); const x = +partsW[0], y = +partsW[1];
      ctx.fillStyle = "#23233a"; ctx.fillRect(px(x) + 1, py(y) + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = "#29faff"; ctx.fillRect(px(x) + 1, py(y) + 1, TILE - 2, 3);
    }
    // Spikes.
    for (const s of spikes) {
      const partsS = s.split(","); const x = +partsS[0], y = +partsS[1];
      const cx = px(x) + TILE / 2, cy = py(y) + TILE / 2, r = TILE * 0.3;
      ctx.fillStyle = "#8a8a9e";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a + Math.PI / 8) * r * 0.45, cy + Math.sin(a + Math.PI / 8) * r * 0.45);
      }
      ctx.closePath(); ctx.fill();
    }
    // Doors: coloured double doors that slide apart as they open.
    for (const d of doors) {
      const col = DOOR_COLORS[d.color];
      const x = px(d.x), y = py(d.y), slide = d.openT * (TILE / 2);
      if (d.open) {
        ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4); ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = col;
      ctx.fillRect(x + 2, y + 2, TILE / 2 - 2 - slide, TILE - 4);
      ctx.fillRect(x + TILE / 2 + slide, y + 2, TILE / 2 - 2 - slide, TILE - 4);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + TILE / 2 - 2, y + 2, 4, TILE - 4);
      if (doorPulse && doorPulse.color === d.color && doorPulse.t > 0) {
        ctx.strokeStyle = col; ctx.globalAlpha = doorPulse.t; ctx.lineWidth = 4;
        ctx.strokeRect(x - 4 - (1 - doorPulse.t) * 10, y - 4 - (1 - doorPulse.t) * 10,
          TILE + 8 + (1 - doorPulse.t) * 20, TILE + 8 + (1 - doorPulse.t) * 20);
        ctx.globalAlpha = 1;
      }
    }
    // Wall buttons: same colour as their door, diamond + ring.
    for (const b of buttons) {
      const col = DOOR_COLORS[b.color];
      const cx = px(b.x) + TILE / 2, cy = py(b.y) + TILE / 2, r = TILE * (b.pressed ? 0.22 : 0.3);
      ctx.fillStyle = b.pressed ? "rgba(255,255,255,0.25)" : col;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
      ctx.closePath(); ctx.fill();
      if (!b.pressed) {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.42, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Exit: pulsing gold portal.
    {
      const cx = px(exit.x) + TILE / 2, cy = py(exit.y) + TILE / 2;
      const pulse = 1 + Math.sin(time * 4) * 0.12;
      ctx.fillStyle = "#ffe14d"; ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.48 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.3 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0a0a13";
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.16 * pulse, 0, Math.PI * 2); ctx.fill();
    }
    // Pickups: bobbing, each with its own shape.
    for (const p of pickups) {
      const bob = Math.sin(time * 3 + p.x) * TILE * 0.05;
      const cx = px(p.x), cy = py(p.y) + bob;
      if (p.kind === "gun") drawGunIcon(cx, cy, TILE * 0.22, GUNS[p.gun].color);
      else if (p.kind === "shield") {
        ctx.strokeStyle = "#29faff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.28, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#29faff";
        ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.12, 0, Math.PI * 2); ctx.fill();
      } else drawHeart(cx, cy, TILE * 0.26, true);
    }
    // Enemies.
    for (const e of enemies) {
      if (!e.alive) continue;
      const cx = px(e.x), cy = py(e.y), r = e.r * TILE;
      if (e.type === "chaser") {
        ctx.fillStyle = "#ff9f2e"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0a0a13";
        ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === "speeder") {
        ctx.fillStyle = "#ff3b30";
        ctx.beginPath(); ctx.moveTo(cx + r, cy); ctx.lineTo(cx - r * 0.8, cy - r * 0.8); ctx.lineTo(cx - r * 0.8, cy + r * 0.8); ctx.closePath(); ctx.fill();
      } else if (e.type === "brute") {
        ctx.fillStyle = "#c86bff"; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = "#0a0a13"; ctx.fillRect(cx - r * 0.5, cy - r * 0.5, r, r * 0.25);
        ctx.fillStyle = "#ffe14d";
        for (let i = 0; i < e.hp; i++) ctx.fillRect(cx - r + 4 + i * (r * 2 - 8) / 3, cy + r - 8, (r * 2 - 8) / 3 - 2, 4);
      } else { // turret
        ctx.fillStyle = "#8a8a9e"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2); ctx.fill();
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        ctx.strokeStyle = "#ff3b30"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4); ctx.stroke();
      }
    }
    // Player: cyan runner with a gun barrel in the facing direction.
    if (state !== "win") {
      const blink = player.invuln > 0 && state === "play" && Math.floor(time * 12) % 2 === 0;
      const cx = px(player.x), cy = py(player.y), r = CFG.PLAYER_R * TILE;
      ctx.globalAlpha = blink ? 0.4 : 1;
      ctx.fillStyle = "#29faff"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GUNS[gun].color; ctx.lineWidth = Math.max(3, TILE * 0.12);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + player.fx * r * 1.7, cy + player.fy * r * 1.7); ctx.stroke();
      ctx.fillStyle = "#0a0a13";
      ctx.beginPath(); ctx.arc(cx + player.fx * r * 0.3, cy + player.fy * r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (player.shieldT > 0) {
        ctx.strokeStyle = "#29faff"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.5 + Math.sin(time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Bullets.
    for (const b of bullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(px(b.x), py(b.y), Math.max(3, b.size * TILE), 0, Math.PI * 2); ctx.fill();
    }
    for (const b of ebullets) {
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath(); ctx.arc(px(b.x), py(b.y), Math.max(3, TILE * 0.12), 0, Math.PI * 2); ctx.fill();
    }
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(px(p.x) - p.size * TILE / 2, py(p.y) - p.size * TILE / 2, p.size * TILE, p.size * TILE);
    }
    ctx.globalAlpha = 1;
    // HUD: hearts top-centre (clear of the 84px back button), level
    // digit top-right, current gun bottom of the playfield edge.
    if (state !== "title") {
      for (let i = 0; i < CFG.HEARTS_MAX; i++) drawHeart(W / 2 + (i - 2) * 34, 22, 11, i < hearts);
      if (typeof drawPixelNumber === "function") drawPixelNumber(ctx, level, W - 40, 14, 6, "rgba(255,255,255,0.55)", false);
      drawGunIcon(30, PH - 26, 12, GUNS[gun].color);
    }
    // ---- the bottom control deck (never gameplay, only controls) ----
    ctx.fillStyle = "#12121f"; ctx.fillRect(0, deckTop, W, DECK_H);
    ctx.fillStyle = "#29faff"; ctx.fillRect(0, deckTop, W, 3);
    // FIRE buttons, mirrored: identical circles on both ends.
    for (const f of [fireL, fireR]) {
      const held = fireIds.size > 0;
      ctx.fillStyle = held ? "#ff6b60" : "#ff3b30";
      ctx.beginPath(); ctx.arc(f.x, f.y, CFG.FIRE_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, CFG.FIRE_R, 0, Math.PI * 2); ctx.stroke();
      // Bullet icon, not a word — no reading required.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(f.x + 22, f.y); ctx.lineTo(f.x - 14, f.y - 14); ctx.lineTo(f.x - 14, f.y + 14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(f.x - 20, f.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    // The floating stick: faint home circle when idle, live stick on drag.
    if (stick.id !== null) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(stick.ox, stick.oy, CFG.STICK_R, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(41,250,255,0.85)";
      ctx.beginPath(); ctx.arc(stick.ox + stick.dx * CFG.STICK_R, stick.oy + stick.dy * CFG.STICK_R, 26, 0, Math.PI * 2); ctx.fill();
    } else if (state === "play") {
      ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(W / 2, deckTop + DECK_H / 2, CFG.STICK_R, 0, Math.PI * 2); ctx.stroke();
    }
    // Overlays: title / level-up / win — pictures first, one big digit.
    if (state === "title") {
      ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, W, PH);
      ctx.fillStyle = "#29faff"; ctx.font = Math.min(44, W / 9) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("VAULT", W / 2, PH * 0.3);
      ctx.fillText("BLASTER", W / 2, PH * 0.3 + 52);
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.moveTo(W / 2 - 24, PH * 0.62 - 34); ctx.lineTo(W / 2 + 34, PH * 0.62); ctx.lineTo(W / 2 - 24, PH * 0.62 + 34); ctx.closePath(); ctx.fill();
    } else if (state === "levelup") {
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, PH);
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, a2 = a + Math.PI / 10;
        ctx.lineTo(W / 2 + Math.cos(a) * 54, PH * 0.4 + Math.sin(a) * 54);
        ctx.lineTo(W / 2 + Math.cos(a2) * 24, PH * 0.4 + Math.sin(a2) * 24);
      }
      ctx.closePath(); ctx.fill();
    } else if (state === "win") {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, PH);
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, a2 = a + Math.PI / 10;
        ctx.lineTo(W / 2 + Math.cos(a) * 80, PH * 0.4 + Math.sin(a) * 80);
        ctx.lineTo(W / 2 + Math.cos(a2) * 36, PH * 0.4 + Math.sin(a2) * 36);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#29faff"; ctx.font = Math.min(30, W / 12) + "px 'Press Start 2P', monospace";
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
  requestAnimationFrame(frame);

  /* Test hook (test-only, never used by the game). */
  window.__vaultTest = {
    get state() { return state; },
    get level() { return level; },
    get gun() { return gun; },
    get hearts() { return hearts; },
    get doors() { return doors; },
    get buttons() { return buttons; },
    get enemies() { return enemies; },
    get pickups() { return pickups; },
    get player() { return player; },
    get maps() { return MAPS; },
    get cfg() { return { DECK_H: DECK_H, FIRE_R: CFG.FIRE_R, COLS: COLS, ROWS: ROWS, deckTop: deckTop, fireL: fireL, fireR: fireR }; },
    get music() { return MUSIC_CFG; },
    start: function () { startGame(); },
    step: function (dt) { tick(dt || 0.016); },
    debug: {
      setMove: function (x, y) { testMove = { x: x, y: y }; },
      clearMove: function () { testMove = null; },
      setFire: function (v) { testFire = !!v; },
      placePlayer: function (x, y) { player.x = x; player.y = y; },
      forceDamage: function () { player.invuln = 0; player.spikeGrace = 0; player.shieldT = 0; hurtPlayer(1, player.x + 1, player.y); },
      setHearts: function (n) { hearts = n; },
      setGun: function (n) { gun = n; },
      forceLevel: function (n) { level = n; startLevel(n); state = "play"; },
      // A tap in the playfield during play — must change nothing.
      fieldTap: function (x, y) { onDown(x, y, 999); onUp(999); },
      deckTap: function (x, y) { onDown(x, y, 998); },
      deckMove: function (x, y) { onMove(x, y, 998); },
      deckRelease: function () { onUp(998); },
      stickState: function () { return { id: stick.id, dx: stick.dx, dy: stick.dy }; },
      fireHeld: function () { return fireIds.size > 0; },
    },
  };
})();
