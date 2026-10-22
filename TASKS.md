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
- 2026-10-22 — New game: **Crazy Traffic** (#20; Juan's spec, the Race redo done right). You're at the bottom, traffic falls toward you; ~38% of cars ricochet off the road edges. One-finger floating stick (floats to the finger — either hand): drag sideways to steer, up = faster, down = slower, release settles to cruise. Funny obstacles: oil slick + banana (spin-outs), unicorn + chicken crossings (they leap away), beach ball (boings off), a PLANE that drives down the road (L3+), star blaster pickup (L2+, auto-zaps the car ahead). Traffic cars carry pizza stacks, surfboards, trees, gifts, balloons, ice cream. 5 levels, a NEW CAR each level (convertible → pickup → taxi → hot rod → rainbow rocket), distance bar to the checkered flag. Crashes knock the other car off the road and spin you out ~1s — miles never lost. 51/51 tests. 20 games live, 30 to go toward 50.
- 2026-10-05 — New game: Miss Munch (his pick: a Ms. Pac-Man-like with an original name). Swipe anywhere to steer — one interaction, either hand. 5 hand-designed mazes (flood-fill validated: every dot reachable), 4 monsters per level with new palettes and faster speeds each level, power pellets, fruit, 3 shields, score count-up. Beat all 5 for the big-surprise finale: fireworks, a two-octave fanfare, spinning star monsters, rainbow wash. 79/79 node logic + render tests pass. 13 games live, 37 to go toward 50.
- 2026-10-05 — Catalog now sorted newest → oldest (his call): GAMES array reversed (home-page featured 3 are the newest), games.html JSON-LD positions renumbered to match. Repo AGENTS.md: new games go at the FRONT of GAMES.
- 2026-10-05 — Blitz terrain upgrade (his tweaks): rolling hills (bases nestle into valleys, harder to hit), concrete bunkers needing 3 bomb hits with progressive damage stages (cracks → crumbling → destroyed), more common on later levels; square dots on HUD + minimap mark bunkers. 38/38 node tests pass.
- 2026-10-04 (night) — New game: Time Wings (his bedtime blank-check: a simple Time Pilot, original name). Drag anywhere to steer, plane auto-fires — one interaction, either hand. 4 eras — 1910 (sepia biplanes), 1940 (warplanes that shoot back), 1970 (weaving jets), 1983 (space, UFOs) — each era's year shown as big digits (no reading needed), quota of enemies then a boss ship with a health bar; beat all 4 for the TIME MASTER win. Star pickups (+250), score count-up, 3 shields, confetti celebrations. 27/27 node logic tests pass. 12 games live, 38 to go toward 50.
- 2026-10-04 — Blitz upgrades + global UI cleanup (his call): removed the mute/sound button from all 11 games (sound always on; device volume is the control), enlarged the back button (84px, chunkier border). Blitz: R2-D2-style power-down wail on plane-on-plane crashes, Sopwith-style whole-field minimap strip at bottom center, 5 levels (6→10 bases, faster/darker enemy planes each level, weather sunny→cloud→wind→rain→storm with matching sound beds, rain, and lightning+thunder). 30/30 node logic tests pass.
- 2026-10-04 — Blitz silent-audio fix: root cause was iOS permanently suspending an AudioContext created before the first user gesture (blitz's engine putt-putt created it on frame 1; later resume() calls can't revive it). chiptune.js now defers context creation until the first tap (pointerdown/touchend unlock + silent-buffer warm-up); tone()/noise() stay silent pre-gesture. Verified live.
- 2026-10-04 — Forced-refresh fix, part 2: his iPhone kept serving the old games.js from its week-long cache without asking the server. Committed `?v=` stamps on all CSS/JS URLs (new `tools/stamp-assets.sh`, run before deploy pushes) so browsers see new URLs and must fetch fresh; verified live.
- 2026-10-04 — Cache rules fixed: HTML `no-store`, CSS/JS/images `no-cache, must-revalidate` (Git deploys carry no ?v= stamps, so week-long caching was serving stale files). Verified live via response headers.
- 2026-10-04 — New game: Biplane Blitz (Sopwith-style: touch above/below plane to climb/dive, mirrored FIRE + BOMB buttons both sides, 6 bases, 3 shields). 11 games live.
- 2026-10-03 — Repo created; site source of truth moved to GitHub (private).
