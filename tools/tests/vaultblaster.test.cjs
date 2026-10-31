/* Node test for Vault Blaster v2 (window.__vaultTest).
   Top-down adventure: bottom control deck only (field touches
   ignored), floating stick in the deck, mirrored FIRE buttons,
   carryable colour-matched KEYS open doors (walk over a key to
   carry it, walk up to its door while carrying it to open it
   and use it up; doors stay locked without their key), gun
   pickups, shield + health, no-game-over respawn with progress
   intact (keys, doors, gun, kills kept), 5 levels as visible
   planning chains, original chiptune loop (bass 0.2, 64 steps).
   Run: node tools/tests/vaultblaster.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "vaultblaster", "game.js");

const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradStub;
    if (k === "measureText") return () => ({ width: 0 });
    if (k === "canvas") return {};
    return noop;
  },
  set: () => true,
});
const mkCanvas = () => ({
  getContext: () => ctxStub, addEventListener: noop, style: {},
  width: 0, height: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }),
});
const sandbox = {
  window: { innerWidth: 400, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, SDGplays: { played: noop } },
  document: {
    getElementById: (id) => (id === "stage" ? mkCanvas() : { addEventListener: noop, style: {} }),
    createElement: () => mkCanvas(),
    addEventListener: noop, hidden: false,
    head: { appendChild: noop },
  },
  performance: { now: () => 1000 },
  requestAnimationFrame: noop,
  makeAudio: () => ({
    tone: noop, noise: noop, arp: noop, unlock: noop, state: () => "running",
    makeMusic: () => ({ tick: noop, start: noop, stop: noop, on: false, step: 0 }),
  }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });
const T = sandbox.window.__vaultTest;
const D = T.debug;

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL:", name); }
}
function step(n, dt) { for (let i = 0; i < n; i++) T.step(dt || 0.016); }

/* ---- maps: shape, legend, keys/doors pair up, staged chains ---- */
const DOOR_OF = { "1": "a", "2": "b", "3": "c", "4": "d" };
const KEY_OF = { a: "1", b: "2", c: "3", d: "4" };
const HP = { E: 1, F: 1, B: 3, T: 2, G: 8 };
const GUN_TTK = { // [rate, dmg, shots] per gun index
  0: [0.38, 1, 1], 1: [0.45, 1, 3], 2: [0.16, 1, 1], 3: [0.30, 2, 1],
};
const NEW_GUN = { 2: 1, 3: 2, 4: 3, 5: 3 }; // level -> gun index (spread/rapid/mega/mega)
const NEW_GUN_CHAR = { 2: "g", 3: "r", 4: "m", 5: "m" };
function flood(rows, openDoors) {
  const tiles = rows.map((r) => r.split(""));
  let start = null, exit = null;
  tiles.forEach((row, y) => row.forEach((c, x) => {
    if (c === "P") start = [x, y];
    if (c === "X") exit = [x, y];
  }));
  const seen = new Set([start.join(",")]);
  const q = [start];
  const solid = (c) => c === "#" || (c >= "1" && c <= "4" && !openDoors.has(c));
  while (q.length) {
    const [x, y] = q.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || ny >= 9 || nx >= 13) continue;
      if (seen.has(nx + "," + ny) || solid(tiles[ny][nx])) continue;
      seen.add(nx + "," + ny); q.push([nx, ny]);
    }
  }
  return { seen, exit };
}
// Staged chain: stage 0 = doors closed; each stage collects every key
// reachable so far, opens their doors, and re-floods. Records the first
// stage at which each key, gun, enemy tile and the exit become reachable.
function staged(rows) {
  const open = new Set();
  const keyStage = {}, gunStage = {}, enemyStage = {};
  let exitStage = null;
  for (let stage = 0; stage < 10; stage++) {
    const { seen, exit } = flood(rows, open);
    rows.forEach((row, y) => row.split("").forEach((c, x) => {
      if (!seen.has(x + "," + y)) return;
      if (KEY_OF[c] && keyStage[c] === undefined) keyStage[c] = stage;
      if ("grm".includes(c) && gunStage[c] === undefined) gunStage[c] = stage;
      if (HP[c] !== undefined && enemyStage[x + "," + y] === undefined) enemyStage[x + "," + y] = stage;
    }));
    if (seen.has(exit.join(","))) { exitStage = stage; break; }
    const newly = Object.keys(keyStage).filter((k) => !open.has(KEY_OF[k]));
    if (!newly.length) break;
    newly.forEach((k) => open.add(KEY_OF[k]));
  }
  return { keyStage, gunStage, enemyStage, exitStage };
}
check("5 maps", T.maps.length === 5);
T.maps.forEach((rows, li) => {
  const L = li + 1;
  check("L" + L + " is 9x13", rows.length === 9 && rows.every((r) => r.length === 13));
  check("L" + L + " one start + one exit",
    rows.join("").split("P").length - 1 === 1 && rows.join("").split("X").length - 1 === 1);
  const doors = new Set(), keys = new Set();
  rows.join("").split("").forEach((c) => {
    if (DOOR_OF[c]) doors.add(c);
    if (KEY_OF[c]) keys.add(c);
  });
  check("L" + L + " every door has its key",
    [...doors].every((d) => keys.has(DOOR_OF[d])));
  check("L" + L + " every key has its door",
    [...keys].every((k) => doors.has(KEY_OF[k])));
  const { keyStage, gunStage, enemyStage, exitStage } = staged(rows);
  check("L" + L + " exit reachable only after the final door (stage == doors)",
    exitStage === doors.size);
  check("L" + L + " key 1 reachable with doors closed (stage 0)",
    keyStage.a === 0);
  rows.forEach((row, y) => row.split("").forEach((c, x) => {
    if ("grmSH".includes(c)) {
      const open = flood(rows, doors);
      check("L" + L + " pickup " + c + " reachable with doors open", open.seen.has(x + "," + y));
    }
  }));
  if (L >= 2) {
    check("L" + L + " new gun reachable only after the first door (stage 1)",
      gunStage[NEW_GUN_CHAR[L]] === 1);
    // Key 2's gate: enemies first reachable at key 2's stage are the
    // guards the player must beat for that key. They must be tough
    // enough that the starting pistol is impractical while the level's
    // new gun handles them quickly.
    const k2stage = keyStage.b;
    let gateHp = 0;
    rows.forEach((row, y) => row.split("").forEach((c, x) => {
      if (HP[c] !== undefined && enemyStage[x + "," + y] === k2stage) gateHp += HP[c];
    }));
    const [rate, dmg, shots] = GUN_TTK[NEW_GUN[L]];
    const ttkNew = Math.ceil(gateHp / (dmg * shots)) * rate;
    const ttkPistol = gateHp * 0.38;
    check("L" + L + " key-2 gate is tough (total HP >= 12)", gateHp >= 12);
    check("L" + L + " key-2 gate: new gun fast (TTK <= 3s), pistol impractical (>= 2x)",
      ttkNew <= 3.0 && ttkPistol >= 2 * ttkNew);
  }
});
// L3 rapid gate, specifically: at range a spread gun's pellets disperse
// (turrets take 1 pellet), so rapid — not spread — is the right tool.
{
  const rows = T.maps[2];
  const { keyStage, enemyStage } = staged(rows);
  let spreadRangeTtk = 0, rapidTtk = 0;
  rows.forEach((row, y) => row.split("").forEach((c, x) => {
    if (HP[c] === undefined || enemyStage[x + "," + y] !== keyStage.b) return;
    const pellets = c === "T" ? 1 : 3;
    spreadRangeTtk += Math.ceil(HP[c] / pellets) * 0.45;
    rapidTtk += HP[c] * 0.16;
  }));
  check("L3 key-2 gate: rapid beats spread-at-range", rapidTtk < spreadRangeTtk);
}
// L4 mega gate, specifically: at least 3 brutes share a row, so the
// mega gun's piercing shots can pass through them in a line.
{
  const rows = T.maps[3];
  const rowCounts = {};
  rows.forEach((row, y) => row.split("").forEach((c, x) => {
    if (c === "B") rowCounts[y] = (rowCounts[y] || 0) + 1;
  }));
  check("L4 mega gate: 3+ brutes share a row (pierce line)",
    Object.values(rowCounts).some((n) => n >= 3));
}

