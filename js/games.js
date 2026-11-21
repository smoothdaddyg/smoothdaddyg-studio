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
     category  slug from CATEGORIES below — every game has one
   ------------------------------------------------------------
   Categories (cool names, no plain genre words):
     smart       "Smart Games" — the worksheet games (money, time,
                 numbers). Danny's name: say it with pride.
     blast       "Blast Zone" — shoot, dodge, drive, chase.
     gameday     "Game Day" — sports.
     chill       "Chill Zone" — calm toys and colouring.
     playground  "Playground" — tag, dance, dress-up.
   ------------------------------------------------------------
   Design rules for every game (from the studio brief):
   - No reading required inside the game. Show, don't explain.
   - One obvious interaction: tap / drag / swipe.
   - Every tap gives immediate feedback (animation + sound).
   - Forgiving: no timers, no game-over, no lost progress.
   - Age-respectful arcade visuals. No ads. No purchases.
   - iPad-first: big touch targets, touch-action safe.
   ============================================================ */

/* Category display names, in chip order. */
const CATEGORIES = {
  smart: { name: "Smart Games", hue: 140 },
  blast: { name: "Blast Zone", hue: 15 },
  gameday: { name: "Game Day", hue: 120 },
  chill: { name: "Chill Zone", hue: 265 },
  playground: { name: "Playground", hue: 315 },
};

