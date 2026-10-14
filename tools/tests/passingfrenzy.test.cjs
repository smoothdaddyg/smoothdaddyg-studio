/* Node test for Passing Frenzy (window.__frenzyTest).
   Verifies: game starts, tap-to-throw works, ball modes, scoring, win at 10,
   restart, red sprinters, proximity steals (in/out of STEAL_RADIUS),
   steal scoring + bottom reset, shot-clock violation (no red points, bottom
   reset), beep warnings in the final 0.5s, pass resetting the clock,
   both teams streaming BOTH ways (up/down mix), off-screen recycling,
   and carrier-runoff turnovers.
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

// counting audio stub so tests can verify the shot-clock beeps
let toneCalls = 0;
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
  makeAudio: () => ({ tone: () => { toneCalls++; }, noise: noop, arp: noop, toggleMute: () => false, unlock: noop, state: () => "running" }),
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

// ---- test helpers (position players deterministically) ----
function allPlayers() { return F.debug.players(); }
function reds() { return allPlayers().filter((p) => p.team === "red"); }
function blues() { return allPlayers().filter((p) => p.team === "blue"); }
// park reds off-screen and freeze them: no accidental steals/interceptions
function parkReds() {
  for (const p of reds()) { p.x = 30; p.y = -400; p.vx = 0; p.vy = 0; }
}
function freezeAll() {
  for (const p of allPlayers()) { p.vx = 0; p.vy = 0; }
}

// game starts in title, players spawn
eq("initial state is title", F.state, "title");
ok("players exist", F.players >= 10);

// start the game
F.start();
eq("state is play after start", F.state, "play");
ok("blue has ball or ball in play", ["carried", "flying", "loose"].includes(F.ballMode));

// tap to throw (if blue has it, ball should fly)
F.tap(200, 100);
ok("tap changes ball mode or keeps play", F.state === "play");

// step the simulation — players keep moving, no crashes
// (reds parked off-screen so the unattended sim can't steal/intercept)
parkReds();
for (let i = 0; i < 120; i++) F.step(0.016);
ok("players still exist after 2s", F.players >= 10);
eq("state still play", F.state, "play");

// scoring: force blue to 8, then score to reach 10 -> win
// (forceScore sets the score then triggers a basket which adds 2)
F.start();
parkReds();
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
parkReds();
F.forceScore("red", 8); // 8 + 2 = 10
eq("red wins at 10", F.redScore, 10);
F.step(2.0);
eq("state is win (red)", F.state, "win");

// config sanity
ok("win score is 10", F.cfg.WIN_SCORE === 10);
eq("steal radius is 48", F.cfg.STEAL_RADIUS, 48);
eq("shot clock is 4.0s", F.cfg.SHOT_CLOCK, 4.0);
eq("shot warn window is 0.5s", F.cfg.SHOT_WARN, 0.5);
eq("spawn protection margin is 60", F.cfg.SPAWN_SAFE_Y, 60);
eq("red speed min matches blue (40)", F.cfg.RED_SPEED_MIN, 40);
eq("red speed max matches blue (140)", F.cfg.RED_SPEED_MAX, 140);

// red sprinters: all red speeds in range, and fast ones actually spawn
let maxRed = 0, allInRange = true;
for (let r = 0; r < 15; r++) {
  F.start();
  for (const p of reds()) {
    if (p.speed < 40 || p.speed > 140) allInRange = false;
    if (p.speed > maxRed) maxRed = p.speed;
  }
}
ok("all red speeds within 40-140", allInRange);
ok("red sprinters exist (some red faster than 120)", maxRed > 120);

// PROXIMITY STEAL: red inside STEAL_RADIUS steals (no touch needed)
// (carrier walked onto the court first — spawn protection blocks steals
// while the fresh carrier is still entering from below the screen)
F.start();
parkReds();
freezeAll();
let carrier = F.debug.ball().carrier;
ok("ball starts carried by blue", carrier && carrier.team === "blue");
carrier.y -= F.cfg.SPAWN_MARGIN + F.cfg.SPAWN_SAFE_Y + 40; // visibly in play
const thief = reds()[0];
thief.x = carrier.x; thief.y = carrier.y; // distance 0 < 48
const rsBefore = F.redScore;
F.step(0.016);
eq("proximity steal: red +2", F.redScore, rsBefore + 2);
eq("proximity steal triggers celebrate", F.state, "celebrate");

// after the steal: ball resets to a fresh blue player coming up from the bottom
let guard = 0;
while (F.state !== "play" && guard++ < 40) F.step(0.1);
eq("back to play after steal", F.state, "play");
eq("ball with blue after steal reset", F.ballMode, "carried");
const postSteal = F.debug.ball().carrier;
ok("reset carrier is blue", postSteal && postSteal.team === "blue");
ok("reset carrier enters from the bottom", postSteal && postSteal.y > 650);
ok("reset carrier moves upward (coming up)", postSteal && postSteal.vy < 0);

// NO STEAL just outside the radius (carrier on the court, past spawn protection)
F.start();
parkReds();
freezeAll();
carrier = F.debug.ball().carrier;
carrier.y -= F.cfg.SPAWN_MARGIN + F.cfg.SPAWN_SAFE_Y + 40; // visibly in play
const lurker = reds()[0];
lurker.x = carrier.x + F.cfg.STEAL_RADIUS + 25;
lurker.y = carrier.y;
const rsBefore2 = F.redScore;
for (let i = 0; i < 5; i++) F.step(0.016);
eq("no steal outside radius", F.redScore, rsBefore2);
eq("ball still carried by blue", F.ballMode, "carried");
ok("carrier still has it", F.debug.ball().carrier === carrier);

// SPAWN PROTECTION: no steal while the fresh blue carrier is still entering
// from below the screen — red can't spawn-camp the reset
F.start();
parkReds();
freezeAll();
carrier = F.debug.ball().carrier;
const spawnY = carrier.y; // H + SPAWN_MARGIN — still off-screen, not in play
const camper = reds()[0];
camper.x = carrier.x; camper.y = carrier.y; // right on top of the carrier
const rsBefore3 = F.redScore;
for (let i = 0; i < 10; i++) F.step(0.016);
eq("no spawn-camp steal while entering", F.redScore, rsBefore3);
eq("ball still carried by blue", F.ballMode, "carried");
ok("carrier still has it", F.debug.ball().carrier === carrier);
// ...but once the carrier is visibly on the court, the same proximity steals
carrier.y = spawnY - F.cfg.SPAWN_MARGIN - F.cfg.SPAWN_SAFE_Y - 40; // past the in-play line
camper.x = carrier.x; camper.y = carrier.y;
const rsBefore4 = F.redScore;
F.step(0.016);
eq("steal fires once carrier is in play", F.redScore, rsBefore4 + 2);

// SHOT CLOCK: holding too long = turnover, NO red points, blue reset
F.start();
parkReds();
freezeAll();
const holder = F.debug.ball().carrier;
for (let i = 0; i < 260; i++) F.step(0.016); // 4.16s > 4.0s clock
eq("no red points on shot-clock violation", F.redScore, 0);
eq("no blue points on shot-clock violation", F.blueScore, 0);
eq("ball back with blue after violation", F.ballMode, "carried");
const postClock = F.debug.ball().carrier;
ok("holder changed after violation", postClock && postClock !== holder);
ok("fresh clock after violation reset", F.debug.ball().possT < 1.0);
ok("violation reset carrier moves upward (coming up)", postClock && postClock.vy < 0);
eq("still playing after violation (no game over)", F.state, "play");

// BEEP WARNINGS: silent early, beeping in the final 0.5s
F.start();
parkReds();
freezeAll();
toneCalls = 0;
for (let i = 0; i < 180; i++) F.step(0.016); // 2.88s — before the warn window (warn starts at 3.5s)
eq("no beeps before final 0.5s", toneCalls, 0);
for (let i = 0; i < 80; i++) F.step(0.016); // through the warn window + expiry (4.16s total)
ok("beeps fire during final 0.5s", toneCalls >= 2);

// PASS RESETS THE CLOCK: hold 1.2s, complete a pass, new holder gets 0
F.start();
parkReds();
freezeAll();
const passer = F.debug.ball().carrier;
passer.x = 100; passer.y = 500;
const mate = blues().find((p) => p !== passer);
mate.x = 250; mate.y = 500; // far from the top basket (200,108): a pass, not a shot
for (const p of allPlayers()) {
  if (p === passer || p === mate) continue;
  p.x = 30; p.y = 30; // everyone else out of the pass lane
}
for (let i = 0; i < 75; i++) F.step(0.016); // hold 1.2s
ok("clock advanced while holding", F.debug.ball().possT > 1.0);
F.tap(250, 500); // pass to the mate
eq("ball flying after pass", F.ballMode, "flying");
let caught = false;
for (let i = 0; i < 60 && !caught; i++) {
  F.step(0.016);
  if (F.ballMode === "carried") caught = true;
}
ok("teammate caught the pass", caught);
ok("clock reset on catch", F.debug.ball().possT < 0.3);
ok("new holder is the mate", F.debug.ball().carrier === mate);

// PASS RELEASE: a red crowding the carrier can't intercept on frame 1 —
// the ball must leave the passer's hands first (universal throw grace).
// Regression test: taps used to feel like they "wouldn't release" because
// a nearby red instantly picked the pass for 2 free points.
F.start();
parkReds();
freezeAll();
const passer2 = F.debug.ball().carrier;
passer2.x = 200;
passer2.y -= F.cfg.SPAWN_MARGIN + F.cfg.SPAWN_SAFE_Y + 40; // on the court, in play
const lurker2 = reds()[0];
lurker2.x = passer2.x + 20; lurker2.y = passer2.y; // 20px away — inside CATCH_R
for (const p of reds().slice(1)) { p.x = 30; p.y = -400; }
const mate2 = blues().find((p) => p !== passer2);
mate2.x = 200; mate2.y = 250; // up-court, but clear of the top basket's shoot zone
for (const p of blues()) {
  if (p === passer2 || p === mate2) continue;
  p.x = 30; p.y = 30; // everyone else out of the pass lane
}
const rsBefore5 = F.redScore;
F.tap(200, 250); // pass forward to the mate
eq("tap releases the ball", F.ballMode, "flying");
F.step(0.016); // one frame — the old bug intercepted here for red +2
eq("no instant interception on frame 1", F.redScore, rsBefore5);
ok("ball still flying after frame 1", F.ballMode === "flying");

// BOTH DIRECTIONS: each team spawns a mix of up-movers and down-movers,
// dir is always ±1, and vy's sign always matches dir
let blueUp = 0, blueDown = 0, redUp = 0, redDown = 0, dirOk = true;
for (let r = 0; r < 8; r++) {
  F.start();
  for (const p of allPlayers()) {
    if (p.dir !== 1 && p.dir !== -1) dirOk = false;
    if ((p.dir < 0) !== (p.vy < 0)) dirOk = false; // vy sign matches dir
    if (Math.abs(p.vy) !== p.speed) dirOk = false; // |vy| == speed
    if (p.team === "blue") { if (p.vy < 0) blueUp++; else blueDown++; }
    else { if (p.vy < 0) redUp++; else redDown++; }
  }
}
ok("player dir is ±1, vy sign matches dir, |vy| == speed", dirOk);
ok("blue spawns both up-movers and down-movers", blueUp > 0 && blueDown > 0);
ok("red spawns both up-movers and down-movers", redUp > 0 && redDown > 0);

// OFF-SCREEN RECYCLING (bottom): a down-moving blue that exits the bottom
// edge is removed and the roster is replenished with a fresh player
F.start();
parkReds();
const wanderer = blues().find((p) => p !== F.debug.ball().carrier);
wanderer.vx = 0; wanderer.vy = 100; wanderer.y = 690; // heading for the bottom edge
const wandererRef = wanderer;
for (let i = 0; i < 30; i++) F.step(0.016); // 0.48s * 100px/s = 48px > 46px to the edge
ok("bottom-exiting player is removed", !F.debug.players().includes(wandererRef));
ok("roster replenished after bottom exit", F.players >= 12);
eq("still playing after bottom recycle", F.state, "play");

// OFF-SCREEN RECYCLING (top): an up-moving red that exits the top edge
// is removed and the roster is replenished
F.start();
parkReds();
const riser = reds()[0];
riser.vx = 0; riser.vy = -100; riser.y = 10; // heading for the top edge
const riserRef = riser;
for (let i = 0; i < 30; i++) F.step(0.016); // 48px up from y=10 -> -38 < -36 exits
ok("top-exiting player is removed", !F.debug.players().includes(riserRef));
ok("roster replenished after top exit", F.players >= 12);
eq("still playing after top recycle", F.state, "play");

// CARRIER RUNOFF: a blue carrier that runs off the bottom turns it over to red
F.start();
parkReds();
const runaway = F.debug.ball().carrier;
runaway.vx = 0; runaway.vy = 120; runaway.y = 690; // blue carrier heading down, near bottom
for (let i = 0; i < 30; i++) F.step(0.016); // 57.6px > 46px to the edge
const newCarrier = F.debug.ball().carrier;
ok("runoff turns the ball over to red", newCarrier && newCarrier.team === "red");
eq("still playing after runoff turnover", F.state, "play");
// red's reset carrier enters visibly from the top (moving down), never
// spawned off-screen with the ball
ok("red reset carrier moves downward (from the top)", newCarrier && newCarrier.vy > 0);
ok("red reset carrier near the top edge", newCarrier && newCarrier.y < 120);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
