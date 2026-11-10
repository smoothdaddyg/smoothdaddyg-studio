/* ============================================================
   COLORING BOOK — SmoothDaddyG, game #23
   ------------------------------------------------------------
   Danny's 2026-11-08 call: a coloring book — pictures of
   cool things to color in, a bunch of colors to pick from.

   Then his daughter's real photos shaped it further:
   her well-used Crayola box, and her cat activity book
   (cats in towels, magic hats and cookie jars, paw-print
   borders). So the palette is a CRAYON BOX — crayon-
   shaped swatches in classic crayon colors — and a
   friendly CAT joins the pictures, drawn in her book's
   style: big face, pointy ears, fluffy chest, curled tail.

   Danny's 2026-11-10 call: "change the color book game
   to work more like a real crayon. U have it where u
   just tap and the color shows up. That's not fun. In
   the real word we move our hands back and forth and
   color the area. Doesn't have to be in the lines
   either. That's the beauty of coloring. U try to stay
   in the lines."

   So v2 is REAL CRAYON: pick a crayon, then SCRIBBLE
   back and forth across the picture. Each stroke lays
   down waxy, grainy crayon — jittered dabs in slightly
   varied shades, so it looks like wax on paper, not a
   flat fill. The paint lives on a canvas UNDER the
   line art, so color spills OUTSIDE the lines exactly
   like the real thing — and trying to stay inside them
   is the game: the 10 dots under the page light up as
   the line-art area fills (paint outside the lines
   doesn't count toward it), each one keeping the crayon
   color that earned it, all 10 lit at about half the
   picture colored. The eraser scrubs paint back off,
   same back-and-forth motion. v3 (his 2026-11-10
   playtest): the dots are only progress now — the game
   NEVER finishes a page on its own. A big green SAVE
   button appears once she's put any color down, and SHE
   taps it when SHE thinks she's done; only then does the
   page celebrate and roll on.

   6 pages: Unicorn, Rocket, Spaceship, Satellite,
   Flower, Cat. The line art is the same SVG paths as
   v1 — they now double as the mask that decides what
   counts as "inside the lines" (rasterized once at
   boot into a 50x50 grid; if that ever fails, any
   paint counts and the page still finishes).

   RANDOM every playthrough (his call): fresh load and
   PLAY AGAIN shuffle the pictures — no two playthroughs
   start with the same picture or run the same sequence.
   The NEW PICTURE button (shuffle icon, in the deck)
   re-rolls the current picture to a random different
   unfinished one, as often as she likes — skipping never
   erases work, every picture keeps its scribbles until
   she comes back to it. If there's nowhere left to
   re-roll to, it opens the thumbnail gallery instead of
   silently doing nothing, and it works even while a
   celebration is playing. The thumbnail gallery (grid
   button in the deck) still lets her jump to any
   picture, and now each thumbnail shows the real
   coloring on that page. Color all 6 for the grand
   finale gallery + PLAY AGAIN.

   Danny's 2026-11-10 playtest (v3): three fixes. (1) The
   site-wide 84px back button overlaid the paper's top-left
   corner on his iPhone, hiding the line art there — in
   portrait the stage now starts 104px down and the paper
   is capped by viewport height, so the whole page stays
   visible and tappable. (2) NEW PICTURE never silently
   does nothing (see above). (3) The game NO LONGER
   decides she's done: reaching half the picture only
   lights all 10 dots — nothing dings, nothing advances.
   A big green SAVE button appears under the dots as soon
   as she's put any color down; SHE taps it when SHE
   thinks she's done, and only then does the page
   celebrate and roll on. (Judgment call, his to flip:
   SAVE is offered after any paint at all, not gated to
   the half-picture mark — "she decides" means she
   decides, even at a quarter-colored page.)

   NO connect-the-dots or matching here — those are
   separate future games. This one stays a pure
   coloring book.

   ONE OBVIOUS INTERACTION: pick a crayon, scribble.
   Sound always on, NO volume control ever. A soft
   crayon scratch while you scribble, pops that climb
   in pitch as the dots light up. Original music-box
   chiptune loop (its own melody, bass 0.2, harmony
   voice). 84px back button. No reading required
   anywhere except PLAY AGAIN. No ads, no IAP. iPad-first.
   ============================================================ */
