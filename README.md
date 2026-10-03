# Clash of Villages

A Clash of Clans style village builder and battle game that runs in the browser. Three.js renders the 3D world from an isometric camera. All models are generated in code as chunky low-poly medieval pieces, so the game ships no art assets.

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

## Code layout

```
src/data/       building, troop and name tables
src/core/       pure game rules (economy, villagers, army, raids, save state)
src/battle/     battle simulation, A* pathfinding, enemy village generator
src/render/     Three.js engine, terrain, procedural models, village + battle views
src/ui/         HUD, action bar, modals (DOM + CSS)
test/           Vitest tests for rules and simulation
```

The simulation in `src/battle/sim.js` has no rendering code, so tests and offline raids run it headless.
