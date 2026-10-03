/* ============================================================
   Pixel numerals for canvas — 3x5 dot-matrix digits, zero assets.
   Used for scores and counts so games need no text rendering
   and no webfont loading. Draws 0-9.
   ============================================================ */

const PIXEL_DIGITS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

/* Draw a number centered at (cx, y=top). px = pixel size. */
function drawPixelNumber(ctx, n, cx, y, px, color, glow) {
  const s = String(n);
  const dw = 4 * px; // 3px digit + 1px gap
  const totalW = s.length * dw - px;
  let x = cx - totalW / 2;
  ctx.save();
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = px * 2.5;
  }
  for (const ch of s) {
    const g = PIXEL_DIGITS[ch];
    if (g) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (g[r][c] === "1") {
            ctx.fillRect(x + c * px, y + r * px, px, px);
          }
        }
      }
    }
    x += dw;
  }
  ctx.restore();
}

/* Width in px of a number rendered at pixel size px (for layout). */
function pixelNumberWidth(n, px) {
  return String(n).length * 4 * px - px;
}
