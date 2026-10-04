/* ============================================================
   SmoothDaddyG chiptune synth — WebAudio, zero assets.
   Square/triangle-wave blips and arpeggios, arcade flavored.
   Sound starts only after a user gesture (mobile-safe).
   ============================================================ */

function makeAudio() {
  "use strict";
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
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
    if (muted) return;
    opts = opts || {};
    const when = opts.when || 0;
    const attack = opts.attack || 0.005;
    const vol = opts.vol != null ? opts.vol : 0.2;
    try {
      const c = ac();
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

  /* iOS requires a gesture before audio; unlock on first touch. */
  function unlockNow() {
    try { ac(); } catch (e) { /* ignore */ }
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
    unlock: unlockNow,
    state: function () { return ctx ? ctx.state : "none"; },
    toggleMute: function () {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
