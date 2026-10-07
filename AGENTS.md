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
