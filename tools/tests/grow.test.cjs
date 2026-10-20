/* Node test for GROW (window.__growTest).
   Verifies: variable flower heights (little to giant), all surprise
   visitor kinds exist and trigger, the storm brings a hurricane, the
   hurricane rips the plants out and throws them away, then a new seed
   begins under a calm sky.
   Run: node tools/tests/grow.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "grow", "game.js");

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
  makeAudio: () => ({ tone: noop, noise: noop, arp: noop, unlock: noop, state: () => "running" }),
  drawPixelNumber: noop,
  Math, JSON, Object, Array, setTimeout: noop,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(gamePath, "utf8"), sandbox, { filename: "game.js" });

const F = sandbox.window.__growTest;
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}

// ---- variable flower heights: little ones AND giants ----
{
  let min = 99, max = 0, giant = 0, little = 0;
  for (let i = 0; i < 400; i++) {
    const st = F.makeStem(i % 5);
    min = Math.min(min, st.vigor);
    max = Math.max(max, st.vigor);
    if (st.vigor >= 1.8) giant++;
    if (st.vigor < 0.7) little++;
  }
  ok("some flowers stay little (min vigor " + min.toFixed(2) + ")", min < 0.7);
  ok("some flowers grow huge (max vigor " + max.toFixed(2) + ")", max > 1.7);
  ok("giants still appear", giant > 0);
  ok("little ones are common, not freaks", little > 40);
}

// ---- all surprise visitor kinds trigger ----
for (const k of ["sun", "rain", "cloud", "wind", "snow", "rainbow", "unicorn",
                 "skunk", "frog", "butterfly", "snail", "shootingstar", "storm"]) {
  F.forceSurprise(k);
  eq("visitor triggers: " + k, F.surpriseKind, k);
}

// ---- the storm brings the hurricane ----
F.forceSurprise("storm");
eq("storm brings hurricane weather", F.weather, "hurricane");

// ---- the hurricane rips the plants out and throws them away ----
{
  // grow a plant first (4 taps = full bloom, no finale yet)
  for (let i = 0; i < 4; i++) F.tap(200);
  const before = F.stemCount;
  ok("plant has stems to rip", before >= 1);
  F.forceSurprise("storm");
  eq("storm brings hurricane weather", F.weather, "hurricane");
  // run the hurricane past its wind-up (4.2s)
  for (let i = 0; i < 300; i++) F._frame(0.016);
  eq("hurricane ended (calm after the storm)", F.weather, "sunny");
  eq("a new seed begins (one fresh stem)", F.stemCount, 1);
  ok("ripped plants are tumbling away", F.rippedCount > 0);
  // the tumbling plants clear out
  for (let i = 0; i < 200; i++) F._frame(0.016);
  eq("ripped plants cleared", F.rippedCount, 0);
}

// ---- hurricane only rips after the wind-up, not instantly ----
{
  for (let i = 0; i < 4; i++) F.tap(200);
  F.forceWeather("hurricane");
  for (let i = 0; i < 60; i++) F._frame(0.016); // 1s — still screaming
  eq("plants survive the first second", F.weather, "hurricane");
  ok("wind-up timer runs", F.hurricaneT > 0.5);
}

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
