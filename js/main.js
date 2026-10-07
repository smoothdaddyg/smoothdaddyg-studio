/* SmoothDaddyG site JS: pixel sprites, game cards, nav state.
   No dependencies. */

(function () {
  "use strict";

  /* ---------- pixel-art sprites (string maps, X = filled) ---------- */
  const SPRITES = {
    ball: [
      "..XXX..",
      ".XXXXX.",
      "XXXXXXX",
      "XXXXXXX",
      "XXXXXXX",
      ".XXXXX.",
      "..XXX..",
    ],
    gem: [
      "...X...",
      "..XXX..",
      ".XXXXX.",
      "XXXXXXX",
      ".XXXXX.",
      "..XXX..",
      "...X...",
    ],
    rock: [
      "...XX..",
      "..XXXX.",
      "XXXXXXX",
      "XXXXXXX",
      ".XXXXXX",
      "..XXXX.",
      "...X...",
    ],
    invader: [
      "..X...X..",
      "...X.X...",
      "..XXXXX..",
      ".XX.X.XX.",
      "XXXXXXXXX",
      "X.XXXXX.X",
      "X.X...X.X",
      "...X.X...",
    ],
    coin: [
      ".XXXX.",
      "XXXXXX",
      "XX..XX",
      "XX..XX",
      "XX..XX",
      "XXXXXX",
      ".XXXX.",
    ],
    car: [
      "...X...",
      "..XXX..",
      ".XXXXX.",
      "XXXXXXX",
      "XX.X.XX",
      "XXXXXXX",
      ".XXXXX.",
    ],
  };

  /* Render a sprite map as crisp inline SVG. */
  function spriteSVG(name, color) {
    const map = SPRITES[name] || SPRITES.ball;
    const h = map.length;
    const w = Math.max(...map.map((r) => r.length));
    let rects = "";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < (map[y] || "").length; x++) {
        if (map[y][x] === "X") {
          rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 ${w} ${h}" fill="${color}" aria-hidden="true">${rects}</svg>`;
  }

  function neon(hue) {
    return `hsl(${hue}, 95%, 60%)`;
  }

  function artStyle(hue) {
    return (
      `background:` +
      `radial-gradient(circle at 50% 62%, hsla(${hue},95%,55%,0.34), transparent 62%),` +
      `radial-gradient(circle at 18% 12%, hsla(${(hue + 70) % 360},90%,40%,0.20), transparent 55%),` +
      `linear-gradient(180deg, #191926, #0e0e17);` +
      `color:${neon(hue)};`
    );
  }

  /* ---------- cards ---------- */
  function cardHTML(g, page, plays) {
    // On the games page the links are relative to root; on home too (both at root).
    void page;
    const chip =
      plays === null || plays === undefined
        ? ""
        : `<span class="plays-chip" aria-hidden="true">&#9654; ${plays}</span>`;
    return `
      <article class="card">
        ${chip}
        <div class="card-art" style="${artStyle(g.hue)}">
          <img src="games/${g.id}/cover.webp" alt="" loading="lazy" data-cover />
        </div>
        <div class="card-body">
          <h3>${g.title}</h3>
          <p>${g.desc}</p>
          <div class="card-cta">
            <a class="btn btn-play" href="${g.url}" aria-label="Play ${g.title}">&#9654; Play</a>
          </div>
        </div>
      </article>`;
  }

  function renderGrid(el, list, counts) {
    if (!el || typeof GAMES === "undefined") return;
    el.innerHTML = list
      .map((g) => cardHTML(g, undefined, counts ? counts[g.id] || 0 : null))
      .join("");
  }

  /* ---------- studio mode: play counts, visible only to the owner ---------- */
  function studioOn() {
    return typeof SDGplays !== "undefined" && SDGplays.isStudio();
  }

  function renderGameGrid() {
    const el = document.getElementById("game-grid");
    if (!el || typeof GAMES === "undefined") return;
    const counts = studioOn() ? SDGplays.getAll() : null;
    const list = studioOn() ? SDGplays.sortByPlays(GAMES, counts) : GAMES;
    renderGrid(el, list, counts);
    renderStudioPanel();
  }

  /* World plays panel: global counts from the server log, studio only. */
  let studioStatsCache = null; // null | "loading" | stats object
  function renderStudioPanel() {
    const grid = document.getElementById("game-grid");
    if (!grid) return;
    let panel = document.getElementById("studio-panel");
    if (!studioOn()) {
      if (panel) panel.remove();
      studioStatsCache = null;
      return;
    }
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "studio-panel";
      panel.className = "studio-panel";
      grid.parentNode.insertBefore(panel, grid);
    }
    if (studioStatsCache === "loading") return;
    if (studioStatsCache) {
      paintStudioPanel(panel, studioStatsCache);
      return;
    }
    studioStatsCache = "loading";
    panel.innerHTML = '<div class="studio-loading">COUNTING WORLD PLAYS…</div>';
    SDGplays.globalStats().then((stats) => {
      studioStatsCache = stats || { ok: false };
      const p = document.getElementById("studio-panel");
      if (p) paintStudioPanel(p, studioStatsCache);
    });
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function paintStudioPanel(panel, stats) {
    if (!stats || !stats.ok || !stats.total) {
      panel.innerHTML = '<h2>WORLD PLAYS</h2><div class="studio-loading">NO PLAYS LOGGED YET — GO PLAY SOMETHING!</div>';
      return;
    }
    const rows = GAMES.map((g) => ({ title: g.title, n: (stats.perGame && stats.perGame[g.id]) || 0 }))
      .sort((a, b) => b.n - a.n);
    const max = Math.max(1, rows[0].n);
    const dayKeys = Object.keys(stats.perDay || {}).sort().slice(-7);
    const dmax = Math.max(1, ...dayKeys.map((k) => stats.perDay[k]));
    let html = "<h2>WORLD PLAYS</h2>" +
      '<div class="studio-sub">' + stats.total + " PLAYS ACROSS EVERY DEVICE" +
      (stats.since ? " · SINCE " + escHtml(new Date(stats.since * 1000).toLocaleDateString()) : "") + "</div>";
    html += rows.map((r) =>
      '<div class="studio-row"><span class="t">' + escHtml(r.title.toUpperCase()) + '</span>' +
      '<span class="bar"><i style="width:' + Math.round((r.n / max) * 100) + '%"></i></span>' +
      '<span class="n">' + r.n + "</span></div>"
    ).join("");
    if (dayKeys.length) {
      html += '<div class="studio-days">' + dayKeys.map((k) => {
        const parts = k.split("-");
        const label = parts[1] + "/" + parts[2];
        const n = stats.perDay[k];
        const h = Math.max(4, Math.round((n / dmax) * 90));
        return '<div class="studio-day"><div class="dn">' + n + '</div>' +
          '<div class="db" style="height:' + h + 'px"></div>' +
          '<div class="dl">' + label + "</div></div>";
      }).join("") + "</div>";
    }
    panel.innerHTML = html;
  }

  function studioBadge() {
    document.querySelectorAll("a.logo").forEach((logo) => {
      let tag = logo.querySelector(".studio-tag");
      if (studioOn()) {
        if (!tag) {
          tag = document.createElement("span");
          tag.className = "studio-tag";
          tag.textContent = "STUDIO";
          logo.appendChild(tag);
        }
      } else if (tag) {
        tag.remove();
      }
    });
  }

  // Long-press (~1.5s) on the logo toggles studio mode. A normal tap
  // still follows the link; a long-press suppresses the click.
  function studioToggleWire() {
    if (typeof SDGplays === "undefined") return;
    document.querySelectorAll("a.logo").forEach((logo) => {
      let timer = null;
      let fired = false;
      let sx = 0,
        sy = 0;
      const start = (e) => {
        fired = false;
        sx = (e.touches && e.touches[0] && e.touches[0].clientX) || e.clientX || 0;
        sy = (e.touches && e.touches[0] && e.touches[0].clientY) || e.clientY || 0;
        timer = setTimeout(() => {
          timer = null;
          fired = true;
          SDGplays.toggleStudio();
          renderGameGrid();
          studioBadge();
        }, 1500);
      };
      const cancel = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };
      const move = (e) => {
        if (!timer) return;
        const x = (e.touches && e.touches[0] && e.touches[0].clientX) || e.clientX || 0;
        const y = (e.touches && e.touches[0] && e.touches[0].clientY) || e.clientY || 0;
        if (Math.abs(x - sx) > 14 || Math.abs(y - sy) > 14) cancel();
      };
      logo.addEventListener("pointerdown", start);
      logo.addEventListener("pointerup", cancel);
      logo.addEventListener("pointercancel", cancel);
      logo.addEventListener("pointerleave", cancel);
      logo.addEventListener("pointermove", move);
      logo.addEventListener(
        "click",
        (e) => {
          if (fired) {
            e.preventDefault();
            e.stopPropagation();
            fired = false;
          }
        },
        true
      );
    });
  }

  /* ---------- nav active state ---------- */
  function markNav() {
    const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const map = {
      "index.html": "home",
      "games.html": "games",
      "about.html": "about",
    };
    const key = map[path];
    if (!key) return;
    document.querySelectorAll(".nav-links a").forEach((a) => {
      if (a.dataset.nav === key) a.classList.add("active");
    });
  }

  /* ---------- decorative hero sprites ---------- */
  function heroDecor() {
    const host = document.getElementById("hero-sprites");
    if (!host) return;
    const items = [
      { s: "invader", c: "#00eaff", x: "8%", y: "22%", d: "7s" },
      { s: "ball", c: "#ff3df0", x: "88%", y: "30%", d: "9s" },
      { s: "gem", c: "#ffe14d", x: "14%", y: "72%", d: "8s" },
      { s: "rock", c: "#3dff7a", x: "84%", y: "70%", d: "10s" },
    ];
    host.innerHTML = items
      .map(
        (it) =>
          `<span class="float-sprite" style="left:${it.x};top:${it.y};color:${it.c};animation-duration:${it.d}">${spriteSVG(
            it.s,
            it.c
          )}</span>`
      )
      .join("");
  }

  /* float-sprite styles injected here so the CSS file stays lean */
  const extra = document.createElement("style");
  extra.textContent = `
    #hero-sprites { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
    .float-sprite { position:absolute; width:54px; opacity:.5; animation: floaty 8s ease-in-out infinite; filter: drop-shadow(0 0 10px currentColor); }
    .float-sprite svg { width:100%; height:auto; image-rendering:pixelated; }
    @keyframes floaty { 0%,100% { transform: translateY(-10px); } 50% { transform: translateY(12px); } }
    @media (prefers-reduced-motion: reduce) { .float-sprite { animation:none; } }
    /* studio mode (owner-only play counts) */
    .card { position:relative; }
    .plays-chip { position:absolute; top:10px; right:10px; z-index:2; font-family:'Press Start 2P',monospace; font-size:9px; letter-spacing:1px; color:#ffe14d; background:rgba(8,8,14,.78); border:1px solid rgba(255,225,77,.45); padding:6px 8px; border-radius:6px; pointer-events:none; }
    .logo .studio-tag { display:inline-block; margin-left:8px; padding:4px 7px; font-family:'Press Start 2P',monospace; font-size:8px; letter-spacing:2px; color:#0b0b16; background:#ffe14d; border-radius:4px; vertical-align:middle; }
    /* studio panel: WORLD plays (global, from the server log) */
    .studio-panel { margin:0 0 26px; padding:18px 20px 20px; background:rgba(10,12,30,.72); border:1px solid rgba(41,250,255,.35); border-radius:14px; }
    .studio-panel h2 { margin:0 0 4px; font-family:'Press Start 2P',monospace; font-size:13px; letter-spacing:2px; color:#29faff; }
    .studio-panel .studio-sub { font-family:'Press Start 2P',monospace; font-size:9px; color:rgba(234,246,255,.65); letter-spacing:1px; margin-bottom:14px; }
    .studio-row { display:flex; align-items:center; gap:10px; margin:7px 0; }
    .studio-row .t { width:38%; min-width:150px; font-family:'Press Start 2P',monospace; font-size:10px; color:#eaf6ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .studio-row .bar { flex:1; height:14px; background:rgba(255,255,255,.08); border-radius:7px; overflow:hidden; }
    .studio-row .bar i { display:block; height:100%; background:linear-gradient(90deg,#29faff,#7e57c2); border-radius:7px; }
    .studio-row .n { width:64px; text-align:right; font-family:'Press Start 2P',monospace; font-size:10px; color:#ffe14d; }
    .studio-days { display:flex; gap:8px; margin-top:16px; align-items:flex-end; }
    .studio-day { flex:1; text-align:center; }
    .studio-day .db { width:100%; background:rgba(41,250,255,.25); border:1px solid rgba(41,250,255,.5); border-radius:6px 6px 0 0; min-height:4px; }
    .studio-day .dl { margin-top:6px; font-family:'Press Start 2P',monospace; font-size:8px; color:rgba(234,246,255,.6); }
    .studio-day .dn { font-family:'Press Start 2P',monospace; font-size:8px; color:#ffe14d; margin-bottom:4px; }
    .studio-loading { font-family:'Press Start 2P',monospace; font-size:10px; color:rgba(234,246,255,.6); letter-spacing:1px; padding:8px 0; }
  `;
  document.head.appendChild(extra);

  /* If a cover image fails to load, drop it so the pixel sprite behind shows. */
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (t && t.matches && t.matches("img[data-cover]")) t.remove();
    },
    true
  );

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    markNav();
    heroDecor();
    renderGameGrid();
    studioBadge();
    studioToggleWire();
    renderGrid(
      document.getElementById("featured-grid"),
      typeof GAMES !== "undefined" ? GAMES.slice(0, 3) : []
    );
  });
})();