"use strict";
(function () {
  /* ---------------- the pages: SVG line art ----------------
     Each region is one <path> (multiple subpaths allowed),
     drawn in painter's order (later = on top). Details are
     stroke-only line work. All coordinates in a 400x400 box.
     The same paths build the "inside the lines" mask. */
  const STROKE = "#16161f";
  const PAGES = [
    { name: "unicorn", regions: [
      { id: "tail", d: "M102,218 C72,228 56,258 70,288 C86,272 96,250 106,234 Z" },
      { id: "legBack", d: "M132,282 h16 v52 h-16 Z M156,282 h16 v52 h-16 Z" },
      { id: "legFront", d: "M232,282 h16 v52 h-16 Z M256,282 h16 v52 h-16 Z" },
      { id: "body", d: "M95,235 a95,55 0 1,0 190,0 a95,55 0 1,0 -190,0 Z" },
      { id: "wing", d: "M150,205 C170,175 215,168 238,192 C215,202 180,208 150,205 Z" },
      { id: "mane", d: "M252,132 C232,150 224,185 232,212 C246,198 252,168 258,138 Z" },
      { id: "head", d: "M246,148 a42,30 0 1,0 84,0 a42,30 0 1,0 -84,0 Z M258,160 L240,215 L285,222 L292,168 Z" },
      { id: "horn", d: "M296,120 L312,76 L324,118 Z" },
      { id: "ear", d: "M252,126 L260,98 L274,120 Z" },
      { id: "star", d: "M80,54 L86.5,71.1 L104.7,72 L90.5,83.4 L95.3,101 L80,91 L64.7,101 L69.5,83.4 L55.3,72 L73.5,71.1 Z" },
    ], details: '<circle cx="302" cy="142" r="3.4" fill="' + STROKE + '" stroke="none"/><path d="M306,164 q8,6 16,2" />' },
    { name: "rocket", regions: [
      { id: "flame", d: "M180,282 C168,312 174,338 200,358 C226,338 232,312 220,282 Z" },
      { id: "flameCore", d: "M190,286 C184,306 189,326 200,336 C211,326 216,306 210,286 Z" },
      { id: "finL", d: "M170,232 L128,302 L170,286 Z" },
      { id: "finR", d: "M230,232 L272,302 L230,286 Z" },
      { id: "body", d: "M170,112 h60 v138 a30,30 0 0,1 -60,0 Z" },
      { id: "nose", d: "M170,112 L200,42 L230,112 Z" },
      { id: "window", d: "M174,172 a26,26 0 1,0 52,0 a26,26 0 1,0 -52,0 Z" },
      { id: "star1", d: "M90,76 L93.5,85.2 L103.3,85.7 L95.7,91.9 L98.2,101.3 L90,96 L81.8,101.3 L84.3,91.9 L76.7,85.7 L86.5,85.2 Z" },
      { id: "star2", d: "M320,108 L322.9,116 L331.4,116.3 L324.8,121.5 L327.1,129.7 L320,125 L312.9,129.7 L315.2,121.5 L308.6,116.3 L317.1,116 Z" },
      { id: "cloud", d: "M65,355 a20,20 0 1,0 40,0 a20,20 0 1,0 -40,0 Z M91,345 a24,24 0 1,0 48,0 a24,24 0 1,0 -48,0 Z M132,358 a18,18 0 1,0 36,0 a18,18 0 1,0 -36,0 Z" },
    ], details: '<circle cx="200" cy="172" r="16" />' },
    { name: "spaceship", regions: [
      { id: "beam", d: "M158,250 L242,250 L200,342 Z" },
      { id: "saucer", d: "M60,210 a140,42 0 1,0 280,0 a140,42 0 1,0 -280,0 Z" },
      { id: "dome", d: "M130,206 a70,62 0 0,1 140,0 Z" },
      { id: "alien", d: "M170,162 a30,34 0 1,0 60,0 a30,34 0 1,0 -60,0 Z" },
      { id: "light1", d: "M108,214 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 Z" },
      { id: "light2", d: "M188,224 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 Z" },
      { id: "light3", d: "M268,214 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 Z" },
      { id: "antenna", d: "M196,102 h8 v-26 h-8 Z M190,66 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0 Z" },
      { id: "star1", d: "M60,66 L63.5,75.2 L73.3,75.7 L65.7,81.9 L68.2,91.3 L60,86 L51.8,91.3 L54.3,81.9 L46.7,75.7 L56.5,75.2 Z" },
      { id: "star2", d: "M340,78 L342.9,86 L351.4,86.3 L344.8,91.5 L347.1,99.7 L340,95 L332.9,99.7 L335.2,91.5 L328.6,86.3 L337.1,86 Z" },
    ], details: '<circle cx="190" cy="158" r="4" fill="' + STROKE + '" stroke="none"/><circle cx="210" cy="158" r="4" fill="' + STROKE + '" stroke="none"/><path d="M193,172 q7,6 14,0" /><ellipse cx="200" cy="210" rx="140" ry="42" />' },
    { name: "satellite", regions: [
      { id: "panelL", d: "M58,168 h88 v48 h-88 Z" },
      { id: "panelR", d: "M254,168 h88 v48 h-88 Z" },
      { id: "body", d: "M168,150 h64 v76 a12,12 0 0,1 -12,12 h-40 a12,12 0 0,1 -12,-12 Z" },
      { id: "dish", d: "M158,104 C176,110 194,124 200,148 C186,138 168,124 158,104 Z" },
      { id: "antenna", d: "M236,148 L262,106 L268,110 L242,152 Z M259,102 a9,9 0 1,0 18,0 a9,9 0 1,0 -18,0 Z" },
      { id: "earth", d: "M252,300 a38,38 0 1,0 76,0 a38,38 0 1,0 -76,0 Z M275,285 C285,280 295,288 292,298 C288,306 275,306 272,296 C270,290 272,288 275,285 Z" },
      { id: "moon", d: "M73,300 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0 Z" },
      { id: "star1", d: "M70,67 L73.2,75.6 L82.4,76 L75.2,81.7 L77.6,90.5 L70,85.5 L62.4,90.5 L64.8,81.7 L57.6,76 L66.8,75.6 Z" },
      { id: "star2", d: "M330,58 L332.9,66 L341.4,66.3 L334.8,71.5 L337.1,79.7 L330,75 L322.9,79.7 L325.2,71.5 L318.6,66.3 L327.1,66 Z" },
      { id: "star3", d: "M200,49 L202.7,56.3 L210.5,56.6 L204.4,61.4 L207.5,68.9 L200,64.6 L192.5,68.9 L195.6,61.4 L189.5,56.6 L197.3,56.3 Z" },
    ], details: '<path d="M86,168 v48 M114,168 v48 M282,168 v48 M310,168 v48" /><rect x="186" y="172" width="28" height="18" rx="4" /><circle cx="88" cy="294" r="4" /><circle cx="104" cy="308" r="3" />' },
    { name: "flower", regions: [
      { id: "stem", d: "M193,182 C195,230 195,280 193,312 L207,312 C205,280 205,230 207,182 Z" },
      { id: "leafL", d: "M193,258 C162,248 140,262 134,288 C160,294 186,284 193,258 Z" },
      { id: "leafR", d: "M207,268 C238,258 260,272 266,298 C240,304 214,294 207,268 Z" },
      { id: "petal1", d: "M176,95 a24,40 0 1,0 48,0 a24,40 0 1,0 -48,0 Z", tr: "rotate(0 200 150)" },
      { id: "petal2", d: "M176,95 a24,40 0 1,0 48,0 a24,40 0 1,0 -48,0 Z", tr: "rotate(60 200 150)" },
      { id: "petal3", d: "M176,95 a24,40 0 1,0 48,0 a24,40 0 1,0 -48,0 Z", tr: "rotate(120 200 150)" },
      { id: "petal4", d: "M176,95 a24,40 0 1,0 48,0 a24,40 0 1,0 -48,0 Z", tr: "rotate(180 200 150)" },
      { id: "petal5", d: "M176,95 a24,40 0 1,0 48,0 a24,40 0 1,0 -48,0 Z", tr: "rotate(240 200 150)" },
      { id: "petal6", d: "M176,95 a24,40 0 1,0 48,0 a24,40 0 1,0 -48,0 Z", tr: "rotate(300 200 150)" },
      { id: "center", d: "M168,150 a32,32 0 1,0 64,0 a32,32 0 1,0 -64,0 Z" },
      { id: "sun", d: "M292,70 a28,28 0 1,0 56,0 a28,28 0 1,0 -56,0 Z M316,34 L320,18 L324,34 Z M352,66 L368,70 L352,74 Z M316,106 L320,122 L324,106 Z M288,66 L272,70 L288,74 Z" },
    ], details: '<circle cx="188" cy="142" r="3" /><circle cx="212" cy="142" r="3" /><circle cx="200" cy="160" r="3" />' },
    { name: "cat", regions: [
      { id: "tail", d: "M285,320 C300,365 250,390 180,388 C120,386 70,370 62,340 C75,358 120,368 175,366 C235,364 275,350 285,320 Z" },
      { id: "earL", d: "M112,112 L94,30 L170,74 Z" },
      { id: "earR", d: "M288,112 L306,30 L230,74 Z" },
      { id: "face", d: "M95,165 a105,95 0 1,0 210,0 a105,95 0 1,0 -210,0 Z" },
      { id: "tuft", d: "M175,78 C180,60 190,60 195,72 C200,58 210,60 212,74 C218,62 228,66 226,80 C210,70 190,70 175,78 Z" },
      { id: "chest", d: "M130,245 C120,290 125,340 150,360 C175,375 225,375 250,360 C275,340 280,290 270,245 C240,262 160,262 130,245 Z" },
      { id: "pawL", d: "M124,352 a26,16 0 1,0 52,0 a26,16 0 1,0 -52,0 Z" },
      { id: "pawR", d: "M224,352 a26,16 0 1,0 52,0 a26,16 0 1,0 -52,0 Z" },
      { id: "nose", d: "M186,188 L214,188 L200,206 Z" },
      { id: "bow", d: "M200,258 L166,242 L166,274 Z M200,258 L234,242 L234,274 Z M192,250 h16 v16 h-16 Z" },
    ], details: '<path d="M168,150 Q180,138 192,150 Q180,162 168,150 Z M208,150 Q220,138 232,150 Q220,162 208,150 Z" /><circle cx="180" cy="150" r="5" fill="' + STROKE + '" stroke="none"/><circle cx="220" cy="150" r="5" fill="' + STROKE + '" stroke="none"/><path d="M150,175 L115,168 M150,185 L118,185 M150,195 L120,202 M250,175 L285,168 M250,185 L282,185 M250,195 L280,202" /><path d="M185,208 Q200,220 215,208" /><path d="M126,96 L112,58 L146,80 Z M274,96 L288,58 L254,80 Z" /><path d="M142,348 v8 M158,348 v8 M242,348 v8 M258,348 v8" />' },
  ];

  /* ---------------- the crayon box ----------------
     Classic crayon colors, like the real box: red, pink,
     orange, yellow, light green, green, blue, dark blue,
     purple, brown, peach, white, black — plus a pink
     eraser that scrubs paint back off. */
  const PALETTE = [
    { name: "red", hex: "#ee204d" },
    { name: "pink", hex: "#ff7eb9" },
    { name: "orange", hex: "#ff7518" },
    { name: "yellow", hex: "#ffe14d" },
    { name: "lightgreen", hex: "#7ed957" },
    { name: "green", hex: "#1cac78" },
    { name: "blue", hex: "#1f75fe" },
    { name: "darkblue", hex: "#1e3fae" },
    { name: "purple", hex: "#7442c8" },
    { name: "brown", hex: "#7b3f00" },
    { name: "peach", hex: "#ffcf9e" },
    { name: "white", hex: "#ffffff" },
    { name: "black", hex: "#222222" },
    { name: "eraser", hex: "#ffffff", eraser: true },
  ];
  const WHITE = "#ffffff";

  /* ---------------- audio ---------------- */
  const SFX = (typeof makeAudio === "function") ? makeAudio() : null;
  function tone(f, d, o) { try { if (SFX) SFX.tone(f, d, o || {}); } catch (e) {} }
  function noiseS(d, o) { try { if (SFX) SFX.noise(d, o || {}); } catch (e) {} }
  function arp(ns, s, t, v) { try { if (SFX) SFX.arp(ns, s, t, v); } catch (e) {} }
  // The crayon scratch: a short soft bandpass noise burst,
  // throttled while the hand moves — wax on paper.
  function sndScribble(erase) {
    noiseS(0.05, { filter: "bandpass", freq: erase ? 900 : 1400 + Math.random() * 1000, vol: 0.03 });
  }
  // Pop pitch climbs as the dots light up — the sound
  // itself tells you you're getting somewhere.
  function sndPop(dots) {
    const f = 520 + Math.min(dots, 10) * 40;
    tone(f, 0.09, { type: "square", vol: 0.09, slideTo: f * 1.5 });
    noiseS(0.05, { filter: "highpass", freq: 5000, vol: 0.04 });
  }
  function sndFanfare() { arp([523, 659, 784, 1046, 1318], 0.1, "square", 0.10); noiseS(0.5, { filter: "highpass", freq: 3000, vol: 0.04, when: 0.2 }); }
  function sndFinale() { arp([523, 659, 784, 1046, 1318, 1568, 2093, 2637], 0.12, "square", 0.11); noiseS(0.9, { filter: "highpass", freq: 3000, vol: 0.05, when: 0.3 }); }

  /* ---------------- background music ----------------
     An ORIGINAL music-box loop, composed here: a gentle
     C-major lullaby with a singable phrase and a
     variation at the end, rests that breathe, a harmony
     voice a third under the lead, and a soft pedal bass
     (still loud at 0.2, per the studio rule). Barely any
     drums — just a soft heartbeat kick. 64 steps, 96 BPM. */
  const C3 = 130.81, F3 = 174.61, G3 = 196, A3 = 220;
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, C6 = 1046.5;
  const MUSIC_CFG = {
    bpm: 96, steps: 64, div: 4, bassVol: 0.2, leadVol: 0.06, harmonyVol: 0.03,
    kicks: [0, 32], snares: [], hats: "none",
    bass: [C3,0,0,0, G3,0,0,0, C3,0,0,0, G3,0,0,0,
           F3,0,0,0, C3,0,0,0, F3,0,0,0, G3,0,0,0,
           C3,0,0,0, G3,0,0,0, A3,0,0,0, G3,0,0,0,
           F3,0,0,0, G3,0,0,0, C3,0,0,0, G3,0,C3,0],
    lead: [E5,0,G5,0, C6,0,G5,0, A5,0,G5,0, E5,0,0,0,
           F5,0,A5,0, G5,0,F5,0, E5,0,D5,0, C5,0,0,0,
           E5,0,G5,0, C6,0,A5,0, G5,0,E5,0, D5,0,0,0,
           F5,0,E5,0, D5,0,C5,0, D5,0,0,0, C5,0,0,0],
    harmony: [],
  };
  (function () {
    const third = {};
    third[C5] = 415.3; third[D5] = 466.16; third[E5] = 523.25;
    third[F5] = 587.33; third[G5] = 659.25; third[A5] = 783.99; third[C6] = 987.77;
    for (let i = 0; i < 64; i++) {
      const l = MUSIC_CFG.lead[i];
      MUSIC_CFG.harmony[i] = l ? (third[l] || 0) : 0;
    }
  })();
  let MUSIC = null;
  try { MUSIC = SFX && SFX.makeMusic ? SFX.makeMusic(MUSIC_CFG) : null; } catch (e) { MUSIC = null; }
  let musicStarted = false;
  function startMusic() {
    if (!musicStarted && MUSIC) { try { MUSIC.start(); } catch (e) {} musicStarted = true; }
  }

  /* ---------------- the crayon engine ----------------
     BOX: the 400x400 drawing box. Paint lives on one
     offscreen canvas per page (OFF x OFF px) and is
     blitted onto the visible #paint canvas. Progress is
     tracked on a GRID x GRID boolean grid: a cell counts
     when it is painted AND inside the line art (the
     mask). Paint outside the lines shows up on the page
     — it just doesn't move the dots. */
  const BOX = 400, GRID = 50, CELL = BOX / GRID, OFF = 800, SCALE = OFF / BOX;
  const BRUSH = 13;        // crayon radius, box units
  const ERASER_BRUSH = 18; // eraser radius, box units
  const TARGET = 0.5;       // half the picture colored = done
  const DOTS_N = 10;

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [ (n >> 16) & 255, (n >> 8) & 255, n & 255 ];
  }
  function shadeStr(rgb, f) {
    const c = function (v) { return Math.max(0, Math.min(255, Math.round(v * f))); };
    return "rgb(" + c(rgb[0]) + "," + c(rgb[1]) + "," + c(rgb[2]) + ")";
  }

  /* The "inside the lines" mask: rasterize the page's
     region paths onto a GRID x GRID canvas once at boot.
     Any failure (no Path2D, no pixels) falls back to
     "everything counts" so the page can still finish. */
  function buildMask(pageIdx) {
    const grid = new Uint8Array(GRID * GRID);
    try {
      if (typeof Path2D !== "function") throw new Error("no Path2D");
      const mc = document.createElement("canvas");
      mc.width = GRID; mc.height = GRID;
      const mctx = mc.getContext("2d");
      if (!mctx) throw new Error("no ctx");
      mctx.scale(GRID / BOX, GRID / BOX);
      mctx.fillStyle = "#fff";
      for (const r of PAGES[pageIdx].regions) {
        mctx.save();
        if (r.tr) {
          const m = /rotate\((-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\)/.exec(r.tr);
          if (m) {
            mctx.translate(+m[2], +m[3]);
            mctx.rotate((+m[1]) * Math.PI / 180);
            mctx.translate(-m[2], -m[3]);
          }
        }
        mctx.fill(new Path2D(r.d));
        mctx.restore();
      }
      const img = mctx.getImageData(0, 0, GRID, GRID);
      if (!img || !img.data) throw new Error("no pixels");
      for (let i = 0; i < GRID * GRID; i++) grid[i] = img.data[i * 4 + 3] > 0 ? 1 : 0;
    } catch (e) {
      grid.fill(1);
    }
    let total = 0;
    for (let i = 0; i < GRID * GRID; i++) total += grid[i];
    if (!total) grid.fill(1), total = GRID * GRID;
    return { grid: grid, total: total };
  }
  const MASKS = PAGES.map(function (_, i) { return buildMask(i); });

  /* ---------------- dom ---------------- */
  function el(id) { return document.getElementById(id); }
  const paperEl = el("paper"), picEl = el("pic"), dotsEl = el("dots"), paletteEl = el("palette");
  const paintEl = el("paint"), cursorEl = el("cursor");
  const newBtn = el("newBtn"), galleryBtn = el("galleryBtn");
  const saveBtn = el("saveBtn");
  const overlay = el("galleryOverlay"), thumbsEl = el("thumbs");
  const playAgainBtn = el("playAgainBtn"), galleryCloseBtn = el("galleryCloseBtn");
  const fx = el("fx");
  const fctx = fx ? fx.getContext("2d") : null;
  const pctx = paintEl ? paintEl.getContext("2d") : null;

  /* ---------------- state ---------------- */
  const CELEB_T = 2.0, FINALE_T = 2.5;
  let state = "color"; // color | celebrate | finale
  let order = []; // shuffled permutation of page indices (gallery order)
  let current = 0; // page index being colored
  let done = {}; // page index -> true once finished
  let selected = 0; // palette index
  let celebT = 0, finaleT = 0, finaleShown = false, galleryMode = "picker";
  let saveShown = false; // the SAVE button is showing and tappable
  let parts = [];
  let playedLogged = false;
  // Per-page paint: a boolean grid, a painted-mask-cell count,
  // dots lit + the color that earned each dot, and the
  // offscreen canvas that holds the real wax.
  let grids = [], painted = [], lit = [], dotCols = [], offs = [], offCtxs = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function unfinished() {
    const out = [];
    for (let i = 0; i < PAGES.length; i++) if (!done[i]) out.push(i);
    return out;
  }
  function randomUnfinished(except) {
    const cands = unfinished().filter((i) => i !== except);
    if (!cands.length) return null;
    return cands[Math.floor(Math.random() * cands.length)];
  }
  function coverage(pageIdx) {
    const total = MASKS[pageIdx].total;
    return total ? painted[pageIdx] / total : 0;
  }
  function isDone(pageIdx) { return !!done[pageIdx]; }
  function recount(pageIdx) {
    const m = MASKS[pageIdx].grid, g = grids[pageIdx];
    let n = 0;
    for (let i = 0; i < GRID * GRID; i++) if (g[i] && m[i]) n++;
    painted[pageIdx] = n;
    lit[pageIdx] = Math.min(DOTS_N, Math.floor(coverage(pageIdx) / TARGET * DOTS_N));
    if (pageIdx === current) updateSaveBtn();
  }

  /* ---------------- painting ----------------
     One stamp: mark the grid disc (what counts) and lay
     down waxy dabs on the offscreen canvas (what she
     sees). The canvas dabs are jittered and shaded so a
     stroke reads as crayon wax, not a flat tube. */
  function stampAt(pageIdx, x, y, erase) {
    if (state !== "color") return;
    const r = erase ? ERASER_BRUSH : BRUSH;
    const g = grids[pageIdx], m = MASKS[pageIdx].grid;
    const cx0 = Math.max(0, Math.floor((x - r) / CELL)), cx1 = Math.min(GRID - 1, Math.floor((x + r) / CELL));
    const cy0 = Math.max(0, Math.floor((y - r) / CELL)), cy1 = Math.min(GRID - 1, Math.floor((y + r) / CELL));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const dx = (cx + 0.5) * CELL - x, dy = (cy + 0.5) * CELL - y;
        if (dx * dx + dy * dy > r * r) continue;
        const idx = cy * GRID + cx;
        if (erase) {
          if (g[idx]) { g[idx] = 0; if (m[idx]) painted[pageIdx]--; }
        } else {
          if (!g[idx]) { g[idx] = 1; if (m[idx]) painted[pageIdx]++; }
        }
      }
    }
    const octx = offCtxs[pageIdx];
    if (octx) {
      const px = x * SCALE, py = y * SCALE;
      if (erase) {
        octx.save();
        octx.globalCompositeOperation = "destination-out";
        octx.globalAlpha = 1;
        octx.beginPath();
        octx.arc(px, py, ERASER_BRUSH * SCALE, 0, Math.PI * 2);
        octx.fill();
        octx.restore();
      } else {
        const rgb = hexToRgb(PALETTE[selected].hex);
        for (let k = 0; k < 3; k++) {
          const jx = px + rnd(-7, 7), jy = py + rnd(-7, 7);
          octx.globalAlpha = rnd(0.5, 0.85);
          octx.fillStyle = shadeStr(rgb, [0.88, 1.0, 1.12][k]);
          octx.beginPath();
          octx.arc(jx, jy, rnd(9, 14), 0, Math.PI * 2);
          octx.fill();
        }
        octx.globalAlpha = 1;
      }
    }
  }
  function strokePoint(pageIdx, x, y) {
    if (state !== "color") return false;
    stampAt(pageIdx, x, y, !!PALETTE[selected].eraser);
    blit();
    afterStroke();
    return true;
  }
  function strokeLine(pageIdx, x0, y0, x1, y1) {
    if (state !== "color") return false;
    const erase = !!PALETTE[selected].eraser;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let i = 0; i <= steps; i++) {
      if (state !== "color") break;
      stampAt(pageIdx, x0 + (x1 - x0) * (i / steps), y0 + (y1 - y0) * (i / steps), erase);
    }
    blit();
    afterStroke();
    return true;
  }
  function blit() {
    if (!pctx || !offs[current]) return;
    try {
      pctx.clearRect(0, 0, OFF, OFF);
      pctx.drawImage(offs[current], 0, 0);
    } catch (e) {}
  }
  // Dots light up as the picture fills; each one keeps
  // the crayon color that earned it. Crossing the halfway
  // mark lights the last dot — and NOTHING else happens.
  // The game never decides she's done: only her SAVE tap
  // finishes a page (see savePicture below).
  function afterStroke() {
    const cov = coverage(current);
    const want = Math.min(DOTS_N, Math.floor(cov / TARGET * DOTS_N));
    if (want > lit[current]) {
      for (let k = lit[current]; k < want; k++) dotCols[current][k] = PALETTE[selected].hex;
      lit[current] = want;
      sndPop(want);
      renderDots();
    } else if (want < lit[current]) {
      lit[current] = want;
      renderDots();
    }
    updateSaveBtn();
  }
  // SAVE shows as soon as she's put any color down on an
  // unfinished page — and hides again if she erases it
  // all, or once the page is finished. The row reserves
  // its space either way, so the paper never jumps.
  function updateSaveBtn() {
    const show = state === "color" && !done[current] && coverage(current) > 0;
    saveShown = show;
    if (!saveBtn) return;
    if (show) saveBtn.classList.add("show");
    else saveBtn.classList.remove("show");
    saveBtn.disabled = !show;
  }

  /* ---------------- rendering ---------------- */
  function svgForPage(pageIdx) {
    const p = PAGES[pageIdx];
    let s = '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">';
    for (const r of p.regions) {
      s += '<path d="' + r.d + '"' +
        (r.tr ? ' transform="' + r.tr + '"' : '') +
        ' fill="none" stroke="' + STROKE + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    s += '<g pointer-events="none" fill="none" stroke="' + STROKE + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + p.details + "</g>";
    s += "</svg>";
    return s;
  }
  function paintDataURL(pageIdx) {
    try {
      const c = offs[pageIdx];
      return (c && typeof c.toDataURL === "function") ? c.toDataURL() : null;
    } catch (e) { return null; }
  }
  function renderPage() {
    if (picEl) picEl.innerHTML = svgForPage(current);
    blit();
    renderDots();
    updateNewBtn();
    updateSaveBtn();
  }
  function renderDots() {
    if (!dotsEl) return;
    let h = "";
    for (let i = 0; i < DOTS_N; i++) {
      const on = i < lit[current];
      const col = dotCols[current][i];
      h += '<span class="dot' + (on ? " on" : "") + '"' + (on && col ? ' style="background:' + col + '"' : "") + "></span>";
    }
    dotsEl.innerHTML = h;
  }
  function renderPalette() {
    if (!paletteEl) return;
    paletteEl.innerHTML = "";
    PALETTE.forEach((c, i) => {
      const b = document.createElement("button");
      if (c.eraser) {
        b.className = "eraser" + (i === selected ? " sel" : "");
        b.innerHTML = "&#10005;";
        b.setAttribute("aria-label", "Eraser");
      } else {
        b.className = "crayon" + (i === selected ? " sel" : "");
        b.style.setProperty("--c", c.hex);
        b.setAttribute("aria-label", c.name + " crayon");
      }
      b.addEventListener("click", function () { selectColor(i); });
      paletteEl.appendChild(b);
    });
  }
  function updateNewBtn() {
    if (!newBtn) return;
    const cands = unfinished().filter((i) => i !== current);
    if (cands.length) newBtn.classList.remove("dim");
    else newBtn.classList.add("dim");
  }
  const STAR_SVG = '<svg viewBox="0 0 24 24" fill="#ffe14d" stroke="#c9a90e" stroke-width="1"><path d="M12,1 L14.7,8.2 L22.5,8.6 L16.5,13.6 L18.6,21.3 L12,17.2 L5.4,21.3 L7.5,13.6 L1.5,8.6 L9.3,8.2 Z"/></svg>';
  function renderGallery() {
    if (!thumbsEl) return;
    thumbsEl.innerHTML = "";
    for (const i of order) {
      const b = document.createElement("button");
      b.className = "thumb";
      const img = paintDataURL(i);
      b.innerHTML = (img ? '<img class="thumbpaint" src="' + img + '" alt="">' : "") + svgForPage(i) + (done[i] ? '<span class="star">' + STAR_SVG + "</span>" : "");
      b.setAttribute("aria-label", PAGES[i].name + (done[i] ? ", finished" : ""));
      (function (idx) {
        b.addEventListener("click", function () { openPage(idx); });
      })(i);
      thumbsEl.appendChild(b);
    }
  }

  /* ---------------- particles (sparkles / confetti / fireworks) ---------------- */
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < (n || 10); i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(0.4, speed || 2.5);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s * 70, vy: Math.sin(a) * s * 70 - 30, t: 0, life: rnd(0.4, 0.8), color: color, size: rnd(3, 7), kind: "dot" });
    }
  }
  function firework(x, y) {
    const cols = ["#ff3b30", "#ffe14d", "#3ddc5f", "#29faff", "#ff3df0", "#ff9f2e"];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd(-0.1, 0.1), s = rnd(120, 260);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rnd(0.7, 1.2), color: cols[i % cols.length], size: rnd(4, 8), kind: "dot" });
    }
  }
  function confettiPiece() {
    parts.push({ x: rnd(0, window.innerWidth), y: -12, vx: rnd(-25, 25), vy: rnd(70, 170), t: 0, life: rnd(1.4, 2.4), color: ["#ff3b30", "#ffe14d", "#3ddc5f", "#29faff", "#ff3df0", "#ff9f2e"][Math.floor(rnd(0, 6))], size: rnd(6, 11), kind: "conf" });
  }

  /* ---------------- game flow ---------------- */
  function newGame() {
    done = {};
    order = shuffle(PAGES.map((_, i) => i));
    current = order[0];
    selected = 0;
    state = "color";
    celebT = 0; finaleT = 0; finaleShown = false;
    grids = []; painted = []; lit = []; dotCols = []; offs = []; offCtxs = [];
    for (let i = 0; i < PAGES.length; i++) {
      grids.push(new Uint8Array(GRID * GRID));
      painted.push(0);
      lit.push(0);
      dotCols.push(new Array(DOTS_N).fill(null));
      const c = document.createElement("canvas");
      c.width = OFF; c.height = OFF;
      offs.push(c);
      offCtxs.push(c.getContext ? c.getContext("2d") : null);
    }
    if (overlay) overlay.hidden = true;
    renderPalette();
    renderPage();
    if (!playedLogged && window.SDGplays) {
      try { window.SDGplays.played("coloringbook"); } catch (e) {}
      playedLogged = true;
    }
  }
  function selectColor(i) {
    selected = i;
    renderPalette();
  }
  function finishPage() {
    done[current] = true;
    state = "celebrate";
    celebT = 0;
    updateSaveBtn();
    sndFanfare();
    burst(window.innerWidth / 2, window.innerHeight * 0.35, "#ffe14d", 30, 4);
  }
  // SAVE: the only way a page finishes. She taps it when
  // SHE thinks she's done — any amount of color counts.
  // The celebration + roll to the next picture only happen
  // because she asked for them.
  function savePicture() {
    if (state !== "color") return false;
    if (done[current]) return false;
    if (coverage(current) <= 0) return false;
    finishPage();
    return true;
  }
  function advance() {
    if (Object.keys(done).length >= PAGES.length) { startFinale(); return; }
    const next = randomUnfinished();
    if (next == null) { startFinale(); return; }
    current = next;
    state = "color";
    renderPage();
  }
  function newPicture() {
    if (state === "finale") return false;
    if (state === "celebrate") {
      // Tapping NEW PICTURE mid-celebration jumps right
      // away instead of making her wait out the 2s beat —
      // unless this was the last picture, in which case
      // the celebration rolls to the finale as planned.
      const cands = unfinished().filter((i) => i !== current);
      if (!cands.length) return false;
      state = "color";
      celebT = 0;
    }
    if (state !== "color") return false;
    const next = randomUnfinished(current);
    if (next == null) {
      // Nowhere left to re-roll to: open the gallery
      // instead of silently doing nothing — she can jump
      // to any picture, finished or not.
      openGallery("picker");
      return true;
    }
    current = next;
    renderPage();
    return true;
  }
  function openPage(i) {
    current = i;
    state = "color";
    if (overlay) overlay.hidden = true;
    renderPage();
  }
  function openGallery(mode) {
    galleryMode = mode || "picker";
    renderGallery();
    if (playAgainBtn) playAgainBtn.hidden = galleryMode !== "finale";
    if (overlay) overlay.hidden = false;
  }
  function closeGallery() {
    if (overlay) overlay.hidden = true;
  }
  function startFinale() {
    state = "finale";
    finaleT = 0; finaleShown = false;
    sndFinale();
    firework(window.innerWidth * 0.3, window.innerHeight * 0.3);
    firework(window.innerWidth * 0.7, window.innerHeight * 0.25);
  }
  function playAgain() {
    newGame();
  }

  /* ---------------- input: scribble, don't tap ----------------
     Pointer down on the paper starts a stroke; moving the
     hand lays down crayon all along the path; lifting
     ends it. One finger at a time. The line art sits on
     top with pointer-events off, so the hand colors
     straight through it — inside the lines or out. */
  let stroking = false, activePointer = null, lastX = 0, lastY = 0, lastSnd = 0;
  function toBox(e) {
    const r = paperEl ? paperEl.getBoundingClientRect() : { left: 0, top: 0, width: BOX, height: BOX };
    return {
      x: (e.clientX - r.left) / r.width * BOX,
      y: (e.clientY - r.top) / r.height * BOX,
      rect: r,
    };
  }
  function moveCursor(p, show) {
    if (!cursorEl) return;
    if (!show) { cursorEl.style.display = "none"; return; }
    const r = p.rect, d = ((PALETTE[selected].eraser ? ERASER_BRUSH : BRUSH) * 2 / BOX) * r.width;
    cursorEl.style.display = "block";
    cursorEl.style.width = d + "px";
    cursorEl.style.height = d + "px";
    cursorEl.style.left = (p.x / BOX * 100) + "%";
    cursorEl.style.top = (p.y / BOX * 100) + "%";
    cursorEl.style.borderColor = PALETTE[selected].eraser ? "#ff9fb0" : PALETTE[selected].hex;
  }
  function onPaperDown(e) {
    if (state !== "color") return;
    e.preventDefault();
    startMusic();
    const p = toBox(e);
    stroking = true; activePointer = e.pointerId;
    lastX = p.x; lastY = p.y;
    if (paperEl && paperEl.setPointerCapture) {
      try { paperEl.setPointerCapture(e.pointerId); } catch (err) {}
    }
    strokePoint(current, p.x, p.y);
    moveCursor(p, true);
  }
  function onPaperMove(e) {
    if (!stroking || e.pointerId !== activePointer) {
      if (e.pointerType === "mouse" && state === "color") moveCursor(toBox(e), true);
      return;
    }
    e.preventDefault();
    const p = toBox(e);
    strokeLine(current, lastX, lastY, p.x, p.y);
    lastX = p.x; lastY = p.y;
    moveCursor(p, true);
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
    if (now - lastSnd > 70) { lastSnd = now; sndScribble(!!PALETTE[selected].eraser); }
  }
  function onPaperUp(e) {
    if (e.pointerId !== activePointer) return;
    stroking = false; activePointer = null;
    moveCursor(null, false);
  }
  if (paperEl) {
    paperEl.addEventListener("pointerdown", onPaperDown);
    paperEl.addEventListener("pointermove", onPaperMove);
    paperEl.addEventListener("pointerup", onPaperUp);
    paperEl.addEventListener("pointercancel", onPaperUp);
    paperEl.addEventListener("pointerleave", function (e) {
      if (!stroking) moveCursor(null, false);
    });
    paperEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  if (newBtn) newBtn.addEventListener("click", function () { startMusic(); newPicture(); });
  if (saveBtn) saveBtn.addEventListener("click", function () { startMusic(); savePicture(); });
  if (galleryBtn) galleryBtn.addEventListener("click", function () { startMusic(); openGallery("picker"); });
  if (galleryCloseBtn) galleryCloseBtn.addEventListener("click", function () { closeGallery(); });
  if (playAgainBtn) playAgainBtn.addEventListener("click", function () { startMusic(); playAgain(); });
  document.addEventListener("pointerdown", function () { startMusic(); }, { once: true });

  /* ---------------- loop: particles + celebration timing ---------------- */
  let W = 400, H = 700, DPR = 1;
  function resize() {
    if (!fx) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    fx.width = Math.round(W * DPR); fx.height = Math.round(H * DPR);
    fx.style.width = W + "px"; fx.style.height = H + "px";
    fx.style.touchAction = "none";
    if (fctx) fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  let last = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (MUSIC) MUSIC.tick(dt);
    tick(dt);
    drawFx();
  }
  function tick(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === "dot") p.vy += 260 * dt;
      if (p.t >= p.life) parts.splice(i, 1);
    }
    if (state === "celebrate") {
      celebT += dt;
      if (Math.random() < dt * 14) confettiPiece();
      if (Math.random() < dt * 2.2) firework(rnd(W * 0.15, W * 0.85), rnd(H * 0.1, H * 0.4));
      if (celebT >= CELEB_T) advance();
    } else if (state === "finale") {
      finaleT += dt;
      if (Math.random() < dt * 16) confettiPiece();
      if (Math.random() < dt * 2.5) firework(rnd(W * 0.15, W * 0.85), rnd(H * 0.08, H * 0.45));
      if (!finaleShown && finaleT >= FINALE_T) {
        finaleShown = true;
        openGallery("finale");
      }
    }
  }
  function drawFx() {
    if (!fctx) return;
    fctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      fctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      fctx.fillStyle = p.color;
      if (p.kind === "conf") {
        fctx.save();
        fctx.translate(p.x, p.y);
        fctx.rotate(p.t * 4);
        fctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        fctx.restore();
      } else {
        fctx.beginPath();
        fctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        fctx.fill();
      }
    }
    fctx.globalAlpha = 1;
  }

  /* ---------------- boot ---------------- */
  resize();
  newGame();
  requestAnimationFrame(frame);

  /* Test hook (test-only, never used by the game). */
  window.__colorTest = {
    get state() { return state; },
    get current() { return current; },
    get order() { return order.slice(); },
    get done() { return Object.keys(done).map(Number); },
    get selected() { return selected; },
    get selectedColor() { return PALETTE[selected].hex; },
    get selectedName() { return PALETTE[selected].name; },
    get palette() { return PALETTE.map((c) => ({ name: c.name, hex: c.hex, eraser: !!c.eraser })); },
    get pages() { return PAGES.map((p) => ({ name: p.name, regions: p.regions.map((r) => r.id) })); },
    get coverage() { return coverage(current); },
    get coverages() { return PAGES.map((_, i) => coverage(i)); },
    get progress() { return { coverage: coverage(current), dots: lit[current], total: DOTS_N }; },
    get unfinishedCount() { return unfinished().length; },
    get saveReady() { return saveShown; },
    save: function () { return savePicture(); },
    get galleryShown() { return overlay ? !overlay.hidden : false; },
    get galleryMode() { return galleryMode; },
    get music() { return MUSIC_CFG; },
    get gridSize() { return GRID; },
    get target() { return TARGET; },
    get cfg() { return { CELEB_T: CELEB_T, FINALE_T: FINALE_T, pageCount: PAGES.length }; },
    coverageOf: function (i) { return coverage(i); },
    isDone: function (i) { return isDone(i); },
    start: function () { newGame(); },
    selectColor: function (i) { selectColor(i); },
    stamp: function (x, y) { return strokePoint(current, x, y); },
    stroke: function (pts) {
      if (!pts || pts.length < 1 || state !== "color") return false;
      if (pts.length === 1) return strokePoint(current, pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) strokeLine(current, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      return true;
    },
    openPage: function (i) { openPage(i); },
    newPicture: function () { return newPicture(); },
    openGallery: function (m) { openGallery(m); },
    closeGallery: function () { closeGallery(); },
    playAgain: function () { playAgain(); },
    step: function (dt) { tick(dt || 0.016); },
    debug: {
      maskOf: function (i) { return Array.from(MASKS[i].grid); },
      maskTotal: function (i) { return MASKS[i].total; },
      setMask: function (i, fn) {
        for (let cy = 0; cy < GRID; cy++) {
          for (let cx = 0; cx < GRID; cx++) {
            MASKS[i].grid[cy * GRID + cx] = fn((cx + 0.5) * CELL, (cy + 0.5) * CELL) ? 1 : 0;
          }
        }
        let total = 0;
        for (let k = 0; k < GRID * GRID; k++) total += MASKS[i].grid[k];
        MASKS[i].total = total || 1;
        recount(i);
        renderDots();
      },
      paintToCoverage: function (frac) {
        for (let y = 4; y < BOX && state === "color"; y += 8) {
          for (let x = 4; x < BOX && state === "color"; x += 8) {
            stampAt(current, x, y, false);
            if (coverage(current) >= frac) { blit(); afterStroke(); return; }
          }
        }
        blit(); afterStroke();
      },
      paintToComplete: function () { this.paintToCoverage(TARGET); },
      finishCurrent: function () { finishPage(); },
      forceState: function (s) { state = s; },
    },
  };
})();
