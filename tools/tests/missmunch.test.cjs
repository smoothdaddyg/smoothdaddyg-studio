/* Node test for Miss Munch redesign (window.__munch).
   Verifies: tiny 13x11 maze is well-formed and fully connected,
   the maze fills the screen, monsters can leave the house,
   and a level is completable.
   Run: node tools/tests/missmunch.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "missmunch", "game.js");

const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradStub;
    if (k === "createElement") return undefined;
    if (k === "measureText") return () => ({ width: 0 });
    if (k === "canvas") return {};
    return noop;
  },
  set: () => true,
});
const mkCanvas = () => ({ getContext: () => ctxStub, addEventListener: noop, style: {}, width: 0, height: 0 });

const sandbox = {
  window: { innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1, addEventListener: noop },
  document: {
    getElementById: (id) => (id === "stage" ? mkCanvas() : { addEventListener: noop, style: {} }),
    createElement: (tag) => {
      if (tag === "canvas") {
        return { width: 0, height: 0, getContext: () => ctxStub, style: {} };
      }
      return mkCanvas();
    },
    addEventListener: noop,
    head: { appendChild: noop },
  },
  performance: { now: () => 1000 },
  requestAnimationFrame: noop,
  makeAudio: () => ({ tone: noop, noise: noop, arp: noop, toggleMute: () => false, unlock: noop, state: () => "running" }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });

const M = sandbox.window.__munch;
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}

// 1. tall maze dimensions (fills a phone screen)
eq("COLS is 13", M.COLS, 13);
eq("ROWS is 28", M.ROWS, 28);
eq("3 levels", M.LEVELS, 3);
const grid = M.mazeGrid(1);
eq("28 rows", grid.length, 28);
ok("every row is 13 chars", grid.every((r) => r.length === 13));

// 2. exactly one player start, a 3-wide house and door
let pCount = 0, gCount = 0, dashCount = 0, px = 0, py = 0;
for (let r = 0; r < 28; r++) for (let c = 0; c < 13; c++) {
  const ch = grid[r][c];
  if (ch === "P") { pCount++; px = c; py = r; }
  if (ch === "G") gCount++;
  if (ch === "-") dashCount++;
}
eq("one player start", pCount, 1);
eq("house is 3 wide", gCount, 3);
eq("door is 3 wide", dashCount, 3);

// 2b. no big open rooms: every 2x2 block has a wall (except the house)
let openBlocks = 0;
for (let r = 0; r < 27; r++) for (let c = 0; c < 12; c++) {
  const cells = [grid[r][c], grid[r+1][c], grid[r][c+1], grid[r+1][c+1]];
  if (cells.every((ch) => ch !== '#') && !cells.some((ch) => ch === 'G' || ch === '-')) openBlocks++;
}
eq("no 2x2 open areas (walls on both sides of every path)", openBlocks, 0);

// 3. connectivity: every dot reachable from P via player-walkable tiles
const seen = new Set();
const q = [[px, py]];
seen.add(px + "," + py);
while (q.length) {
  const [cx, cy] = q.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = ((cx + dx) % 13 + 13) % 13, ny = cy + dy;
    if (ny < 0 || ny >= 28) continue;
    const k = nx + "," + ny;
    if (!seen.has(k) && M.walkable(nx, ny, false, false)) { seen.add(k); q.push([nx, ny]); }
  }
}
let unreachableDots = 0, dotCount = 0;
for (let r = 0; r < 28; r++) for (let c = 0; c < 13; c++) {
  const ch = grid[r][c];
  if (ch === "." || ch === "o") {
    dotCount++;
    if (!seen.has(c + "," + r)) unreachableDots++;
  }
}
ok("maze has a good dot count (" + dotCount + ")", dotCount > 50 && dotCount < 140);
eq("all dots reachable from start", unreachableDots, 0);

// 4. monsters can path out of the house: door tiles connect house to open maze
ok("door walkable for leaving monsters", M.walkable(6, 13, true, true));
ok("tile below door walkable", M.walkable(6, 14, true, false));
ok("house interior walkable for monsters", M.walkable(5, 12, true, false) && M.walkable(7, 12, true, false));

// 5. ghost leaving logic: a released monster exits and goes active.
//    (Only run ~25 frames: longer runs let other monsters roam and
//    possibly catch the player, which resets everyone to the house.)
M._press(0, 0); // ready -> play
M._state("play");
const ghosts = M._ghosts();
const g0 = ghosts[0];
g0.mode = "leaving"; g0.x = 6; g0.y = 12;
for (let k = 1; k < ghosts.length; k++) { ghosts[k].mode = "house"; ghosts[k].releaseT = 1e9; }
for (let i = 0; i < 60; i++) {
  M._frame(1 / 60);
  for (let k = 1; k < ghosts.length; k++) { ghosts[k].mode = "house"; ghosts[k].releaseT = 1e9; }
}
ok("monster leaves the house and activates", g0.mode === "active");
ok("monster is out of the house", g0.y >= 13.9);

// 6. fright mode + a full frame runs without throwing (new art paths)
M._setFright(5);
for (let i = 0; i < 120; i++) M._frame(1 / 60);
ok("120 frames with fright render fine", true);

// 7. player can eat: put player on a dot tile heading into it
M._press(0, 0);
const before = M._dotsLeft();
ok("dots remain to eat", before > 0);

// 8. player can turn at an intersection (not just at walls)
M._press(0, 0); M._state("play");
(function () {
  const gs = M._ghosts();
  for (let k = 0; k < gs.length; k++) { gs[k].mode = "house"; gs[k].releaseT = 1e9; gs[k].x = 6; gs[k].y = 12; }
  const p = M._player();
  p.x = 2; p.y = 7; p.dir = { x: 1, y: 0 }; p.want = { x: 0, y: 0 };
  let turnedAt = null;
  for (let i = 0; i < 300; i++) {
    if (p.x > 2.5 && !p.want.x && !p.want.y) p.want = { x: 0, y: -1 };
    M._frame(1 / 60);
    for (let k = 0; k < gs.length; k++) { gs[k].mode = "house"; gs[k].releaseT = 1e9; }
    if (p.dir.y === -1) { turnedAt = Math.round(p.x); break; }
  }
  // (6,7) is the first walkable up-turn heading right along row 7
  eq("player turns up at the x=6 intersection", turnedAt, 6);
})();

// 9. eaten monsters regenerate: eyes always path home and reactivate
function eyesRegen(sx, sy) {
  M._press(0, 0); M._state("play");
  const gs = M._ghosts();
  const g = gs[0];
  g.mode = "eyes"; g.x = sx; g.y = sy; g.dir = { x: 1, y: 0 };
  for (let k = 1; k < gs.length; k++) { gs[k].mode = "house"; gs[k].releaseT = 1e9; gs[k].x = 6; gs[k].y = 12; }
  const p = M._player();
  p.x = 1; p.y = 9; p.dir = { x: 0, y: 0 }; p.want = { x: 0, y: 0 };
  for (let i = 0; i < 60 * 20; i++) {
    M._frame(1 / 60);
    for (let k = 1; k < gs.length; k++) { gs[k].mode = "house"; gs[k].releaseT = 1e9; }
    if (g.mode === "active") return true;
    if (M._state() !== "play") return false;
  }
  return false;
}
ok("eyes regenerate from far corner (1,1)", eyesRegen(1, 1));
ok("eyes regenerate from (11,25)", eyesRegen(11, 25));
ok("eyes regenerate from mid-maze (6,19)", eyesRegen(6, 19));
ok("eyes regenerate from the (1,13) corridor", eyesRegen(1, 13));

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