/* ---- title -> play ---- */
check("starts on title", T.state === "title");
T.start();
check("start() -> play, level 1, pistol, 5 hearts, no keys carried",
  T.state === "play" && T.level === 1 && T.gun === 0 && T.hearts === 5 && T.carried.length === 0);

/* ---- spawn safety + title drag (2026-10-31 bug report: player
   stuck at spawn, looked inside a wall) ---- */
{
  for (let L = 1; L <= 5; L++) {
    D.forceLevel(L);
    const rows = T.maps[L - 1];
    check("L" + L + " spawn is the P floor tile, not a wall",
      rows[Math.floor(T.player.y)][Math.floor(T.player.x)] === "P");
  }
  // A deck drag that starts on the title screen must start the
  // game AND move the player — the first touch must not be eaten.
  T.toTitle();
  const sx = T.player.x;
  D.deckTap(200, T.cfg.deckTop + 90);
  D.deckMove(200 + 50, T.cfg.deckTop + 90);
  step(20);
  check("title-screen deck drag starts the game and moves the player",
    T.state === "play" && T.player.x > sx + 0.5);
  D.deckRelease();
}

/* ---- wall trap (2026-10-31 photo: player + chaser stuck in
   the top wall row) ---- */
{
  // A centre stepped inside a top wall tile — exactly what a
  // 0.5-tile knockback does — must pop out to floor and move
  // again, not stay trapped by the old upward push + border clamp.
  D.placePlayer(4.5, 0.3); D.setMove(1, 0); step(10); D.clearMove();
  check("centre inside a top wall tile pops out to floor",
    T.maps[0][Math.floor(T.player.y)][Math.floor(T.player.x)] !== "#");
  const wx = T.player.x;
  D.setMove(1, 0); step(20); D.clearMove();
  check("player unstuck from a wall can move again", T.player.x > wx + 0.5);
  D.forceLevel(1); // back to spawn so the next test starts in open floor
}

