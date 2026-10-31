/* Node test for Vault Blaster (window.__vaultTest).
   Top-down adventure: bottom control deck only (field touches
   ignored), floating stick in the deck, mirrored FIRE buttons,
   colour-matched wall buttons open doors, gun pickups, shield
   + health, no-game-over respawn with progress intact, 5
   levels, original chiptune loop (bass 0.2, 64 steps).
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

/* ---- maps: shape, legend, doors/buttons pair up ---- */
check("5 maps", T.maps.length === 5);
const DOOR_OF = { "1": "a", "2": "b", "3": "c", "4": "d" };
const BTN_OF = { a: "1", b: "2", c: "3", d: "4" };
function flood(rows, openDoors) {
  const seen = new Set(); let start = null, exit = null;
  const tiles = rows.map((r) => r.split(""));
  tiles.forEach((row, y) => row.forEach((c, x) => {
    if (c === "P") start = [x, y];
    if (c === "X") exit = [x, y];
  }));
  const solid = (c) => c === "#" || (!openDoors && c >= "1" && c <= "4");
  const q = [start]; seen.add(start.join(","));
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
T.maps.forEach((rows, li) => {
  check("L" + (li + 1) + " is 9x13", rows.length === 9 && rows.every((r) => r.length === 13));
  check("L" + (li + 1) + " one start + one exit",
    rows.join("").split("P").length - 1 === 1 && rows.join("").split("X").length - 1 === 1);
  const doors = new Set(), btns = new Set();
  rows.join("").split("").forEach((c) => {
    if (DOOR_OF[c]) doors.add(c);
    if (BTN_OF[c]) btns.add(c);
  });
  check("L" + (li + 1) + " every door has its button",
    [...doors].every((d) => btns.has(DOOR_OF[d])));
  check("L" + (li + 1) + " every button has its door",
    [...btns].every((b) => doors.has(BTN_OF[b])));
  const closed = flood(rows, false), open = flood(rows, true);
  const at = (x, y) => x + "," + y;
  rows.forEach((row, y) => row.split("").forEach((c, x) => {
    if (BTN_OF[c]) check("L" + (li + 1) + " button " + c + " reachable with doors closed", closed.seen.has(at(x, y)));
    if ("grmSH".includes(c)) check("L" + (li + 1) + " pickup " + c + " reachable with doors open", open.seen.has(at(x, y)));
  }));
  check("L" + (li + 1) + " exit NOT reachable with doors closed", !closed.seen.has(closed.exit.join(",")));
  check("L" + (li + 1) + " exit reachable with doors open", open.seen.has(open.exit.join(",")));
});

/* ---- title -> play ---- */
check("starts on title", T.state === "title");
T.start();
check("start() -> play, level 1, pistol, 5 hearts",
  T.state === "play" && T.level === 1 && T.gun === 0 && T.hearts === 5);

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
D.placePlayer(7.5, 1.5); // next to the L1 chaser at (8.5, 1.5)
D.setFire(true); step(20); D.setFire(false);
check("firing at a nearby enemy kills it",
  T.enemies.some((e) => e.type === "chaser" && !e.alive));

/* ---- wall button opens its colour-matched door ---- */
T.start();
D.placePlayer(3.5, 5.5); step(2); // L1 red button
check("walking onto a button presses it",
  T.buttons.some((b) => b.color === 0 && b.pressed));
step(40);
check("its door opens after the slide",
  T.doors.some((d) => d.color === 0 && d.open));

/* ---- gun pickup swaps the gun ---- */
D.forceLevel(2);
D.placePlayer(7.5, 1.5); step(2); // spread gun
check("walking over a gun picks it up (spread)", T.gun === 1);

/* ---- shield blocks damage; health restores ---- */
D.forceLevel(1);
D.placePlayer(3.5, 7.5); step(2); // shield
check("shield pickup sets shield time", T.player.shieldT > 0);
D.forceLevel(3);
D.placePlayer(3.5, 7.5); step(2); // shield again on L3
D.setHearts(5);
D.placePlayer(10.5, 1.5); step(2); // spike tile
check("shield blocks spike damage", T.hearts === 5);
D.forceLevel(1);
D.setHearts(3);
D.placePlayer(6.5, 7.5); step(2); // health pack
check("health pack restores 2 hearts (capped at 5)", T.hearts === 5);

/* ---- death: brief pause, respawn, progress intact ---- */
D.forceLevel(3);
D.placePlayer(6.5, 4.5); step(42); // press yellow button, door opens
check("door open before death", T.doors.some((d) => d.color === 2 && d.open));
D.setGun(2);
D.setHearts(1);
D.forceDamage(); // lethal hit, deterministic (no wandering-enemy timing)
check("lethal hit -> dead state, not game over", T.state === "dead");
step(90);
check("respawn: play again, hearts full, same level, gun kept, door kept open",
  T.state === "play" && T.hearts === 5 && T.level === 3 && T.gun === 2 &&
  T.doors.some((d) => d.color === 2 && d.open));

/* ---- exit advances a level ---- */
D.forceLevel(1);
D.placePlayer(10.5, 5.5); step(2); // exit tile
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
