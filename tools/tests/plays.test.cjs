/* Node test for the shared play-logging interface (window.SDGplays).
   Verifies: played() bumps local + POSTs, first-tap auto-log fires once,
   replay calls log again, globalStats parses the server payload.
   Run: node tools/tests/plays.test.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const playsPath = path.join(__dirname, "..", "..", "js", "plays.js");

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL", name); }
}
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}

function loadPlays(pathname, hooks) {
  hooks = hooks || {};
  const posts = [];
  const store = {};
  const listeners = {};
  const sandbox = {
    location: { pathname: pathname, search: "" },
    addEventListener: (t, fn) => { listeners[t] = listeners[t] || []; listeners[t].push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      key: (i) => Object.keys(store)[i],
      get length() { return Object.keys(store).length; },
    },
    navigator: hooks.beacon === false ? {} : {
      sendBeacon: (url, blob) => { posts.push({ url, body: hooks.readBlob ? hooks.readBlob(blob) : "?" }); return true; },
    },
    fetch: hooks.fetch || null,
    Blob: function (parts, opts) { this.parts = parts; this.type = opts && opts.type; },
    Promise, Math, JSON, Object, Array, encodeURIComponent,
  };
  sandbox.window = sandbox; // like a browser: window === globalThis
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(playsPath, "utf8"), ctx, { filename: "plays.js" });
  return {
    SDGplays: ctx.SDGplays,
    posts,
    store,
    firePointerDown: () => { (listeners.pointerdown || []).forEach((fn) => fn()); },
    pointerListeners: () => (listeners.pointerdown || []).length,
  };
}
const readBlob = (b) => b.parts.join("");

// 1. played() POSTs to the API; the local counter keeps its v1 meaning
{
  const t = loadPlays("/games/blitz/", { readBlob });
  eq("page load bumps local once", t.store["sdg_plays_blitz"], "1");
  t.SDGplays.played("blitz");
  eq("one beacon POST", t.posts.length, 1);
  ok("POST hits api/log-play.php", t.posts[0].url === "/api/log-play.php");
  ok("POST body carries the game", t.posts[0].body === "game=blitz");
  // replays log again (no dedup); local stays at the page-load bump
  t.SDGplays.played("blitz");
  eq("replay POSTs again", t.posts.length, 2);
  eq("local untouched by played()", t.store["sdg_plays_blitz"], "1");
}

// 2. first tap of a visit auto-logs exactly once
{
  const t = loadPlays("/games/grow/", { readBlob });
  t.firePointerDown();
  t.firePointerDown();
  t.firePointerDown();
  eq("auto-play fires once", t.posts.length, 1);
  ok("auto-play names the game", t.posts[0].body === "game=grow");
  eq("listener removed after fire", t.pointerListeners(), 0);
}

// 3. no auto anything off game pages
{
  const t = loadPlays("/games.html", { readBlob });
  t.firePointerDown();
  eq("no POST off game pages", t.posts.length, 0);
}

// 4. falls back to fetch when beacon is missing
{
  const posts = [];
  const t = loadPlays("/games/pop/", {
    beacon: false,
    fetch: (url, opts) => { posts.push({ url, body: opts.body }); return Promise.resolve({ catch: () => {} }); },
  });
  t.SDGplays.played("pop");
  eq("fetch fallback POSTs", posts.length, 1);
  ok("fetch hits the api", posts[0].url === "/api/log-play.php");
}

// 5. globalStats resolves the server payload; null when unreachable
{
  const payload = { ok: true, total: 5, perGame: { blitz: 3, grow: 2 }, perDay: { "2026-10-07": 5 }, since: 1700000000 };
  const t = loadPlays("/games.html", {
    beacon: false,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(payload) }),
  });
  t.SDGplays.globalStats().then((s) => {
    eq("globalStats total", s.total, 5);
    eq("globalStats perGame", s.perGame.blitz, 3);
    const t2 = loadPlays("/games.html", { beacon: false, fetch: () => Promise.reject(new Error("down")) });
    t2.SDGplays.globalStats().then((s2) => {
      eq("globalStats null when down", s2, null);
      console.log(pass + " passed, " + fail + " failed");
      process.exit(fail ? 1 : 0);
    });
  });
}
