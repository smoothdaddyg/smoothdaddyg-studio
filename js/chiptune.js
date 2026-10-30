/* ============================================================
   SmoothDaddyG chiptune synth — WebAudio, zero assets.
   Square/triangle-wave blips and arpeggios, arcade flavored.
   Sound starts only after a user gesture (mobile-safe).
   ============================================================ */

function makeAudio() {
  "use strict";
  let ctx = null;
  let muted = false;
  // iOS Safari permanently suspends an AudioContext created before the
  // first user gesture — resume() later can't revive it. So no context
  // exists until unlockNow() runs inside a real tap/click.
  let unlocked = false;

  function ac() {
    if (!unlocked) return null;
    if (!ctx) {
      // iOS/iPadOS route Web Audio through the "Ambient" session, which
      // Silent Mode mutes outright — so games are silent through the
      // speaker whenever the silent switch is on (headphones exempt).
      // Claiming the "playback" session (Safari 16.4+) opts game audio
      // out of the silent switch. Guarded: no-op everywhere else.
      try {
        if (typeof navigator !== "undefined" && "audioSession" in navigator && navigator.audioSession) {
          navigator.audioSession.type = "playback";
        }
      } catch (e) { /* ignore — ambient rules still apply */ }
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  }

  /* Single blip. opts: type, vol, when (sec delay), slideTo (freq sweep). */
  function tone(freq, dur, opts) {
    if (muted) return;
    opts = opts || {};
    const type = opts.type || "square";
    const vol = opts.vol != null ? opts.vol : 0.11;
    const when = opts.when || 0;
    const slideTo = opts.slideTo || null;
    try {
      const c = ac();
      if (!c) return; // pre-gesture: stay silent, game still works
      const t = c.currentTime + when;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(30, freq), t);
      if (slideTo) {
        o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
      }
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {
      /* audio unavailable — stay silent, game still works */
    }
  }

  /* Happy little arpeggio. notes = array of frequencies. */
  function arp(notes, step, type, vol) {
    step = step || 0.09;
    type = type || "square";
    vol = vol != null ? vol : 0.1;
    notes.forEach((n, i) => {
      tone(n, step * 2.4, { type: type, vol: vol, when: i * step });
    });
  }

  /* Filtered noise burst — drums, explosions, rain, wind, thunder.
     opts: filter ("lowpass"|"highpass"|"bandpass"), freq, Q, vol,
     when (sec delay), attack (sec fade-in). Always decays to silence. */
  function noise(dur, opts) {
    if (muted) return null;
    opts = opts || {};
    const when = opts.when || 0;
    const attack = opts.attack || 0.005;
    const vol = opts.vol != null ? opts.vol : 0.2;
    try {
      const c = ac();
      if (!c) return null; // pre-gesture: stay silent, game still works
      const t = c.currentTime + when;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = !!opts.loop;
      const flt = c.createBiquadFilter();
      flt.type = opts.filter || "lowpass";
      flt.frequency.setValueAtTime(opts.freq || 1000, t);
      if (opts.slideTo) {
        flt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.slideTo), t + dur);
      }
      flt.Q.value = opts.Q || 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0011, vol), t + attack);
      if (!opts.loop) {
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      }
      src.connect(flt);
      flt.connect(g);
      g.connect(c.destination);
      src.start(t);
      if (!opts.loop) src.stop(t + dur + 0.05);
      // Return handles so callers can shape loops (ambient beds).
      return { src: src, filter: flt, gain: g, ctx: c };
    } catch (e) {
      /* audio unavailable — stay silent, game still works */
      return null;
    }
  }

  /* Step-sequencer background loop — his rule (2026-10-22): "video
     games need background music," kept under the sound effects.
     cfg: bpm (required), steps (default 32), bass[] / lead[] (freq-or-0
     per step), bassType ("triangle"), leadType ("square"), bassVol,
     leadVol, kickEvery (steps between kicks, default 8, 0 = none),
     snareOff (default 4, null = none), hats ("odd"|"all"|"none"),
     kickVol, snareVol, hatVol. Funk upgrade (2026-10-30): div (steps
     per beat, default 2 = 8ths; 4 = 16ths for syncopation) and explicit
     kicks[] / snares[] (step indices mod steps; when present they
     replace kickEvery / snareOff). Old configs without div/kicks/snares
     behave exactly as before. Tones schedule through tone()/noise(),
     so pre-gesture calls stay silent and the step clock still runs.
     Returns { tick(dt), start(), stop(), on, step }. */
  function makeMusic(cfg) {
    cfg = cfg || {};
    const steps = cfg.steps || 32;
    const div = cfg.div || 2;
    const m = { on: false, step: 0, t: 0, STEP_DUR: 60 / (cfg.bpm || 100) / div };
    function tick(dt) {
      if (!m.on) return;
      m.t += dt;
      while (m.t >= m.STEP_DUR) {
        m.t -= m.STEP_DUR;
        const s = m.step % steps;
        m.step++;
        const b = cfg.bass && cfg.bass[s];
        if (b) tone(b, 0.22, { type: cfg.bassType || "triangle", vol: cfg.bassVol != null ? cfg.bassVol : 0.13 });
        const l = cfg.lead && cfg.lead[s];
        if (l) tone(l, 0.2, { type: cfg.leadType || "square", vol: cfg.leadVol != null ? cfg.leadVol : 0.03 });
        const ke = cfg.kickEvery != null ? cfg.kickEvery : 8;
        const kickHere = cfg.kicks ? cfg.kicks.indexOf(s) !== -1 : (ke && s % ke === 0);
        if (kickHere) tone(cfg.kickFreq || 130, 0.12, { type: "sine", vol: cfg.kickVol != null ? cfg.kickVol : 0.16, slideTo: 42 });
        const so = cfg.snareOff !== undefined ? cfg.snareOff : 4;
        const snareHere = cfg.snares ? cfg.snares.indexOf(s) !== -1 : (ke && so != null && s % ke === so);
        if (snareHere) noise(0.09, { filter: "bandpass", freq: 1800, vol: cfg.snareVol != null ? cfg.snareVol : 0.04 });
        const hats = cfg.hats || "odd";
        if ((hats === "odd" && s % 2 === 1) || hats === "all") noise(0.03, { filter: "highpass", freq: 6500, vol: cfg.hatVol != null ? cfg.hatVol : 0.02 });
      }
    }
    return {
      tick: tick,
      start: function () { m.on = true; },
      stop: function () { m.on = false; },
      get on() { return m.on; },
      get step() { return m.step; },
    };
  }

  /* iOS requires the AudioContext to be created inside a user gesture.
     First tap/click unlocks it, plays a 1-sample silent buffer as
     belt-and-suspenders, and removes the listeners. */
  function unlockNow() {
    if (!unlocked) {
      unlocked = true;
      try {
        const c = ac();
        if (c) {
          const buf = c.createBuffer(1, 1, c.sampleRate);
          const src = c.createBufferSource();
          src.buffer = buf;
          src.connect(c.destination);
          src.start(0);
        }
      } catch (e) { /* ignore */ }
    } else {
      try { ac(); } catch (e) { /* ignore */ }
    }
  }
  window.addEventListener("pointerdown", function unlock() {
    unlockNow();
    window.removeEventListener("pointerdown", unlock);
  });
  window.addEventListener("touchend", function unlock2() {
    unlockNow();
    window.removeEventListener("touchend", unlock2);
  });

  return {
    tone: tone,
    arp: arp,
    noise: noise,
    makeMusic: makeMusic,
    unlock: unlockNow,
    state: function () { return ctx ? ctx.state : (unlocked ? "none" : "locked"); },
    toggleMute: function () {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
