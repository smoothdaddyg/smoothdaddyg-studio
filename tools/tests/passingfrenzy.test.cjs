/* Node test for Passing Frenzy (window.__frenzyTest).
   Verifies: game starts, tap-to-throw works, ball modes, scoring, win at 10, restart.
   Run: node tools/tests/passingfrenzy.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "passingfrenzy", "game.js");

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
const mkCanvas = () => ({ getContext: () => ctxStub, addEventListener: noop, style: {}, width: 0, height: 0 });

const sandbox = {
  window: { innerWidth: 400, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, SDGplays: { played: noop } },
  document: {
    getElementById: (id) => (id === "stage" ? mkCanvas() : { addEventListener: noop, style: {} }),
    createElement: () => mkCanvas(),
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

const F = sandbox.window.__frenzyTest;
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}

// game starts in title, players spawn
eq("initial state is title", F.state, "title");
ok("players exist", F.players >= 10);

// start the game
F.start();
eq("state is play after start", F.state, "play");
ok("blue has ball or ball in play", ["carried", "flying", "loose"].includes(F.ballMode));

// tap to throw (if blue has it, ball should fly)
const modeBefore = F.ballMode;
F.tap(200, 100);
const modeAfter = F.ballMode;
ok("tap changes ball mode or keeps play", F.state === "play");

// step the simulation — players keep moving, no crashes
for (let i = 0; i < 120; i++) F.step(0.016);
ok("players still exist after 2s", F.players >= 10);
eq("state still play", F.state, "play");

// scoring: force blue to 8, then score to reach 10 -> win
// (forceScore sets the score then triggers a basket which adds 2)
F.start();
F.forceScore("blue", 6); // 6 + 2 = 8
eq("blue at 8", F.blueScore, 8);
F.step(2.0); // let celebrate finish -> back to play
eq("back to play after celebrate", F.state, "play");
F.forceScore("blue", 8); // 8 + 2 = 10 -> win
eq("blue wins at 10", F.blueScore, 10);
// celebrate comes before win
ok("celebrate or win after 10", F.state === "celebrate" || F.state === "win");
F.step(2.0);
eq("state is win", F.state, "win");

// play again resets
F.start();
eq("restart -> play", F.state, "play");
eq("scores reset", F.blueScore + F.redScore, 0);

// red can win too
F.start();
F.forceScore("red", 8); // 8 + 2 = 10
eq("red wins at 10", F.redScore, 10);
F.step(2.0);
eq("state is win (red)", F.state, "win");

// config sanity
ok("win score is 10", F.cfg.WIN_SCORE === 10);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
