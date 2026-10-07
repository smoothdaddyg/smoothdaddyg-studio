/* ============================================================
   SmoothDaddyG — Game Catalog
   ------------------------------------------------------------
   HOW TO ADD A GAME:
   1. Build the game in its own folder:  games/<slug>/index.html
      (the folder's index.html is the playable game page).
   2. Add ONE entry to the GAMES array below. That's it — the
      home page and the games library render automatically.
   ------------------------------------------------------------
   Entry fields:
     id      unique short name, e.g. "pop"
     title   display name, e.g. "Pop"
     desc    one very short line, no reading level required
             (this is site copy, not in-game text)
     hue     0-360, neon color used for the card artwork
     sprite  pixel-art key from SPRITES in js/main.js
             (add new sprite maps there if you need one)
     url     path to the playable game, e.g. "games/pop/"
   ------------------------------------------------------------
   Design rules for every game (from the studio brief):
   - No reading required inside the game. Show, don't explain.
   - One obvious interaction: tap / drag / swipe.
   - Every tap gives immediate feedback (animation + sound).
   - Forgiving: no timers, no game-over, no lost progress.
   - Age-respectful arcade visuals. No ads. No purchases.
   - iPad-first: big touch targets, touch-action safe.
   ============================================================ */

const GAMES = [
  { id: "dancejudge", title: "Dance Judge", desc: "Watch three silly couples dance, then score them 1-10 like a real judge!" },
  {
    id: "missmunch",
    title: "Miss Munch",
    desc: "Swipe to steer. Gobble every dot, dodge the monsters.",
    hue: 55,
    sprite: "ball",
    url: "games/missmunch/",
  },
  {
    id: "timewings",
    title: "Time Wings",
    desc: "Drag to steer through four eras of sky.",
    hue: 265,
    sprite: "plane",
    url: "games/timewings/",
  },
  {
    id: "blitz",
    title: "Biplane Blitz",
    desc: "Climb, dive, bomb the bases.",
    hue: 15,
    sprite: "plane",
    url: "games/blitz/",
  },
  {
    id: "starguard",
    title: "Star Guard",
    desc: "Drag to steer. Blast the invaders.",
    hue: 190,
    sprite: "invader",
    url: "games/starguard/",
  },
  {
    id: "orbit",
    title: "Orbit",
    desc: "Tap to launch a comet. Every orbit sings.",
    hue: 230,
    sprite: "ball",
    url: "games/orbit/",
  },
  {
    id: "grow",
    title: "Grow",
    desc: "Tap to grow a flower.",
    hue: 100,
    sprite: "rock",
    url: "games/grow/",
  },
  {
    id: "drum",
    title: "Drum",
    desc: "Tap the beat pads.",
    hue: 210,
    sprite: "coin",
    url: "games/drum/",
  },
  {
    id: "chase",
    title: "Chase",
    desc: "Chase the hopping star.",
    hue: 15,
    sprite: "invader",
    url: "games/chase/",
  },
  {
    id: "splash",
    title: "Splash",
    desc: "Tap anywhere, make splats.",
    hue: 265,
    sprite: "ball",
    url: "games/splash/",
  },
  {
    id: "catch",
    title: "Catch",
    desc: "Catch the falling stars.",
    hue: 150,
    sprite: "gem",
    url: "games/catch/",
  },
  {
    id: "count",
    title: "Count",
    desc: "Tap every asteroid and watch the number grow.",
    hue: 45,
    sprite: "rock",
    url: "games/count/",
  },
  {
    id: "match",
    title: "Match",
    desc: "See the shape up top? Find the same one below.",
    hue: 190,
    sprite: "gem",
    url: "games/match/",
  },
  {
    id: "pop",
    title: "Pop",
    desc: "Colorful orbs float by. Tap them — they burst. Pure fun.",
    hue: 315,
    sprite: "ball",
    url: "games/pop/",
  },
];
