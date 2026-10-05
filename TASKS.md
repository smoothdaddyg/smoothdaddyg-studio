# TASKS.md — SmoothDaddyG coordination board

Whoever picks up a task: move it from **Up next** to **In progress** with your
name, do the work on a feature branch, open a PR, and move it to **Done** when
the PR merges and the deploy is verified live. One task per person at a time
on shared files (`js/chiptune.js`, `js/main.js`, `js/games.js`, `AGENTS.md`).

## In progress
- (none)

## Up next
- (add tasks here)

## Done
- 2026-10-04 (night) — New game: Time Wings (his bedtime blank-check: a simple Time Pilot, original name). Drag anywhere to steer, plane auto-fires — one interaction, either hand. 4 eras — 1910 (sepia biplanes), 1940 (warplanes that shoot back), 1970 (weaving jets), 1983 (space, UFOs) — each era's year shown as big digits (no reading needed), quota of enemies then a boss ship with a health bar; beat all 4 for the TIME MASTER win. Star pickups (+250), score count-up, 3 shields, confetti celebrations. 27/27 node logic tests pass. 12 games live, 38 to go toward 50.
- 2026-10-04 — Blitz upgrades + global UI cleanup (his call): removed the mute/sound button from all 11 games (sound always on; device volume is the control), enlarged the back button (84px, chunkier border). Blitz: R2-D2-style power-down wail on plane-on-plane crashes, Sopwith-style whole-field minimap strip at bottom center, 5 levels (6→10 bases, faster/darker enemy planes each level, weather sunny→cloud→wind→rain→storm with matching sound beds, rain, and lightning+thunder). 30/30 node logic tests pass.
- 2026-10-04 — Blitz silent-audio fix: root cause was iOS permanently suspending an AudioContext created before the first user gesture (blitz's engine putt-putt created it on frame 1; later resume() calls can't revive it). chiptune.js now defers context creation until the first tap (pointerdown/touchend unlock + silent-buffer warm-up); tone()/noise() stay silent pre-gesture. Verified live.
- 2026-10-04 — Forced-refresh fix, part 2: his iPhone kept serving the old games.js from its week-long cache without asking the server. Committed `?v=` stamps on all CSS/JS URLs (new `tools/stamp-assets.sh`, run before deploy pushes) so browsers see new URLs and must fetch fresh; verified live.
- 2026-10-04 — Cache rules fixed: HTML `no-store`, CSS/JS/images `no-cache, must-revalidate` (Git deploys carry no ?v= stamps, so week-long caching was serving stale files). Verified live via response headers.
- 2026-10-04 — New game: Biplane Blitz (Sopwith-style: touch above/below plane to climb/dive, mirrored FIRE + BOMB buttons both sides, 6 bases, 3 shields). 11 games live.
- 2026-10-03 — Repo created; site source of truth moved to GitHub (private).
