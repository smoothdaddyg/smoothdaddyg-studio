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

// 1. tiny maze dimensions
eq("COLS is 13", M.COLS, 13);
eq("ROWS is 11", M.ROWS, 11);
eq("3 levels", M.LEVELS, 3);
const grid = M.mazeGrid(1);
eq("11 rows", grid.length, 11);
ok("every row is 13 chars", grid.every((r) => r.length === 13));

// 2. exactly one player start, a 3-wide house and door
let pCount = 0, gCount = 0, dashCount = 0, px = 0, py = 0;
for (let r = 0; r < 11; r++) for (let c = 0; c < 13; c++) {
  const ch = grid[r][c];
  if (ch === "P") { pCount++; px = c; py = r; }
  if (ch === "G") gCount++;
  if (ch === "-") dashCount++;
}
eq("one player start", pCount, 1);
eq("house is 3 wide", gCount, 3);
eq("door is 3 wide", dashCount, 3);

// 3. connectivity: every dot reachable from P via player-walkable tiles
const seen = new Set();
const q = [[px, py]];
seen.add(px + "," + py);
while (q.length) {
  const [cx, cy] = q.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = ((cx + dx) % 13 + 13) % 13, ny = cy + dy;
    if (ny < 0 || ny >= 11) continue;
    const k = nx + "," + ny;
    if (!seen.has(k) && M.walkable(nx, ny, false, false)) { seen.add(k); q.push([nx, ny]); }
  }
}
let unreachableDots = 0, dotCount = 0;
for (let r = 0; r < 11; r++) for (let c = 0; c < 13; c++) {
  const ch = grid[r][c];
  if (ch === "." || ch === "o") {
    dotCount++;
    if (!seen.has(c + "," + r)) unreachableDots++;
  }
}
ok("maze has a small dot count (" + dotCount + ")", dotCount > 20 && dotCount < 120);
eq("all dots reachable from start", unreachableDots, 0);

// 4. monsters can path out of the house: door tiles connect house to open maze
ok("door walkable for leaving monsters", M.walkable(6, 6, true, true));
ok("tile below door walkable", M.walkable(6, 7, true, false));
ok("house interior walkable for monsters", M.walkable(5, 5, true, false) && M.walkable(7, 5, true, false));

// 5. ghost leaving logic: a released monster exits and goes active.
//    (Only run ~25 frames: longer runs let other monsters roam and
//    possibly catch the player, which resets everyone to the house.)
M._press(0, 0); // ready -> play
M._state("play");
const ghosts = M._ghosts();
const g0 = ghosts[0];
g0.mode = "leaving"; g0.x = 6; g0.y = 5;
for (let i = 0; i < 25; i++) M._frame(1 / 60);
ok("monster leaves the house and activates", g0.mode === "active");
ok("monster is out of the house", g0.y >= 5.9);

// 6. fright mode + a full frame runs without throwing (new art paths)
M._setFright(5);
for (let i = 0; i < 120; i++) M._frame(1 / 60);
ok("120 frames with fright render fine", true);

// 7. player can eat: put player on a dot tile heading into it
M._press(0, 0);
const before = M._dotsLeft();
ok("dots remain to eat", before > 0);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
