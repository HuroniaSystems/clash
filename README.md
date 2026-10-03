# Clash of Villages

A Clash of Clans style village builder and battle game that runs in the browser. Three.js renders the 3D world from an isometric camera. All models, textures, sound effects and music are generated in code, so the game ships no art or audio assets.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
npm test         # economy + battle simulation tests
```

Progress saves to `localStorage` every few seconds. Time keeps passing while you are away: builds, training, research and resource production all catch up (up to 8 hours) when you return.

## Features

**Village**
- A 44x44 tile map. Drag to pan, scroll or pinch to zoom.
- Gold, elixir and gems. Collect from mines and collectors by tapping the bubbles. Storages and the Town Hall set the caps.
- 15 building types: Town Hall, Gold Mine, Elixir Collector, both storages, House, Builder's Hut, Barracks, Army Camp, Laboratory, Cannon, Archer Tower, Mortar, Air Defense, Wizard Tower and Walls.
- Builder huts limit how many builds run at once. Finish early with gems, or cancel for a 50% refund.
- Move any building. Walls keep placing in a line.
- Clear trees and rocks to find gems.

**Villagers**
- Villagers move in while you have free housing. Each has a name, a look, a level and a skill: Mining, Alchemy, Building, Leadership, Scholarship or Combat.
- Tap a villager in the world, or open the Villagers panel, to see their level, XP and job.
- Assign jobs at buildings:

  | Job | Building | Effect |
  | --- | --- | --- |
  | Miner | Gold Mine | Gold production |
  | Alchemist | Elixir Collector | Elixir production |
  | Mason | Builder's Hut | Build speed |
  | Drill Sergeant | Barracks | Training speed |
  | Captain | Army Camp | Troop damage in attacks |
  | Scholar | Laboratory | Research speed |
  | Gunner / Lookout | Defenses | Defense damage |
  | Clerk | Town Hall | Passive gold |

- Villagers earn XP while they work and level up to 10. A skill match gives 1.5x the bonus. Workers walk to their building and work there, wearing a hat colored by their job.

**Army**
- 8 troops: Barbarian, Archer, Giant, Goblin, Wall Breaker, Balloon, Wizard and Dragon. Barracks levels unlock them, and the Laboratory upgrades them up to level 6.
- Trained troops wait around the Army Camp fires.

**Battles**
- Find a Match generates a rival village sized to your Town Hall, with walls, defenses and loot.
- Scout for 30 seconds or press Next. Then tap or hold outside the red zone to deploy.
- Troops use A* pathfinding. They break through walls when that is faster. Giants and Balloons target defenses, Goblins target resources, and Wall Breakers blow up walls.
- Defenses track and lead their targets. Mortars have a blind spot. Air Defense only hits flying units.
- You earn stars (50%, Town Hall, 100%), loot that scales with the damage you do, trophies and gems.
- From Town Hall 2, raiders attack your village. Watch the defense live or let it resolve on its own. Shields protect you after a heavy loss.

**Art**
- Every building changes look as it levels: wood becomes stone, then gains towers, banners and gold trim.
- Stone, brick, plank, shingle, thatch and cobble textures are drawn on canvases at startup and mapped onto the models.
- Low and recessed surfaces get baked shading, and each building casts a soft contact shadow.

**Audio**
- Web Audio synthesis with no sound files:
  - UI: bubbly button pops, panel swooshes and error buzzes.
  - Village: coin and elixir collection jingles, hammering, completion fanfares and villager greetings.
  - Battle: swords, arrows, cannon booms, mortar whistles, rockets, magic zaps, crumbling buildings, a war horn, star chimes and victory/defeat stingers. Each is panned by where it happens on screen.
  - Music: a lute-and-flute village theme and a drum-driven battle theme, plus birdsong in the village.
- The speaker button mutes everything. Settings (tap your name) has music and effects volume sliders.

## Code layout

```
src/data/       building, troop and name tables
src/core/       pure game rules (economy, villagers, army, raids, save state)
src/battle/     battle simulation, A* pathfinding, enemy village generator
src/render/     Three.js engine, terrain, textures, building + character models, views
src/audio/      Web Audio synths, sound effect recipes, music sequencer
src/ui/         HUD, action bar, modals (DOM + CSS)
test/           Vitest tests for rules and simulation
```

The simulation in `src/battle/sim.js` has no rendering code, so tests and offline raids run it headless.
