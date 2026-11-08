# Boing! 🟣

A bouncy-ball platformer for the browser. You're a purple blob that never stops bouncing — run, hop, jump and swim through 8 levels, collect rings, stomp grumpy spike-balls and reach the portal. Plain HTML/CSS/JavaScript (ES modules) on a `<canvas>`. No build step, no dependencies.

## Run it

ES modules + `fetch()` need a web server (not `file://`):

```bash
python3 -m http.server 8000      # → http://localhost:8000
# or: npm start   /   npx serve   /   VS Code "Live Server"
```

Handy URL flags: `?level=5` jump straight into a level · `&unlock` unlock all levels · `&touch` force touch controls.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Move | ← → / A D | on-screen ◀ ▶ |
| Jump | ↑ / W / Space | on-screen ▲ |
| Pause | Esc / P | ❚❚ button |
| Restart level | R | pause menu |

The ball bounces on its own. **Tap or hold jump as you land** (or just before) for a full jump; otherwise you do small hops. Jump again right after a hop to upgrade it.

## What's in the game

- **Rings** – collect them all for ★2. **Par time** gives ★3. Finishing gives ★1.
- **Spikes** – pop you. **Walkers** – stomp them from above, touch them from the side and you pop.
- **Spring pads**, **one-way platforms**, **moving platforms**, **crumbling blocks** (they fall, then regrow), **water** (floaty swimming), **checkpoints**, **hearts** (+1 life).
- Difficulty sets lives: Easy 5 · Normal 3 · Hard 2. Progress, stars and settings are saved in `localStorage`.

## Project layout

```
index.html
css/style.css
js/
  main.js              screen flow, HUD, results, pause, settings
  config & constants   js/sim/constants.js  ← all physics/feel numbers live here
  sim/                 DOM-free simulation (runs in Node too)
    world.js           ball physics, collisions, enemies, pickups, rules
    level.js           level parser
  game/
    session.js         fixed-timestep loop, event routing, scoring
    input.js           keyboard + touch
  render/
    renderer.js        camera, shake, draw order
    atlas.js           pre-rendered tile art    themes.js  palettes
    background.js      parallax scenery         sprites.js  hero/enemy/pickups
    particles.js       effects                  menuBackground.js  animated menu scene
  ui/
    sfx.js             synthesized sound effects (WebAudio)
    music.js           procedural chiptune music (menu + game loops)
    transitions.js     canvas screen transitions (stripes, iris)
    storage.js         save data
levels/                level01.json … level08.json + index.json
tools/
  build-levels.mjs     levels are drawn with a tiny script → JSON
  verify.mjs           a bot plays every level to prove it's beatable
assets/fonts/           only the two fonts — everything else is generated in code
```

## Making levels

Edit `tools/build-levels.mjs` (draw with `g.ground()`, `g.rings()`, `g.spikes()`, `g.mover()` …) then:

```bash
npm run levels     # regenerate levels/*.json
npm run verify     # beam-search bot plays them; fails if a level can't be finished
                   # and warns about rings it can't reach
```

Or write the JSON by hand — the map legend is at the top of `js/sim/level.js`. Add new levels to `tools/build-levels.mjs` so `index.json` is regenerated.

Rule of thumb from the physics: a full jump clears **~3 tiles up** and **~4 tiles across** (use 2-tile steps and ≤3-tile gaps for fair levels; springs launch ~6.5 tiles).

## Credits & licences

Team: UI/UX — Fahim · Game logic — Tamzid · Level design — Prithul · Infra — Shahriar.
Fonts: Tsuchigumo, ByteBounce (licences in `assets/fonts/licenses/`). All sprites, music, sound effects, transitions and backgrounds are generated in code; the character and levels are original.
