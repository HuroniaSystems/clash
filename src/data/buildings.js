// Static building definitions. Arrays inside `levels` are indexed by level - 1.
// `maxCount` is indexed by Town Hall level - 1.

export const GRID = 44;
export const BUILD_MARGIN = 2; // tiles at the map edge where nothing can be built
export const MAX_TH = 6;

function levels(spec) {
  const n = spec.th.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const lv = {};
    for (const [k, v] of Object.entries(spec)) {
      if (k === 'costRes') continue;
      lv[k] = Array.isArray(v) ? v[i] : v;
    }
    lv.cost = { [spec.costRes]: spec.cost[i] };
    out.push(lv);
  }
  return out;
}

export const BUILDINGS = {
  townhall: {
    name: 'Town Hall',
    size: 4,
    category: 'economy',
    desc: 'The heart of your village. Upgrading it unlocks new buildings and higher levels.',
    maxCount: [1, 1, 1, 1, 1, 1],
    job: { role: 'Clerk', skill: 'scholarship', max: 3, effect: 'Collects taxes (passive gold)' },
    levels: levels({
      th: [0, 1, 2, 3, 4, 5],
      costRes: 'gold',
      cost: [0, 1000, 4000, 15000, 50000, 150000],
      time: [0, 30, 90, 240, 480, 900],
      hp: [1500, 1800, 2200, 2700, 3300, 4000],
      storeGold: [1000, 2500, 5000, 10000, 20000, 40000],
      storeElixir: [1000, 2500, 5000, 10000, 20000, 40000],
      tax: [2, 4, 7, 11, 16, 22], // gold per minute per clerk-equivalent
    }),
  },
  goldmine: {
    name: 'Gold Mine',
    size: 3,
    category: 'economy',
    resource: 'gold',
    desc: 'Digs gold out of the ground. Assign Miners to dig faster.',
    maxCount: [1, 2, 3, 4, 5, 6],
    job: { role: 'Miner', skill: 'mining', max: 3, effect: 'Increases gold production' },
    levels: levels({
      th: [1, 1, 2, 2, 3, 4],
      costRes: 'elixir',
      cost: [150, 300, 700, 1400, 3000, 7000],
      time: [5, 15, 45, 120, 300, 600],
      hp: [400, 440, 480, 520, 560, 600],
      rate: [20, 40, 70, 110, 160, 220], // per minute
      cap: [200, 500, 1000, 2000, 3500, 5000],
    }),
  },
  elixircollector: {
    name: 'Elixir Collector',
    size: 3,
    category: 'economy',
    resource: 'elixir',
    desc: 'Pumps elixir from the ley lines below. Alchemists improve its yield.',
    maxCount: [1, 2, 3, 4, 5, 6],
    job: { role: 'Alchemist', skill: 'alchemy', max: 3, effect: 'Increases elixir production' },
    levels: levels({
      th: [1, 1, 2, 2, 3, 4],
      costRes: 'gold',
      cost: [150, 300, 700, 1400, 3000, 7000],
      time: [5, 15, 45, 120, 300, 600],
      hp: [400, 440, 480, 520, 560, 600],
      rate: [20, 40, 70, 110, 160, 220],
      cap: [200, 500, 1000, 2000, 3500, 5000],
    }),
  },
  goldstorage: {
    name: 'Gold Storage',
    size: 3,
    category: 'economy',
    storage: 'gold',
    desc: 'Stores your gold. Upgrade to hold more.',
    maxCount: [1, 1, 2, 2, 2, 3],
    levels: levels({
      th: [1, 1, 2, 3, 4, 5, 6],
      costRes: 'elixir',
      cost: [300, 750, 1500, 3000, 6000, 12000, 25000],
      time: [10, 30, 90, 180, 360, 600, 900],
      hp: [400, 600, 800, 1000, 1200, 1500, 1650],
      cap: [1500, 3000, 6000, 12000, 25000, 45000, 100000],
    }),
  },
  elixirstorage: {
    name: 'Elixir Storage',
    size: 3,
    category: 'economy',
    storage: 'elixir',
    desc: 'Stores your elixir. Upgrade to hold more.',
    maxCount: [1, 1, 2, 2, 2, 3],
    levels: levels({
      th: [1, 1, 2, 3, 4, 5, 6],
      costRes: 'gold',
      cost: [300, 750, 1500, 3000, 6000, 12000, 25000],
      time: [10, 30, 90, 180, 360, 600, 900],
      hp: [400, 600, 800, 1000, 1200, 1500, 1650],
      cap: [1500, 3000, 6000, 12000, 25000, 45000, 100000],
    }),
  },
  house: {
    name: 'House',
    size: 2,
    category: 'village',
    desc: 'Homes for villagers. More housing attracts more villagers to your village.',
    maxCount: [2, 3, 4, 5, 6, 7],
    levels: levels({
      th: [1, 2, 3, 4, 5],
      costRes: 'gold',
      cost: [100, 500, 1500, 4000, 10000],
      time: [5, 30, 90, 240, 480],
      hp: [250, 300, 350, 400, 450],
      housing: [2, 3, 4, 5, 6],
    }),
  },
  builderhut: {
    name: "Builder's Hut",
    size: 2,
    category: 'village',
    desc: 'Each hut provides a builder. Masons working here speed up all construction.',
    maxCount: [2, 3, 3, 4, 5, 5],
    countCost: [0, 0, 2000, 8000, 30000],
    job: { role: 'Mason', skill: 'building', max: 1, effect: 'Speeds up all construction' },
    levels: [{ th: 1, cost: { gold: 0 }, time: 0, hp: 250 }],
  },
  barracks: {
    name: 'Barracks',
    size: 3,
    category: 'army',
    desc: 'Trains troops. Upgrade to unlock new troop types. Drill Sergeants train faster.',
    maxCount: [1, 1, 2, 2, 3, 3],
    job: { role: 'Drill Sergeant', skill: 'leadership', max: 2, effect: 'Speeds up troop training' },
    levels: levels({
      th: [1, 1, 2, 2, 3, 4, 5, 6],
      costRes: 'elixir',
      cost: [200, 1000, 2500, 5000, 10000, 20000, 40000, 80000],
      time: [10, 30, 90, 180, 300, 480, 720, 900],
      hp: [250, 290, 330, 370, 420, 470, 520, 580],
    }),
  },
  armycamp: {
    name: 'Army Camp',
    size: 4,
    category: 'army',
    desc: 'Houses your trained troops. Captains stationed here make troops hit harder in battle.',
    maxCount: [1, 1, 2, 2, 3, 4],
    job: { role: 'Captain', skill: 'leadership', max: 2, effect: 'Boosts troop damage in attacks' },
    levels: levels({
      th: [1, 2, 3, 4, 5],
      costRes: 'elixir',
      cost: [250, 2500, 10000, 50000, 150000],
      time: [10, 60, 240, 600, 900],
      hp: [250, 270, 290, 310, 330],
      capacity: [20, 30, 35, 40, 45],
    }),
  },
  laboratory: {
    name: 'Laboratory',
    size: 3,
    category: 'army',
    desc: 'Researches troop upgrades. Scholars speed up research.',
    maxCount: [0, 1, 1, 1, 1, 1],
    job: { role: 'Scholar', skill: 'scholarship', max: 2, effect: 'Speeds up research' },
    levels: levels({
      th: [2, 3, 4, 5, 6],
      costRes: 'elixir',
      cost: [5000, 25000, 50000, 100000, 200000],
      time: [30, 120, 300, 600, 900],
      hp: [500, 550, 600, 650, 700],
    }),
  },
  cannon: {
    name: 'Cannon',
    size: 3,
    category: 'defense',
    desc: 'Fires heavy cannonballs at ground troops.',
    maxCount: [2, 2, 2, 3, 3, 4],
    job: { role: 'Gunner', skill: 'combat', max: 1, effect: 'Increases damage when defending' },
    defense: { range: 9, minRange: 0, speed: 0.8, air: false, ground: true, splash: 0, projectile: 'ball' },
    levels: levels({
      th: [1, 1, 2, 3, 4, 5],
      costRes: 'gold',
      cost: [250, 1000, 4000, 16000, 50000, 100000],
      time: [10, 30, 120, 300, 600, 900],
      hp: [420, 470, 520, 570, 620, 670],
      dps: [9, 11, 15, 19, 25, 31],
    }),
  },
  archertower: {
    name: 'Archer Tower',
    size: 3,
    category: 'defense',
    desc: 'Long range tower that hits both air and ground targets.',
    maxCount: [0, 1, 2, 2, 3, 4],
    job: { role: 'Lookout', skill: 'combat', max: 1, effect: 'Increases damage when defending' },
    defense: { range: 10, minRange: 0, speed: 0.5, air: true, ground: true, splash: 0, projectile: 'arrow' },
    levels: levels({
      th: [2, 2, 3, 4, 5, 6],
      costRes: 'gold',
      cost: [1000, 2000, 5000, 20000, 80000, 180000],
      time: [15, 60, 180, 400, 700, 1000],
      hp: [380, 420, 460, 500, 540, 580],
      dps: [11, 15, 19, 25, 30, 35],
    }),
  },
  mortar: {
    name: 'Mortar',
    size: 3,
    category: 'defense',
    desc: 'Lobs explosive shells that deal splash damage to groups of ground troops. Has a blind spot up close.',
    maxCount: [0, 0, 1, 1, 2, 2],
    job: { role: 'Gunner', skill: 'combat', max: 1, effect: 'Increases damage when defending' },
    defense: { range: 11, minRange: 4, speed: 5, air: false, ground: true, splash: 1.5, projectile: 'shell' },
    levels: levels({
      th: [3, 3, 4, 5],
      costRes: 'gold',
      cost: [5000, 25000, 60000, 150000],
      time: [60, 300, 600, 900],
      hp: [400, 450, 500, 550],
      dps: [4, 5, 6, 7],
    }),
  },
  airdefense: {
    name: 'Air Defense',
    size: 3,
    category: 'defense',
    desc: 'Rockets that shred flying units. Cannot target ground troops.',
    maxCount: [0, 0, 0, 1, 1, 2],
    job: { role: 'Lookout', skill: 'combat', max: 1, effect: 'Increases damage when defending' },
    defense: { range: 10, minRange: 0, speed: 1, air: true, ground: false, splash: 0, projectile: 'rocket' },
    levels: levels({
      th: [4, 4, 5, 6],
      costRes: 'gold',
      cost: [20000, 60000, 150000, 300000],
      time: [180, 480, 720, 900],
      hp: [800, 850, 900, 950],
      dps: [80, 110, 140, 160],
    }),
  },
  wizardtower: {
    name: 'Wizard Tower',
    size: 3,
    category: 'defense',
    desc: 'A wizard hurls magic orbs that splash both air and ground units.',
    maxCount: [0, 0, 0, 0, 1, 2],
    job: { role: 'Apprentice', skill: 'scholarship', max: 1, effect: 'Increases damage when defending' },
    defense: { range: 7, minRange: 0, speed: 1.3, air: true, ground: true, splash: 1, projectile: 'orb' },
    levels: levels({
      th: [5, 5, 6, 6],
      costRes: 'gold',
      cost: [120000, 220000, 320000, 420000],
      time: [300, 600, 800, 1000],
      hp: [620, 650, 680, 730],
      dps: [11, 13, 16, 20],
    }),
  },
  wall: {
    name: 'Wall',
    size: 1,
    category: 'defense',
    desc: 'Slows down enemy ground troops. Upgrades are instant.',
    maxCount: [25, 50, 75, 100, 125, 175],
    levels: levels({
      th: [1, 2, 3, 4, 5, 6],
      costRes: 'gold',
      cost: [50, 200, 800, 2000, 5000, 12000],
      time: [0, 0, 0, 0, 0, 0],
      hp: [300, 500, 700, 900, 1400, 2000],
    }),
  },
};

export const SHOP_CATEGORIES = [
  { id: 'economy', name: 'Economy', types: ['goldmine', 'elixircollector', 'goldstorage', 'elixirstorage'] },
  { id: 'defense', name: 'Defense', types: ['cannon', 'archertower', 'mortar', 'airdefense', 'wizardtower', 'wall'] },
  { id: 'army', name: 'Army', types: ['barracks', 'armycamp', 'laboratory'] },
  { id: 'village', name: 'Village', types: ['house', 'builderhut'] },
];

export const OBSTACLES = {
  tree: { name: 'Tree', size: 2, cost: { elixir: 100 } },
  pine: { name: 'Pine Tree', size: 2, cost: { elixir: 150 } },
  rock: { name: 'Rock', size: 2, cost: { gold: 100 } },
  bush: { name: 'Bush', size: 1, cost: { elixir: 50 } },
};

export function isDefense(type) {
  return !!BUILDINGS[type]?.defense;
}

export function isResourceBuilding(type) {
  const d = BUILDINGS[type];
  return !!(d && (d.resource || d.storage || type === 'townhall'));
}
