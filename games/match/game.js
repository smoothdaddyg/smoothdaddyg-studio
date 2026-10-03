/* ============================================================
   MATCH — SmoothDaddyG
   A big shape is shown up top. Below: 2 (later 3) shapes.
   Tap the one that matches: celebration + chiptune arpeggio.
   Wrong tap: gentle wobble, soft tone, try again. No penalty.
   Difficulty adapts quietly — never a menu.
   One interaction: tap. No reading required.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const audio = makeAudio();

  let W = 0, H = 0, DPR = 1;
  let time = 0;

  const SHAPES = ["circle", "square", "triangle", "gem", "star"];
  const HUES = [315, 190, 45, 150, 265];

  let target = null;      // {shape, hue}
  let choices = [];       // [{shape, hue, x, y, size, wobble, pop}]
  let state = "play";     // "play" | "cheer"
  let cheerT = 0;
  let confetti = [];
  let spinT = 0;

  // adaptive difficulty (quiet — no menus)
  let choiceCount = 2;
  let goodStreak = 0;
  let badStreak = 0;
  let firstTry = true;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
  }
  window.addEventListener("resize", resize);

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function layout() {
    if (!choices.length) return;
    const n = choices.length;
    const size = Math.max(96, Math.min(150, (W - 56) / n - 18));
    const gap = 18;
    const totalW = n * size + (n - 1) * gap;
    let x = W / 2 - totalW / 2;
    const y = H - size - Math.max(40, H * 0.07);
    choices.forEach((c) => {
      c.size = size;
      c.x = x + size / 2;
      c.y = y + size / 2;
      x += size + gap;
    });
  }

  function newRound() {
    const shape = pick(SHAPES);
    const hue = pick(HUES);
    target = { shape: shape, hue: hue };

    const others = shuffled(SHAPES.filter((s) => s !== shape)).slice(0, choiceCount - 1);
    const defs = [{ shape: shape, hue: hue }].concat(
      others.map((s) => ({ shape: s, hue: pick(HUES.filter((h) => h !== hue)) }))
    );
    choices = shuffled(defs).map((d) => ({
      shape: d.shape, hue: d.hue,
      x: 0, y: 0, size: 120,
      wobble: 0, pop: 0, // pop-in animation
    }));
    firstTry = true;
    state = "play";
    layout();
    choices.forEach((c, i) => { c.pop = -i * 0.07; }); // staggered entrance
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function starPath(r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function shapePath(shape, r) {
    ctx.beginPath();
    if (shape === "circle") ctx.arc(0, 0, r * 0.92, 0, 6.2832);
    else if (shape === "square") { const a = r * 1.62; ctx.rect(-a / 2, -a / 2, a, a); }
    else if (shape === "triangle") {
      const a = r * 1.95;
      ctx.moveTo(0, -a / 2); ctx.lineTo(a / 2, a / 2); ctx.lineTo(-a / 2, a / 2);
      ctx.closePath();
    } else if (shape === "gem") {
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.72, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.72, 0);
      ctx.closePath();
    } else if (shape === "star") starPath(r);
  }

  function drawShape(shape, hue, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = `hsl(${hue},95%,60%)`;
    ctx.shadowColor = `hsl(${hue},95%,60%)`;
    ctx.shadowBlur = r * 0.35;
    shapePath(shape, r);
    ctx.fill();
    ctx.restore();
  }

  function celebrate(x, y, hue) {
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * 6.283;
      const sp = 120 + Math.random() * 320;
      confetti.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        t: 0, life: 0.9 + Math.random() * 0.7,
        hue: pick([hue, 45, 190, 315, 150]),
        r: 3 + Math.random() * 4,
      });
    }
    audio.arp([523.25, 659.25, 783.99, 1046.5], 0.085, "square", 0.09);
    audio.arp([261.63, 329.63, 392.0], 0.12, "triangle", 0.07);
  }

  function onTap(e) {
    if (state !== "play") return;
    const x = e.clientX, y = e.clientY;
    for (const c of choices) {
      const half = c.size / 2;
      if (Math.abs(x - c.x) <= half && Math.abs(y - c.y) <= half) {
        if (c.shape === target.shape) {
          // correct!
          state = "cheer";
          cheerT = 0;
          spinT = 0;
          celebrate(c.x, c.y, c.hue);
          if (firstTry) {
            goodStreak++;
            badStreak = 0;
            if (goodStreak >= 3 && choiceCount < 3) {
              choiceCount = 3; // quietly add a third choice
              goodStreak = 0;
            }
          } else {
            goodStreak = 0;
            badStreak = 0;
          }
        } else {
          // wrong — gentle wobble, no penalty
          firstTry = false;
          c.wobble = 1;
          goodStreak = 0;
          badStreak++;
          if (badStreak >= 2 && choiceCount > 2) {
            choiceCount = 2; // quietly ease back
            badStreak = 0;
          }
          audio.tone(174, 0.18, { type: "triangle", vol: 0.08, slideTo: 130 });
        }
        return;
      }
    }
  }

  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const muteBtn = document.getElementById("muteBtn");
  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    muteBtn.style.opacity = audio.toggleMute() ? "0.35" : "1";
  });

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    time += dt;

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d0d1a");
    bg.addColorStop(1, "#0a0a13");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const ty = Math.max(150, H * 0.3);

    // target frame
    const frameR = Math.min(W, H) * 0.19;
    ctx.save();
    ctx.strokeStyle = "rgba(0,234,255,0.65)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#00eaff";
    ctx.shadowBlur = 18;
    roundRectPath(W / 2 - frameR, ty - frameR, frameR * 2, frameR * 2, 26);
    ctx.stroke();
    ctx.restore();

    // target shape (gentle pulse draws the eye — show, don't tell)
    if (target) {
      const pulse = 1 + Math.sin(time * 2.4) * 0.05;
      let rot = 0;
      if (state === "cheer") {
        spinT += dt;
        rot = spinT * 9;
      }
      ctx.save();
      ctx.translate(W / 2, ty);
      ctx.rotate(rot);
      ctx.scale(pulse, pulse);
      ctx.translate(-W / 2, -ty);
      drawShape(target.shape, target.hue, W / 2, ty, frameR * 0.52);
      ctx.restore();
    }

    // divider dots (wordless separation)
    ctx.fillStyle = "rgba(167,167,196,0.35)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(W / 2 - 40 + i * 20, ty + frameR + 34, 3, 0, 6.2832);
      ctx.fill();
    }

    // choice cards
    for (const c of choices) {
      c.pop += dt * 3.2;
      const pk = Math.min(1, Math.max(0, c.pop));
      const ease = 1 - Math.pow(1 - pk, 3);
      if (c.wobble > 0) c.wobble = Math.max(0, c.wobble - dt * 2.2);
      const wob = Math.sin(time * 26) * 9 * c.wobble;

      ctx.save();
      ctx.translate(c.x + wob, c.y);
      ctx.scale(Math.max(0.01, ease), Math.max(0.01, ease));
      ctx.fillStyle = "#171728";
      ctx.strokeStyle = state === "cheer" && c.shape === target.shape
        ? `hsl(${c.hue},95%,65%)` : "#2c2c46";
      ctx.lineWidth = 3;
      if (state === "cheer" && c.shape === target.shape) {
        ctx.shadowColor = `hsl(${c.hue},95%,60%)`;
        ctx.shadowBlur = 24;
      }
      const half = c.size / 2;
      roundRectPath(-half, -half, c.size, c.size, 22);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      drawShape(c.shape, c.hue, c.x + wob, c.y, c.size * 0.26 * Math.max(0.01, ease));
    }

    // confetti
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.t += dt;
      if (p.t >= p.life) { confetti.splice(i, 1); continue; }
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = `hsla(${p.hue},95%,62%,${k.toFixed(2)})`;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    }

    if (state === "cheer") {
      cheerT += dt;
      if (cheerT > 0.95) newRound();
    }

    requestAnimationFrame(frame);
  }

  resize();
  newRound();
  requestAnimationFrame(frame);
})();
