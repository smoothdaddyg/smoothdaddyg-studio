/* ============================================================
   Dance Judge — a tiny televised dance competition.
   Watch three cute couples dance, score each 1-10, celebrate
   the winner. You are the judge, not the contestant.
   - No reading required: tap the giant 1-10 buttons.
   - No timers, no failing, no game over. Ever.
   - Sound on by default, no in-game volume control.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);

  var audio = makeAudio();

  /* ---------------- utils ---------------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return (a + Math.random() * (b - a + 1)) | 0; }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function chance(p) { return Math.random() < p; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ============================================================
     MUSIC — tiny step sequencer, one groove per dance style.
     Each style: bpm, drum pattern, bassline, melody (scale degrees).
     ============================================================ */
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pentatonic-ish
  function deg(root, d, oct) {
    var n = SCALE[((d % SCALE.length) + SCALE.length) % SCALE.length];
    return root * Math.pow(2, (n + (oct || 0) * 12) / 12);
  }

  var GROOVES = {
    waltz:   { bpm: 132, beats: 3, root: 261.6, minor: false,
               kick: [1,0,0, 0,0,0, 0,0,0], snare: [0,0,0, 0,1,0, 0,1,0],
               bass: [0,-1,-1, -1,-1,-1, 4,-1,-1], mel: [0,2,4, 7,4,2, 4,2,0] },
    tango:   { bpm: 120, beats: 4, root: 220.0, minor: true,
               kick: [1,0,1,0, 1,0,0,1, 0,0,1,0], snare: [0,0,0,0, 0,0,1,0, 0,1,0,0],
               bass: [0,-1,0,-1, 3,-1,-1,-1, 2,-1,0,-1], mel: [0,-1,3,-1, 2,0,-1,-1, 4,3,2,-1] },
    disco:   { bpm: 116, beats: 4, root: 246.9, minor: false,
               kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
               bass: [0,-1,0,-1, 7,-1,0,-1, 0,-1,0,-1, 5,-1,4,-1], mel: [7,-1,9,7, -1,4,-1,2, 0,-1,2,4, -1,-1,7,-1] },
    salsa:   { bpm: 132, beats: 4, root: 277.2, minor: false,
               kick: [1,0,0,1, 0,0,1,0, 0,0,1,0], snare: [0,0,1,0, 0,1,0,0, 1,0,0,1],
               bass: [0,-1,-1,0, -1,-1,4,-1, -1,0,-1,-1], mel: [4,-1,7,-1, 9,-1,7,4, -1,2,4,-1] },
    swing:   { bpm: 150, beats: 4, root: 246.9, minor: false, shuffle: true,
               kick: [1,0,0,0, 0,0,1,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,1, 0,0,1,0],
               bass: [0,-1,-1,0, -1,-1,4,-1, -1,-1,5,-1], mel: [0,4,-1,7, -1,9,-1,7, 4,-1,2,0] },
    rock:    { bpm: 140, beats: 4, root: 220.0, minor: false,
               kick: [1,0,0,0, 0,0,1,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0],
               bass: [0,0,-1,0, -1,0,4,-1, 5,-1,4,-1], mel: [0,-1,0,4, -1,7,-1,4, 9,7,4,2] },
    country: { bpm: 128, beats: 4, root: 261.6, minor: false,
               kick: [1,0,0,0, 0,0,0,0, 1,0,0,0], snare: [0,0,1,0, 0,1,0,0, 0,0,1,0],
               bass: [0,-1,-1,-1, 4,-1,-1,-1, 5,-1,4,-1], mel: [0,2,4,2, 7,-1,4,2, 0,-1,-1,-1] },
    ballet:  { bpm: 100, beats: 3, root: 293.7, minor: false, soft: true,
               kick: [0,0,0, 0,0,0, 0,0,0], snare: [0,0,0, 0,0,0, 0,0,0],
               bass: [0,-1,-1, -1,-1,-1, -1,-1,-1], mel: [0,4,7, 12,9,7, 4,2,0] },
    hiphop:  { bpm: 96, beats: 4, root: 196.0, minor: true,
               kick: [1,0,0,0, 0,0,0,1, 0,0,1,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0],
               bass: [0,-1,-1,-1, -1,-1,-1,-1, 3,-1,-1,2], mel: [-1,-1,0,-1, -1,3,-1,-1, 2,-1,0,-1] },
    funk:    { bpm: 108, beats: 4, root: 220.0, minor: true,
               kick: [1,0,0,1, 0,0,1,0, 0,1,0,0], snare: [0,0,0,0, 1,0,1,0, 0,0,1,0],
               bass: [0,-1,3,-1, 0,-1,-1,4, -1,3,2,-1], mel: [7,-1,-1,9, -1,7,-1,-1, 4,-1,2,-1] },
    charleston: { bpm: 170, beats: 4, root: 261.6, minor: false,
               kick: [1,0,1,0, 0,1,0,0, 1,0,1,0], snare: [0,0,0,0, 1,0,0,1, 0,0,0,0],
               bass: [0,-1,4,-1, 5,-1,4,-1, 0,-1,4,-1], mel: [4,7,9,7, 12,9,7,4, 2,4,7,4] },
    chacha:  { bpm: 124, beats: 4, root: 246.9, minor: false,
               kick: [1,0,0,0, 1,0,1,0, 0,0,1,0], snare: [0,0,1,1, 0,0,0,0, 1,1,0,0],
               bass: [0,-1,-1,-1, 4,-1,-1,-1, 5,-1,4,-1], mel: [0,-1,4,4, -1,7,-1,4, 2,-1,0,-1] },
    freestyle: { bpm: 122, beats: 4, root: 261.6, minor: false, silly: true,
               kick: [1,0,0,1, 0,0,1,0, 1,0,0,0], snare: [0,0,1,0, 0,1,0,0, 0,0,1,1],
               bass: [0,-1,7,-1, -1,4,-1,-1, 5,-1,2,-1], mel: [7,9,12,9, 7,4,2,4, 0,4,7,-1] },
    robot:   { bpm: 100, beats: 4, root: 196.0, minor: true, stiff: true,
               kick: [1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,1,0, 0,0,1,0, 0,0,1,0],
               bass: [0,0,0,0, 3,3,3,3, 2,2,2,2], mel: [0,0,-1,0, 0,-1,3,-1, 2,2,-1,2] },
    silly:   { bpm: 140, beats: 4, root: 293.7, minor: false, silly: true,
               kick: [1,0,1,0, 0,1,0,0, 1,0,0,1], snare: [0,1,0,0, 1,0,1,0, 0,1,0,0],
               bass: [0,4,7,4, 9,7,4,2, 0,4,7,12], mel: [12,9,7,4, 2,4,7,9, 12,-1,7,-1] },
    ballroom:{ bpm: 120, beats: 4, root: 246.9, minor: false,
               kick: [1,0,0,0, 0,0,0,0, 0,0,0,0], snare: [0,0,0,0, 0,0,1,0, 0,0,0,0],
               bass: [0,-1,-1,-1, -1,-1,-1,-1, 4,-1,-1,-1], mel: [0,4,7,4, 9,7,4,2, 7,4,2,0] },
  };

  var STYLES = Object.keys(GROOVES);

  // Style -> favored move categories (choreography flavor)
  var STYLE_TASTE = {
    waltz:   ["spin", "partner", "floor", "basic", "finish"],
    tango:   ["basic", "spin", "partner", "finish", "floor"],
    disco:   ["basic", "spin", "jump", "comedy", "finish"],
    salsa:   ["basic", "spin", "partner", "jump", "finish"],
    swing:   ["basic", "spin", "partner", "jump", "comedy"],
    rock:    ["basic", "jump", "comedy", "spin", "finish"],
    country: ["basic", "jump", "partner", "comedy", "finish"],
    ballet:  ["spin", "floor", "basic", "partner", "finish"],
    hiphop:  ["basic", "floor", "comedy", "jump", "finish"],
    funk:    ["basic", "comedy", "spin", "floor", "finish"],
    charleston: ["basic", "jump", "comedy", "spin", "finish"],
    chacha:  ["basic", "partner", "spin", "jump", "finish"],
    freestyle: ["comedy", "jump", "spin", "partner", "floor"],
    robot:   ["basic", "comedy", "spin", "floor", "finish"],
    silly:   ["comedy", "jump", "spin", "partner", "floor"],
    ballroom: ["partner", "spin", "basic", "floor", "finish"],
  };

  // Personalities keep the three performances feeling different.
  var PERSONALITIES = {
    elegant:   { styles: ["waltz", "ballet", "ballroom", "tango"], bounce: 0.4 },
    silly:     { styles: ["disco", "funk", "silly", "freestyle", "charleston"], bounce: 1.6 },
    dramatic:  { styles: ["tango", "rock", "hiphop", "salsa", "chacha"], bounce: 1.0 },
    smooth:    { styles: ["swing", "salsa", "chacha", "disco", "ballroom"], bounce: 0.9 },
    wild:      { styles: ["rock", "freestyle", "silly", "funk", "charleston"], bounce: 1.8 },
  };

  function Music(style) {
    var g = GROOVES[style];
    var stepsPerBeat = 3;
    var stepDur = 60 / g.bpm / stepsPerBeat;
    var totalSteps = g.beats * stepsPerBeat;
    return {
      style: style, g: g, stepDur: stepDur, totalSteps: totalSteps,
      step: 0, nextT: 0, playing: false,
      start: function (delay) {
        this.step = 0;
        this.nextT = null; // anchored to the update clock on first tick
        this.delay = delay || 0.1;
        this.playing = true;
      },
      stop: function () { this.playing = false; },
      beatPhase: function () { return (this.step / stepsPerBeat) % 1; },
      update: function (now) {
        if (!this.playing) return;
        if (this.nextT === null) this.nextT = now + this.delay;
        // schedule a little ahead so timing stays tight
        while (this.nextT < now + 0.25) {
          this.playStep(this.step, Math.max(0, Math.min(0.3, this.nextT - now)));
          this.step = (this.step + 1) % this.totalSteps;
          this.nextT += this.stepDur;
        }
      },
      playStep: function (s, when) {
        var g = this.g;
        when = Math.max(0, when);
        var v = g.soft ? 0.5 : 1;
        if (g.kick[s]) audio.tone(120, 0.12, { type: "sine", vol: 0.5 * v, when: when, slideTo: 45 });
        if (g.snare[s]) audio.noise(0.09, { vol: 0.16 * v, when: when, filter: "highpass", freq: 1800 });
        // hats tick along
        audio.noise(0.03, { vol: 0.05 * v, when: when, filter: "highpass", freq: 6000 });
        var b = g.bass[s];
        if (b >= 0) audio.tone(deg(g.root / 2, b), this.stepDur * 2.4, { type: g.stiff ? "square" : "triangle", vol: 0.22 * v, when: when });
        var m = g.mel[s];
        if (m >= 0) audio.tone(deg(g.root, m, g.silly && chance(0.15) ? 1 : 0), this.stepDur * 1.8, { type: "square", vol: 0.07 * v, when: when });
      },
    };
  }

  /* ============================================================
     DANCERS — cute parametric characters. No realistic humans,
     just lovable little arcade dancers.
     ============================================================ */
  var SKINS = ["#ffd9b3", "#f1b98a", "#c98d5f", "#8a5a3b", "#6b4226", "#ffe3c2"];
  var HAIRC = ["#3b2a20", "#6b4226", "#c98d2e", "#e8b83a", "#d94f30", "#8a2be2", "#2e9bd8", "#e2e2e2", "#ff6fa5", "#3ddc84"];
  var CLOTHC = ["#ff3b6b", "#ff8a3b", "#ffd23b", "#3ddc84", "#35c4ff", "#7a5cff", "#ff3df0", "#ff3b30", "#2ee6a8", "#f5f0ff"];

  var THEMES = ["ballroom", "disco", "cowboy", "tango", "tropical", "rock", "princess", "mismatch"];

  function makeDancer(theme, which) {
    // which: 0 = left partner, 1 = right partner
    var d = {
      skin: pick(SKINS),
      hairStyle: ri(0, 5), hairColor: pick(HAIRC),
      hat: 0, // 0 none, 1 cowboy, 2 tophat, 3 bow, 4 cap, 5 crown
      dress: false, topC: pick(CLOTHC), botC: pick(CLOTHC),
      shoeC: pick(["#3b2a20", "#111111", "#f5f0ff", "#d94f30"]),
      size: rnd(0.88, 1.12),
      blush: chance(0.7),
      // pose channels (animated)
      x: 0, y: 0, face: 1, rot: 0, crouch: 0, jump: 0, tilt: 0,
      armL: 0.3, armR: -0.3, legL: 0.15, legR: -0.15,
      expr: "happy", exprT: 0,
      spin: 0, // extra full-body spin 0..1
    };
    // theme the costume
    if (theme === "ballroom") {
      d.dress = which === 1; d.topC = pick(["#f5f0ff", "#1a1a2e", "#7a0e2e"]); d.botC = d.dress ? pick(CLOTHC) : "#1a1a2e";
      if (chance(0.4)) d.hat = 2;
    } else if (theme === "disco") {
      d.topC = pick(["#ff3df0", "#35c4ff", "#ffd23b", "#3ddc84"]); d.botC = d.topC;
      d.hairStyle = ri(2, 4); if (chance(0.5)) d.hat = 4;
    } else if (theme === "cowboy") {
      d.hat = 1; d.topC = pick(["#2e9bd8", "#d94f30", "#f5f0ff"]); d.botC = "#3b2a20"; d.shoeC = "#3b2a20";
    } else if (theme === "tango") {
      d.dress = which === 1; d.topC = pick(["#111111", "#7a0e2e"]); d.botC = d.dress ? "#7a0e2e" : "#111111";
      d.hairColor = "#1a1a1a"; if (which === 1 && chance(0.6)) d.hat = 3;
    } else if (theme === "tropical") {
      d.topC = pick(["#3ddc84", "#ff8a3b", "#ff3b6b"]); d.dress = chance(0.5); d.botC = pick(["#ffd23b", "#2ee6a8"]);
      if (chance(0.5)) d.hat = 3;
    } else if (theme === "rock") {
      d.topC = "#1a1a1a"; d.botC = pick(["#1a1a1a", "#2e3a5c"]); d.hairStyle = ri(3, 4);
      d.hairColor = pick(["#1a1a1a", "#d94f30", "#e8b83a"]);
    } else if (theme === "princess") {
      d.dress = true; d.topC = pick(["#ff9ff3", "#f5f0ff", "#ff6fa5"]); d.botC = d.topC;
      d.hat = chance(0.5) ? 5 : 3; d.hairStyle = ri(1, 3);
    } else { // mismatch: delightfully clashing
      d.dress = chance(0.5); d.hat = ri(0, 5);
      d.topC = pick(CLOTHC); d.botC = pick(CLOTHC);
    }
    return d;
  }

  function makeCouple() {
    var theme = pick(THEMES);
    return { theme: theme, a: makeDancer(theme, 0), b: makeDancer(theme, 1) };
  }

  // expression -> eyes + mouth
  function drawFace(d, hx, hy, s) {
    var ex = d.face * 3 * s;
    ctx.fillStyle = "#1a1a1a";
    var e = d.expr;
    if (e === "dizzy") {
      // X eyes
      ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2 * s;
      [[-6, 0], [6, 0]].forEach(function (p) {
        ctx.beginPath();
        ctx.moveTo(hx + p[0] * s - 3 * s + ex, hy + p[1] * s - 3 * s);
        ctx.lineTo(hx + p[0] * s + 3 * s + ex, hy + p[1] * s + 3 * s);
        ctx.moveTo(hx + p[0] * s + 3 * s + ex, hy + p[1] * s - 3 * s);
        ctx.lineTo(hx + p[0] * s - 3 * s + ex, hy + p[1] * s + 3 * s);
        ctx.stroke();
      });
      ctx.strokeStyle = "#1a1a1a";
      ctx.beginPath();
      for (var i = 0; i <= 6; i++) {
        var wx = hx - 8 * s + i * (16 * s / 6);
        var wy = hy + 9 * s + Math.sin(i * 2.2) * 2 * s;
        if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    } else {
      var eyeR = (e === "wow" || e === "cheer") ? 3.4 * s : 2.4 * s;
      if (e === "laugh" || e === "proud") {
        // happy closed eyes ^^
        ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2 * s;
        [[-6, 0], [6, 0]].forEach(function (p) {
          ctx.beginPath();
          ctx.arc(hx + p[0] * s + ex, hy + p[1] * s, 3.4 * s, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        });
      } else if (e === "love") {
        ctx.fillStyle = "#ff3b6b";
        [[-6, 0], [6, 0]].forEach(function (p) {
          drawHeart(hx + p[0] * s + ex, hy + p[1] * s, 4 * s);
        });
        ctx.fillStyle = "#1a1a1a";
      } else {
        ctx.beginPath(); ctx.arc(hx - 6 * s + ex, hy, eyeR, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + 6 * s + ex, hy, eyeR, 0, 6.29); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(hx - 6 * s + ex + 1 * s, hy - 1 * s, eyeR * 0.35, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + 6 * s + ex + 1 * s, hy - 1 * s, eyeR * 0.35, 0, 6.29); ctx.fill();
        ctx.fillStyle = "#1a1a1a";
      }
      // mouth
      ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2 * s; ctx.lineCap = "round";
      ctx.beginPath();
      if (e === "wow" || e === "cheer") { ctx.arc(hx + ex, hy + 9 * s, 4 * s, 0, 6.29); ctx.stroke(); }
      else if (e === "laugh") {
        ctx.arc(hx + ex, hy + 6 * s, 6 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = "#7a1f1f";
        ctx.beginPath(); ctx.arc(hx + ex, hy + 8 * s, 4 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fill();
        ctx.fillStyle = "#1a1a1a";
      }
      else if (e === "proud") { ctx.arc(hx + ex + 2 * s, hy + 7 * s, 5 * s, 0.3 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
      else { ctx.arc(hx + ex, hy + 6 * s, 5 * s, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
    }
    if (d.blush) {
      ctx.fillStyle = "rgba(255,110,150,0.55)";
      ctx.beginPath(); ctx.arc(hx - 11 * s + ex, hy + 6 * s, 3 * s, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + 11 * s + ex, hy + 6 * s, 3 * s, 0, 6.29); ctx.fill();
    }
  }

  function drawHeart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.7, y - s, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.7, y - s, x + s * 1.4, y, x, y + s * 0.9);
    ctx.fill();
  }

  function drawHair(d, hx, hy, s) {
    ctx.fillStyle = d.hairColor;
    var hs = d.hairStyle;
    if (hs === 0) { // neat cap
      ctx.beginPath(); ctx.arc(hx, hy - 3 * s, 13 * s, Math.PI, 0); ctx.fill();
    } else if (hs === 1) { // long
      ctx.beginPath(); ctx.arc(hx, hy - 3 * s, 13 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(hx - 14 * s, hy - 4 * s, 6 * s, 22 * s);
      ctx.fillRect(hx + 8 * s, hy - 4 * s, 6 * s, 22 * s);
    } else if (hs === 2) { // curly
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.arc(hx + i * 7 * s, hy - 10 * s + (i % 2) * 3 * s, 6 * s, 0, 6.29); ctx.fill();
      }
    } else if (hs === 3) { // spiky
      for (var k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(hx + k * 6 * s - 4 * s, hy - 8 * s);
        ctx.lineTo(hx + k * 6 * s, hy - 20 * s);
        ctx.lineTo(hx + k * 6 * s + 4 * s, hy - 8 * s);
        ctx.closePath(); ctx.fill();
      }
    } else if (hs === 4) { // ponytail
      ctx.beginPath(); ctx.arc(hx, hy - 3 * s, 12 * s, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + 14 * s * d.face, hy - 2 * s, 5 * s, 0, 6.29); ctx.fill();
      ctx.fillRect(hx + 12 * s * d.face - 2 * s, hy, 5 * s, 16 * s);
    } else { // bun
      ctx.beginPath(); ctx.arc(hx, hy - 3 * s, 12 * s, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy - 18 * s, 7 * s, 0, 6.29); ctx.fill();
    }
  }

  function drawHat(d, hx, hy, s) {
    if (d.hat === 1) { // cowboy
      ctx.fillStyle = "#e8d8a8";
      ctx.beginPath(); ctx.ellipse(hx, hy - 14 * s, 20 * s, 6 * s, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#d8c088";
      ctx.beginPath(); ctx.arc(hx, hy - 16 * s, 10 * s, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#8a6a3b"; ctx.fillRect(hx - 10 * s, hy - 19 * s, 20 * s, 4 * s);
    } else if (d.hat === 2) { // top hat
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(hx - 18 * s, hy - 16 * s, 36 * s, 4 * s);
      ctx.fillRect(hx - 10 * s, hy - 36 * s, 20 * s, 22 * s);
      ctx.fillStyle = "#ff3b6b"; ctx.fillRect(hx - 10 * s, hy - 20 * s, 20 * s, 4 * s);
    } else if (d.hat === 3) { // bow
      ctx.fillStyle = "#ff3b6b";
      [[-1, 0], [1, 0]].forEach(function (sg) {
        ctx.beginPath();
        ctx.moveTo(hx + sg[0] * 4 * s, hy - 14 * s);
        ctx.lineTo(hx + sg[0] * 14 * s, hy - 20 * s);
        ctx.lineTo(hx + sg[0] * 14 * s, hy - 8 * s);
        ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = "#d41e4e";
      ctx.beginPath(); ctx.arc(hx, hy - 14 * s, 3.5 * s, 0, 6.29); ctx.fill();
    } else if (d.hat === 4) { // cap
      ctx.fillStyle = d.topC;
      ctx.beginPath(); ctx.arc(hx, hy - 6 * s, 13 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(hx - 13 * s, hy - 8 * s, 30 * s, 3 * s);
    } else if (d.hat === 5) { // crown
      ctx.fillStyle = "#ffd23b";
      ctx.beginPath();
      ctx.moveTo(hx - 10 * s, hy - 12 * s);
      ctx.lineTo(hx - 10 * s, hy - 22 * s); ctx.lineTo(hx - 5 * s, hy - 15 * s);
      ctx.lineTo(hx, hy - 24 * s); ctx.lineTo(hx + 5 * s, hy - 15 * s);
      ctx.lineTo(hx + 10 * s, hy - 22 * s); ctx.lineTo(hx + 10 * s, hy - 12 * s);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawDancer(d) {
    var s = d.size;
    ctx.save();
    ctx.translate(d.x, d.y - (d.jump || 0));

    // shadow stays planted while the body spins
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, (d.jump || 0) + 3 * s, 20 * s * (1 - (d.jump || 0) / 160), 6 * s, 0, 0, 6.29);
    ctx.fill();

    // spins pivot around the torso, not the feet
    ctx.translate(0, -40 * s);
    if (d.spin) ctx.rotate(d.spin * Math.PI * 2);
    ctx.rotate(d.tilt || 0);
    ctx.translate(0, 40 * s);
    var crouchY = (d.crouch || 0) * 16 * s;

    var hipY = -34 * s + crouchY;

    // legs
    [[d.legL, -1], [d.legR, 1]].forEach(function (L) {
      var a = L[0], side = L[1];
      var fx = Math.sin(a) * 22 * s + side * 4 * s;
      var fy = hipY + Math.cos(a) * 22 * s;
      ctx.strokeStyle = d.skin; ctx.lineWidth = 7 * s; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(side * 4 * s, hipY); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = d.shoeC;
      ctx.beginPath(); ctx.ellipse(fx + 3 * s * d.face, fy, 7 * s, 4 * s, 0, 0, 6.29); ctx.fill();
    });

    // body: dress or suit
    if (d.dress) {
      var twirl = 1 + (d.twirl || 0) * 0.9;
      ctx.fillStyle = d.botC;
      ctx.beginPath();
      ctx.moveTo(-9 * s, hipY + 2 * s);
      ctx.lineTo(9 * s, hipY + 2 * s);
      ctx.lineTo(20 * s * twirl, hipY + 30 * s);
      ctx.lineTo(-20 * s * twirl, hipY + 30 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(-9 * s, hipY + 2 * s); ctx.lineTo(-2 * s, hipY + 2 * s);
      ctx.lineTo(-8 * s * twirl, hipY + 30 * s); ctx.lineTo(-20 * s * twirl, hipY + 30 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = d.topC;
      roundRect(-10 * s, hipY - 22 * s, 20 * s, 26 * s, 6 * s); ctx.fill();
    } else {
      ctx.fillStyle = d.topC;
      roundRect(-11 * s, hipY - 24 * s, 22 * s, 28 * s, 7 * s); ctx.fill();
      // bowtie / collar
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(-6 * s, hipY - 22 * s); ctx.lineTo(0, hipY - 18 * s); ctx.lineTo(6 * s, hipY - 22 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff3b6b";
      ctx.beginPath();
      ctx.moveTo(-5 * s, hipY - 19 * s); ctx.lineTo(0, hipY - 16 * s); ctx.lineTo(-5 * s, hipY - 13 * s);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5 * s, hipY - 19 * s); ctx.lineTo(0, hipY - 16 * s); ctx.lineTo(5 * s, hipY - 13 * s);
      ctx.closePath(); ctx.fill();
    }

    // arms
    var shY = hipY - 18 * s;
    [[d.armL, -1], [d.armR, 1]].forEach(function (A) {
      var a = A[0], side = A[1];
      var hx2 = side * 11 * s + Math.sin(a) * 20 * s;
      var hy2 = shY - Math.cos(a) * 20 * s;
      ctx.strokeStyle = d.skin; ctx.lineWidth = 6 * s; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(side * 11 * s, shY); ctx.lineTo(hx2, hy2); ctx.stroke();
      ctx.fillStyle = d.skin;
      ctx.beginPath(); ctx.arc(hx2, hy2, 4.5 * s, 0, 6.29); ctx.fill();
    });

    // head
    var hx = 0, hy = hipY - 40 * s + crouchY * 0.3;
    ctx.fillStyle = d.skin;
    ctx.beginPath(); ctx.arc(hx, hy, 15 * s, 0, 6.29); ctx.fill();
    drawHair(d, hx, hy, s);
    drawHat(d, hx, hy, s);
    drawFace(d, hx, hy, s);

    ctx.restore();
  }

  /* ============================================================
     MOVE LIBRARY — 55+ reusable dance moves.
     Each move: {id, cat, dur (sec), fn(t, d, p)}.
     t goes 0..1 across the move. d = dancer, p = partner.
     Pose channels: x,y,face,rot,crouch,jump,tilt,armL,armR,
     legL,legR,twirl,spin,expr.
     ============================================================ */
  var MOVES = [];
  function MV(id, cat, dur, fn) { MOVES.push({ id: id, cat: cat, dur: dur, fn: fn }); }
  var TAU = Math.PI * 2;

  /* ---- basic (8) ---- */
  MV("step-side", "basic", 1.2, function (t, d) {
    d.x = d.hx + Math.sin(t * Math.PI) * 26 * d.face; d.armL = 0.9; d.armR = -0.9;
    d.legL = Math.sin(t * Math.PI) * 0.5; d.legR = -Math.sin(t * Math.PI) * 0.5;
  });
  MV("step-fwd", "basic", 1.2, function (t, d) {
    d.jump = Math.sin(t * Math.PI) * 6; d.armL = -0.6 + t * 0.4; d.armR = 0.6 - t * 0.4;
  });
  MV("shuffle", "basic", 1.4, function (t, d) {
    d.x = d.hx + Math.sin(t * TAU * 2) * 7; d.legL = Math.sin(t * TAU * 2) * 0.45; d.legR = -Math.sin(t * TAU * 2) * 0.45;
    d.armL = 0.5; d.armR = -0.5;
  });
  MV("kick", "basic", 1.0, function (t, d) {
    var k = Math.sin(t * Math.PI);
    d.legR = -1.3 * k; d.jump = k * 8; d.armL = -1.2 * k; d.armR = 1.2 * k; d.expr = "wow";
  });
  MV("heel-tap", "basic", 1.2, function (t, d) {
    var n = Math.sin(t * TAU * 3) > 0 ? 1 : 0;
    d.legL = -0.5 * n; d.legR = -0.5 * (1 - n); d.crouch = 0.25;
  });
  MV("toe-tap", "basic", 1.2, function (t, d) {
    d.legR = -0.9 * Math.abs(Math.sin(t * TAU * 2)); d.armL = -0.8; d.armR = 0.8; d.tilt = Math.sin(t * TAU) * 0.08;
  });
  MV("sway", "basic", 1.6, function (t, d) {
    d.tilt = Math.sin(t * TAU) * 0.22; d.armL = 1.4; d.armR = -1.4; d.x = d.hx + Math.sin(t * TAU) * 10;
  });
  MV("bounce", "basic", 1.2, function (t, d, p, b) {
    d.jump = Math.abs(Math.sin(t * TAU * 2 + b)) * 16; d.armL = -2.4; d.armR = 2.4;
    d.crouch = 0.3 * (1 - Math.abs(Math.sin(t * TAU * 2)));
  });

  /* ---- spins (7) ---- */
  MV("spin-1", "spin", 1.1, function (t, d) { d.spin = t; d.armL = -2.6; d.armR = 2.6; d.expr = "wow"; });
  MV("spin-2", "spin", 1.6, function (t, d) { d.spin = t * 2; d.armL = -2.6; d.armR = 2.6; d.twirl = Math.sin(t * Math.PI); });
  MV("spin-fast", "spin", 1.2, function (t, d) { d.spin = t * 3; d.crouch = 0.3; d.expr = "dizzy"; });
  MV("spin-slow", "spin", 2.2, function (t, d) {
    d.spin = t; d.armL = -2.9; d.armR = 2.9; d.tilt = Math.sin(t * Math.PI) * 0.15; d.expr = "proud";
  });
  MV("spin-both", "spin", 1.4, function (t, d, p) {
    d.spin = t; p.spin = 1 - t; d.armL = -2.6; d.armR = 2.6; p.armL = -2.6; p.armR = 2.6;
  });
  MV("pirouette", "spin", 1.8, function (t, d) {
    d.spin = t * 2; d.legR = -1.1; d.armL = -2.8; d.armR = 1.2; d.jump = Math.sin(t * Math.PI) * 6;
  });
  MV("twirl-dress", "spin", 1.5, function (t, d) {
    d.spin = t; d.twirl = Math.sin(t * Math.PI); d.armL = -2.2; d.armR = 2.2; d.expr = "laugh";
  });

  /* ---- jumps (6) ---- */
  MV("jump-small", "jump", 1.0, function (t, d) {
    d.jump = Math.sin(t * Math.PI) * 30; d.armL = -2.6; d.armR = 2.6; d.legL = 0.4; d.legR = -0.4;
  });
  MV("jump-big", "jump", 1.3, function (t, d) {
    d.jump = Math.sin(t * Math.PI) * 62; d.armL = -2.9; d.armR = 2.9;
    d.legL = 0.9 * Math.sin(t * Math.PI); d.legR = -0.9 * Math.sin(t * Math.PI); d.expr = "wow";
  });
  MV("jump-star", "jump", 1.3, function (t, d) {
    var k = Math.sin(t * Math.PI);
    d.jump = k * 55; d.armL = -2.9 * k - 0.3; d.armR = 2.9 * k + 0.3;
    d.legL = 1.0 * k; d.legR = -1.0 * k; d.expr = "cheer";
  });
  MV("jump-side", "jump", 1.1, function (t, d) {
    var k = Math.sin(t * Math.PI);
    d.jump = k * 34; d.x = d.hx + k * 40 * d.face; d.tilt = 0.25 * k * d.face;
  });
  MV("jump-spin", "jump", 1.4, function (t, d) {
    d.jump = Math.sin(t * Math.PI) * 48; d.spin = t; d.armL = -2.6; d.armR = 2.6;
  });
  MV("jump-sync", "jump", 1.3, function (t, d, p) {
    var k = Math.sin(t * Math.PI);
    [d, p].forEach(function (q) {
      q.jump = k * 52; q.armL = -2.9; q.armR = 2.9; q.expr = "cheer";
    });
  });

  /* ---- floor (5) ---- */
  MV("splits", "floor", 1.6, function (t, d) {
    var k = Math.sin(t * Math.PI);
    d.legL = 1.35 * k; d.legR = -1.35 * k; d.crouch = 0.85 * k;
    d.armL = -2.7 * k; d.armR = 2.7 * k; d.expr = k > 0.7 ? "wow" : "happy";
  });
  MV("slide", "floor", 1.3, function (t, d) {
    d.x = d.hx + 60 * d.face * t; d.crouch = 0.5 * Math.sin(t * Math.PI); d.tilt = -0.2 * d.face;
    d.legL = 0.7; d.legR = -0.3; d.armR = 1.4;
  });
  MV("knee-slide", "floor", 1.5, function (t, d) {
    var k = Math.sin(t * Math.PI);
    d.x = d.hx + 70 * d.face * t; d.crouch = 0.8 * k; d.armL = -2.9; d.armR = 2.9; d.expr = "wow";
  });
  MV("floor-pose", "floor", 1.6, function (t, d) {
    var k = Math.min(1, t * 2.5);
    d.crouch = 0.9 * k; d.armL = -2.9 * k; d.armR = 0.6 * k; d.tilt = 0.3 * k; d.expr = "proud";
  });
  MV("floor-spin", "floor", 1.5, function (t, d) {
    d.crouch = 0.9; d.spin = t * 2; d.armL = -1.4; d.armR = 1.4;
  });

  /* ---- partner (9) ---- */
  MV("hold-spin", "partner", 1.8, function (t, d, p) {
    var a = t * TAU;
    var cx = (d.hx + p.hx) / 2, r = 46;
    d.x = cx + Math.cos(a) * r; p.x = cx - Math.cos(a) * r;
    d.armR = -1.6; p.armL = 1.6; d.expr = "laugh"; p.expr = "laugh";
  });
  MV("twirl-partner", "partner", 1.5, function (t, d, p) {
    p.spin = t; p.armL = -2.6; p.armR = 2.6; d.armR = -1.8; d.expr = "proud"; p.expr = "wow";
  });
  MV("dip", "partner", 1.8, function (t, d, p) {
    var k = Math.sin(t * Math.PI);
    p.tilt = 0.9 * k; p.crouch = 0.5 * k; p.armL = -2.6 * k; p.armR = -2.2 * k;
    d.tilt = -0.25 * k; d.armL = -1.2 * k; d.armR = 0.6 * k;
    d.expr = "proud"; p.expr = "wow";
  });
  MV("lift", "partner", 1.8, function (t, d, p) {
    var k = Math.sin(t * Math.PI);
    p.jump = 46 * k; p.armL = -2.9; p.armR = 2.9; p.legL = 0.5; p.legR = -0.5;
    d.crouch = 0.45 * k; d.armL = -2.7 * k; d.armR = 2.7 * k;
    d.expr = "proud"; p.expr = "cheer";
  });
  MV("catch", "partner", 1.5, function (t, d, p) {
    var k = Math.sin(t * Math.PI);
    p.x = d.x + 30 * d.face; p.jump = 20 * k; p.tilt = 0.5 * k;
    d.armL = -1.8; d.armR = -1.8; d.crouch = 0.3; d.expr = "wow"; p.expr = "laugh";
  });
  MV("switch", "partner", 1.4, function (t, d, p) {
    var dx = d.hx, px = p.hx, k = t;
    d.x = dx + (px - dx) * k; p.x = px + (dx - px) * k;
    d.jump = Math.sin(k * Math.PI) * 22; p.jump = Math.sin(k * Math.PI) * 22;
  });
  MV("circle", "partner", 2.0, function (t, d, p) {
    var a = t * TAU, cx = (d.hx + p.hx) / 2, r = 52;
    d.x = cx + Math.cos(a) * r; d.jump = Math.abs(Math.sin(a * 2)) * 10;
    p.x = cx - Math.cos(a) * r; p.jump = Math.abs(Math.sin(a * 2 + 1)) * 10;
    d.face = Math.cos(a) > 0 ? 1 : -1; p.face = -d.face;
  });
  MV("back-to-back", "partner", 1.6, function (t, d, p) {
    d.x = d.hx - 14; p.x = p.hx + 14; d.face = -1; p.face = 1;
    var k = Math.sin(t * Math.PI);
    d.armL = -2.4 * k; d.armR = -2.4 * k; p.armL = 2.4 * k; p.armR = 2.4 * k;
    d.bounce = k; d.expr = "proud"; p.expr = "proud";
  });
  MV("slide-under", "partner", 1.8, function (t, d, p) {
    var k = t;
    d.x = d.hx + 110 * d.face * k; d.crouch = 0.9 * Math.sin(k * Math.PI);
    p.jump = 34 * Math.sin(k * Math.PI); p.armL = -2.6; p.armR = 2.6; p.expr = "wow";
  });

  /* ---- comedy (10) ---- */
  MV("moonwalk", "comedy", 1.8, function (t, d) {
    d.x = d.hx - 44 * d.face * t;
    d.legL = Math.sin(t * TAU * 3) * 0.6; d.legR = -Math.sin(t * TAU * 3) * 0.6;
    d.tilt = 0.12; d.armL = 0.7; d.armR = -0.7; d.expr = "proud";
  });
  MV("wiggle", "comedy", 1.4, function (t, d) {
    d.x = d.hx + Math.sin(t * TAU * 4) * 6; d.tilt = Math.sin(t * TAU * 4) * 0.3;
    d.armL = 1.2 + Math.sin(t * TAU * 4) * 0.5; d.armR = -1.2 - Math.sin(t * TAU * 4) * 0.5;
    d.expr = "laugh";
  });
  MV("dizzy-spin", "comedy", 1.8, function (t, d) {
    d.spin = t * 4; d.expr = "dizzy";
    if (t > 0.8) { d.tilt = (t - 0.8) * 1.4; d.crouch = (t - 0.8) * 2.2; }
  });
  MV("hat-flies", "comedy", 1.6, function (t, d) {
    d.jump = Math.sin(Math.min(1, t * 1.6) * Math.PI) * 30;
    d.armL = -2.9; d.armR = 2.9; d.expr = "wow"; d.hatFly = Math.sin(t * Math.PI);
  });
  MV("almost-fall", "comedy", 1.6, function (t, d, p) {
    var k = Math.sin(t * Math.PI);
    d.tilt = 0.85 * k * d.face; d.crouch = 0.5 * k; d.armL = -2.8 * k; d.armR = 2.8 * k;
    d.expr = "wow";
    if (t > 0.55) { p.x = d.x + 34 * d.face; p.armL = -1.6; p.armR = -1.6; p.expr = "laugh"; }
  });
  MV("wrong-way", "comedy", 1.6, function (t, d, p) {
    d.face = -p.face; d.x = d.hx + Math.sin(t * Math.PI) * 20 * -d.face;
    d.armL = 1.0; d.armR = -1.0; d.expr = "laugh";
  });
  MV("freeze", "comedy", 1.4, function (t, d) {
    var k = t < 0.35 ? t / 0.35 : 1;
    d.jump = 26 * Math.sin(Math.min(1, k) * Math.PI);
    d.armL = -2.9 * k; d.armR = 2.9 * k; d.legL = 0.8 * k; d.legR = -0.8 * k;
    d.expr = "wow";
    if (t > 0.5) { d.expr = "proud"; }
  });
  MV("big-kick", "comedy", 1.2, function (t, d) {
    var k = Math.sin(t * Math.PI);
    d.legR = -1.8 * k; d.jump = k * 14; d.armL = -2.2 * k; d.expr = "cheer";
  });
  MV("chicken", "comedy", 1.6, function (t, d) {
    d.crouch = 0.45; d.armL = 1.9 + Math.sin(t * TAU * 4) * 0.4; d.armR = -1.9 - Math.sin(t * TAU * 4) * 0.4;
    d.x = d.hx + Math.sin(t * TAU * 2) * 5; d.expr = "laugh";
  });
  MV("tiny-steps", "comedy", 1.4, function (t, d) {
    d.x = d.hx + 34 * d.face * t;
    d.legL = Math.sin(t * TAU * 6) * 0.7; d.legR = -Math.sin(t * TAU * 6) * 0.7;
    d.armL = -Math.sin(t * TAU * 6) * 0.7; d.armR = Math.sin(t * TAU * 6) * 0.7;
    d.crouch = 0.35; d.expr = "laugh";
  });

  /* ---- finishers (8) ---- */
  MV("fin-dip", "finish", 1.8, function (t, d, p) {
    var k = t < 0.6 ? t / 0.6 : 1;
    p.tilt = 1.0 * k; p.crouch = 0.55 * k; p.armL = -2.9 * k; p.armR = -2.4 * k;
    d.tilt = -0.3 * k; d.armR = 2.6 * k; d.expr = "proud"; p.expr = "love";
  });
  MV("fin-arms-up", "finish", 1.6, function (t, d, p) {
    var k = Math.min(1, t * 2);
    [d, p].forEach(function (q, i) {
      q.jump = Math.sin(Math.min(1, t * 3) * Math.PI) * (i ? 26 : 30);
      q.armL = -2.9 * k; q.armR = 2.9 * k; q.expr = "cheer";
    });
  });
  MV("fin-b2b", "finish", 1.6, function (t, d, p) {
    var k = Math.min(1, t * 2);
    d.x = d.hx - 16; p.x = p.hx + 16; d.face = -1; p.face = 1;
    d.armL = -2.6 * k; d.armR = -2.6 * k; p.armL = 2.6 * k; p.armR = 2.6 * k;
    d.expr = "proud"; p.expr = "proud";
  });
  MV("fin-splits", "finish", 1.8, function (t, d, p) {
    var k = Math.min(1, t * 1.8);
    [d, p].forEach(function (q) {
      q.legL = 1.3 * k; q.legR = -1.3 * k; q.crouch = 0.8 * k;
      q.armL = -2.8 * k; q.armR = 2.8 * k; q.expr = "wow";
    });
  });
  MV("fin-kneel", "finish", 1.6, function (t, d, p) {
    var k = Math.min(1, t * 2);
    d.crouch = 0.95 * k; d.armR = 2.4 * k; d.armL = -0.5 * k; d.expr = "proud";
    p.jump = 20 * Math.sin(Math.min(1, t * 2.5) * Math.PI); p.armL = -2.9 * k; p.armR = 2.9 * k; p.expr = "cheer";
  });
  MV("fin-jump", "finish", 1.6, function (t, d, p) {
    var k = Math.sin(Math.min(1, t * 1.4) * Math.PI);
    [d, p].forEach(function (q) {
      q.jump = k * 58; q.armL = -2.9; q.armR = 2.9;
      q.legL = 0.7 * k; q.legR = -0.7 * k; q.expr = "cheer";
    });
  });
  MV("fin-lift", "finish", 2.0, function (t, d, p) {
    var k = t < 0.55 ? t / 0.55 : 1;
    p.jump = 52 * k; p.armL = -2.9; p.armR = 2.9; p.legL = 0.6; p.legR = -0.6;
    d.crouch = 0.5 * k; d.armL = -2.8 * k; d.armR = 2.8 * k;
    d.expr = "proud"; p.expr = "cheer";
  });
  MV("fin-point", "finish", 1.6, function (t, d, p) {
    var k = Math.min(1, t * 2.2);
    d.armR = 2.9 * k; d.armL = -0.4 * k; d.legR = -0.5 * k; d.expr = "proud";
    p.armL = -2.9 * k; p.armR = 0.4 * k; p.legL = 0.5 * k; p.expr = "laugh";
  });

  // hat flying off needs a drawn prop: expose per-dancer flag read by draw
  var _hatFlyDraw = null;

  /* ============================================================
     CHOREOGRAPHY — builds a real routine, not random flailing:
     entrance → opening → main → highlight → finale → pose.
     Move categories follow the dance style's taste.
     ============================================================ */
  var MV_BY_ID = {};
  MOVES.forEach(function (m) { MV_BY_ID[m.id] = m; });

  function movesIn(cat) { return MOVES.filter(function (m) { return m.cat === cat; }); }

  var FX_FOR_MOVE = {
    "spin-2": "spotlight", "spin-fast": "spotlight", "spin-both": "spotlight",
    "dip": "hearts", "fin-dip": "hearts",
    "jump-big": "flash", "jump-star": "flash", "jump-sync": "flash", "fin-jump": "flash",
    "dizzy-spin": "stars", "hat-flies": "stars", "moonwalk": "sparkles",
    "lift": "fireworks", "fin-lift": "fireworks", "jump-spin": "fireworks",
  };

  function buildRoutine(style) {
    var taste = STYLE_TASTE[style] || STYLE_TASTE.freestyle;
    var seq = [];
    function add(mv, who, fx) {
      seq.push({ mv: mv, who: who, t: 0, dur: mv.dur, fx: fx || FX_FOR_MOVE[mv.id] || null, fxDone: false });
    }
    // entrance: both glide in
    add(pick([MV_BY_ID["step-side"], MV_BY_ID["tiny-steps"], MV_BY_ID["shuffle"]]), 2);
    // opening: 2 moves
    add(pick(movesIn(taste[3])), chance(0.5) ? 2 : ri(0, 1));
    add(pick(movesIn(taste[0])), 2);
    // main: 3 moves
    add(pick(movesIn(taste[1])), ri(0, 1));
    add(pick(movesIn(taste[0])), 2);
    add(pick(movesIn(taste[2])), chance(0.6) ? 2 : ri(0, 1));
    // highlight: one impressive moment
    add(pick(movesIn(pick(["spin", "jump", "partner", "floor"]))), 2);
    // finale: 1-2 moves
    if (chance(0.5)) add(pick(movesIn(taste[4] === "finish" ? "finish" : taste[1])), 2);
    // pose: always a finisher, both dancers
    add(pick(movesIn("finish")), 2);
    return seq;
  }

  /* ============================================================
     STAGES — 14 randomized backdrops. Simple shapes, dancers first.
     ============================================================ */
  var STAGE_IDS = ["ballroom", "disco", "desert", "beach", "space", "jungle",
                   "candy", "underwater", "rainbow", "city", "castle", "spooky",
                   "arcade", "tropical"];

  function stageColors(id) {
    switch (id) {
      case "ballroom": return { top: "#2a1a5e", bot: "#0e0a2e", floor1: "#4a2a9a", floor2: "#2a1a5e", glow: "#ffd23b" };
      case "disco": return { top: "#1a0a3e", bot: "#0a061e", floor1: "#3a1a6e", floor2: "#1a0a3e", glow: "#ff3df0" };
      case "desert": return { top: "#ff9f2e", bot: "#7a3a10", floor1: "#c98d2e", floor2: "#8a5a1b", glow: "#ffe14d" };
      case "beach": return { top: "#35c4ff", bot: "#0a5e8a", floor1: "#e8d8a8", floor2: "#c9b078", glow: "#fff3b0" };
      case "space": return { top: "#050514", bot: "#0e0e2e", floor1: "#2a2a5e", floor2: "#14142e", glow: "#35c4ff" };
      case "jungle": return { top: "#0e5e2e", bot: "#072e16", floor1: "#1e7a3e", floor2: "#0e4a22", glow: "#3ddc84" };
      case "candy": return { top: "#ff9ff3", bot: "#a53df0", floor1: "#ff6fa5", floor2: "#d43d8a", glow: "#fff" };
      case "underwater": return { top: "#0a5e8a", bot: "#041e3e", floor1: "#1a7aaa", floor2: "#0a4a6e", glow: "#35c4ff" };
      case "rainbow": return { top: "#2a1a5e", bot: "#0e0a2e", floor1: "#5e3daa", floor2: "#2e1e5e", glow: "#ffd23b" };
      case "city": return { top: "#1a1a3e", bot: "#05051a", floor1: "#3a3a6e", floor2: "#1e1e3e", glow: "#ffe14d" };
      case "castle": return { top: "#2e1a4e", bot: "#0e0a24", floor1: "#4a2a6e", floor2: "#2a1a4e", glow: "#c9a8ff" };
      case "spooky": return { top: "#1a0e2e", bot: "#05030e", floor1: "#3e2a5e", floor2: "#1e1430", glow: "#b45cff" };
      case "arcade": return { top: "#0e0e2e", bot: "#050510", floor1: "#2e1e5e", floor2: "#14142e", glow: "#ff3df0" };
      default: return { top: "#0a5e4a", bot: "#04241c", floor1: "#1e8a6e", floor2: "#0e4a3a", glow: "#3ddc84" };
    }
  }

  function drawStageDeco(id, t, beatT) {
    // simple iconic silhouettes behind the dancers
    ctx.save();
    if (id === "ballroom" || id === "castle") {
      // lighted arch
      ctx.strokeStyle = stageColors(id).glow; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(W / 2, H * 0.62, Math.min(W, H) * 0.30, Math.PI, 0); ctx.stroke();
      for (var i = 0; i <= 12; i++) {
        var a = Math.PI + i * Math.PI / 12;
        var bx = W / 2 + Math.cos(a) * Math.min(W, H) * 0.30, by = H * 0.62 + Math.sin(a) * Math.min(W, H) * 0.30;
        ctx.fillStyle = (i % 2 ? "#fff" : stageColors(id).glow);
        ctx.beginPath(); ctx.arc(bx, by, 6, 0, 6.29); ctx.fill();
      }
      if (id === "castle") {
        ctx.fillStyle = "#0a0618";
        [[0.08, 0.5], [0.85, 0.55]].forEach(function (p) {
          ctx.fillRect(W * p[0], H * p[1] - 120, 70, 160);
          ctx.beginPath();
          ctx.moveTo(W * p[0] - 8, H * p[1] - 120); ctx.lineTo(W * p[0] + 35, H * p[1] - 180); ctx.lineTo(W * p[0] + 78, H * p[1] - 120);
          ctx.closePath(); ctx.fill();
        });
      }
    } else if (id === "disco") {
      // disco ball
      var dx = W / 2, dy = H * 0.14;
      ctx.strokeStyle = "#888"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, dy - 26); ctx.stroke();
      ctx.fillStyle = "#cfe8ff";
      ctx.beginPath(); ctx.arc(dx, dy, 30, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(120,180,255,0.7)";
      for (var r2 = -2; r2 <= 2; r2++) for (var c2 = -2; c2 <= 2; c2++)
        ctx.fillRect(dx + c2 * 11 - 4, dy + r2 * 11 - 4, 8, 8);
      // moving reflections
      for (var s2 = 0; s2 < 8; s2++) {
        var sa = t * 0.7 + s2 * 0.785;
        ctx.fillStyle = "rgba(255,255,255," + (0.25 + 0.2 * Math.sin(t * 3 + s2)) + ")";
        ctx.beginPath(); ctx.arc(dx + Math.cos(sa) * 120, dy + 60 + Math.sin(sa) * 60, 4, 0, 6.29); ctx.fill();
      }
    } else if (id === "desert") {
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.18, 44, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#2e7a2e";
      ctx.fillRect(W * 0.12 - 8, H * 0.42, 16, 90);
      ctx.fillRect(W * 0.12 - 22, H * 0.48, 14, 40); ctx.fillRect(W * 0.12 + 8, H * 0.54, 14, 34);
    } else if (id === "beach" || id === "tropical") {
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.arc(W * 0.82, H * 0.16, 40, 0, 6.29); ctx.fill();
      [[0.1], [0.9]].forEach(function (p) {
        var px = W * p[0];
        ctx.strokeStyle = "#7a5a3b"; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(px, H * 0.55); ctx.quadraticCurveTo(px + 20, H * 0.35, px + 10, H * 0.22); ctx.stroke();
        ctx.fillStyle = "#2e9b4e";
        for (var f = 0; f < 5; f++) {
          var fa = -0.4 + f * 0.35;
          ctx.beginPath();
          ctx.ellipse(px + 10 + Math.cos(fa) * 44, H * 0.22 + Math.sin(fa) * 22, 34, 10, fa, 0, 6.29);
          ctx.fill();
        }
      });
      if (id === "beach") {
        ctx.fillStyle = "rgba(53,196,255,0.5)";
        ctx.fillRect(0, H * 0.52, W, 26);
      }
    } else if (id === "space") {
      for (var st = 0; st < 60; st++) {
        var sx = (st * 173) % W, sy = (st * 97) % (H * 0.5);
        ctx.fillStyle = "rgba(255,255,255," + (0.3 + 0.5 * Math.abs(Math.sin(t * 2 + st))) + ")";
        ctx.fillRect(sx, sy, 3, 3);
      }
      ctx.fillStyle = "#7a5cff";
      ctx.beginPath(); ctx.arc(W * 0.85, H * 0.16, 34, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#c9b8ff"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(W * 0.85, H * 0.16, 56, 14, -0.4, 0, 6.29); ctx.stroke();
    } else if (id === "jungle") {
      ctx.fillStyle = "rgba(20,120,60,0.85)";
      for (var v = 0; v < 6; v++) {
        var vx = (v / 6) * W + 30;
        ctx.fillRect(vx, 0, 14, H * 0.3);
        ctx.beginPath(); ctx.ellipse(vx + 7, H * 0.3, 40, 16, 0.3, 0, 6.29); ctx.fill();
      }
    } else if (id === "candy") {
      [[0.15, "#ff3b6b"], [0.5, "#35c4ff"], [0.85, "#3ddc84"]].forEach(function (l) {
        var lx = W * l[0];
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(lx, H * 0.55); ctx.lineTo(lx, H * 0.2); ctx.stroke();
        ctx.fillStyle = l[1];
        ctx.beginPath(); ctx.arc(lx, H * 0.16, 30, 0, 6.29); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(lx, H * 0.16, 18, 0, 6.29); ctx.stroke();
      });
    } else if (id === "underwater") {
      for (var b = 0; b < 24; b++) {
        var bx2 = (b * 211) % W, by2 = H * 0.5 - ((t * 40 + b * 53) % (H * 0.5));
        ctx.strokeStyle = "rgba(180,240,255,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx2, by2, 4 + (b % 4), 0, 6.29); ctx.stroke();
      }
      ctx.fillStyle = "rgba(30,140,90,0.8)";
      for (var w2 = 0; w2 < 5; w2++) {
        var wx2 = (w2 / 5) * W + 40;
        ctx.beginPath(); ctx.ellipse(wx2, H * 0.55, 16, 60 + 14 * Math.sin(t * 2 + w2), 0.2 * Math.sin(t * 2 + w2), 0, 6.29); ctx.fill();
      }
    } else if (id === "rainbow") {
      var cols = ["#ff3b30", "#ff8a3b", "#ffd23b", "#3ddc84", "#35c4ff", "#7a5cff"];
      for (var rb = 0; rb < 6; rb++) {
        ctx.strokeStyle = cols[rb]; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.66, 200 - rb * 16, Math.PI, 0); ctx.stroke();
      }
    } else if (id === "city") {
      ctx.fillStyle = "#0a0a20";
      for (var bd = 0; bd < 8; bd++) {
        var bw = W / 8, bh = 90 + ((bd * 67) % 90);
        ctx.fillRect(bd * bw + 4, H * 0.5 - bh, bw - 8, bh);
        ctx.fillStyle = "rgba(255,225,77,0.75)";
        for (var wn = 0; wn < 6; wn++)
          ctx.fillRect(bd * bw + 10 + (wn % 3) * 16, H * 0.5 - bh + 12 + ((wn / 3) | 0) * 22, 8, 10);
        ctx.fillStyle = "#0a0a20";
      }
    } else if (id === "spooky") {
      ctx.fillStyle = "#e8e0f0";
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.16, 42, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(232,224,240,0.25)";
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.16, 60, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      for (var bt = 0; bt < 4; bt++) {
        var bx3 = (bt * 311 + t * 30) % W;
        ctx.beginPath();
        ctx.moveTo(bx3 - 14, H * 0.2); ctx.quadraticCurveTo(bx3, H * 0.14, bx3, H * 0.2);
        ctx.quadraticCurveTo(bx3, H * 0.14, bx3 + 14, H * 0.2);
        ctx.closePath(); ctx.fill();
      }
    } else if (id === "arcade") {
      var shapes = ["#ff3df0", "#35c4ff", "#ffd23b", "#3ddc84"];
      for (var sh = 0; sh < 8; sh++) {
        ctx.strokeStyle = shapes[sh % 4]; ctx.lineWidth = 4;
        var ax = (sh * 197) % W, ay = 40 + (sh * 89) % (H * 0.35);
        if (sh % 2) { ctx.strokeRect(ax, ay, 34, 34); }
        else { ctx.beginPath(); ctx.arc(ax, ay, 18, 0, 6.29); ctx.stroke(); }
      }
      ctx.fillStyle = "#0a0a1e";
      for (var cab = 0; cab < 4; cab++) {
        ctx.fillRect(W * 0.06 + cab * W * 0.28, H * 0.34, 70, 110);
        ctx.fillStyle = shapes[cab % 4];
        ctx.fillRect(W * 0.06 + cab * W * 0.28 + 10, H * 0.34 + 12, 50, 40);
        ctx.fillStyle = "#0a0a1e";
      }
    }
    ctx.restore();
  }

  /* ============================================================
     EFFECTS & PARTICLES
     ============================================================ */
  var parts = [];
  function spawn(o) {
    if (parts.length > 420) parts.splice(0, parts.length - 420);
    parts.push(o);
  }
  function sparkle(x, y, c) {
    for (var i = 0; i < 10; i++)
      spawn({ x: x + rnd(-16, 16), y: y + rnd(-30, 10), vx: rnd(-30, 30), vy: rnd(-60, -10),
              life: rnd(0.4, 0.9), t: 0, c: c || "#fff3b0", r: rnd(2, 4), shape: "star" });
  }
  function hearts(x, y) {
    for (var i = 0; i < 8; i++)
      spawn({ x: x + rnd(-24, 24), y: y + rnd(-20, 10), vx: rnd(-20, 20), vy: rnd(-90, -40),
              life: rnd(0.8, 1.4), t: 0, c: pick(["#ff3b6b", "#ff8ab3", "#ff5c8a"]), r: rnd(4, 7), shape: "heart" });
  }
  function confettiBurst(n, y0) {
    for (var i = 0; i < n; i++)
      spawn({ x: rnd(0, W), y: (y0 || -20) + rnd(-40, 0), vx: rnd(-60, 60), vy: rnd(90, 220),
              life: rnd(1.6, 2.8), t: 0, c: "hsl(" + ri(0, 360) + ",95%,62%)", r: rnd(3, 6), shape: "conf", rot: rnd(0, 6), vr: rnd(-6, 6) });
  }
  function firework(x, y) {
    // visuals only — no boom (too much for little ears)
    var hue = ri(0, 360);
    for (var i = 0; i < 30; i++) {
      var a = rnd(0, 6.283), s = rnd(40, 170);
      spawn({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
              life: rnd(0.7, 1.3), t: 0, c: "hsl(" + hue + ",95%,62%)", r: rnd(2, 4), shape: "dot" });
    }
  }
  function balloon(x) {
    spawn({ x: x, y: H + 30, vx: rnd(-14, 14), vy: rnd(-120, -80), life: rnd(4, 6), t: 0,
            c: pick(["#ff3b6b", "#35c4ff", "#ffd23b", "#3ddc84", "#7a5cff"]), r: rnd(14, 22), shape: "balloon" });
  }
  function musicNotes(x, y) {
    for (var i = 0; i < 5; i++)
      spawn({ x: x + rnd(-30, 30), y: y, vx: rnd(-16, 16), vy: rnd(-70, -30),
              life: rnd(0.9, 1.5), t: 0, c: pick(["#ff8ab3", "#35c4ff", "#ffd23b"]), r: rnd(5, 8), shape: "note" });
  }

  function drawParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.shape !== "balloon") p.vy += 160 * dt;
      if (p.vr) p.rot += p.vr * dt;
      var a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      if (p.shape === "star") {
        drawStar(p.x, p.y, p.r, p.t * 6, p.c);
      } else if (p.shape === "heart") {
        drawHeart(p.x, p.y, p.r);
      } else if (p.shape === "conf") {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); ctx.restore();
      } else if (p.shape === "balloon") {
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 1.25, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = p.c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y + p.r * 1.25);
        ctx.quadraticCurveTo(p.x + 8, p.y + p.r * 1.25 + 24, p.x - 4, p.y + p.r * 1.25 + 44); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.ellipse(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.25, p.r * 0.4, -0.4, 0, 6.29); ctx.fill();
      } else if (p.shape === "note") {
        ctx.font = Math.round(p.r * 3) + "px serif";
        ctx.fillText("♪", p.x, p.y);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Per-act confetti themes: each performance ends with its own flavor. */
  var CONF_THEMES = ["stars", "hearts", "bubbles", "notes", "rainbow"];
  function celebrationBurst(theme, x, y, n) {
    n = n || 40;
    for (var i = 0; i < n; i++) {
      var px = x + rnd(-70, 70), py = y + rnd(-50, 40);
      if (theme === "stars")
        spawn({ x: px, y: py, vx: rnd(-90, 90), vy: rnd(-170, -30), life: rnd(1, 2), t: 0,
                c: pick(["#fff3b0", "#ffd23b", "#ffffff"]), r: rnd(3, 6), shape: "star" });
      else if (theme === "hearts")
        spawn({ x: px, y: py, vx: rnd(-70, 70), vy: rnd(-150, -30), life: rnd(1, 2), t: 0,
                c: pick(["#ff3b6b", "#ff8ab3", "#ff5c8a"]), r: rnd(4, 7), shape: "heart" });
      else if (theme === "bubbles")
        spawn({ x: px, y: py, vx: rnd(-60, 60), vy: rnd(-130, -20), life: rnd(1, 2), t: 0,
                c: pick(["#35c4ff", "#7ad9ff", "#d6f2ff"]), r: rnd(3, 7), shape: "dot" });
      else if (theme === "notes")
        spawn({ x: px, y: py, vx: rnd(-50, 50), vy: rnd(-130, -30), life: rnd(1, 1.8), t: 0,
                c: pick(["#ff8ab3", "#35c4ff", "#ffd23b"]), r: rnd(5, 8), shape: "note" });
      else
        spawn({ x: px, y: py, vx: rnd(-90, 90), vy: rnd(60, 180), life: rnd(1.4, 2.4), t: 0,
                c: "hsl(" + ri(0, 360) + ",95%,62%)", r: rnd(3, 6), shape: "conf", rot: rnd(0, 6), vr: rnd(-6, 6) });
    }
  }

  function drawStar(x, y, r, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = color; ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ============================================================
     AUDIENCE — a row of tiny cheering fans behind the dancers.
     ============================================================ */
  var crowd = [];
  function seedCrowd() {
    crowd = [];
    var n = Math.max(8, Math.floor(W / 110));
    for (var i = 0; i < n; i++) {
      crowd.push({
        x: (i + 0.5) / n, skin: pick(SKINS), hairC: pick(HAIRC),
        shirt: pick(CLOTHC), ph: rnd(0, 6.28), excite: 0,
      });
    }
  }
  function drawCrowd(t, baseY) {
    for (var i = 0; i < crowd.length; i++) {
      var c = crowd[i];
      var x = c.x * W;
      var jump = Math.abs(Math.sin(t * 5 + c.ph)) * (6 + c.excite * 26);
      var y = baseY - jump;
      // body
      ctx.fillStyle = c.shirt;
      roundRect(x - 13, y - 26, 26, 26, 7); ctx.fill();
      // head
      ctx.fillStyle = c.skin;
      ctx.beginPath(); ctx.arc(x, y - 36, 12, 0, 6.29); ctx.fill();
      // hair
      ctx.fillStyle = c.hairC;
      ctx.beginPath(); ctx.arc(x, y - 40, 12, Math.PI, 0); ctx.fill();
      // arms: up when excited
      ctx.strokeStyle = c.skin; ctx.lineWidth = 5; ctx.lineCap = "round";
      var armUp = c.excite > 0.4 ? -1 : Math.sin(t * 5 + c.ph) * 0.4;
      ctx.beginPath(); ctx.moveTo(x - 12, y - 18); ctx.lineTo(x - 20, y - 18 + armUp * 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 12, y - 18); ctx.lineTo(x + 20, y - 18 + armUp * 22); ctx.stroke();
      // face: happy dots + smile
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath(); ctx.arc(x - 4, y - 37, 1.8, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4, y - 37, 1.8, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y - 34, 4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
  }

  /* ============================================================
     SHOW FLOW — states: title → entrance → dance → pose → judge
     → (×3) → results → winner → replay
     ============================================================ */
  var state = "title";
  var stateT = 0;
  var show = null;          // {acts: [...], idx}
  var music = null;
  var dimT = 0, flashT = 0, convergeT = 0;
  var spotTarget = null;    // x for spotlights to follow
  var buttons = [];         // score buttons
  var replayBtn = null, titleBtn = null;
  var fanfareT = 0, fwT = 0, confT = 0, starT = 0;
  var winners = [];
  // awards-show sequence state
  var reveal = [false, false, false], revealT = 0, revealPop = [0, 0, 0];
  var spotSweep = false, rollT = 0, rollAcc = 0;

  function floorY() { return H * 0.70; }
  function dancerScale() { return clamp(Math.min(W, H) / 700, 0.7, 1.4); }

  function newShow() {
    var pers = shuffle(Object.keys(PERSONALITIES).slice()).slice(0, 3);
    var themes = shuffle(THEMES.slice()).slice(0, 3);
    var stages = shuffle(STAGE_IDS.slice()).slice(0, 3);
    var cthemes = shuffle(CONF_THEMES.slice()).slice(0, 3);
    var acts = [];
    for (var i = 0; i < 3; i++) {
      var p = PERSONALITIES[pers[i]];
      var style = pick(p.styles);
      acts.push({
        couple: makeCouple(), theme: themes[i],
        personality: pers[i], style: style,
        stage: stages[i], music: Music(style),
        routine: null, score: 0, cheer: 0.5,
        confetti: cthemes[i],
      });
      // theme the couple by its own theme (not the shared pick)
      acts[i].couple = (function (th) { return { theme: th, a: makeDancer(th, 0), b: makeDancer(th, 1) }; })(themes[i]);
    }
    show = { acts: acts, idx: 0 };
    parts = [];
  }

  function currentAct() { return show.acts[show.idx]; }

  function placeCouple(couple, cx, feetY) {
    var s = dancerScale();
    [["a", -1], ["b", 1]].forEach(function (P, i) {
      var d = couple[P[0]];
      d.x = cx + P[1] * 62 * s; d.y = feetY;
      d.hx = d.x; d.hy = d.y;
      d.face = -P[1]; d.s = s;
      resetPose(d);
    });
  }

  function resetPose(d) {
    d.rot = 0; d.crouch = 0; d.jump = 0; d.tilt = 0;
    d.armL = 0.3; d.armR = -0.3; d.legL = 0.15; d.legR = -0.15;
    d.twirl = 0; d.spin = 0; d.expr = "happy"; d.hatFly = 0;
  }

  function startAct() {
    var act = currentAct();
    act.routine = buildRoutine(act.style);
    act.ri = 0;
    placeCouple(act.couple, W / 2, floorY());
    act.couple.a.x = -100; act.couple.b.x = W + 100; // slide in from sides
    act.music.start(0.3);
    music = act.music;
    state = "entrance"; stateT = 0;
    spotTarget = null; convergeT = 0;
  }

  function moveStart(act) {
    var m = act.routine[act.ri];
    [act.couple.a, act.couple.b].forEach(function (d) {
      d.hx = d.x; d.hy = d.y;
      resetPose(d);
    });
    // move-specific fx
    var cx = W / 2, fy = floorY();
    if (m.fx === "spotlight") { spotTarget = m.who === 1 ? act.couple.b.x : act.couple.a.x; }
    else if (m.fx === "hearts") { hearts(cx, fy - 90); musicNotes(cx, fy - 120); }
    else if (m.fx === "flash") { flashT = 0.35; }
    else if (m.fx === "fireworks") { firework(cx + rnd(-160, 160), fy - rnd(180, 300)); }
    else if (m.fx === "stars") { sparkle(act.couple.a.x, fy - 110, "#fff3b0"); sparkle(act.couple.b.x, fy - 110, "#fff3b0"); }
    else if (m.fx === "sparkles") { sparkle(cx, fy - 60, "#35c4ff"); }
    // dips dim the lights
    if (m.mv.id === "dip" || m.mv.id === "fin-dip") dimT = 0.9;
    m.fxDone = true;
  }

  function applyMove(act, m, t01) {
    var a = act.couple.a, b = act.couple.b;
    var beat = music ? music.beatPhase() : 0;
    if (m.who === 0) { m.mv.fn(t01, a, b, beat); idleGroove(b, beat); }
    else if (m.who === 1) { m.mv.fn(t01, b, a, beat); idleGroove(a, beat); }
    else { m.mv.fn(t01, a, b, beat); }
  }

  function idleGroove(d, beat) {
    // backup dancer keeps it cute
    d.jump = Math.abs(Math.sin(beat * Math.PI)) * 8;
    d.armL = 0.8; d.armR = -0.8;
    d.tilt = Math.sin(beat * Math.PI * 2) * 0.06;
  }

  /* ---------------- score buttons ---------------- */
  var BTN_COLORS = ["#ff3b30", "#ff6a3b", "#ff8a3b", "#ffb43b", "#ffd23b",
                    "#3ddc84", "#35c4ff", "#3b8aff", "#7a5cff", "#ff3df0"];

  /* Score buttons span the entire bottom edge — huge targets.
     Faces go from flat (1) to huge grin (10): no reading needed. */
  function layoutButtons() {
    buttons = [];
    var n = 10, gap = 6, margin = 6;
    var top = H - 128, bh, bw, rows;
    if (W >= 880) {
      rows = 1; bh = 104;
      bw = (W - margin * 2 - gap * (n - 1)) / n;
    } else {
      rows = 2; bh = 56;
      bw = (W - margin * 2 - gap * 4) / 5;
    }
    for (var i = 0; i < n; i++) {
      var r = rows === 1 ? 0 : (i / 5) | 0;
      var c = rows === 1 ? i : i % 5;
      buttons.push({
        n: i + 1,
        x: margin + c * (bw + gap),
        y: top + r * (bh + gap) + (rows === 1 ? 0 : 6),
        w: bw, h: bh, c: BTN_COLORS[i], pop: 0,
      });
    }
  }

  function drawButtons(t) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var s = 1 + b.pop * 0.45;
      var w = b.w * s, h = b.h * s;
      var x = b.x + b.w / 2 - w / 2, y = b.y + b.h / 2 - h / 2;
      var cx = b.x + b.w / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(x + 3, y + 6, w, h, 16); ctx.fill();
      ctx.fillStyle = b.c;
      roundRect(x, y, w, h, 16); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(x + 4, y + 4, w - 8, h * 0.42, 12); ctx.fill();
      // number
      ctx.fillStyle = "#fff";
      ctx.font = "bold " + Math.round(h * 0.40) + "px 'Press Start 2P', monospace";
      ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4;
      ctx.fillText(String(b.n), cx, y + h * 0.30);
      ctx.shadowBlur = 0;
      // face: flat line at 1, beaming grin at 10
      var sm = (b.n - 1) / 9;
      var fr = h * 0.155, fx = cx, fy = y + h * 0.70;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = Math.max(2, fr * 0.13); ctx.lineCap = "round";
      if (b.n >= 8) {
        [-1, 1].forEach(function (sg) {
          ctx.beginPath();
          ctx.arc(fx + sg * fr * 0.36, fy - fr * 0.08, fr * 0.2, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        });
      } else {
        ctx.beginPath(); ctx.arc(fx - fr * 0.34, fy - fr * 0.08, fr * 0.11, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + fr * 0.34, fy - fr * 0.08, fr * 0.11, 0, 6.29); ctx.fill();
      }
      if (b.n === 10) {
        ctx.fillStyle = "#7a1f1f";
        ctx.beginPath(); ctx.arc(fx, fy - fr * 0.05, fr * 0.52, 0.28 * Math.PI, 0.72 * Math.PI); ctx.fill();
      }
      ctx.beginPath();
      if (sm < 0.12) {
        ctx.moveTo(fx - fr * 0.42, fy + fr * 0.32);
        ctx.lineTo(fx + fr * 0.42, fy + fr * 0.32);
      } else {
        ctx.arc(fx, fy - fr * 0.05, fr * (0.28 + sm * 0.42), 0.28 * Math.PI, 0.72 * Math.PI);
      }
      ctx.stroke();
    }
    ctx.textBaseline = "alphabetic";
  }

  /* Scoring is scaled: a small score gets a gentle nod, a big score
     gets the whole crowd. Never punish a low score. */
  function judgeScore(n, bx, by) {
    var act = currentAct();
    act.score = n;
    act.cheer = n >= 8 ? 1 : n >= 4 ? 0.55 : 0.25;
    var big = n >= 8, mid = n >= 4 && n < 8;
    if (big) {
      audio.arp([523, 659, 784, 1047], 0.08, "square", 0.13);
      audio.noise(0.5, { vol: 0.1, filter: "highpass", freq: 1200 });
      celebrationBurst("rainbow", bx, by - 60, 30);
    } else if (mid) {
      audio.arp([440, 554, 659], 0.09, "square", 0.1);
    } else {
      audio.tone(330, 0.3, { type: "triangle", vol: 0.1 });
      audio.tone(262, 0.35, { type: "triangle", vol: 0.08, when: 0.12 });
    }
    sparkle(bx, by, "#fff3b0");
    if (big) sparkle(bx, by, BTN_COLORS[n - 1]);
    [act.couple.a, act.couple.b].forEach(function (d) {
      d.expr = big ? "cheer" : mid ? "laugh" : "happy";
    });
    crowd.forEach(function (c) { c.excite = big ? 1 : mid ? 0.5 : 0.2; });
    stateT = 0; state = "scored";
  }

  /* ---------------- per-state update ---------------- */
  function update(dt, now) {
    stateT += dt;
    if (dimT > 0) dimT -= dt;
    if (flashT > 0) flashT -= dt;
    for (var i = 0; i < buttons.length; i++)
      if (buttons[i].pop > 0) buttons[i].pop = Math.max(0, buttons[i].pop - dt * 2.2);
    crowd.forEach(function (c) { if (c.excite > 0) c.excite = Math.max(0, c.excite - dt * 0.5); });

    if (music) music.update(now);

    if (state === "title") {
      // demo couple grooving behind the big play button
      if (show) {
        var act = show.acts[0];
        var beat = music ? music.beatPhase() : (now % 1);
        idleGroove(act.couple.a, beat); idleGroove(act.couple.b, beat + 0.5);
      }
    } else if (state === "entrance") {
      var a2 = currentAct();
      var k = Math.min(1, stateT / 1.6);
      var e = 1 - Math.pow(1 - k, 3);
      a2.couple.a.x = lerp(-100, W / 2 - 62 * dancerScale(), e);
      a2.couple.b.x = lerp(W + 100, W / 2 + 62 * dancerScale(), e);
      a2.couple.a.jump = Math.abs(Math.sin(stateT * 9)) * 10;
      a2.couple.b.jump = Math.abs(Math.sin(stateT * 9 + 1)) * 10;
      if (k >= 1) {
        a2.couple.a.hx = a2.couple.a.x; a2.couple.b.hx = a2.couple.b.x;
        a2.ri = 0; moveStart(a2);
        state = "dance"; stateT = 0;
      }
    } else if (state === "dance") {
      var ac = currentAct();
      var m = ac.routine[ac.ri];
      m.t += dt;
      var t01 = clamp(m.t / m.dur, 0, 1);
      applyMove(ac, m, t01);
      // safety net: dancers never leave the screen, whatever a move does
      [ac.couple.a, ac.couple.b].forEach(function (d) {
        d.x = clamp(d.x, 50, W - 50);
      });
      if (spotTarget !== null) {
        // spotlight tracks the spinner
        spotTarget = m.who === 1 ? ac.couple.b.x : ac.couple.a.x;
      }
      if (m.t >= m.dur) {
        ac.ri++;
        if (ac.ri >= ac.routine.length) {
          state = "pose"; stateT = 0; convergeT = 1.6;
          if (music) music.stop(); music = null;
          audio.arp([523, 659, 784], 0.09, "square", 0.1);
        } else moveStart(ac);
      }
    } else if (state === "pose") {
      convergeT = Math.max(0, convergeT - dt);
      if (stateT > 1.6) {
        state = "judge"; stateT = 0; layoutButtons();
        // each performance ends with its own confetti flavor
        var pa = currentAct();
        celebrationBurst(pa.confetti, W / 2, floorY() - 150, 45);
        audio.arp([659, 784], 0.09, "square", 0.1);
      }
    } else if (state === "judge") {
      var ac2 = currentAct();
      var beat2 = (now % 1);
      idleGroove(ac2.couple.a, beat2); idleGroove(ac2.couple.b, beat2 + 0.5);
      ac2.couple.a.expr = "happy"; ac2.couple.b.expr = "happy";
    } else if (state === "scored") {
      var ac3 = currentAct();
      var ch = ac3.cheer == null ? 0.5 : ac3.cheer;
      ac3.couple.a.jump = Math.abs(Math.sin(stateT * 10)) * (6 + 44 * ch);
      ac3.couple.b.jump = Math.abs(Math.sin(stateT * 10 + 1)) * (6 + 44 * ch);
      if (stateT > 1.7) {
        show.idx++;
        if (show.idx >= 3) {
          // awards show: everyone on stage, scores revealed one by one
          show.acts.forEach(function (a3, i) {
            placeCouple(a3.couple, W * (0.2 + i * 0.3), floorY());
          });
          state = "results"; stateT = 0;
          reveal = [false, false, false]; revealPop = [0, 0, 0]; revealT = 0;
        } else startAct();
      }
    } else if (state === "results") {
      show.acts.forEach(function (a4, i) {
        var beat3 = (now % 1) + i * 0.3;
        idleGroove(a4.couple.a, beat3); idleGroove(a4.couple.b, beat3 + 0.5);
      });
      for (var pi = 0; pi < 3; pi++)
        if (revealPop[pi] > 0) revealPop[pi] = Math.max(0, revealPop[pi] - dt * 2);
      // scores pop in one per second, left to right
      revealT += dt;
      for (var ri2 = 0; ri2 < 3; ri2++) {
        if (!reveal[ri2] && revealT > ri2 + 1) {
          reveal[ri2] = true; revealPop[ri2] = 1;
          var cxr = W * (0.2 + ri2 * 0.3);
          sparkle(cxr, H * 0.40, "#fff3b0");
          audio.tone(440 + ri2 * 160, 0.35, { type: "square", vol: 0.12 });
          audio.tone(660 + ri2 * 160, 0.4, { type: "square", vol: 0.08, when: 0.1 });
        }
      }
      if (revealT > 4.1) {
        state = "suspense"; stateT = 0;
        spotSweep = true; rollT = 0; rollAcc = 0;
      }
    } else if (state === "suspense") {
      // dramatic pause: spotlights sweep wildly, drum roll builds
      show.acts.forEach(function (a4, i) {
        var beat3 = (now % 1) + i * 0.3;
        idleGroove(a4.couple.a, beat3); idleGroove(a4.couple.b, beat3 + 0.5);
        a4.couple.a.expr = "wow"; a4.couple.b.expr = "wow";
      });
      rollT += dt; rollAcc += dt;
      var rk = clamp(rollT / 2.8, 0, 1);
      if (rollAcc >= lerp(0.32, 0.07, rk)) {
        rollAcc = 0;
        audio.tone(70 + rk * 40, 0.1, { type: "sine", vol: 0.28, slideTo: 50 });
        audio.noise(0.05, { vol: 0.07, filter: "lowpass", freq: 800 });
      }
      if (rollT > 2.8) {
        spotSweep = false;
        var max = Math.max(show.acts[0].score, show.acts[1].score, show.acts[2].score);
        winners = show.acts.filter(function (a5) { return a5.score === max; });
        state = "winner"; stateT = 0; fanfareT = 0; fwT = 0; confT = 0; starT = 0;
        convergeT = 99;
        crowd.forEach(function (c) { c.excite = 1; });
        audio.arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.07, "square", 0.14);
      }
    } else if (state === "winner") {
      // winners groove to the middle, everyone celebrates
      winners.forEach(function (w, i) {
        var tx = W / 2 + (i - (winners.length - 1) / 2) * 150 * dancerScale();
        w.couple.a.x = lerp(w.couple.a.x, tx - 62 * dancerScale(), Math.min(1, dt * 3));
        w.couple.b.x = lerp(w.couple.b.x, tx + 62 * dancerScale(), Math.min(1, dt * 3));
        if (((stateT * 1.4) | 0) !== ((stateT - dt) * 1.4 | 0)) {
          var mv = pick(movesIn(pick(["jump", "spin", "comedy"])));
          [w.couple.a, w.couple.b].forEach(function (d) { d.hx = d.x; d.hy = d.y; resetPose(d); });
          w._vmv = { mv: mv, t: 0 };
        }
        if (w._vmv) {
          w._vmv.t += dt;
          var tt = clamp(w._vmv.t / w._vmv.mv.dur, 0, 1);
          w._vmv.mv.fn(tt, w.couple.a, w.couple.b, now % 1);
          if (tt >= 1) w._vmv = null;
        }
      });
      show.acts.forEach(function (a6) {
        if (winners.indexOf(a6) < 0) {
          // good sports: clap along
          a6.couple.a.armL = -1.4 + Math.sin(now * 10) * 0.3;
          a6.couple.a.armR = -1.4 - Math.sin(now * 10) * 0.3;
          a6.couple.b.armL = -1.4 - Math.sin(now * 10) * 0.3;
          a6.couple.b.armR = -1.4 + Math.sin(now * 10) * 0.3;
        }
      });
      // celebration fx + fanfare — make it WOW
      fanfareT -= dt;
      if (fanfareT <= 0) {
        audio.arp([523, 659, 784, 1047, 1319, 1568], 0.08, "square", 0.14);
        audio.tone(120, 0.14, { type: "sine", vol: 0.5, slideTo: 45 });
        audio.noise(0.5, { vol: 0.14, filter: "highpass", freq: 1200 }); // crowd roar
        flashT = 0.22;
        fanfareT = 0.9;
      }
      fwT -= dt;
      if (fwT <= 0) {
        firework(rnd(W * 0.08, W * 0.92), rnd(H * 0.06, H * 0.38));
        firework(rnd(W * 0.08, W * 0.92), rnd(H * 0.06, H * 0.38));
        if (chance(0.7)) balloon(rnd(W * 0.1, W * 0.9));
        fwT = 0.38;
      }
      confT -= dt;
      if (confT <= 0) {
        // lots of confetti for the winner, in their act's flavor
        confettiBurst(35);
        if (winners.length) celebrationBurst(winners[0].confetti, W / 2, H * 0.25, 25);
        confT = 0.45;
      }
      starT -= dt;
      if (starT <= 0) {
        winners.forEach(function (w) {
          sparkle(w.couple.a.x, floorY() - 130, "#fff3b0");
          sparkle(w.couple.b.x, floorY() - 130, "#ffd23b");
        });
        starT = 0.3;
      }
      if (stateT > 10) { state = "replay"; stateT = 0; layoutReplay(); }
    } else if (state === "replay") {
      show.acts.forEach(function (a7, i) {
        var beat4 = (now % 1) + i * 0.3;
        idleGroove(a7.couple.a, beat4); idleGroove(a7.couple.b, beat4 + 0.5);
      });
    }

    drawParts(dt);
  }

  function layoutReplay() {
    replayBtn = { x: W / 2, y: H * 0.5, r: Math.min(W, H) * 0.11 };
  }

  /* ---------------- drawing the show ---------------- */
  function drawFloor(t, beat) {
    var top = H * 0.52, bot = H - 132;
    // base
    ctx.fillStyle = "#0a0a18";
    ctx.fillRect(0, top, W, bot - top + 4);
    // perspective tiles, glowing with the beat
    var rows = 5, cols = 12;
    for (var r = 0; r < rows; r++) {
      var y0 = top + (bot - top) * Math.pow(r / rows, 1.4);
      var y1 = top + (bot - top) * Math.pow((r + 1) / rows, 1.4);
      for (var c = 0; c < cols; c++) {
        var hue = (t * 30 + (r * cols + c) * 14 + beat * 60) % 360;
        var on = ((r + c) % 2 === 0);
        ctx.fillStyle = "hsla(" + hue + ",85%," + (on ? 42 : 26) + "%,0.9)";
        var x0 = (c / cols) * W, x1 = ((c + 1) / cols) * W;
        // slight perspective: widen toward bottom
        var inset = (1 - r / rows) * 0.08 * W;
        ctx.fillRect(x0 + inset * 0.3, y0, (x1 - x0) - inset * 0.6, y1 - y0 - 1);
      }
    }
    // glossy reflection strip
    var gg = ctx.createLinearGradient(0, top, 0, bot);
    gg.addColorStop(0, "rgba(255,255,255,0.20)");
    gg.addColorStop(0.4, "rgba(255,255,255,0.03)");
    gg.addColorStop(1, "rgba(255,255,255,0.10)");
    ctx.fillStyle = gg;
    ctx.fillRect(0, top, W, bot - top);
  }

  function drawSpotlights(t) {
    var tops = [W * 0.2, W * 0.5, W * 0.8];
    var cols = ["rgba(255,80,180,0.20)", "rgba(80,180,255,0.20)", "rgba(255,220,80,0.20)"];
    for (var i = 0; i < 3; i++) {
      var tx;
      if (convergeT > 0) tx = W / 2;
      else if (spotSweep) tx = W / 2 + Math.sin(t * 9 + i * 2.4) * W * 0.45;
      else if (spotTarget !== null && i === 1) tx = spotTarget;
      else tx = tops[i] + Math.sin(t * 0.9 + i * 2.1) * W * 0.12;
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(tops[i] - 26, -10);
      ctx.lineTo(tops[i] + 26, -10);
      ctx.lineTo(tx + 130, floorY() + 40);
      ctx.lineTo(tx - 130, floorY() + 40);
      ctx.closePath(); ctx.fill();
      // lamp
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(tops[i], 6, 12, 0, 6.29); ctx.fill();
    }
  }

  function drawTrophy(x, y, s, t) {
    var bob = Math.sin(t * 3) * 6;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    ctx.fillStyle = "#ffd23b";
    ctx.fillRect(-16, -34, 32, 40);
    ctx.beginPath(); ctx.arc(0, -34, 16, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = "#ffd23b"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(-20, -16, 12, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(20, -16, 12, Math.PI * 1.5, Math.PI * 2.5); ctx.stroke();
    ctx.fillRect(-10, 6, 20, 10);
    ctx.fillRect(-18, 16, 36, 8);
    drawStar(0, -52, 12, t * 2, "#fff3b0");
    ctx.restore();
  }

  function drawBigButton(b, t, glyph) {
    var pulse = 1 + 0.06 * Math.sin(t * 4);
    var r = b.r * pulse;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath(); ctx.arc(b.x, b.y + 8, r, 0, 6.29); ctx.fill();
    var g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.2, b.x, b.y, r);
    g.addColorStop(0, "#3ddc84"); g.addColorStop(1, "#1d9e44");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.29); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.29); ctx.stroke();
    ctx.fillStyle = "#fff";
    if (glyph === "play") {
      ctx.beginPath();
      ctx.moveTo(b.x - r * 0.3, b.y - r * 0.42);
      ctx.lineTo(b.x + r * 0.48, b.y);
      ctx.lineTo(b.x - r * 0.3, b.y + r * 0.42);
      ctx.closePath(); ctx.fill();
    }
  }

  function hatsActs() {
    if (!show) return [];
    if (state === "results" || state === "suspense" || state === "winner" || state === "replay") return show.acts;
    var c = currentAct();
    return c ? [c] : [];
  }
  function drawFlyingHats() {
    if (!show) return;
    hatsActs().forEach(function (a) {
      [a.couple.a, a.couple.b].forEach(function (d) {
        if (d.hatFly > 0.05 && d.hat) {
          var hx = d.x + 30 * d.face, hy = d.y - 120 * d.hatFly;
          ctx.save(); ctx.translate(hx, hy); ctx.rotate(d.hatFly * 5);
          drawHat({ hat: d.hat, topC: d.topC, face: 1 }, 0, 0, d.s);
          ctx.restore();
        }
      });
    });
  }

  function draw() {
    var now = performance.now() / 1000;
    var t = now;
    var act = show ? currentAct() : null;
    var stage = act ? act.stage : "disco";
    var sc = stageColors(stage);

    // backdrop
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, sc.top); bg.addColorStop(0.55, sc.bot); bg.addColorStop(1, "#050510");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    drawStageDeco(stage, t, now);
    drawCrowd(t, H * 0.34);
    drawFloor(t, music ? music.beatPhase() : (now % 1));
    drawSpotlights(t);

    // dancers
    if (show && (state === "results" || state === "suspense" || state === "winner" || state === "replay")) {
      show.acts.forEach(function (a) {
        drawDancer(a.couple.a); drawDancer(a.couple.b);
      });
    } else if (show && act) {
      drawDancer(act.couple.a); drawDancer(act.couple.b);
    } else if (state === "title" && show) {
      drawDancer(show.acts[0].couple.a); drawDancer(show.acts[0].couple.b);
    }
    drawFlyingHats();
    // (particles are drawn in update via drawParts)

    // dim / flash overlays
    if (dimT > 0) { ctx.fillStyle = "rgba(0,0,10," + (0.45 * dimT) + ")"; ctx.fillRect(0, 0, W, H); }
    if (flashT > 0) { ctx.fillStyle = "rgba(255,255,255," + (0.55 * flashT / 0.35) + ")"; ctx.fillRect(0, 0, W, H); }

    // awards scores: revealed one by one, then winner highlighted
    if (state === "results" || state === "suspense" || state === "winner" || state === "replay") {
      ctx.textAlign = "center";
      show.acts.forEach(function (a2, i) {
        if ((state === "results" || state === "suspense") && !reveal[i]) return;
        var cx = W * (0.2 + i * 0.3);
        var isW = (state === "winner" || state === "replay") && winners.indexOf(a2) >= 0;
        var sc2 = (isW ? 1.35 + 0.1 * Math.sin(t * 6) : 1) * (1 + (revealPop[i] || 0) * 0.5);
        ctx.save(); ctx.translate(cx, H * 0.40); ctx.scale(sc2, sc2);
        if (isW) {
          ctx.fillStyle = "#ffd23b";
          ctx.beginPath(); ctx.arc(0, 0, 44, 0, 6.29); ctx.fill();
          ctx.fillStyle = "#7a0e2e";
        } else { ctx.fillStyle = "#fff"; }
        drawPixelNumber(ctx, a2.score, 0, 0, 7, isW ? "#7a0e2e" : "#ffffff", true);
        ctx.restore();
        if (isW && (state === "winner" || state === "replay")) drawTrophy(cx, H * 0.28, 1.45, t);
      });
      ctx.textAlign = "left";
    }

    // judging buttons
    if (state === "judge" || state === "scored") {
      drawButtons(t);
      if (state === "judge") {
        // dancers point at the buttons: subtle arrow bounce
        ctx.fillStyle = "rgba(255,255,255," + (0.5 + 0.3 * Math.sin(t * 4)) + ")";
        ctx.font = "28px 'Press Start 2P', monospace"; ctx.textAlign = "center";
        ctx.fillText("▼", W / 2, H - 140 + Math.sin(t * 4) * 6);
        ctx.textAlign = "left";
      }
    }

    // title / replay big play button
    if (state === "title") {
      ctx.fillStyle = "rgba(0,0,10,0.35)"; ctx.fillRect(0, 0, W, H);
      drawBigButton(titleBtn, t, "play");
    } else if (state === "replay") {
      drawBigButton(replayBtn, t, "play");
    }

    // couple indicator during performances: little dots top-center
    if (show && (state === "entrance" || state === "dance" || state === "pose" || state === "judge" || state === "scored")) {
      for (var i = 0; i < 3; i++) {
        ctx.fillStyle = i < show.idx ? "#3ddc84" : i === show.idx ? "#ffd23b" : "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(W / 2 + (i - 1) * 34, 30, i === show.idx ? 11 : 8, 0, 6.29); ctx.fill();
      }
    }
  }

  /* ---------------- input ---------------- */
  function hitButton(b, x, y) {
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  canvas.addEventListener("pointerdown", function (e) {
    audio.unlock();
    var x = e.clientX, y = e.clientY;
    if (state === "title") {
      var d = Math.hypot(x - titleBtn.x, y - titleBtn.y);
      if (d <= titleBtn.r * 1.3) {
        audio.arp([523, 659, 784], 0.08, "square", 0.12);
        newShow(); startAct();
      }
    } else if (state === "judge") {
      for (var i = 0; i < buttons.length; i++) {
        if (hitButton(buttons[i], x, y)) {
          buttons[i].pop = 1;
          judgeScore(buttons[i].n, buttons[i].x + buttons[i].w / 2, buttons[i].y);
          break;
        }
      }
    } else if (state === "replay") {
      var d2 = Math.hypot(x - replayBtn.x, y - replayBtn.y);
      if (d2 <= replayBtn.r * 1.3) {
        audio.arp([523, 659, 784], 0.08, "square", 0.12);
        if (window.SDGplays) SDGplays.played("dancejudge");
        newShow(); startAct();
      }
    }
  });

  /* ---------------- main loop ---------------- */
  var last = performance.now();
  function frame(nowMs) {
    var now = nowMs / 1000;
    var dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    update(dt, now);
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------------- boot ---------------- */
  newShow();
  // title screen: first couple grooving behind the play button
  placeCouple(show.acts[0].couple, W / 2 || 512, 500);
  titleBtn = { x: 0, y: 0, r: 60 };
  seedCrowd();
  resize();
  titleBtn.x = W / 2; titleBtn.y = H * 0.52; titleBtn.r = Math.min(W, H) * 0.11;
  placeCouple(show.acts[0].couple, W / 2, floorY());
  window.addEventListener("resize", function () {
    seedCrowd();
    titleBtn.x = W / 2; titleBtn.y = H * 0.52; titleBtn.r = Math.min(W, H) * 0.11;
    if (state === "title") placeCouple(show.acts[0].couple, W / 2, floorY());
    if (state === "replay") layoutReplay();
  });
  requestAnimationFrame(frame);

  /* ---------------- test hooks ---------------- */
  window.__dance = {
    MOVES: MOVES, STYLES: STYLES, STAGE_IDS: STAGE_IDS,
    buildRoutine: buildRoutine, makeCouple: makeCouple,
    Music: Music, GROOVES: GROOVES, PERSONALITIES: PERSONALITIES,
    _state: function (s) { if (s !== undefined) state = s; return state; },
    _show: function () { return show; },
    _newShow: newShow,
    _hatsActs: hatsActs,
    _winnerOf: function (scores) {
      var max = Math.max.apply(null, scores);
      return scores.map(function (s2, i) { return s2 === max ? i : -1; }).filter(function (i) { return i >= 0; });
    },
  };
})();
