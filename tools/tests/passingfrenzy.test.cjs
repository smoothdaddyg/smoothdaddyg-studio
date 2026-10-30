/* Node test for Passing Frenzy (window.__frenzyTest).
   Verifies: game starts, tap-to-throw works, ball modes, scoring, win at 7,
   restart, red sprinters, proximity steals (in/out of STEAL_RADIUS),
   steal scoring + bottom reset, shot-clock violation (no red points, bottom
   reset), beep warnings in the final 0.5s, pass resetting the clock,
   both teams streaming BOTH ways (up/down mix), off-screen recycling,
   carrier-runoff turnovers, and the 3 levels (2026-10-26): winning L1
   advances to L2, winning L2 advances to L3, winning L3 is the finale,
   and a red level win replays the same level (no game over).
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
  drawPixelNumber: noop,
  Math, JSON, Object, Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
// real chiptune for the makeMusic sequencer under test (tones stay silent:
// no AudioContext in node, but the step clock still runs)
const chiptunePath = path.join(__dirname, "..", "..", "js", "chiptune.js");
vm.runInContext(fs.readFileSync(chiptunePath, "utf8"), sandbox, { filename: "chiptune.js" });
const realMakeAudio = sandbox.makeAudio;
// game audio stub: counting tones for the beep tests, real sequencer for music
const stubAudio = { tone: () => { toneCalls++; }, noise: noop, arp: noop, toggleMute: () => false, unlock: noop, state: () => "running" };
stubAudio.makeMusic = (cfg) => realMakeAudio().makeMusic(cfg);
sandbox.makeAudio = () => stubAudio;
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

// LEVELS (2026-10-26): three levels — harder, faster, more people each.
// (forceScore sets the score then triggers a basket which adds 2)
eq("3 levels", F.levels.length, 3);
eq("level 1: 6 blue / 4 red, 40-140", F.levels[0].blue + "/" + F.levels[0].red + "/" + F.levels[0].min + "-" + F.levels[0].max, "6/4/40-140");
eq("level 2: 8 blue / 6 red, 70-190", F.levels[1].blue + "/" + F.levels[1].red + "/" + F.levels[1].min + "-" + F.levels[1].max, "8/6/70-190");
eq("level 3: 10 blue / 8 red, 100-240", F.levels[2].blue + "/" + F.levels[2].red + "/" + F.levels[2].min + "-" + F.levels[2].max, "10/8/100-240");

// winning level 1 advances to level 2 (NOT the win screen)
F.start();
eq("starts at level 1", F.level, 1);
parkReds();
F.forceScore("blue", 4); // 4 + 2 = 6 < 7, no winner yet
eq("blue at 6", F.blueScore, 6);
F.step(2.0); // celebrate finishes -> back to play (no winner yet)
eq("back to play after celebrate", F.state, "play");
F.forceScore("blue", 5); // 5 + 2 = 7 -> level 1 won
eq("blue wins level 1 at 7", F.blueScore, 7);
F.step(2.0); // celebrate finishes -> levelup splash
eq("levelup splash after level 1 win", F.state, "levelup");
eq("level is now 2", F.level, 2);
let lvlGuard = 0;
while (F.state !== "play" && lvlGuard++ < 40) F.step(0.1); // splash finishes -> level 2
eq("level 2 in play", F.state, "play");
eq("scores reset for level 2", F.blueScore + F.redScore, 0);
ok("level 2 has more players", F.players >= 14);
ok("level 2 speeds in 70-190", allPlayers().every((p) => p.speed >= 70 && p.speed <= 190));

// winning level 2 advances to level 3
parkReds();
F.forceScore("blue", 5); // 5 + 2 = 7 -> level 2 won
F.step(2.0);
eq("levelup splash after level 2 win", F.state, "levelup");
eq("level is now 3", F.level, 3);
lvlGuard = 0;
while (F.state !== "play" && lvlGuard++ < 40) F.step(0.1);
eq("level 3 in play", F.state, "play");
eq("scores reset for level 3", F.blueScore + F.redScore, 0);
ok("level 3 has more players", F.players >= 18);
ok("level 3 speeds in 100-240", allPlayers().every((p) => p.speed >= 100 && p.speed <= 240));

// winning level 3 IS the win (grand finale)
parkReds();
F.forceScore("blue", 5); // 5 + 2 = 7 -> finale win
eq("blue wins level 3 at 7", F.blueScore, 7);
// celebrate comes before win
ok("celebrate or win after finale", F.state === "celebrate" || F.state === "win");
F.step(2.0);
eq("state is win after finale", F.state, "win");

// play again resets to level 1
F.start();
eq("restart -> play", F.state, "play");
eq("restart -> level 1", F.level, 1);
eq("scores reset", F.blueScore + F.redScore, 0);

// red can win too
F.start();
parkReds();
F.forceScore("red", 5); // 5 + 2 = 7
eq("red wins at 7", F.redScore, 7);
F.step(2.0);
eq("state is win (red)", F.state, "win");

// red winning a level is NOT game over — TRY AGAIN replays the same level
// (sandbox 400x700: play button x=76..324, y=434..518, center 200,476)
F.tap(200, 476);
eq("try again -> play", F.state, "play");
eq("try again replays the same level", F.level, 1);
eq("scores reset on try again", F.blueScore + F.redScore, 0);

// config sanity
ok("win score is 7 (2026-10-30 quick levels)", F.cfg.WIN_SCORE === 7);
eq("steal radius is 48", F.cfg.STEAL_RADIUS, 48);
eq("shot clock is 4.0s", F.cfg.SHOT_CLOCK, 4.0);
eq("shot warn window is 0.5s", F.cfg.SHOT_WARN, 0.5);
eq("red count is 4 (blue outnumbers red)", F.cfg.RED_COUNT, 4);
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
// (carrier walked past red's goal first — the no-steal zone blocks steals
// while blue is still bringing the ball up from below the bottom basket)
F.start();
parkReds();
freezeAll();
let carrier = F.debug.ball().carrier;
ok("ball starts carried by blue", carrier && carrier.team === "blue");
carrier.y -= 200; // past red's goal (bottom basket at H-108): stealable
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

// NO STEAL just outside the radius (carrier past red's goal, stealable zone)
F.start();
parkReds();
freezeAll();
carrier = F.debug.ball().carrier;
carrier.y -= 200; // past red's goal (bottom basket at H-108)
const lurker = reds()[0];
lurker.x = carrier.x;
lurker.y = carrier.y + F.cfg.STEAL_RADIUS + 25; // 73px below — vertical offset
                                               // avoids the x-clamp flake when
                                               // the carrier spawns near an edge
const rsBefore2 = F.redScore;
for (let i = 0; i < 5; i++) F.step(0.016);
eq("no steal outside radius", F.redScore, rsBefore2);
eq("ball still carried by blue", F.ballMode, "carried");
ok("carrier still has it", F.debug.ball().carrier === carrier);

// NO-STEAL ZONE: reds can't take the ball until blue brings it past their
// goal (the bottom basket) — no spawn-camping the fresh carrier as it
// enters from the bottom of the screen
F.start();
parkReds();
freezeAll();
carrier = F.debug.ball().carrier;
const spawnY = carrier.y; // H + SPAWN_MARGIN — below red's goal line
const camper = reds()[0];
camper.x = carrier.x; camper.y = carrier.y; // right on top of the carrier
const rsBefore3 = F.redScore;
for (let i = 0; i < 10; i++) F.step(0.016);
eq("no steal below red's goal line", F.redScore, rsBefore3);
eq("ball still carried by blue", F.ballMode, "carried");
ok("carrier still has it", F.debug.ball().carrier === carrier);
// still safe just short of the line (sandbox H=700: basket line at 592)
carrier.y = 600;
camper.x = carrier.x; camper.y = carrier.y;
for (let i = 0; i < 5; i++) F.step(0.016);
eq("no steal just short of the goal line", F.redScore, rsBefore3);
eq("ball still carried by blue", F.ballMode, "carried");
// ...but once past their goal, the same proximity steals
carrier.y = 580; // above the line: past red's goal
camper.x = carrier.x; camper.y = carrier.y;
const rsBefore4 = F.redScore;
F.step(0.016);
eq("steal fires once past red's goal", F.redScore, rsBefore4 + 2);

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

// NO SELF-PASS: a fast carrier throwing in their own running direction
// must never re-catch the ball — the thrower is always right on it just
// after the grace, which used to "snap" the ball straight back to their
// hands (the won't-release bug).
F.start();
parkReds();
freezeAll();
const runner = F.debug.ball().carrier;
runner.x = 200; runner.y = 500; runner.vx = 0; runner.vy = -120; // sprinting up
for (const p of allPlayers()) {
  if (p === runner) continue;
  p.x = 360; p.y = 660; // everyone else clear of the throw lane
}
F.tap(200, 350); // throw up-court, the way the carrier is running
eq("ball flying after throw", F.ballMode, "flying");
let snappedBack = false;
for (let i = 0; i < 125; i++) { // ~2s of flight
  F.step(0.016);
  const b = F.debug.ball();
  if (b.mode === "carried" && b.carrier === runner) snappedBack = true;
}
ok("thrower never re-catches own pass", !snappedBack);

// PASS RELEASE: a red crowding the carrier can't intercept on frame 1 —
// the ball must leave the passer's hands first (universal throw grace).
// Regression test: taps used to feel like they "wouldn't release" because
// a nearby red instantly picked the pass for 2 free points.
F.start();
parkReds();
freezeAll();
const passer2 = F.debug.ball().carrier;
passer2.x = 200;
passer2.y -= 200; // past red's goal (bottom basket at H-108): stealable
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
ok("roster replenished after bottom exit", F.players >= 10);
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
ok("roster replenished after top exit", F.players >= 10);
eq("still playing after top recycle", F.state, "play");

// CARRIER RUNOFF: a blue carrier that runs off the bottom resets to a fresh
// blue player from the bottom — no dead red-carry interlude (red can't score
// with the ball and blue can't steal it back, so the old handoff to red just
// meant seconds of dead taps; regression test for Juan's "won't release" report)
F.start();
parkReds();
const runaway = F.debug.ball().carrier;
runaway.vx = 0; runaway.vy = 120; runaway.y = 690; // blue carrier heading down, near bottom
for (let i = 0; i < 30; i++) F.step(0.016); // 57.6px > 46px to the edge
const newCarrier = F.debug.ball().carrier;
ok("runoff resets to a fresh blue carrier", newCarrier && newCarrier.team === "blue");
eq("still playing after runoff", F.state, "play");
// the fresh carrier enters from the bottom (moving up), protected by the
// spawn gate until on-court
ok("fresh blue carrier moves upward (from the bottom)", newCarrier && newCarrier.vy < 0);
// no dead-tap window: a tap right after the runoff throws immediately
F.tap(200, 100);
eq("tap right after runoff throws the ball", F.ballMode, "flying");

// BACKGROUND MUSIC (his rule 2026-10-22: every game gets a loop, under the SFX)
F.start();
eq("music is on after start", F.musicOn, true);
const s0 = F.musicStep;
for (let i = 0; i < 120; i++) F.step(0.016); // ~2s of play
ok("music step clock advances under play", F.musicStep > s0);
const s1 = F.musicStep;
for (let i = 0; i < 600; i++) F.step(0.016); // ~9.6s covers a full 64-step loop at 142 BPM (6.8s)
ok("music keeps looping without stalling", F.musicStep > s1);
const mc = F.musicCfg;
eq("bass pattern is 64 steps (4 bars of 16ths)", mc.bass.length, 64);
eq("lead pattern is 64 steps (4 bars of 16ths)", mc.lead.length, 64);
// his 2026-10-30 direction: more bass than the old 0.13 ceiling —
// the triangle bed now sits at 0.2; his ears are the QA on whether
// it crowds the SFX, and it gets pulled back if it does.
ok("bass at the new louder level", mc.bassVol <= 0.2);
ok("lead stays under the SFX", mc.leadVol <= 0.05);
ok("kick stays under the SFX", mc.kickVol <= 0.2);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
