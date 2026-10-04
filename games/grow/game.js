/* ============================================================
   GROW — SmoothDaddyG
   A seed mound waits at the bottom. Every tap grows the plant
   one stage: seed → sprout → stem → bud → full bloom.
   Every flower is different: a random type and colors each
   time. Tap left or right of a stem and it leans that way as
   it grows. And every so often a tap brings a surprise visitor
   instead — and each visitor brings its weather with it:
   sunny, rainy, cloudy, windy or snowy skies, each with its
   own background sounds, plus the occasional rainbow or
   (rarely) a unicorn just for fun.
   Sunshine and rain are growing weather: they make the plant
   grow bigger too. Some flowers grow taller than others —
   and once in a while a giant blooms. Sometimes a bloom is
   joined by another
   flower, and another — until the whole plant bursts in one
   big finale and a new seed begins. An endless, gentle cycle.
   One interaction: tap. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1, time = 0, frameDt = 0;

  const STAGE_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0];
  const HEIGHTS = [0, 34, 74, 100, 128];
  const MAX_BEND = 58;         // px the flower head leans at full bend
  const SURPRISE_CHANCE = 0.2; // ~1 tap in 5 brings a visitor instead
  const SURPRISE_LIFE = 2.5;   // seconds a visitor stays
  const MAX_STEMS = 4;         // a plant can carry up to 4 flowers
  const ANOTHER_CHANCE = 0.65; // odds a bloom is joined by another flower
  const BOOST_STEP = 1.18;     // sun/rain grow a bloom ~18% bigger
  const BOOST_CAP = 1.6;       // ...up to 1.6× its natural size
  const WEATHERS = ["sunny", "cloudy", "windy", "rainy", "snowy"];
  const KIND_TO_WEATHER = {    // surprise visitors that bring weather
    sun: "sunny", rain: "rainy", cloud: "cloudy",
    wind: "windy", snow: "snowy",
  };
  const GIANT_VIGOR = 1.8;     // the rare giant flower

  // The plant is a small cluster of stems sharing one mound.
  // Each stem has its own stage, lean, flower, leaves and bloom
  // boost; the youngest (last in the array) is the one taps grow.
  let stems = [];       // { stage, growT, lean, flower, leaves, offset, boost, phase }
  let surprise = null;  // { kind, t, life, side } while a visitor is here
  let tapCount = 0;     // taps since page load (first tap always grows)
  let petals = [];      // petal-burst particles
  let sparkles = [];    // twinkle particles
  let drops = [];       // rain drops
  let rings = [];
  let bg = [];
  let moundX = 0, moundY = 0;
  let weather = "sunny";       // ambient weather; visitors change it
  let audioStarted = false;    // ambient beds start on first tap (autoplay-safe)
  let ambientLoops = [];       // [{ name, handle, wind }] background beds
  let clouds = [];             // drifting clouds (cloudy/rainy skies)
  let gusts = [];              // wind streaks (windy)
  let flakes = [];             // snowflakes (snowy)
  let bolt = null;             // lightning bolt { pts, t, life }
  let flash = 0;               // lightning screen flash 0..1
  let boltCount = 0;
  let chirpT = 3, rumbleT = 10, boltT = 8, snowT = 9;  // ambience schedulers

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.touchAction = "none";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    moundX = W / 2;
    moundY = H - 120;
    buildBg();
  }
  window.addEventListener("resize", resize);

  function buildBg() {
    bg = [];
    const n = Math.max(30, Math.floor((W * H) / 12000));
    for (let i = 0; i < n; i++) {
      bg.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * 6.283,
      });
    }
  }

  function easeOut(k) {
    return 1 - Math.pow(1 - k, 3);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /* ---------- random flowers ---------- */

  // Every stem gets its own flower: a random type, a random
  // petal hue from anywhere on the rainbow, its own center color,
  // petal count and size. No two flowers look alike.
  function pickFlower() {
    const types = ["daisy", "tulip", "star", "sunflower"];
    const type = types[(Math.random() * types.length) | 0];
    const f = {
      type: type,
      hue: (Math.random() * 360) | 0,
      centerHue: [35, 45, 55][(Math.random() * 3) | 0],
      count: 8,
      size: 28,
    };
    if (type === "daisy") {
      f.count = 7 + ((Math.random() * 4) | 0);      // 7–10 round petals
      f.size = 26 + Math.random() * 8;
    } else if (type === "star") {
      f.count = 5 + ((Math.random() * 2) | 0);      // 5–6 pointed petals
      f.size = 30 + Math.random() * 8;
    } else if (type === "tulip") {
      f.count = 0;                                 // a cup, not a ring
      f.size = 30 + Math.random() * 9;
    } else {                                       // sunflower
      f.hue = 40 + ((Math.random() * 12) | 0);      // always golden
      f.centerHue = 28;                            // big brown center
      f.count = 12 + ((Math.random() * 5) | 0);     // 12–16 thin petals
      f.size = 25 + Math.random() * 6;
    }
    return f;
  }

  function petalHue(f, i) {
    return f.hue + (i % 2 === 0 ? 0 : 14);
  }

  // Stems spread gently across the mound as the cluster grows:
  // the first in the center, then alternating left and right.
  function stemOffset(i) {
    if (i === 0) return 0;
    return (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2) * 36;
  }

  // Some flowers grow more than others: each stem rolls a
  // vigor that scales its height and bloom size. Sunflowers
  // trend tall; 5% of the time a GIANT appears.
  function rollVigor(type) {
    const r = Math.random();
    if (r < 0.05) return GIANT_VIGOR;
    if (type === "sunflower") return 1.1 + Math.random() * 0.5;
    return 0.8 + Math.random() * 0.7;
  }

  function makeStem(i) {
    const flower = pickFlower();
    const vigor = rollVigor(flower.type);
    return {
      stage: 0, growT: 1, lean: 0,
      flower: flower, leaves: [],
      offset: stemOffset(i), boost: 1,
      phase: Math.random() * 6.283,   // its own sway rhythm
      vigor: vigor,
      giant: vigor >= GIANT_VIGOR,
      giantCheered: false,
    };
  }

  function currentStem() {
    return stems[stems.length - 1];
  }

  function makeLeaf(h, side, len) {
    return {
      h: h, side: side, len: len,
      size: 0.85 + Math.random() * 0.35,           // each leaf a bit different
      hue: 126 + ((Math.random() * 34) | 0),       // its own shade of green
      tilt: (Math.random() - 0.5) * 0.24,
    };
  }

  function addLeavesForStage(stem, newStage, side) {
    if (newStage === 1) {
      stem.leaves.push(makeLeaf(30, 1, 34));
      stem.leaves.push(makeLeaf(22, -1, 30));
    } else if (newStage === 2) {
      stem.leaves.push(makeLeaf(62, side, 40));    // new leaf on the tapped side
    } else if (newStage === 3) {
      stem.leaves.push(makeLeaf(88, side, 30));
    }
  }

  /* ---------- stem geometry (with lean) ---------- */

  // The stem is a gentle quadratic curve. Its tip shifts sideways
  // by lean * MAX_BEND, so everything — leaves, bud, bloom, bursts —
  // follows the bend.
  function stemPoints(stem, topY) {
    const windy = weather === "windy";
    const sway = Math.sin(time * (windy ? 2.8 : 1.4) + stem.phase)
      * (windy ? 22 : 6);                    // stems dance in the wind
    const bend = stem.lean * MAX_BEND;
    const wig = surprise && surprise.kind === "rain"
      ? Math.sin(time * 16) * 3 : 0;               // happy wiggle in the rain
    const baseX = moundX + stem.offset;
    const y0 = moundY - 12;
    return {
      x0: baseX, y0: y0,
      x1: baseX + bend * 0.3 + sway * 0.4, y1: y0 - (y0 - topY) * 0.55,
      x2: baseX + bend + sway + wig, y2: topY,
    };
  }

  function qPoint(p, t) {
    const u = 1 - t;
    return {
      x: u * u * p.x0 + 2 * u * t * p.x1 + t * t * p.x2,
      y: u * u * p.y0 + 2 * u * t * p.y1 + t * t * p.y2,
    };
  }

  // Point on the stem at height h above the base (leaves live here).
  function pointAtHeight(stem, topY, h) {
    const p = stemPoints(stem, topY);
    const targetY = (moundY - 12) - h;
    let lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (qPoint(p, mid).y > targetY) lo = mid; else hi = mid;
    }
    return qPoint(p, (lo + hi) / 2);
  }

  function tipPoint(stem, stageVal) {
    const p = stemPoints(stem, moundY - 12 - HEIGHTS[stageVal] * stem.vigor);
    return { x: p.x2, y: p.y2 };
  }

  /* ---------- particles ---------- */

  function sparkleBurst(x, y, hue, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const sp = 60 + Math.random() * 200;
      sparkles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        t: 0, life: 0.6 + Math.random() * 0.5,
        hue: hue, r: 2 + Math.random() * 3.5,
      });
    }
  }

  function bloomBurst(stem, withSound) {
    const tip = tipPoint(stem, 4);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283;
      const sp = 120 + Math.random() * 320;
      petals.push({
        x: tip.x, y: tip.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140,
        rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 10,
        t: 0, life: 1.1 + Math.random() * 0.7,
        hue: petalHue(stem.flower, i),
        r: 8 + Math.random() * 8,
      });
    }
    rings.push({ x: tip.x, y: tip.y, r: 20, t: 0, life: 0.5, hue: stem.flower.hue });
    if (withSound !== false) {
      audio.arp([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.09, "triangle", 0.1);
    }
  }

  /* ---------- surprises ---------- */

  function surpriseJingle(kind) {
    if (kind === "sun") {
      audio.arp([523.25, 587.33, 659.25, 783.99], 0.09, "triangle", 0.09);
    } else if (kind === "rain") {
      audio.arp([783.99, 659.25, 587.33, 523.25], 0.1, "triangle", 0.07);
    } else if (kind === "cloud") {
      audio.arp([392, 440, 523.25], 0.12, "sine", 0.07);
    } else if (kind === "wind") {
      audio.noise(0.7, { filter: "bandpass", freq: 900, slideTo: 2600, vol: 0.1 });
      audio.arp([392, 523.25, 659.25], 0.1, "sine", 0.06);
    } else if (kind === "snow") {
      audio.arp([1567.98, 2093, 2637], 0.09, "sine", 0.06);
    } else if (kind === "rainbow") {
      audio.arp([523.25, 659.25, 783.99, 1046.5, 783.99, 659.25], 0.07, "triangle", 0.09);
    } else { // unicorn — extra magical
      audio.arp([1046.5, 1318.5, 1567.98, 2093], 0.08, "triangle", 0.08);
      audio.tone(1567.98, 0.35, { type: "triangle", vol: 0.05, when: 0.32, slideTo: 2637 });
    }
  }

  // A visitor arrives and brings its weather with it. Rainbow and
  // unicorn are pure celebration — they leave the sky alone.
  function startSurpriseForced(kind) {
    surprise = {
      kind: kind, t: 0, life: SURPRISE_LIFE,
      side: Math.random() < 0.5 ? -1 : 1,
    };
    surpriseJingle(kind);
    const w = KIND_TO_WEATHER[kind];
    if (w) setWeather(w);
  }

  function startSurprise() {
    // Weighted pick: the unicorn is the rare, special one.
    const r = Math.random();
    let kind = "sun";
    if (r < 0.10) kind = "unicorn";
    else if (r < 0.26) kind = "rainbow";
    else if (r < 0.46) kind = "sun";
    else if (r < 0.66) kind = "rain";
    else if (r < 0.79) kind = "cloud";
    else if (r < 0.91) kind = "wind";
    else kind = "snow";
    startSurpriseForced(kind);
  }

  // Sunshine and rain are growing weather: when either visitor
  // arrives, the plant grows too. Below bloom that means advancing
  // one full stage (a stage advance IS growing bigger); at full
  // bloom the flower itself swells instead. Rainbow and unicorn
  // are pure celebration — no boost. This boost is the surprise
  // tap's growth; it never stacks with a normal tap-grow.
  function applyWeatherBoost(side) {
    if (!surprise) return;
    const kind = surprise.kind;
    if (kind !== "sun" && kind !== "rain") return;
    const stem = currentStem();
    if (stem.stage < 4) {
      advanceStage(stem, side);
    } else if (stem.boost < BOOST_CAP) {
      stem.boost = Math.min(BOOST_CAP, stem.boost * BOOST_STEP);
      const tip = tipPoint(stem, 4);
      sparkleBurst(tip.x, tip.y, kind === "sun" ? 48 : 205, 16);
      audio.tone(1318.5, 0.18, { type: "triangle", vol: 0.06 });
    }
  }

  /* ---------- weather: visitors bring the weather ---------- */

  // Every new plant starts under a fresh sky: often sunny,
  // sometimes cloudy, occasionally wild.
  function rollStartWeather() {
    const r = Math.random();
    if (r < 0.4) return "sunny";
    if (r < 0.7) return "cloudy";
    if (r < 0.8) return "windy";
    if (r < 0.9) return "rainy";
    return "snowy";
  }

  // Fade out every ambient loop, then stop it (~1s crossfade).
  function stopAllAmbient() {
    const old = ambientLoops;
    ambientLoops = [];
    old.forEach(function (a) {
      try {
        const t = a.handle.ctx.currentTime;
        a.handle.gain.gain.setTargetAtTime(0.0001, t, 0.3);
        const h = a.handle;
        setTimeout(function () { try { h.src.stop(); } catch (e) {} }, 1300);
      } catch (e) {}
    });
  }

  // Start the background "outside" sound for this weather.
  // Quiet looped beds; birds, chimes and thunder are scheduled
  // in the frame loop so they feel alive, not mechanical.
  function startAmbientBed(name) {
    stopAllAmbient();
    if (audio.muted) return;
    function bed(dur, opts) {
      opts.loop = true;
      if (opts.attack == null) opts.attack = 1.2;
      const h = audio.noise(dur, opts);
      if (h) ambientLoops.push({ name: name, handle: h, wind: !!opts.isWind });
      return h;
    }
    if (name === "rainy") {
      bed(3, { filter: "bandpass", freq: 2800, Q: 0.5, vol: 0.05 });  // patter
    } else if (name === "cloudy") {
      bed(3, { filter: "lowpass", freq: 380, vol: 0.035 });           // soft breeze
    } else if (name === "windy") {
      bed(3, { filter: "bandpass", freq: 520, Q: 2.2, vol: 0.075, attack: 1.6, isWind: true });
    }
    // sunny: birds chirp on a scheduler. snowy: near-silence + soft chimes.
  }

  function setWeather(name) {
    if (WEATHERS.indexOf(name) < 0) return;
    weather = name;
    if (audioStarted) startAmbientBed(name);
  }

  // A bird chirps: a couple of quick rising blips.
  function chirp() {
    const base = 2200 + Math.random() * 1400;
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      audio.tone(base, 0.08, { type: "sine", vol: 0.025, when: i * 0.11, slideTo: base * 1.5 });
    }
  }

  // Lightning: jagged bolt, screen flash, thunder crack.
  function triggerLightning() {
    const bx = W * (0.15 + Math.random() * 0.7);
    const pts = [{ x: bx, y: -20 }];
    let x = bx, y = -20;
    while (y < H * 0.42) {
      y += 26 + Math.random() * 36;
      x += (Math.random() - 0.5) * 70;
      pts.push({ x: x, y: y });
    }
    bolt = { pts: pts, t: 0, life: 0.5 };
    flash = 1;
    boltCount++;
    if (audioStarted && !audio.muted) {
      audio.noise(1.6, { filter: "lowpass", freq: 130, vol: 0.32 });   // thunder crack
      audio.noise(0.22, { filter: "highpass", freq: 2600, vol: 0.1 }); // electric snap
    }
  }

  // Schedulers (birds / thunder / chimes), wind whistle LFO, and
  // all ambient weather particles. Called every frame.
  function updateWeatherVisuals(dt) {
    const canSound = audioStarted && !audio.muted;

    if (weather === "sunny" && canSound) {
      chirpT -= dt;
      if (chirpT <= 0) { chirp(); chirpT = 2 + Math.random() * 5; }
    } else if (weather === "rainy") {
      if (canSound) {
        rumbleT -= dt;
        if (rumbleT <= 0) {
          audio.noise(2.5, { filter: "lowpass", freq: 80, vol: 0.2 }); // distant thunder
          rumbleT = 8 + Math.random() * 12;
        }
      }
      boltT -= dt;
      if (boltT <= 0) { triggerLightning(); boltT = 6 + Math.random() * 8; }
    } else if (weather === "snowy" && canSound) {
      snowT -= dt;
      if (snowT <= 0) {
        audio.tone([2093, 2349.3, 2637][(Math.random() * 3) | 0], 1.0, { type: "sine", vol: 0.018 });
        snowT = 7 + Math.random() * 8;
      }
    }

    // Wind whistle: slowly wander the bandpass frequency.
    for (const a of ambientLoops) {
      if (a.wind) {
        try {
          a.handle.filter.frequency.setTargetAtTime(
            320 + Math.sin(time * 0.6) * 260 + Math.sin(time * 1.7) * 80,
            a.handle.ctx.currentTime, 0.2);
        } catch (e) {}
      }
    }

    // Ambient clouds: light and drifty when cloudy, dark when rainy.
    const wantClouds = weather === "cloudy" ? 4 : weather === "rainy" ? 2 : 0;
    while (clouds.length < wantClouds) {
      clouds.push({
        x: Math.random() < 0.5 ? -160 : W + 160,
        y: 40 + Math.random() * 120,
        vx: (8 + Math.random() * 14) * (Math.random() < 0.5 ? 1 : -1),
        s: 0.7 + Math.random() * 0.9,
      });
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.x += c.vx * dt;
      if (wantClouds === 0 || c.x < -260 || c.x > W + 260) clouds.splice(i, 1);
    }

    // Wind streaks blowing sideways.
    if (weather === "windy" && gusts.length < 36) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      gusts.push({
        x: dir > 0 ? -160 : W + 160, y: Math.random() * H * 0.8,
        vx: dir * (420 + Math.random() * 320),
        len: 60 + Math.random() * 90,
      });
    }
    for (let i = gusts.length - 1; i >= 0; i--) {
      const g = gusts[i];
      g.x += g.vx * dt;
      if (g.x < -240 || g.x > W + 240) gusts.splice(i, 1);
    }

    // Snowflakes drifting down.
    if (weather === "snowy" && flakes.length < 90) {
      flakes.push({
        x: Math.random() * W, y: -12,
        vy: 30 + Math.random() * 45,
        ph: Math.random() * 6.283, r: 1.6 + Math.random() * 2.2,
      });
    }
    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i];
      f.y += f.vy * dt;
      f.x += Math.sin(time * 1.3 + f.ph) * 24 * dt;
      if (f.y > H + 14) flakes.splice(i, 1);
    }

    // Lightning decay.
    if (bolt) { bolt.t += dt; if (bolt.t >= bolt.life) bolt = null; }
    if (flash > 0) flash = Math.max(0, flash - dt * 2.4);
  }

  function surpriseAlpha(s) {
    return clamp(Math.min(1, s.t / 0.3, (s.life - s.t) / 0.5), 0, 1);
  }

  function drawSun(s) {
    const rise = easeOut(Math.min(1, s.t / 0.6));
    const cx = s.side < 0 ? 86 : W - 86;
    const cy = -64 + 156 * rise;
    ctx.save();
    ctx.globalAlpha = surpriseAlpha(s);
    ctx.fillStyle = "hsla(48, 100%, 60%, 0.15)";
    ctx.beginPath();
    ctx.arc(cx, cy, 64, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = "hsl(48, 100%, 58%)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.shadowColor = "hsl(48, 100%, 55%)";
    ctx.shadowBlur = 12;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.2832 + time * 0.7;
      const r1 = 40, r2 = 52 + Math.sin(time * 3 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.fillStyle = "hsl(50, 100%, 62%)";
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, 6.2832);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#7a4d00";
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 3, 3, 0, 6.2832);
    ctx.arc(cx + 10, cy - 3, 3, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = "#7a4d00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 13, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.fillStyle = "hsla(20, 90%, 65%, 0.55)";
    ctx.beginPath();
    ctx.arc(cx - 17, cy + 6, 4.5, 0, 6.2832);
    ctx.arc(cx + 17, cy + 6, 4.5, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function rainCloudPos(s) {
    const enter = easeOut(Math.min(1, s.t / 0.7));
    const startX = s.side < 0 ? -90 : W + 90;
    const endX = moundX + s.side * 26;
    return {
      x: startX + (endX - startX) * enter,
      y: 84 + Math.sin(time * 1.1) * 4,
    };
  }

  function drawCloudShape(x, y, s, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = "hsla(220, 40%, 70%, 0.8)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(x, y, 46 * s, 23 * s, 0, 0, 6.2832);
    ctx.ellipse(x - 30 * s, y + 6 * s, 29 * s, 16 * s, 0, 0, 6.2832);
    ctx.ellipse(x + 30 * s, y + 6 * s, 31 * s, 17 * s, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function drawRainCloud(s) {
    const c = rainCloudPos(s);
    drawCloudShape(c.x, c.y, 1, "hsl(222, 25%, 80%)", surpriseAlpha(s));
  }

  // The cloud visitor drifts in grey and quiet — no drops.
  function drawCloudVisitor(s) {
    const c = rainCloudPos(s);
    drawCloudShape(c.x, c.y, 1.15, "hsl(220, 12%, 62%)", surpriseAlpha(s));
  }

  // The wind visitor: three swooping arcs spinning overhead.
  function drawWindVisitor(s) {
    ctx.save();
    ctx.globalAlpha = surpriseAlpha(s);
    ctx.strokeStyle = "hsla(200, 60%, 85%, 0.8)";
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const yy = 150 + i * 46;
      const a0 = time * (2.2 + i * 0.5) + i * 2.1;
      ctx.lineWidth = 6 - i;
      ctx.beginPath();
      ctx.arc(moundX, yy, 110 + i * 26, a0, a0 + 2.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The snow visitor: a big snowflake twirling down from the sky.
  function drawSnowVisitor(s) {
    const fall = easeOut(Math.min(1, s.t / 0.8));
    const x = moundX + s.side * 60;
    const y = -50 + 220 * fall;
    ctx.save();
    ctx.globalAlpha = surpriseAlpha(s);
    ctx.translate(x, y);
    ctx.rotate(time * 0.8);
    ctx.strokeStyle = "#eaf4ff";
    ctx.shadowColor = "#bcd8ff";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.2832;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRainbow(s) {
    const sweep = easeOut(Math.min(1, s.t / 0.9));
    const R = Math.min(W, H) * 0.48;
    const hues = [0, 38, 58, 130, 205, 275];
    ctx.save();
    ctx.globalAlpha = surpriseAlpha(s) * 0.9;
    ctx.lineWidth = 9;
    for (let i = 0; i < hues.length; i++) {
      ctx.strokeStyle = "hsl(" + hues[i] + ", 95%, 62%)";
      ctx.shadowColor = "hsl(" + hues[i] + ", 95%, 65%)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(moundX, moundY - 6, R - i * 10, Math.PI, Math.PI + sweep * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < frameDt * 5) {
      const a = Math.PI + Math.random() * Math.PI;
      const r = R - Math.random() * 50;
      sparkles.push({
        x: moundX + Math.cos(a) * r, y: moundY - 6 + Math.sin(a) * r,
        vx: 0, vy: -20, t: 0, life: 0.7,
        hue: hues[(Math.random() * hues.length) | 0], r: 2.4,
      });
    }
  }

  function drawUnicorn(s) {
    const rise = easeOut(Math.min(1, s.t / 0.45));
    const sink = easeOut(clamp((s.life - s.t) / 0.5, 0, 1));
    const vis = Math.min(rise, sink);
    const bob = Math.sin(s.t * 5) * 3 * vis;
    const ux = moundX + s.side * 58;
    const uy = moundY + 16 - 52 * vis + bob;
    const u = 3.1;
    const white = "#f8f8ff";
    function px(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x * u, y * u, w * u, h * u);
    }
    ctx.save();
    ctx.globalAlpha = surpriseAlpha(s);
    ctx.translate(ux, uy);
    ctx.scale(s.side, 1);
    // rainbow tail
    px(-9.6, -6.5, 2, 2, "hsl(280, 85%, 65%)");
    px(-9.6, -4.5, 2, 2, "hsl(205, 90%, 62%)");
    px(-9.6, -2.5, 2, 2, "hsl(130, 70%, 52%)");
    // legs + hooves
    px(-6, -2, 2, 4.5, white);
    px(2.5, -2, 2, 4.5, white);
    px(-6, 1.7, 2, 0.9, "#8a7f9e");
    px(2.5, 1.7, 2, 0.9, "#8a7f9e");
    // body
    px(-7, -7.5, 12, 5.5, white);
    // neck + head
    px(3.5, -11, 3, 4.5, white);
    px(4.5, -12.5, 6, 4.5, white);
    px(9.5, -10, 2.5, 2.8, "#ffe0ee");
    // ear
    px(4.8, -14.3, 1.6, 2, white);
    // gold horn
    ctx.fillStyle = "hsl(45, 100%, 55%)";
    ctx.shadowColor = "hsl(45, 100%, 60%)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(6.4 * u, -12.5 * u);
    ctx.lineTo(8.6 * u, -17.5 * u);
    ctx.lineTo(9.6 * u, -12.5 * u);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // rainbow mane down the neck
    px(2.2, -12, 1.8, 2.2, "hsl(0, 90%, 62%)");
    px(2.2, -9.8, 1.8, 2.2, "hsl(45, 95%, 58%)");
    px(2.2, -7.6, 1.8, 2.2, "hsl(130, 70%, 50%)");
    px(2.2, -5.4, 1.8, 2, "hsl(215, 90%, 62%)");
    // eye + blush
    px(7.6, -11, 1.1, 1.1, "#26222e");
    px(8.6, -9.6, 1.4, 0.9, "hsla(335, 90%, 70%, 0.8)");
    ctx.restore();
    if (Math.random() < frameDt * 4) {
      sparkleBurst(ux + (Math.random() - 0.5) * 70, uy - 30, (Math.random() * 360) | 0, 1);
    }
  }

  // Sky surprises and the unicorn draw behind the mound and plant;
  // rain drops fall in front (drawn later, in the frame loop).
  function drawSurpriseBack() {
    if (!surprise) return;
    if (surprise.kind === "sun") drawSun(surprise);
    else if (surprise.kind === "rainbow") drawRainbow(surprise);
    else if (surprise.kind === "unicorn") drawUnicorn(surprise);
    else if (surprise.kind === "rain") drawRainCloud(surprise);
    else if (surprise.kind === "cloud") drawCloudVisitor(surprise);
    else if (surprise.kind === "wind") drawWindVisitor(surprise);
    else if (surprise.kind === "snow") drawSnowVisitor(surprise);
  }

  function updateRain(dt) {
    if (surprise && surprise.kind === "rain" && surprise.t < surprise.life - 0.3) {
      const c = rainCloudPos(surprise);
      if (drops.length < 160) {
        for (let i = 0; i < 3; i++) {
          drops.push({
            x: c.x + (Math.random() - 0.5) * 84,
            y: c.y + 18,
            vy: 360 + Math.random() * 160,
          });
        }
      }
    } else if (weather === "rainy") {
      // Ambient drizzle while rainy weather lingers.
      if (drops.length < 160) {
        for (let i = 0; i < 2; i++) {
          drops.push({
            x: Math.random() * W,
            y: -12,
            vy: 380 + Math.random() * 180,
          });
        }
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.vy * dt;
      if (d.y >= moundY - 8) {
        sparkles.push({
          x: d.x, y: moundY - 8,
          vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40,
          t: 0, life: 0.3, hue: 205, r: 1.8,
        });
        drops.splice(i, 1);
      }
    }
  }

  function drawRain() {
    if (!drops.length) return;
    ctx.save();
    ctx.strokeStyle = "hsla(205, 90%, 72%, 0.85)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const d of drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + 9);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Sky tint for the current weather + ambient clouds and
  // wind streaks, drawn behind the mound and plants.
  function drawWeatherBack() {
    let tint = null;
    if (weather === "cloudy") tint = "rgba(30,36,58,0.30)";
    else if (weather === "rainy") tint = "rgba(20,30,60,0.20)";
    else if (weather === "snowy") tint = "rgba(120,160,255,0.07)";
    else if (weather === "sunny") tint = "rgba(255,200,80,0.05)";
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
    const dark = weather === "rainy";
    for (const c of clouds) {
      drawCloudShape(c.x, c.y, c.s, dark ? "hsl(222, 18%, 45%)" : "hsl(220, 14%, 60%)", 0.9);
    }
    if (gusts.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const g of gusts) {
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x - (g.vx > 0 ? g.len : -g.len), g.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlakes() {
    if (!flakes.length) return;
    ctx.save();
    ctx.fillStyle = "rgba(240,248,255,0.85)";
    for (const f of flakes) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  // Lightning bolt + screen flash, drawn over the scene.
  function drawBolt() {
    if (bolt) {
      const k = Math.max(0, 1 - bolt.t / bolt.life);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = "#cfe8ff";
      ctx.shadowColor = "#9fd0ff";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 4;
      ctx.beginPath();
      bolt.pts.forEach(function (p, i) {
        if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
    }
    if (flash > 0) {
      ctx.fillStyle = "rgba(200,220,255," + (flash * 0.45).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- interaction ---------- */

  // One stage of growth on one stem: a leaf appears on the tapped
  // side, a little rising arpeggio plays, sparkles pop at the tip.
  function advanceStage(stem, side) {
    stem.stage++;
    stem.growT = 0;
    addLeavesForStage(stem, stem.stage, side);
    const base = STAGE_NOTES[stem.stage];
    audio.arp([base, base * 1.25, base * 1.5], 0.08, "triangle", 0.09);
    const tip = tipPoint(stem, stem.stage);
    sparkleBurst(tip.x, tip.y + 10, 150, 12);
    if (stem.stage === 4 && stem.giant && !stem.giantCheered) {
      // A GIANT bloomed — make a fuss about it.
      stem.giantCheered = true;
      sparkleBurst(tip.x, tip.y - 20, 48, 30);
      sparkleBurst(tip.x, tip.y - 20, 300, 30);
      audio.arp([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 0.08, "triangle", 0.1);
    }
  }

  // After a bloom, the next touch often starts ANOTHER stem beside
  // it — a fresh sprout that grows stage by stage while the flower
  // (or flowers) already open stay on show, swaying gently.
  function startNewStem(side, leanSeed) {
    const stem = makeStem(stems.length);
    stem.lean = clamp(leanSeed, -1, 1);
    stems.push(stem);
    advanceStage(stem, side); // pops up as a sprout on this very tap
  }

  // ...or it's time for the grand finale: every flower bursts its
  // petals together in one big celebration, and a fresh single
  // seed begins.
  function grandFinale() {
    stems.forEach(function (stem, i) {
      if (stem.stage === 4) bloomBurst(stem, i === 0);
    });
    stems = [makeStem(0)];
    currentStem().growT = 0;
    audio.tone(392, 0.15, { type: "triangle", vol: 0.08, when: 0.5 });
    setWeather(rollStartWeather());   // a new plant, a new sky
  }

  function grow(side, leanSeed) {
    const stem = currentStem();
    if (stem.stage < 4) {
      advanceStage(stem, side);
    } else if (stems.length < MAX_STEMS && Math.random() < ANOTHER_CHANCE) {
      startNewStem(side, leanSeed);
    } else {
      grandFinale();
    }
  }

  function onTap(e) {
    const stem = currentStem();
    const baseX = moundX + stem.offset;
    const x = e && typeof e.clientX === "number" ? e.clientX : baseX;
    const dx = x - baseX;
    tapCount++;
    if (!audioStarted) {
      // First tap: the outside world fades in (autoplay-safe).
      audioStarted = true;
      startAmbientBed(weather);
    }
    // Tap side steers the lean: right of the stem bends it right,
    // left bends it left; repeated taps accumulate up to the cap.
    const leanNudge = clamp(dx / (W * 0.5), -1, 1) * 0.5;
    stem.lean = clamp(stem.lean + leanNudge, -1, 1);
    const side = dx >= 0 ? 1 : -1;
    // Sometimes a tap brings a visitor instead of growing — never
    // on the very first tap, and never two visitors at once. Sun
    // and rain still grow the plant via applyWeatherBoost; that
    // boost is this tap's growth, never doubled with a tap-grow.
    if (!surprise && tapCount > 1 && Math.random() < SURPRISE_CHANCE) {
      startSurprise();
      applyWeatherBoost(side);
      return;
    }
    grow(side, leanNudge);
  }
  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });


  /* ---------- drawing ---------- */

  function drawMound() {
    ctx.save();
    ctx.shadowColor = "hsl(280, 60%, 40%)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#2a1f33";
    ctx.beginPath();
    ctx.ellipse(moundX, moundY, 92, 30, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "hsla(280, 50%, 60%, 0.25)";
    ctx.beginPath();
    ctx.ellipse(moundX - 18, moundY - 8, 52, 14, -0.1, 0, 6.2832);
    ctx.fill();
  }

  function drawLeaf(x, y, len, ang, hue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = "hsl(" + hue + ", 70%, 42%)";
    ctx.shadowColor = "hsl(" + hue + ", 80%, 50%)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2, len * 0.28, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function drawStem(stem, topY) {
    const p = stemPoints(stem, topY);
    ctx.save();
    ctx.strokeStyle = "hsl(140, 65%, 38%)";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.shadowColor = "hsl(140, 80%, 50%)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(p.x0, p.y0);
    ctx.quadraticCurveTo(p.x1, p.y1, p.x2, p.y2);
    ctx.stroke();
    ctx.restore();
    return { x: p.x2, y: p.y2 };
  }

  function drawRoundPetal(x, y, len, wid, ang, hue, light) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = "hsl(" + hue + ", 90%, " + light + "%)";
    ctx.shadowColor = "hsl(" + hue + ", 95%, 65%)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function drawPointedPetal(x, y, len, wid, ang, hue, light) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = "hsl(" + hue + ", 90%, " + light + "%)";
    ctx.shadowColor = "hsl(" + hue + ", 95%, 65%)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.4, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.4, wid, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawTulip(cx, baseY, s, f) {
    // Three pointed petals standing up make the cup: two behind,
    // one tall in front.
    drawPointedPetal(cx, baseY, s * 1.05, s * 0.4, -Math.PI / 2 - 0.38, f.hue, 54);
    drawPointedPetal(cx, baseY, s * 1.05, s * 0.4, -Math.PI / 2 + 0.38, f.hue + 16, 54);
    drawPointedPetal(cx, baseY, s * 1.2, s * 0.46, -Math.PI / 2, f.hue + 8, 62);
  }

  function drawBloom(tip, k, stem) {
    const f = stem.flower;
    const cx = tip.x, cy = tip.y - 6 * k;
    const s = f.size * k * stem.boost * stem.vigor;  // vigor + sun/rain size the bloom
    if (f.type === "tulip") {
      drawTulip(cx, cy + s * 0.3, s, f);
      return;
    }
    const n = f.count;
    const wob = Math.sin(time * 1.2 + stem.phase) * 0.05;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + wob;
      if (f.type === "daisy") {
        drawRoundPetal(cx, cy, s * 1.2, s * 0.66, a, petalHue(f, i), 62);
      } else if (f.type === "star") {
        drawPointedPetal(cx, cy, s * 1.3, s * 0.4, a, petalHue(f, i), 60);
      } else { // sunflower: a wide ring of thin golden petals
        drawRoundPetal(cx, cy, s * 1.15, s * 0.3, a, petalHue(f, i), 55);
      }
    }
    // the center
    const cr = f.type === "sunflower" ? s * 0.6
      : f.type === "star" ? s * 0.36 : s * 0.42;
    ctx.save();
    if (f.type === "sunflower") {
      ctx.shadowColor = "hsl(30, 60%, 30%)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "hsl(28, 55%, 24%)";
    } else {
      ctx.shadowColor = "hsl(" + f.centerHue + ", 100%, 60%)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "hsl(" + f.centerHue + ", 100%, 60%)";
    }
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, 6.2832);
    ctx.fill();
    ctx.restore();
    if (f.type === "sunflower") {
      // seed speckles in the big center
      ctx.fillStyle = "hsl(25, 50%, 15%)";
      const dots = [[-0.2, -0.1], [0.15, 0.05], [0, -0.28], [-0.05, 0.22], [0.26, -0.2]];
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(cx + d[0] * cr, cy + d[1] * cr, cr * 0.12, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  function drawPlant(stem) {
    const k = easeOut(Math.min(1, stem.growT));
    const baseX = moundX + stem.offset;

    if (stem.stage === 0) {
      // seed: a small glowing seed on the mound (giants hint bigger)
      const pulse = 1 + Math.sin(time * 3 + stem.phase) * 0.08;
      const ss = 0.7 + 0.3 * stem.vigor;
      ctx.save();
      ctx.shadowColor = "hsl(35, 90%, 55%)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "hsl(35, 85%, 48%)";
      ctx.beginPath();
      ctx.ellipse(baseX, moundY - 22, 13 * pulse * ss, 10 * pulse * ss, 0.3, 0, 6.2832);
      ctx.fill();
      ctx.restore();
      return;
    }

    const topY = moundY - 12 - HEIGHTS[stem.stage] * stem.vigor * k;
    const tip = drawStem(stem, topY);

    // leaves ride the bent stem at their own heights
    for (const lf of stem.leaves) {
      const h = Math.min(lf.h, HEIGHTS[stem.stage] * stem.vigor * k);
      if (h <= 0) continue;
      const p = pointAtHeight(stem, topY, h);
      const ang = lf.side > 0 ? -0.5 + lf.tilt : Math.PI + 0.5 - lf.tilt;
      drawLeaf(p.x, p.y, lf.len * k * lf.size, ang, lf.hue);
    }

    if (stem.stage === 3) {
      // closed bud, already wearing the flower's color
      const bs = stem.vigor;
      ctx.save();
      ctx.shadowColor = "hsl(" + stem.flower.hue + ", 95%, 60%)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "hsl(" + stem.flower.hue + ", 85%, 52%)";
      ctx.beginPath();
      ctx.ellipse(tip.x, tip.y - 12 * k * bs, 13 * k * bs, 18 * k * bs, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "hsl(" + stem.flower.hue + ", 90%, 66%)";
      ctx.beginPath();
      ctx.ellipse(tip.x - 3 * k * bs, tip.y - 16 * k * bs, 6 * k * bs, 10 * k * bs, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
    if (stem.stage === 4) {
      drawBloom(tip, k, stem);
    }
  }

  function drawCluster() {
    for (const stem of stems) drawPlant(stem);
  }

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    frameDt = dt;
    time += dt;
    for (const stem of stems) {
      if (stem.growT < 1) stem.growT = Math.min(1, stem.growT + dt * 1.8);
    }


    if (surprise) {
      surprise.t += dt;
      if (surprise.t >= surprise.life) surprise = null;
    }
    updateRain(dt);
    updateWeatherVisuals(dt);

    // background
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#0b0b16");
    grd.addColorStop(1, "#0a0a13");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    for (const s of bg) {
      const a = 0.25 + Math.abs(Math.sin(time * 0.8 + s.tw)) * 0.5;
      ctx.fillStyle = "rgba(160,200,255," + a.toFixed(2) + ")";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    drawWeatherBack();
    drawSurpriseBack();
    drawMound();
    drawCluster();
    drawRain();
    drawFlakes();

    // sparkles
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const p = sparkles[i];
      p.t += dt;
      if (p.t >= p.life) { sparkles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = "hsla(" + p.hue + ",95%,68%," + k.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * k + 0.5, 0, 6.2832);
      ctx.fill();
    }

    // petal burst
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.t += dt;
      if (p.t >= p.life) { petals.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= 0.985;
      p.rot += p.vr * dt;
      const k = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = "hsl(" + p.hue + ", 90%, 62%)";
      ctx.shadowColor = "hsl(" + p.hue + ", 95%, 65%)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }

    // rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) { rings.splice(i, 1); continue; }
      const k = r.t / r.life;
      ctx.strokeStyle = "hsla(" + r.hue + ",95%,65%," + (1 - k).toFixed(2) + ")";
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 80, 0, 6.2832);
      ctx.stroke();
    }

    drawBolt();

    requestAnimationFrame(frame);
  }

  // minimal test hook: read-only state for automated checks.
  // stage/lean/flower/boost describe the current (youngest) stem.
  window.__growTest = {
    get stage() { const s = currentStem(); return s ? s.stage : 0; },
    get lean() { const s = currentStem(); return s ? s.lean : 0; },
    get flowerType() { const s = currentStem(); return s && s.flower ? s.flower.type : null; },
    get flowerHue() { const s = currentStem(); return s && s.flower ? s.flower.hue : null; },
    get surpriseKind() { return surprise ? surprise.kind : null; },
    get tapCount() { return tapCount; },
    get stemCount() { return stems.length; },
    get stages() { return stems.map(function (s) { return s.stage; }); },
    get boost() { const s = currentStem(); return s ? s.boost : 1; },
    get boosts() { return stems.map(function (s) { return s.boost; }); },
    get flowerCount() { return stems.filter(function (s) { return s.stage === 4; }).length; },
    get weather() { return weather; },
    get vigors() { return stems.map(function (s) { return s.vigor; }); },
    get tipHeights() { return stems.map(function (s) { return HEIGHTS[s.stage] * s.vigor; }); },
    get ambientNames() { return ambientLoops.map(function (a) { return a.name; }); },
    get boltCount() { return boltCount; },
    get lightningActive() { return !!bolt; },
    tap: function (x) { onTap({ clientX: x }); },
    forceSurprise: function (kind) { startSurpriseForced(kind); },
    forceWeather: function (name) { setWeather(name); },
    forceBolt: function () { triggerLightning(); },
  };

  stems = [makeStem(0)];
  weather = rollStartWeather();
  resize();
  requestAnimationFrame(frame);
})();
