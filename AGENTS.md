# AGENTS.md — smoothdaddyg.com contributor notes

How we work on this site. Both human developers and their agents follow this.

## Workflow
- `main` is always deployable and always matches what's live on smoothdaddyg.com.
- New work happens on feature branches (`game/<name>`, `fix/<thing>`), merged via
  pull request. No direct pushes to `main`.
- Coordinate in `TASKS.md` before touching shared files:
  `js/chiptune.js`, `js/main.js`, `js/games.js`, this file.
- Deploys go through Hostinger's Git deploy (auto-deploy on push to `main` via
  webhook). Because Git deploys serve files exactly as committed, browsers are
  cache-busted with committed `?v=` stamps: run `tools/stamp-assets.sh` before
  pushing any deploy that changes CSS, JS, or game code. The `.htaccess`
  backs this up (HTML `no-store`; CSS/JS/images `no-cache, must-revalidate`).
- The old manual zip path (`tools/stamp.sh`, stamp-a-copy) is retired unless
  Git deploy breaks.

## Adding a game
- New game lives in `games/<id>/` with `index.html` + `game.js`.
- Register it in the `GAMES` array in `js/games.js` (id, title, blurb) —
  PREPEND it to the FRONT of the array (catalog renders newest → oldest),
  and renumber the JSON-LD `position` entries in `games.html` to match.
- Cover art at `games/<id>/cover.webp` (1970s cartridge-box style). The catalog
  card auto-wires it from the game id and shows it full-bleed (no sprite
  overlay — removed 2026-10-07 per studio direction; cards are cover art only).
- Add the game URL to `sitemap.xml` and the JSON-LD block in `games.html`.
- Shared audio: `js/chiptune.js`. Play counting: `js/plays.js` (already loaded
  on game pages — call it per its usage in existing games).

## Design rules (non-negotiable)
- No reading required. One obvious interaction. Immediate feedback. Forgiving.
- iPad-first, touch controls. Mirrored controls — the same control must work
  from either side, for either hand.
- Age-respectful, never childish. No ads, no in-app purchases.
- Every game needs a reward or something learned (visible progress, something
  earned). Simplicity alone is not enough — but mechanics stay simple enough
  to pick up instantly.
- Public brand: professional, cool, retro, big-company feel. Never mention
  family, kids, dads, or "Our Story" anywhere on the site.
- Mazes: no big open areas — every pathway must have walls on both sides —
  and walls are exactly one block thick (Miss Munch rule, 2026-10-10).
- No game over from dying, ever. When the player dies, they get recreated
  (respawn) and continue with progress intact (score, level, items kept).
  Death should pause the game or break momentum briefly (~1-2s), but the
  player never starts over and never sees a "game over" screen.
- Background music: every game gets a music loop (Juan, 2026-10-22:
  "video games need background music"). Keep it under the sound effects.
  The sound is 8-bit/16-bit arcade chiptune (Juan, 2026-10-29 — the
  funk/hip-hop loops "are not working"): square-wave lead, triangle
  bass, noise drums, fast arpeggios. Compose it in-house — original,
  free, no attribution owed to anyone. Never ship a downloaded or
  licensed track, and never use an AI generator's "royalty-free"
  output (plan-rights caveats fail the clean bar).
  2026-10-30 refinement (his verdict on Crazy Traffic: "good," with
  more bass and more funk): the bass is a LOUD syncopated triangle
  line (vol 0.2, 16th-note off-beat root/octave/fifth pops) and the
  drums are a funk groove (kick on 1 and 3 + a ghost kick into the
  next bar, snare on 2 and 4). Shared makeMusic supports div (steps
  per beat, 4 = 16ths) and explicit kicks[]/snares[] arrays.
- Pace: levels run short and surprises come often — short attention
  spans, keep it moving, keep something unexpected happening
  (Crazy Traffic, 2026-10-29: every level max ~30s at cruise).
  His 2026-10-30 verdict: faster levels make players stick with the
  game longer. Applied 2026-10-30: Blitz 5–9 bases (was 6–10), Sink
  the Ship 4/5/6 goals (was 5/6/7), Time Wings quotas 8/10/12/14
  (was 10/12/14/16) and smaller bosses, Passing Frenzy first to 7
  (was 10 — his spec, changed under the fast-levels direction),
  Frisbee Dog snappier rounds (resolve 0.7s, jog 330 px/s).
  Miss Munch deliberately untouched: its calm pace is tuned for his
  daughter. Tag, Star Guard, and the toys have no levels to quicken.
- Escalation: every level gets CRAZIER, not just harder — each level
  adds something new to see or tell a friend about (his 2026-10-30
  bar: the player should go "that's insane / that's crazy"). Already
  true for most level games — Crazy Traffic: a new car + new
  surprises each level; Sink the Ship: mines L2, subs + planes L3;
  Time Wings: a new era each level; Blitz: new weather each level;
  Miss Munch: a new maze + faster monsters each level. The flat one
  was Passing Frenzy (levels differed only in counts/speed), so L3
  is now the championship: gold ball + double confetti + a
  center-court explosion on every goal.
- Controls must never hide the action under the player's thumb: put the
  control in its own zone (e.g. a deck at the bottom) with the play
  field above it (Time Wings rule 2026-10-19, Crazy Traffic 2026-10-22).

## Deploy checklist (manual zip path)
- Build from a COPY of the source (never stamp the source tree): use
  `tools/stamp.sh <src> <dest>` which stamps `?v=YYYYMMDDHHMM` into css/js
  links and builds the zip.
- The zip MUST contain `.htaccess` (cache rules) — verify with
  `unzip -l <zip> | grep htaccess` before uploading.
- Upload to `public_html`, extract with overwrite, confirm `.htaccess` is
  visible, set 755 on `css/`, `js/`, `games/` and each `games/<id>/`
  subdirectory, delete the zip, verify the live page renders with the new
  version stamp.
