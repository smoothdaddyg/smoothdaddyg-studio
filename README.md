# SmoothDaddyG — Independent Software Development Studio

Static website for **smoothdaddyg.com**. No build step, no dependencies, no backend.
Just open it or upload it.

## Preview locally

```bash
cd ~/workspace/smoothdaddyg-studio
python3 -m http.server 8080
```

Then open **http://localhost:8080** in a browser (works great on iPad via your
computer's local address, e.g. `http://192.168.1.10:8080`).

## Site structure

```
index.html          Home — hero, insert-coin motif, featured games
games.html          Game library — large cards, big PLAY buttons
about.html          About — the studio and its broader mission
css/style.css       All styling: neon arcade theme, CRT scanlines,
                    pixel display type, press-start buttons
js/games.js         ★ THE GAME CATALOG — add a game with one entry
js/main.js          Site JS: pixel-sprite renderer, card rendering, nav
js/chiptune.js      Shared WebAudio chiptune synth (zero assets)
js/pixelnum.js      Shared 3x5 pixel numerals for canvas (zero assets)
games/pop/          POP — tap the floating orbs (endless, relaxing)
games/match/        MATCH — visual matching, adaptive 2→3 choices
games/count/        COUNT — tap asteroids, adaptive 1→5
```

## Adding a new game

1. Create `games/<slug>/index.html` + `games/<slug>/game.js`.
   Copy `games/pop/index.html` as a starting template — it already wires up
   the canvas, back button, mute button, chiptune synth, and pixel numerals.
2. Add one entry to the `GAMES` array at the top of `js/games.js`
   (the file documents the exact fields).
3. Done — Home and the Games library render it automatically.

### Game design rules (house rules — not optional)

- **No reading required.** Show with pictures, animation, and sound.
- **One obvious interaction:** tap / drag / swipe. Nothing else.
- **Immediate feedback:** every tap → animation + sound.
- **Forgiving:** no timers, no game-over, no lost progress.
- **Age-respectful:** cool arcade visuals, never preschool-baby.
- **No ads, no in-app purchases, no pop-ups**, no external links in games.
- **iPad-first:** touch targets ≥ 88px, `touch-action: none` on canvas.
- **Adaptive difficulty** where sensible — quietly, never a menu.

## Deploy to Hostinger

1. Log in to **hPanel** → **Websites** → select smoothdaddyg.com.
2. Open **File Manager** → go to `public_html`.
3. Delete (or back up) the old site files in `public_html`.
4. Upload **the contents** of this folder (not the folder itself) into
   `public_html` — so `index.html` sits directly inside `public_html`.
   Keep the relative structure: `css/`, `js/`, `games/` alongside it.
5. Visit smoothdaddyg.com to verify. No build, no config, no database.

Tip: upload as a zip via File Manager's **Upload** button, then
**Extract** it inside `public_html` — fastest for many files.
