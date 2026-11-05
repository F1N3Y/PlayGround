// ---------------------------------------------------------------------------
// VOIDLINE — item, loot and recipe definitions
// ---------------------------------------------------------------------------

const svg = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`

export const ICONS = {
  rod: svg('<path d="M4 21 18 5"/><path d="M18 5c3 0 3 4 1.6 7.4"/><path d="M19.6 12.4c-.2 1.7-1.8 2.6-3.1 1.7-1.2-.9-.8-2.4.3-3.1"/><circle cx="6.2" cy="18.8" r="1.1"/>'),
  axe: svg('<path d="m5 21 8-8"/><path d="M12 4c3.8-1.4 7 .4 8 3.6-2.4 3-6.4 4-9.6 2.6L12 4Z"/><path d="m11.2 9.4 3 3"/>'),
  spear: svg('<path d="M4 20 18 6"/><path d="m15 3 6 6-4.5-.5L16 13l-4-4 4.5-.5L15 3Z"/>'),
  blade: svg('<path d="M4 20 17 7"/><path d="m14 3 7 7-3 1-2 2-1 3-7-7 3-1 2-2 1-3Z"/><path d="m6 16 2 2"/><circle cx="4.5" cy="19.5" r="1.2"/>'),
  fish: svg('<path d="M3 12c3-4 7-5 11-3l5-3-1 5 2 1-2 1 1 5-5-3c-4 2-8 1-11-3Z"/><circle cx="8" cy="11" r=".8" fill="currentColor"/>'),
  cooked: svg('<path d="M4 13c3-3.5 6.5-4.5 10-3l5-2.5-.8 4.5 1.8 1-1.8 1 .8 4.5-5-2.5c-3.5 1.5-7 .5-10-3Z"/><path d="M8 17c-1-1-1-2 0-3"/><path d="M12 19c-1-1.5-1-2.5 0-3.5"/>'),
  berry: svg('<circle cx="9" cy="14" r="3"/><circle cx="15" cy="15" r="2.6"/><circle cx="12.5" cy="9.5" r="2.4"/><path d="M12.5 7c0-2 1-3 3-3.5"/><path d="M16 4c2 .2 3 1.2 3 3-2 .2-3-.4-3-3Z"/>'),
  water: svg('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/><path d="M9 14c.2 2 1.4 3 3 3.2"/>'),
  wood: svg('<path d="M4 8.5 12 5l8 3.5v7L12 19l-8-3.5v-7Z"/><path d="M4 8.5 12 12l8-3.5"/><path d="M12 12v7"/><path d="M7 11.8v4M17 11.8v4"/>'),
  stone: svg('<path d="m4 15 2.6-6L13 5l6 3 1.4 6-4.2 5H9l-5-4Z"/><path d="m6.6 9 5.5 3.5L19 8"/><path d="m12.1 12.5.9 6"/>'),
  fiber: svg('<path d="M5 21c0-8 4-14 12-16"/><path d="M8 21c1-5 4-9 9-11"/><path d="M12 21c1-3 3-5 6-6"/><path d="M6 7c-1-2 0-4 2-4 .5 2 0 3.5-2 4Z"/><path d="M11 4c0-2 1.5-3 3.5-2.5C14.5 3.5 13 4.5 11 4Z"/>'),
  sapling: svg('<path d="M12 21v-8"/><path d="M12 13c0-4 2.5-6 6-6 0 4-2.5 6-6 6Z"/><path d="M12 16c-3 0-5-1.5-5.5-4.5 3.5-.4 5.5 1 5.5 4.5Z"/><path d="M7 21h10"/>'),
  deed: svg('<path d="M5 3h11l3 3v15H5V3Z"/><path d="M16 3v4h3"/><path d="M8 11h8M8 14h8M8 17h5"/><path d="m8 7 1.5 1.5L12 6"/>'),
  campfire: svg('<path d="m4 19 16-4M4 15l16 4"/><path d="M12 15c-3-1.2-4-3.6-3-6 1 .6 1.6 1.4 2 2.4C11 8 12.4 6 15 5c.2 3-1 5.4-3 7 2-.2 3.2-1 4-2.4.8 2.6-.8 5.2-4 5.6Z"/>'),
  still: svg('<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M5 8h14"/><path d="M9 12c.4 1.4 1.6 2 3 2s2.6-.6 3-2"/><path d="M10 4v4M14 4v4"/>'),
  medkit: svg('<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M9 6V4h6v2"/><path d="M12 10v6M9 13h6"/>'),
  lure: svg('<path d="M5 4c3 0 4 2 4 5v7"/><path d="M9 16c0 3-3 3-3 1"/><path d="m15 4 1.2 3.4L20 8.5l-3.8 1.1L15 13l-1.2-3.4L10 8.5l3.8-1.1L15 4Z"/>'),
  shard: svg('<path d="m12 2 5 7-5 13-5-13 5-7Z"/><path d="M7 9h10M12 2v20M9.4 9l2.6 13 2.6-13"/>'),
  core: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="m5 5 2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
  plot: svg('<path d="M4 5h16v14H4z"/><path d="M9.5 5v14M14.5 5v14M4 10h16M4 15h16"/>'),
  bag: svg('<path d="M6 8h12l2 13H4L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 13h6"/>'),
  hammer: svg('<path d="m6 21 7-7"/><path d="M13 3c3-1 6 .5 7 3.5-1.5 2-4 3-7 2.5l-2-3L13 3Z"/><path d="m10 9 3 3"/>'),
  book: svg('<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4Z"/><path d="M8 20a4 4 0 0 1 0-8h12"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.06-.33.1-.66.1-1Z"/>'),
  sound: svg('<path d="M5 10v4h4l5 4V6L9 10H5Z"/><path d="M17 9c1.3 1.3 1.3 4.7 0 6M19.5 6.5c3 3 3 8 0 11"/>'),
  mute: svg('<path d="M5 10v4h4l5 4V6L9 10H5Z"/><path d="m17 9 5 6M22 9l-5 6"/>'),
  close: svg('<path d="M5 5l14 14M19 5 5 19"/>'),
  arrow: svg('<path d="M5 12h14M14 7l5 5-5 5"/>'),
  cast: svg('<path d="M4 20 16 6"/><path d="M16 6c3 0 4 3 2 5"/><path d="M18 11c0 2-1.5 3-3 2.2"/><path d="M3 18c3-1 5-1 7 0"/>'),
  skull: svg('<path d="M6 10a6 6 0 1 1 12 0c0 2.4-1 3.4-2 4.4V18H8v-3.6c-1-1-2-2-2-4.4Z"/><circle cx="9.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="14.5" cy="10.5" r="1.2" fill="currentColor"/><path d="M10 18v3M14 18v3"/>'),
  check: svg('<path d="m4 12 5 5L20 6"/>'),
}

export const RARITY = {
  common: { label: 'Common', color: '#a8b6ba' },
  uncommon: { label: 'Uncommon', color: '#74f0b5' },
  rare: { label: 'Rare', color: '#8eb7ff' },
  void: { label: 'Voidwrought', color: '#c99cff' },
}

export const ITEMS = {
  rod: {
    name: 'Castline Rod', kind: 'tool', tool: 'rod', icon: 'rod', rarity: 'uncommon', stack: 1,
    desc: 'Given by the simulation. Casts a line into the void, where the trial hides its gifts.',
  },
  axe: {
    name: 'Salvage Axe', kind: 'tool', tool: 'axe', icon: 'axe', rarity: 'uncommon', stack: 1,
    desc: 'Salvaged from a void cache. Chops lumenwood into usable timber.',
  },
  spear: {
    name: 'Rusty Spear', kind: 'tool', tool: 'weapon', icon: 'spear', rarity: 'uncommon', stack: 1,
    damage: 22, desc: 'A bent spear with a hungry point. Keeps the things beyond the light at bay.',
  },
  blade: {
    name: 'Voidsteel Blade', kind: 'tool', tool: 'weapon', icon: 'blade', rarity: 'rare', stack: 1,
    damage: 38, desc: 'A shard of the trial itself, folded into an edge. It hums when monsters are near.',
  },
  fish: {
    name: 'Pale Voidfish', kind: 'food', icon: 'fish', rarity: 'common', stack: 12,
    use: { hunger: 16 }, desc: 'It should not exist. It tastes better cooked over a campfire.',
  },
  cooked: {
    name: 'Emberfish', kind: 'food', icon: 'cooked', rarity: 'uncommon', stack: 12,
    use: { hunger: 38, health: 6 }, desc: 'Crisped over a campfire. Warmth for the long dark.',
  },
  berry: {
    name: 'Glowberries', kind: 'food', icon: 'berry', rarity: 'common', stack: 16,
    use: { hunger: 20, health: 2 }, desc: 'They glow faintly. The simulation insists they are food.',
  },
  water: {
    name: 'Filtered Water', kind: 'drink', icon: 'water', rarity: 'common', stack: 10,
    use: { thirst: 36 }, desc: 'Collected from a condensation still. Tastes of clean nothing.',
  },
  wood: { name: 'Lumenwood', kind: 'material', icon: 'wood', rarity: 'common', stack: 30, desc: 'Pale timber that holds a faint inner light.' },
  stone: { name: 'Voidstone', kind: 'material', icon: 'stone', rarity: 'common', stack: 30, desc: 'Dense, warm stone. It remembers being part of something larger.' },
  fiber: { name: 'Lumen Fiber', kind: 'material', icon: 'fiber', rarity: 'common', stack: 20, desc: 'Tough silver grass. Useful for binding and for lures.' },
  sapling: {
    name: 'Lumen Sapling', kind: 'plant', icon: 'sapling', rarity: 'uncommon', stack: 4,
    use: { plant: 'tree' }, desc: 'Plant it on your plot. Given time and light, it will grow into lumber.',
  },
  deed: {
    name: 'Plot Deed', kind: 'deed', icon: 'deed', rarity: 'rare', stack: 8,
    use: { deed: 1 }, desc: 'A folded claim on one flagstone of reality. Place it beside your land to expand.',
  },
  medkit: {
    name: 'Repair Gel', kind: 'heal', icon: 'medkit', rarity: 'uncommon', stack: 6,
    use: { health: 45 }, desc: 'The simulation calls it repair gel. Your body calls it a miracle.',
  },
  lure: {
    name: 'Shimmer Lure', kind: 'usable', icon: 'lure', rarity: 'rare', stack: 5,
    use: { lure: 5 }, desc: 'Five casts that draw rarer things from the dark.',
  },
  shard: { name: 'Void Shard', kind: 'material', icon: 'shard', rarity: 'rare', stack: 20, desc: 'A splinter of the trial. It is cold, then suddenly very warm.' },
  core: { name: 'Herald Core', kind: 'quest', icon: 'core', rarity: 'void', stack: 1, desc: 'The heart of the thing that came through the trial. Proof you were here.' },
}

export const LOOT = {
  common: [
    { id: 'wood', min: 2, max: 4, w: 22 },
    { id: 'stone', min: 1, max: 2, w: 17 },
    { id: 'fiber', min: 1, max: 3, w: 14 },
    { id: 'berry', min: 1, max: 3, w: 14 },
    { id: 'fish', min: 1, max: 2, w: 14 },
    { id: 'water', min: 1, max: 2, w: 14 },
    { id: 'medkit', min: 1, max: 1, w: 5 },
  ],
  uncommon: [
    { id: 'water', min: 2, max: 3, w: 18 },
    { id: 'cooked', min: 1, max: 2, w: 14 },
    { id: 'sapling', min: 1, max: 2, w: 16 },
    { id: 'fiber', min: 2, max: 4, w: 14 },
    { id: 'medkit', min: 1, max: 2, w: 12 },
    { id: 'deed', min: 1, max: 1, w: 12 },
    { id: 'spear', min: 1, max: 1, w: 8 },
    { id: 'shard', min: 1, max: 1, w: 6 },
  ],
  rare: [
    { id: 'deed', min: 1, max: 2, w: 20 },
    { id: 'blade', min: 1, max: 1, w: 12 },
    { id: 'medkit', min: 2, max: 3, w: 16 },
    { id: 'shard', min: 1, max: 2, w: 18 },
    { id: 'lure', min: 1, max: 2, w: 16 },
    { id: 'sapling', min: 2, max: 3, w: 18 },
  ],
  void: [
    { id: 'core', min: 1, max: 1, w: 4 },
    { id: 'blade', min: 1, max: 1, w: 16 },
    { id: 'deed', min: 2, max: 3, w: 22 },
    { id: 'shard', min: 2, max: 3, w: 24 },
    { id: 'lure', min: 2, max: 3, w: 18 },
    { id: 'medkit', min: 2, max: 3, w: 16 },
  ],
}

// A little narrative pity: the first few casts always progress the loop.
export const EARLY_LOOT = [
  [['axe', 1], ['wood', 3], ['water', 1]],
  [['sapling', 1], ['wood', 2], ['stone', 2]],
  [['deed', 1], ['berry', 2], ['water', 1]],
  [['spear', 1], ['stone', 2], ['fiber', 2]],
  [['deed', 1], ['shard', 1], ['fish', 2]],
]

export const RECIPES = [
  {
    id: 'campfire', name: 'Campfire', icon: 'campfire', time: 'Utility',
    cost: { wood: 4, stone: 2 },
    desc: 'Cook fish, heal in the warmth, and rest until dawn. Resting advances the trial clock.',
  },
  {
    id: 'still', name: 'Condensation Still', icon: 'still', time: 'Utility',
    cost: { wood: 5, fiber: 2 },
    desc: 'Slowly pulls drinkable water from the void. Collect a charge every 40 seconds.',
  },
  {
    id: 'spear', name: 'Wooden Spear', icon: 'spear', time: 'Weapon',
    cost: { wood: 3, stone: 2 },
    desc: 'A reliable point for the trial. Deals 22 damage per strike.',
  },
  {
    id: 'medkit', name: 'Repair Gel', icon: 'medkit', time: 'Survival',
    cost: { fiber: 2, shard: 1 },
    desc: 'Restores 45 health. Keep one for the night the trial begins.',
  },
  {
    id: 'lure', name: 'Shimmer Lure', icon: 'lure', time: 'Fishing',
    cost: { fiber: 2, shard: 1 },
    desc: 'Improves the rarity of your next five void catches.',
  },
]

export const MONSTERS = {
  wisp: { name: 'Void Wisp', hp: 55, speed: 2.2, damage: 8, radius: 0.9, color: 0x9277ff, xp: 35 },
  crawler: { name: 'Null Crawler', hp: 95, speed: 1.65, damage: 13, radius: 1.2, color: 0xff6b7d, xp: 55 },
  herald: { name: 'The Hollow Herald', hp: 340, speed: 1.15, damage: 19, radius: 2.2, color: 0xffc86b, xp: 300, boss: true },
}

export const TRIAL_DAY = 8
export const DAY_SECONDS = 180
export const VOID_Y = -2.35
