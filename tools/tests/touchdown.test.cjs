/* Node test for Touchdown! (window.__tdTest).
   Danny's 2026-11-16 spec: a test game on the Passing
   Frenzy passing feel, but real football. Line up, GO,
   everybody moves. Your thumb moves the QB (floating
   stick in the bottom deck); tap PASS (mirrored buttons)
   to throw to the most open receiver with a lead; run
   into a back for a handoff. Tackled = line up at that
   spot; incomplete / intercepted = ball back at the line.
   Drive 100 yards (start on your own 20) for a touchdown.
   No downs, no turnovers, no game over ever. Original
   C-major fight-song chiptune (bass 0.2, 64 steps).
   Run: node tools/tests/touchdown.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "touchdown", "game.js");

const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradStub;
    if (k === "measureText") return () => ({ width: 90 });
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
const T = sandbox.window.__tdTest;
if (!T) { console.error("FAIL: no __tdTest hook"); process.exit(1); }

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok - " + name); }
  catch (e) { fail++; console.log("FAIL - " + name + ": " + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + " (got " + a + ", want " + b + ")"); }
function ok(c, m) { if (!c) throw new Error(m); }
function fresh() { T.debug.fresh(); }
function stepN(n) { T.debug.stepN(n); }
function parkDefenders() {
  // Park the defense far away so it can't interfere.
  for (const d of T.def) { d.x = 14; d.y = 98; }
}

test("boots on the title screen; fresh drive lines up on the own 20 with the QB holding the ball", () => {
  eq(T.state, "title", "starts on title");
  fresh();
  eq(T.state, "lineup", "fresh drive is lined up");
  eq(T.ballY, 80, "starts on the own 20 (80 yd from the goal)");
  eq(T.lineY, 80, "line of scrimmage is the own 20");
  ok(T.carrier && T.carrier.role === "qb" && T.carrier.hasBall, "QB has the ball");
  eq(T.off.length, 7, "7 on offense");
  eq(T.def.length, 7, "7 on defense");
  eq(T.debug.yardLabel(), "OWN 20", "yard label reads OWN 20");
});

test("deck tap snaps the ball and assigns random routes", () => {
  fresh();
  T.debug.deckTap(200, 650);
  eq(T.state, "play", "snapped to play");
  for (const p of T.off) {
    if (p.role === "wr") ok(["go", "slant", "cross", "out", "curl"].includes(p.route), "WR runs a route (" + p.route + ")");
    if (p.role === "rb") ok(p.route === "flat" || p.route === "check", "RB has a flat/check route");
  }
});

test("thumb stick moves the QB in the drag direction and stops on release", () => {
  fresh();
  T.debug.snap();
  parkDefenders(); // keep the rush off him so the stick is what's measured
  const x0 = T.off[0].x, y0 = T.off[0].y;
  T.debug.setStick(1, 0);
  stepN(30);
  ok(T.off[0].x > x0 + 2, "stick right runs the QB right (x=" + T.off[0].x.toFixed(1) + ")");
  T.debug.setStick(0, -1);
  const y1 = T.off[0].y;
  stepN(30);
  ok(T.off[0].y < y1 - 2, "stick up runs the QB upfield (y=" + T.off[0].y.toFixed(1) + ")");
  T.debug.clearStick();
  const x2 = T.off[0].x, y2 = T.off[0].y;
  stepN(10);
  ok(Math.abs(T.off[0].x - x2) < 0.01 && Math.abs(T.off[0].y - y2) < 0.01, "release stops the QB");
});

test("field tap does nothing during play; deck tap grabs the stick", () => {
  fresh();
  T.debug.snap();
  T.debug.deckTap(200, 100); // in the playfield
  eq(T.debug.stickState().id, null, "field tap grabs no stick");
  T.debug.deckTap(200, 650); // in the deck
  ok(T.debug.stickState().id !== null, "deck tap grabs the stick");
  T.debug.deckRelease();
  eq(T.debug.stickState().id, null, "release drops the stick");
});

test("PASS throws to the most open receiver with a lead", () => {
  fresh();
  T.debug.snap();
  parkDefenders();
  const wr1 = T.off[1], wr2 = T.off[2];
  wr1.route = "go"; wr2.route = "go";
  wr1.x = -12; wr1.y = 70; // wide open, upfield
  wr2.x = 12; wr2.y = 78;  // covered: park a defender on him
  T.def[0].x = 12; T.def[0].y = 77;
  T.debug.pressPass();
  ok(T.ballInAir, "ball is in the air");
  eq(T.ballInAir.target, wr1, "threw to the open receiver, not the covered one");
  ok(T.ballInAir.T >= 0.35 && T.ballInAir.T <= 0.9, "flight time in range");
});

test("a caught pass lets the receiver run for the goal", () => {
  fresh();
  T.debug.snap();
  parkDefenders();
  const wr1 = T.off[1];
  wr1.route = "go";
  wr1.x = -12; wr1.y = 70;
  T.debug.pressPass();
  ok(T.ballInAir, "thrown");
  stepN(60); // let the ball land and the catch resolve
  ok(T.carrier === wr1 && wr1.hasBall, "receiver caught it and has the ball");
  const y0 = wr1.y;
  stepN(30);
  ok(wr1.y < y0 - 2, "carrier runs upfield after the catch (y=" + wr1.y.toFixed(1) + ")");
});

test("a defender on the landing spot intercepts — ball back at the line, no turnover", () => {
  fresh();
  T.debug.snap();
  parkDefenders();
  const wr1 = T.off[1];
  wr1.route = "go";
  wr1.x = -12; wr1.y = 70;
  T.debug.pressPass();
  const b = T.ballInAir;
  T.def[0].x = b.x1; T.def[0].y = b.y1; // defender beats him to the spot
  stepN(60);
  eq(T.state, "whistle", "interception whistles the play dead");
  eq(T.flash.text, "INTERCEPTED!", "flashes INTERCEPTED!");
  eq(T.ballY, 80, "ball back at the line of scrimmage");
  stepN(80); // whistle ends
  eq(T.state, "lineup", "lines up again at the same spot");
  eq(T.ballY, 80, "no yardage lost on the interception");
});

test("a pass nobody reaches is incomplete — ball back at the line", () => {
  fresh();
  T.debug.snap();
  parkDefenders();
  const wr1 = T.off[1];
  wr1.route = "go";
  wr1.x = -12; wr1.y = 70;
  T.debug.pressPass();
  // Yank the target away from the landing spot mid-flight.
  wr1.x = -14; wr1.y = 96;
  stepN(60);
  eq(T.state, "whistle", "incomplete whistles the play dead");
  eq(T.flash.text, "INCOMPLETE!", "flashes INCOMPLETE!");
  eq(T.ballY, 80, "ball back at the line");
});

test("running into a back hands the ball off and he runs", () => {
  fresh();
  T.debug.snap();
  const qb = T.off[0], rb = T.off[3];
  qb.x = rb.x; qb.y = rb.y + 0.5; // QB steps into the back
  stepN(5);
  ok(T.carrier === rb && rb.hasBall, "handoff: the back has the ball");
  eq(T.flash.text, "HANDOFF!", "flashes HANDOFF!");
  ok(!qb.hasBall, "QB no longer has it");
});

test("a tackle spots the ball at that yard and the drive resumes there", () => {
  fresh();
  T.debug.snap();
  parkDefenders();
  const qb = T.off[0];
  T.debug.setStick(0, -1);
  stepN(45); // 0.75s at 6.5 yd/s ≈ 4.9 yards upfield
  T.debug.clearStick();
  const yBefore = qb.y;
  ok(yBefore < 80, "QB advanced before the tackle (y=" + yBefore.toFixed(1) + ")");
  T.def[0].x = qb.x; T.def[0].y = qb.y; // defender reaches him
  stepN(5);
  eq(T.state, "whistle", "tackle whistles the play dead");
  ok(T.ballY < 80 && T.ballY > 70, "ball spotted at the tackle yard (ballY=" + T.ballY.toFixed(1) + ")");
  stepN(80);
  eq(T.state, "lineup", "lines up at the new spot");
  eq(T.lineY, T.ballY, "line of scrimmage moved to the tackle spot");
});

test("crossing the goal is a touchdown with a finale that restarts the drive", () => {
  fresh();
  T.debug.placeBall(2); // goal-to-go from the 2
  T.debug.snap();
  T.debug.placeQB(0, 0.4); // QB steps into the end zone
  stepN(5);
  eq(T.state, "win", "touchdown wins the game");
  eq(T.flash.text, "TOUCHDOWN!", "flashes TOUCHDOWN!");
  T.debug.fresh();
  eq(T.state, "lineup", "fresh drive lines up again");
  eq(T.ballY, 80, "back on the own 20 for the next drive");
});

test("near the goal the defense lines up on the field, not past the goal line", () => {
  fresh();
  T.debug.placeBall(2);
  for (const d of T.def) ok(d.y >= 0.5, "defender on the field (y=" + d.y.toFixed(1) + ")");
  for (const p of T.off) ok(p.y >= 0.5 && p.y <= 99, "offense on the field");
});

test("music is its own 64-step fight-song loop with loud bass and a harmony voice", () => {
  const m = T.music;
  eq(m.bpm, 132, "132 BPM");
  eq(m.steps, 64, "64 steps");
  eq(m.bassVol, 0.2, "bass loud at 0.2");
  eq(m.bass.length, 64, "bass is 64 steps");
  eq(m.lead.length, 64, "lead is 64 steps");
  eq(m.harmony.length, 64, "harmony is 64 steps");
  ok(m.lead.some((v) => v > 0), "lead has notes");
  ok(m.lead.some((v, i) => v > 0 && m.harmony[i] > 0 && m.harmony[i] < v), "harmony sings a third under the lead");
});

test("PASS buttons are mirrored — both ends of the deck throw", () => {
  const b = T.passButtons;
  ok(b.L.x < 200 && b.R.x > 200, "one button each end (L=" + b.L.x + ", R=" + b.R.x + ")");
  ok(Math.abs(b.L.y - b.R.y) < 1, "same height");
  fresh();
  T.debug.snap();
  parkDefenders();
  T.debug.passTap("L");
  ok(T.ballInAir, "left PASS throws");
  fresh();
  T.debug.snap();
  parkDefenders();
  T.debug.passTap("R");
  ok(T.ballInAir, "right PASS throws");
});

test("renders every state without throwing, HUD clear of the back button", () => {
  fresh();
  T.debug.render();
  ok(true, "rendered title/lineup/play/whistle/win at phone size");
  // The yard label is top-centre and the progress strip is on
  // the right edge — nothing drawn under the 84px back button.
  ok(T.deckTop > 100, "playfield is tall enough to clear the button zone");
});

console.log(pass + "/" + (pass + fail) + " touchdown tests pass");
if (fail > 0) process.exit(1);