/* ---- deck geometry ---- */
check("deck tall enough for big targets", T.cfg.DECK_H >= 170);
check("FIRE buttons >=84px across", T.cfg.FIRE_R * 2 >= 84);
check("FIRE buttons mirrored across centre",
  T.cfg.fireL.x < 200 && T.cfg.fireR.x > 200 && T.cfg.fireL.y === T.cfg.fireR.y);
check("deck sits below the playfield", T.cfg.deckTop > 0 && T.cfg.deckTop < 700);

/* ---- field touches do nothing; deck stick moves ---- */
{
  const x0 = T.player.x, y0 = T.player.y;
  D.fieldTap(200, 200); step(5);
  check("field tap during play changes nothing",
    T.player.x === x0 && T.player.y === y0 && D.stickState().id === null && !D.fireHeld());
  D.deckTap(200, T.cfg.deckTop + 90);
  check("deck tap grabs the stick", D.stickState().id !== null);
  D.deckMove(200 + 50, T.cfg.deckTop + 90); step(20);
  check("stick drag moves the player right", T.player.x > x0 + 0.5);
  D.deckRelease(); step(5);
  check("stick release stops the stick", D.stickState().id === null);
  const x1 = T.player.x;
  step(5);
  check("no drift after release", T.player.x === x1);
}

/* ---- FIRE button: hold -> bullets -> enemy dies ---- */
T.start();
D.placePlayer(2.5, 2.5); // next to the L1 chaser at (3.5, 2.5)
D.setFire(true); step(20); D.setFire(false);
check("firing at a nearby enemy kills it",
  T.enemies.some((e) => e.type === "chaser" && !e.alive));