const GAMES = [
  { id: "bigger", title: "Bigger!", desc: "Two big numbers — tap the bigger one! Or the smaller one, when the arrow says so!",
    hue: 55, sprite: "gem", url: "games/bigger/", category: "smart" },
  { id: "pricecheck", title: "Price Check", desc: "Two treats, two prices — tap the one that costs more… or less! Watch the arrow!",
    hue: 45, sprite: "coin", url: "games/pricecheck/", category: "smart" },
  { id: "clockwork", title: "Clockwork", desc: "What time is it? Tap the clock that matches, sort morning and night, and figure out when the cupcakes are done!",
    hue: 200, sprite: "gem", url: "games/clockwork/", category: "smart" },
  { id: "dollarup", title: "Dollar Up!", desc: "Dollar up to $5! Four things to buy, four bills to spend — figure out which bill buys which thing so you can buy them all!",
    hue: 140, sprite: "gem", url: "games/dollarup/", category: "smart" },
  { id: "touchdown", title: "Touchdown!", desc: "Drive 100 yards to the goal! Drag in the bottom deck to run your quarterback, tap PASS to throw to an open receiver, or hand it off — tackle, line up, and go again until you score!",
    hue: 120, sprite: "ball", url: "games/touchdown/", category: "gameday" },
  { id: "tankwar", title: "Tank War", desc: "Drive your tank with two levers — both up to go forward, one up and one down to turn! Hide behind rocks and trees, then blast the enemy tanks in 3 levels!",
    hue: 130, sprite: "gem", url: "games/tankwar/", category: "blast" },
  { id: "coloringbook", title: "Coloring Book", desc: "Color cool pictures with your crayon box — a unicorn, a rocket, a spaceship, a satellite, a flower and a cat! Pick a crayon and scribble back and forth, just like a real crayon!",
    hue: 45, sprite: "gem", url: "games/coloringbook/", category: "chill" },
  { id: "unicornjoust", title: "Unicorn Joust", desc: "Ride a unicorn and joust weird riders — flying pigs, a dragon, robot chickens and a space llama! Whoever is higher wins!",
    hue: 300, sprite: "gem", url: "games/unicornjoust/", category: "blast" },
  { id: "vaultblaster", title: "Vault Blaster", desc: "Top-down adventure! Collect coloured keys to open doors, grab better guns, and blast through 5 vaults to the finale!",
    hue: 280, sprite: "gem", url: "games/vaultblaster/", category: "blast" },
  { id: "crazytraffic", title: "Crazy Traffic", desc: "Weave through traffic! One finger steers and speeds — dodge bouncing cars, unicorns, and even a plane. A new car every level!",
    hue: 20, sprite: "car", url: "games/crazytraffic/", category: "blast" },
  { id: "sinktheship", title: "Sink the Ship!", desc: "You're the submarine! Drag to steer, torpedoes fire themselves — sink every ship in 3 levels!",
    hue: 160, sprite: "plane", url: "games/sinktheship/", category: "blast" },
  { id: "tag", title: "Tag! You're It", desc: "You're it! Drag to chase five giggling friends around the playground and tag them all!",
    hue: 95, sprite: "gem", url: "games/tag/", category: "playground" },
  { id: "frisbeedog", title: "Frisbee Dog", desc: "Lead the running dog — throw the frisbee ahead of him and watch him sprint to catch it!",
    hue: 35, sprite: "ball", url: "games/frisbeedog/", category: "gameday" },
  { id: "passingfrenzy", title: "Passing Frenzy", desc: "Tap to pass the basketball. Lead your teammates, dodge interceptions, score 10 to win!",
    hue: 200, sprite: "ball", url: "games/passingfrenzy/", category: "gameday" },
  { id: "glamhair", title: "Glam Hair", desc: "Brush, curl, dye and style her hair — then lipstick, blush and bows!",
    hue: 315, sprite: "ball", url: "games/glamhair/", category: "playground" },
  { id: "dancejudge", title: "Dance Judge", desc: "Watch three silly couples dance, then score them 1-10 like a real judge!",
    hue: 315, sprite: "ball", url: "games/dancejudge/", category: "playground" },
  {
    id: "missmunch",
    title: "Miss Munch",
    desc: "Swipe to steer. Gobble every dot, dodge the monsters.",
    hue: 55,
    sprite: "ball",
    url: "games/missmunch/",
    category: "blast",
  },
  {
    id: "timewings",
    title: "Time Wings",
    desc: "Drag to steer through four eras of sky.",
    hue: 265,
    sprite: "plane",
    url: "games/timewings/",
    category: "blast",
  },
  {
    id: "blitz",
    title: "Biplane Blitz",
    desc: "Climb, dive, bomb the bases.",
    hue: 15,
    sprite: "plane",
    url: "games/blitz/",
    category: "blast",
  },
  {
    id: "starguard",
    title: "Star Guard",
    desc: "Drag to steer. Blast the invaders.",
    hue: 190,
    sprite: "invader",
    url: "games/starguard/",
    category: "blast",
  },
  {
    id: "orbit",
    title: "Orbit",
    desc: "Tap to launch a comet. Every orbit sings.",
    hue: 230,
    sprite: "ball",
    url: "games/orbit/",
    category: "chill",
  },
  {
    id: "grow",
    title: "Grow",
    desc: "Tap to grow a flower.",
    hue: 100,
    sprite: "rock",
    url: "games/grow/",
    category: "chill",
  },
  {
    id: "drum",
    title: "Drum",
    desc: "Tap the beat pads.",
    hue: 210,
    sprite: "coin",
    url: "games/drum/",
    category: "chill",
  },
  {
    id: "chase",
    title: "Chase",
    desc: "Chase the hopping star.",
    hue: 15,
    sprite: "invader",
    url: "games/chase/",
    category: "chill",
  },
  {
    id: "splash",
    title: "Splash",
    desc: "Tap anywhere, make splats.",
    hue: 265,
    sprite: "ball",
    url: "games/splash/",
    category: "chill",
  },
  {
    id: "catch",
    title: "Catch",
    desc: "Catch the falling stars.",
    hue: 150,
    sprite: "gem",
    url: "games/catch/",
    category: "chill",
  },
  {
    id: "count",
    title: "Count",
    desc: "Tap every asteroid and watch the number grow.",
    hue: 45,
    sprite: "rock",
    url: "games/count/",
    category: "chill",
  },
  {
    id: "match",
    title: "Match",
    desc: "See the shape up top? Find the same one below.",
    hue: 190,
    sprite: "gem",
    url: "games/match/",
    category: "chill",
  },
  {
    id: "pop",
    title: "Pop",
    desc: "Colorful orbs float by. Tap them — they burst. Pure fun.",
    hue: 315,
    sprite: "ball",
    url: "games/pop/",
    category: "chill",
  },
];
