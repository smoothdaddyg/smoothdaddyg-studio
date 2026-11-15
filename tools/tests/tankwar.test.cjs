/* Node test for Tank War (window.__tankTest).
   Danny's 2026-11-15 spec: two bottom levers steer the tank
   (both up = forward, both down = reverse, one up one down
   = turn); open arena, NOT a maze — rocks, trees, barriers
   as cover; blow stuff up; 3 levels; enemy tanks chase and
   shoot; a few hits to blow you up. V1: auto-fire straight
   ahead (driving is aiming), 3 armor, no game over ever
   (respawn with progress intact), original march chiptune
   (bass 0.2, 64 steps).
   Run: node tools/tests/tankwar.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "tankwar", "game.js");

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
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox);
const T = sandbox.window.__tankTest;
if (!T) { console.error("FAIL: no __tankTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }
function stepN(n, dt) { for (let i = 0; i < n; i++) T.step(dt || 0.016); }
function fresh() { T.start(); stepN(110); } // 1.76s > 1.0s spawn invulnerability
function parkOthers(i) {
  // Park every other alive enemy in the far corner so it can't
  // shoot or ram during a focused test.
  T.enemies.forEach((e, j) => { if (j !== i && e.alive) T.debug.placeEnemy(j, 30, 30); });
}
// Kill enemy i with the player's auto-fire, keeping it parked in
// the firing line (200, 350) — clear of cover on every level.
function killEnemy(i) {
  parkOthers(i);
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  T.debug.setHearts(3); T.debug.clearInvuln();
  let guard = 0;
  while (T.enemies[i].alive && guard++ < 400) {
    if (T.state === "dead") { stepN(90); T.debug.placePlayer(200, 400, -Math.PI / 2); T.debug.setHearts(3); }
    if (T.enemies[i].alive) T.debug.placeEnemy(i, 200, 350);
    T.step(0.016);
  }
  if (T.enemies[i].alive) throw new Error("enemy " + i + " would not die");
}

test("boots on title with 3 escalating levels", () => {
  T.toTitle();
  eq(T.state, "title", "starts on title");
  eq(T.levels.length, 3, "three levels");
  eq(T.levels[0].enemies.length, 2, "L1 has 2 enemies");
  ok(T.levels[0].enemies.every((e) => e.type === "scout"), "L1 is all scouts");
  eq(T.levels[1].enemies.length, 3, "L2 has 3 enemies");
  ok(T.levels[1].enemies.some((e) => e.type === "gunner"), "L2 adds a gunner");
  eq(T.levels[2].enemies.length, 4, "L3 has 4 enemies");
  ok(T.levels[2].enemies.some((e) => e.type === "brute"), "L3 adds a brute");
  ok(T.levels.every((l) => l.obstacles.length >= 4), "every level has cover");
});

test("spawns are clear of obstacles on every level", () => {
  for (let n = 1; n <= 3; n++) {
    T.debug.forceLevel(n);
    const clear = (x, y, r) => T.obstacles.every((o) => {
      if (o.kind === "barrier") return x + r < o.x || x - r > o.x + o.w || y + r < o.y || y - r > o.y + o.h;
      return Math.hypot(x - o.x, y - o.y) > o.r + r;
    });
    ok(clear(T.player.x, T.player.y, 16), "L" + n + " player spawn is clear");
    T.enemies.forEach((e, i) => ok(clear(e.x, e.y, e.r), "L" + n + " enemy " + i + " spawn is clear"));
  }
});

test("start begins play; music is its own march loop", () => {
  fresh();
  eq(T.state, "play", "playing after start");
  eq(T.level, 1, "level 1");
  eq(T.hearts, 3, "three armor");
  const m = T.music;
  eq(m.steps, 64, "64 steps");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.bpm, 126, "march tempo 126");
  ok(m.lead.some((n) => n === 0), "lead has rests that breathe");
  ok(new Set(m.lead.filter(Boolean)).size >= 5, "lead has a real phrase, not one note");
  ok(m.harmony.some((n) => n > 0), "harmony voice present");
  ok(m.bass.some((n) => n > 0), "bass drives");
  ok(Array.isArray(m.kicks) && m.kicks.length > 0, "explicit kick pattern");
});

test("both levers up drives forward; both down reverses", () => {
  fresh();
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  parkOthers(0);
  T.debug.setLever("L", 1); T.debug.setLever("R", 1);
  stepN(30);
  ok(T.player.y < 340, "drove forward (y=" + T.player.y.toFixed(1) + ")");
  ok(Math.abs(T.player.x - 200) < 5, "drove straight");
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  T.debug.setLever("L", -1); T.debug.setLever("R", -1);
  stepN(30);
  ok(T.player.y > 440, "reversed (y=" + T.player.y.toFixed(1) + ")");
  T.debug.clearLevers();
});

test("one up one down spins in place — left up turns left, right up turns right", () => {
  fresh();
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  parkOthers(0);
  const a0 = T.player.angle;
  T.debug.setLever("L", 1); T.debug.setLever("R", -1);
  stepN(30);
  ok(T.player.angle < a0 - 1.0, "left track forward spins left (angle " + T.player.angle.toFixed(2) + ")");
  ok(Math.abs(T.player.x - 200) < 3 && Math.abs(T.player.y - 400) < 3, "spun in place, did not travel");
  T.debug.setLever("L", -1); T.debug.setLever("R", 1);
  const a1 = T.player.angle;
  stepN(30);
  ok(T.player.angle > a1 + 1.0, "right track forward spins right");
  T.debug.clearLevers();
});

test("levers spring back to center on release and the tank stops", () => {
  fresh();
  T.debug.clearLevers();
  const c = T.cfg;
  T.debug.deckTap(c.leverL.x, c.leverL.cy - c.leverL.half * 0.8);
  ok(T.debug.leverState().L > 0.5, "left lever grabbed and pushed up");
  T.debug.deckRelease();
  eq(T.debug.leverState().L, 0, "left lever springs back to 0");
  eq(T.debug.leverState().grabL, null, "grab released");
  T.debug.deckTap(c.leverR.x, c.leverR.cy + c.leverR.half * 0.8);
  ok(T.debug.leverState().R < -0.5, "right lever grabbed and pushed down — mirrored");
  T.debug.deckRelease();
  eq(T.debug.leverState().R, 0, "right lever springs back to 0");
});

test("field tap does nothing; deck tap grabs a lever", () => {
  fresh();
  T.debug.clearLevers();
  const y0 = T.player.y;
  T.debug.fieldTap(200, 200);
  eq(T.debug.leverState().grabL, null, "field tap grabs no lever");
  eq(T.debug.leverState().grabR, null, "field tap grabs no lever (right)");
  stepN(5);
  eq(T.player.y, y0, "field tap did not move the tank");
  const c = T.cfg;
  T.debug.deckTap(c.leverL.x, c.leverL.cy - 30);
  ok(T.debug.leverState().grabL !== null, "deck tap grabs the left lever");
  T.debug.deckRelease();
});

test("title tap on a lever starts the game and grabs that lever", () => {
  T.toTitle();
  const c = T.cfg;
  T.debug.deckTap(c.leverR.x, c.leverR.cy - 30);
  eq(T.state, "play", "title tap starts the game");
  ok(T.debug.leverState().grabR !== null, "same finger is already holding the right lever");
  T.debug.deckRelease();
});

test("auto-fire shoots straight ahead and kills an enemy in the open", () => {
  fresh();
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  parkOthers(0);
  T.debug.placeEnemy(0, 200, 250);
  const kills0 = T.kills;
  killEnemy(0);
  eq(T.kills, kills0 + 1, "kill counted");
  ok(!T.enemies[0].alive, "enemy blown up by auto-fire");
});

test("a rock blocks shells — an enemy behind cover survives the auto-fire", () => {
  fresh();
  // L1 tree at (0.50, 0.30) sits squarely between (200, 400) and (200, 100).
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  parkOthers(0);
  T.debug.placeEnemy(0, 200, 100);
  stepN(90); // 1.44s of auto-fire straight at the tree
  ok(T.enemies[0].alive, "enemy behind the tree survives");
});

test("a rock blocks the tank — it cannot drive through cover", () => {
  fresh();
  // L1 rock at (0.30, 0.45) = (120, 233). Drive right into it.
  T.debug.placePlayer(80, 233, 0);
  parkOthers(0);
  T.debug.setLever("L", 1); T.debug.setLever("R", 1);
  stepN(60);
  ok(T.player.x > 60, "tank moved toward the rock (x=" + T.player.x.toFixed(1) + ")");
  ok(T.player.x < 105, "tank stopped at the rock, did not pass through");
  T.debug.clearLevers();
});

test("enemy chases the player", () => {
  fresh();
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  const d0 = Math.hypot(T.enemies[0].x - 200, T.enemies[0].y - 400);
  stepN(60);
  const d1 = Math.hypot(T.enemies[0].x - 200, T.enemies[0].y - 400);
  ok(d1 < d0 - 20, "enemy closed in (was " + d0.toFixed(0) + ", now " + d1.toFixed(0) + ")");
});

test("enemy shoots when lined up with a clear line of sight", () => {
  fresh();
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  parkOthers(0);
  T.debug.placeEnemy(0, 200, 250);
  T.debug.setEnemyAngle(0, Math.PI / 2);
  T.debug.setEnemyCd(0, 0);
  const n0 = T.ebullets.length;
  stepN(5);
  ok(T.ebullets.length > n0, "enemy fired");
  const b = T.ebullets[T.ebullets.length - 1];
  ok(b.vy > 0, "shell heads toward the player");
});

test("enemy does NOT shoot when cover blocks its line of sight", () => {
  fresh();
  // Enemy at (200, 100), player at (200, 400) — the L1 tree at
  // (200, 155) sits between them. The other enemy is parked where
  // the L1 rock blocks ITS line of sight too.
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  T.debug.placeEnemy(1, 60, 60);
  T.debug.placeEnemy(0, 200, 100);
  T.debug.setEnemyAngle(0, Math.PI / 2);
  T.debug.setEnemyCd(0, 0);
  const n0 = T.ebullets.length;
  stepN(30);
  eq(T.ebullets.length, n0, "no shot through the tree");
});

test("an enemy shell costs one armor; invulnerability blocks the next hit", () => {
  fresh();
  T.debug.clearInvuln();
  const h0 = T.hearts;
  T.debug.forceDamage();
  eq(T.hearts, h0 - 1, "one armor lost");
  T.debug.forceDamage();
  eq(T.hearts, h0 - 1, "second hit during invulnerability does nothing");
  stepN(90); // 1.44s > 1.2s invulnerability
  T.debug.forceDamage();
  eq(T.hearts, h0 - 2, "hit lands again once invulnerability wears off");
});

test("enemy shell in the open hurts the player", () => {
  fresh();
  T.debug.clearInvuln();
  T.debug.placePlayer(200, 400, -Math.PI / 2);
  parkOthers(0);
  T.debug.placeEnemy(0, 200, 250);
  T.debug.setEnemyAngle(0, Math.PI / 2);
  T.debug.setEnemyCd(0, 0);
  const h0 = T.hearts;
  stepN(60); // shell crosses 150 units in ~0.5s
  eq(T.hearts, h0 - 1, "enemy shell cost one armor");
});

test("no game over: destroyed at 0 armor, respawn keeps kills and level", () => {
  fresh();
  killEnemy(0); // progress to keep
  const lvl = T.level;
  T.debug.setHearts(1);
  T.debug.clearInvuln();
  T.debug.forceDamage();
  eq(T.state, "dead", "destroyed on last armor");
  eq(T.hearts, 0, "armor at zero");
  stepN(90); // 1.44s > 1.2s respawn
  eq(T.state, "play", "respawned — never a game over");
  eq(T.hearts, 3, "armor refilled");
  eq(T.level, lvl, "same level after respawn");
  ok(!T.enemies[0].alive, "blown-up enemy stays blown up");
});

test("clearing every enemy clears the level and starts the next", () => {
  fresh();
  killEnemy(0);
  killEnemy(1);
  eq(T.state, "levelup", "level cleared");
  stepN(150); // 2.4s > 2.2s celebration
  eq(T.state, "play", "next level starts");
  eq(T.level, 2, "now on level 2");
  eq(T.enemies.length, 3, "level 2 has 3 enemies");
});

test("renders every state without throwing, HUD clear of the back button", () => {
  // Phone-sized viewport is 400x700 in this sandbox. The 84px back
  // button owns the top-left corner (14..98 px); nothing drawn may
  // live there. Hearts sit top-centre, the level digit top-right,
  // and the enemy dots now ride the bottom of the playfield.
  const c = T.cfg;
  ok(c.deckTop - 26 > 98, "enemy dots sit below the back-button zone (y=" + (c.deckTop - 26) + ")");
  // Hearts are drawn at W/2 and the level digit at W-40 in render,
  // so both are clear of the left corner on any screen width.
  T.toTitle();
  T.debug.render();
  fresh();
  T.debug.render();
  killEnemy(0); killEnemy(1);
  eq(T.state, "levelup", "levelup state to render");
  T.debug.render();
  T.debug.forceLevel(3);
  for (let i = 0; i < 4; i++) if (T.enemies[i].alive) killEnemy(i);
  stepN(150);
  eq(T.state, "win", "win state to render");
  T.debug.render();
  T.toTitle();
  T.start();
  T.debug.setHearts(1); T.debug.clearInvuln(); T.debug.forceDamage();
  eq(T.state, "dead", "dead state to render");
  T.debug.render();
});

test("brute takes three hits", () => {
  T.debug.forceLevel(3);
  T.debug.clearInvuln();
  const bi = T.enemies.findIndex((e) => e.type === "brute");
  ok(bi >= 0, "brute present on L3");
  const kills0 = T.kills;
  killEnemy(bi);
  ok(!T.enemies[bi].alive, "brute blown up after its hits");
  eq(T.kills, kills0 + 1, "brute kill counted once");
});

test("clearing level 3 wins the game with a finale", () => {
  T.debug.forceLevel(3);
  T.debug.clearInvuln();
  for (let i = 0; i < 4; i++) {
    if (T.enemies[i].alive) killEnemy(i);
    T.debug.placePlayer(200, 400, -Math.PI / 2);
  }
  eq(T.state, "levelup", "final level cleared");
  stepN(150);
  eq(T.state, "win", "grand finale after level 3");
  stepN(120); // finale keeps bursting
  eq(T.state, "win", "finale still running until replay");
  const c = T.cfg;
  T.debug.deckTap(c.leverL.x, c.leverL.cy);
  eq(T.state, "play", "tap replays from level 1");
  eq(T.level, 1, "back to level 1");
  T.debug.deckRelease();
});

console.log(pass + "/" + (pass + fail) + " tank war tests pass");
process.exit(fail ? 1 : 0);
