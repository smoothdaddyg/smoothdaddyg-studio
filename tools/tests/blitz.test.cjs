/* Node test for Biplane Blitz projectile physics (window.__blitz).
   Run: node tools/tests/blitz.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const gamePath = path.join(__dirname, "..", "..", "games", "blitz", "game.js");

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
  window: { innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1, addEventListener: noop },
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

const B = sandbox.window.__blitz;
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}

B._state("play");
B._setPlane({ y: 300, vy: 0 });

// bullets: level flight -> purely horizontal
B._tryFire();
let bl = B._bullets();
eq("level bullet vy = 0", bl[bl.length - 1].vy, 0);
const y0 = bl[bl.length - 1].y;
B._frame(0.25); // cooldown
B._frame(0.25);
eq("level bullet y unchanged", Math.round(bl[bl.length - 1].y), Math.round(y0));

// bullets: climbing -> angled upward, rises over time
B._setPlane({ vy: -260 });
B._tryFire();
bl = B._bullets();
const bUp = bl[bl.length - 1];
eq("climb bullet inherits vy", bUp.vy, -260);
const uy0 = bUp.y;
B._frame(0.3);
ok("climb bullet moved up", bUp.y < uy0 - 30);
ok("climb bullet moved forward", bUp.x > 0);

// bullets: diving -> angled downward
B._frame(0.25); // cooldown (vy eases to 0 without steering input)
B._setPlane({ vy: 300 });
B._tryFire();
bl = B._bullets();
const bDn = bl[bl.length - 1];
eq("dive bullet inherits vy", bDn.vy, 300);
const dy0 = bDn.y;
B._frame(0.3);
ok("dive bullet moved down", bDn.y > dy0 + 30);

// bombs: climbing -> pops up first, then weight wins
B._setPlane({ vy: -260 });
B._tryBomb();
let bm = B._bombs();
const bombUp = bm[bm.length - 1];
eq("climb bomb initial vy", bombUp.vy, -210);
const by0 = bombUp.y;
B._frame(0.1);
ok("climb bomb rises at first", bombUp.y < by0);
B._frame(0.5);
ok("climb bomb falling after arc", bombUp.vy > 0);

// bombs: diving -> drops fast immediately
B._frame(1.0); // bomb cooldown
B._setPlane({ vy: 300 });
B._tryBomb();
bm = B._bombs();
const bombDn = bm[bm.length - 1];
eq("dive bomb initial vy", bombDn.vy, 350);
const bd0 = bombDn.y;
B._frame(0.2);
ok("dive bomb drops fast", bombDn.y > bd0 + 40);

// bombs: level -> gentle drop like before
B._setPlane({ vy: 0 });
B._frame(1.0);
B._tryBomb();
bm = B._bombs();
eq("level bomb initial vy", bm[bm.length - 1].vy, 50);

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
