/* ============================================================
   SmoothDaddyG — Play counters (js/plays.js)
   ------------------------------------------------------------
   Tracks how many times each game is opened, stored in the
   browser's localStorage (per device). No backend, no network —
   nothing ever leaves the device.

   Why localStorage: the studio owner checks popularity on his
   daughter's iPad, so HER counts are exactly what he wants to
   see. Visitors never see counts (studio mode is a private,
   owner-only view toggled by a long-press on the logo).

   API (global SDGplays):
     bump(id)        increment the play count for a game id
     get(id)         count for one id (missing = 0)
     getAll()        {id: count} for every id in GAMES (missing = 0)
     played(id)      THE shared "a play session started" event: bumps the
                     local counter AND logs to the server (fire-and-forget).
                     Games call this on replay/restart; the first tap of a
                     visit is logged automatically (see autoPlay below).
     globalStats()   Promise -> {ok, total, perGame, perDay, since} from the
                     server, or null when unreachable. Owner dashboard only.
     sortByPlays(list, counts)  list sorted by plays desc; ties
                     keep their original relative order
     isStudio()      true if studio flag set or ?studio=1 in URL
                     (the URL form also persists the flag)
     toggleStudio()  flip the studio flag, return the new state

   Auto-init: when loaded from a /games/<id>/ page, bump(id)
   exactly once per page load. All storage access is guarded so
   this file can never throw (private mode, disabled storage).
   ============================================================ */

(function () {
  "use strict";

  var PREFIX = "sdg_plays_";
  var STUDIO_KEY = "sdg_studio";
  var bumped = {}; // in-memory guard: bump once per id per page load

  function store() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  function readNum(key) {
    var s = store();
    if (!s) return 0;
    try {
      var raw = s.getItem(key);
      if (raw === null || raw === undefined) return 0;
      var n = parseInt(String(raw), 10);
      return isNaN(n) || n < 0 ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function writeNum(key, n) {
    var s = store();
    if (!s) return;
    try {
      s.setItem(key, String(n));
    } catch (e) {
      /* storage unavailable — counts simply don't persist */
    }
  }

  function bump(id) {
    if (!id) return 0;
    var n = readNum(PREFIX + id) + 1;
    writeNum(PREFIX + id, n);
    return n;
  }

  // Idempotent variant used only by the auto-init, so a page that
  // also calls bump(id) explicitly can't double-count one load.
  function bumpOnce(id) {
    if (!id || bumped[id]) return readNum(PREFIX + id);
    bumped[id] = true;
    return bump(id);
  }

  function get(id) {
    return readNum(PREFIX + id);
  }

  function getAll() {
    var out = {};
    var ids = [];
    try {
      if (typeof GAMES !== "undefined" && GAMES && GAMES.length) {
        for (var i = 0; i < GAMES.length; i++) {
          if (GAMES[i] && GAMES[i].id) ids.push(GAMES[i].id);
        }
      }
    } catch (e) {
      ids = [];
    }
    if (!ids.length) {
      // GAMES catalog not loaded (e.g. a game page): scan storage keys.
      var s = store();
      if (s) {
        try {
          for (var k = 0; k < s.length; k++) {
            var key = s.key(k);
            if (key && key.indexOf(PREFIX) === 0) ids.push(key.slice(PREFIX.length));
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    for (var j = 0; j < ids.length; j++) {
      out[ids[j]] = readNum(PREFIX + ids[j]);
    }
    return out;
  }

  function sortByPlays(list, counts) {
    counts = counts || {};
    var decorated = [];
    for (var i = 0; i < list.length; i++) {
      var g = list[i];
      decorated.push({
        g: g,
        i: i,
        n: (g && counts[g.id]) || 0,
      });
    }
    decorated.sort(function (a, b) {
      if (b.n !== a.n) return b.n - a.n;
      return a.i - b.i; // stable: ties keep catalog order
    });
    var out = [];
    for (var k = 0; k < decorated.length; k++) out.push(decorated[k].g);
    return out;
  }

  function studioFlag() {
    var s = store();
    if (!s) return false;
    try {
      return s.getItem(STUDIO_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setStudioFlag(on) {
    var s = store();
    if (!s) return;
    try {
      s.setItem(STUDIO_KEY, on ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }

  function isStudio() {
    try {
      var q = String((typeof location !== "undefined" && location.search) || "");
      if (/(?:^|[?&])studio=1(?:&|$)/.test(q)) {
        setStudioFlag(true); // ?studio=1 also persists the flag
        return true;
      }
    } catch (e) {
      /* ignore */
    }
    return studioFlag();
  }

  function toggleStudio() {
    var on = !studioFlag();
    setStudioFlag(on);
    return on;
  }

  // Auto-bump on game pages: /games/<id>/ or /games/<id>/index.html
  var pageGameId = null;
  (function autoBump() {
    try {
      var path = String((typeof location !== "undefined" && location.pathname) || "");
      var m = path.match(/\/games\/([a-z0-9-]+)(?:\/|$)/i);
      if (m && m[1]) { pageGameId = m[1]; bumpOnce(m[1]); }
    } catch (e) {
      /* never throw */
    }
  })();

  // Where the API lives, relative to this game page (/games/<id>/ -> /).
  function apiBase() {
    try {
      var p = String((typeof location !== "undefined" && location.pathname) || "");
      var m = p.match(/^(.*\/)games\/[a-z0-9-]+(?:\/|$)/i);
      if (m && m[1]) return m[1];
    } catch (e) {
      /* ignore */
    }
    return "/";
  }

  // The one shared "someone played" event. Fire-and-forget POST to the
  // server log. Never throws, never blocks the game.
  // (The local per-device counter is deliberately untouched: it keeps
  // its v1 meaning of "times opened", while the server log counts
  // actual play sessions.)
  function played(id) {
    if (!id) return;
    try {
      var url = apiBase() + "api/log-play.php";
      var body = "game=" + encodeURIComponent(id);
      var sent = false;
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          sent = !!navigator.sendBeacon(url, new Blob([body], { type: "application/x-www-form-urlencoded" }));
        } catch (e) {
          sent = false;
        }
      }
      if (!sent && typeof fetch === "function") {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body,
          keepalive: true,
        }).catch(function () { /* offline — the local count stands */ });
      }
    } catch (e) {
      /* analytics must never break the game */
    }
  }

  // First tap of a visit = "pressed play". Games with explicit replay
  // buttons call played(id) themselves on every replay; this covers the
  // first session of every game with zero per-game code.
  (function autoPlay() {
    if (!pageGameId) return;
    var fired = false;
    function onFirst() {
      if (fired) return;
      fired = true;
      try { window.removeEventListener("pointerdown", onFirst); } catch (e) {}
      played(pageGameId);
    }
    try {
      window.addEventListener("pointerdown", onFirst);
    } catch (e) {
      /* ignore */
    }
  })();

  // Owner dashboard: global counts from the server. Resolves null when
  // unreachable — the dashboard just shows local counts instead.
  function globalStats() {
    return new Promise(function (resolve) {
      try {
        fetch(apiBase() + "api/stats.php", { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (j) { resolve(j && j.ok ? j : null); })
          .catch(function () { resolve(null); });
      } catch (e) {
        resolve(null);
      }
    });
  }

  window.SDGplays = {
    bump: bump,
    played: played,
    globalStats: globalStats,
    get: get,
    getAll: getAll,
    sortByPlays: sortByPlays,
    isStudio: isStudio,
    toggleStudio: toggleStudio,
  };
})();