/* ---- key pickup: walk over it, carry it, door still shut from afar ---- */
T.start();
D.placePlayer(4.5, 2.5); step(2); // L1 red key
check("walking over a key carries it",
  T.carried.includes(0) && !T.keys.some((k) => k.color === 0));
check("carrying a key does not open its door from afar",
  !T.doors.some((d) => d.color === 0 && d.open));

/* ---- door locked without its key ---- */
T.start();
D.placePlayer(5.5, 4.5); step(2); // tile next to the L1 red door, no key
check("door stays locked without its key",
  !T.doors.some((d) => d.color === 0 && (d.open || d.opening)));

/* ---- door opens with its key, and the key is used up ---- */
T.start();
D.giveKey(0);
D.placePlayer(5.5, 4.5); step(2);
check("walking up to a door with its key starts it opening",
  T.doors.some((d) => d.color === 0 && (d.open || d.opening)));
step(40);
check("door opens after the slide, key consumed",
  T.doors.some((d) => d.color === 0 && d.open) && !T.carried.includes(0));

/* ---- gun pickup swaps the gun ---- */
D.forceLevel(2);
D.placePlayer(6.5, 1.5); step(2); // spread gun
check("walking over a gun picks it up (spread)", T.gun === 1);

/* ---- shield blocks damage; health restores ---- */
D.forceLevel(1);
D.placePlayer(9.5, 6.5); step(2); // shield
check("shield pickup sets shield time", T.player.shieldT > 0);
D.forceLevel(3);
D.placePlayer(6.5, 1.5); step(2); // shield again on L3
step(70); // burn the spawn invulnerability; shield (6s) still up
D.placePlayer(6.5, 3.5); step(2); // spike tile
check("shield blocks spike damage", T.hearts === 5);
D.forceLevel(1);
D.setHearts(3);
D.placePlayer(2.5, 6.5); step(2); // health pack
check("health pack restores 2 hearts (capped at 5)", T.hearts === 5);

/* ---- death: brief pause, respawn, progress intact (key + door + gun) ---- */
D.forceLevel(2);
D.placePlayer(3.5, 2.5); step(2); // collect the red key
check("key collected before death", T.carried.includes(0));
D.setHearts(1);
D.forceDamage(); // lethal hit, deterministic
check("lethal hit -> dead state, not game over", T.state === "dead");
step(90);
check("respawn keeps the unspent key",
  T.state === "play" && T.hearts === 5 && T.level === 2 && T.carried.includes(0));
D.placePlayer(4.5, 4.5); step(2); // walk up to the red door with the key
step(40);
check("door open before second death", T.doors.some((d) => d.color === 0 && d.open));
D.setGun(1);
D.setHearts(1);
D.forceDamage();
step(90);
check("respawn: play again, hearts full, same level, gun kept, door kept open",
  T.state === "play" && T.hearts === 5 && T.level === 2 && T.gun === 1 &&
  T.doors.some((d) => d.color === 0 && d.open));

/* ---- exit advances a level ---- */
D.forceLevel(1);
D.placePlayer(10.5, 4.5); step(2); // exit tile
check("reaching the exit -> levelup", T.state === "levelup");
step(150);
check("levelup auto-advances to level 2 in play", T.state === "play" && T.level === 2);

/* ---- music: own loop, 64 steps, loud bass ---- */
check("music arrays are 64 steps",
  T.music.bass.length === 64 && T.music.lead.length === 64 && T.music.harmony.length === 64);
check("bass loud at 0.2", T.music.bassVol === 0.2);
check("lead has rests and variety",
  T.music.lead.includes(0) && new Set(T.music.lead.filter(Boolean)).size > 8);
check("harmony voice present", T.music.harmony.some(Boolean));

/* ---- long run: no NaNs ---- */
D.forceLevel(5);
D.setMove(1, 0); D.setFire(true); step(500);
D.clearMove(); D.setFire(false);
check("500 steps: player + enemies finite",
  Number.isFinite(T.player.x) && Number.isFinite(T.player.y) &&
  T.enemies.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)));

console.log("vaultblaster: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
