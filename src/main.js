import * as THREE from 'three'
import { World, TILE } from './world.js'
import { SoundEngine } from './audio.js'
import { ITEMS, ICONS, RARITY, LOOT, EARLY_LOOT, RECIPES, TRIAL_DAY, DAY_SECONDS, VOID_Y } from './data.js'

// ---------------------------------------------------------------------------
// bootstrapping
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const canvas = $('#game')
const world = new World(canvas)
const audio = new SoundEngine()
const isTouch = window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 1100)

const SAVE_KEY = 'voidline-save-v2'
const SETTINGS_KEY = 'voidline-settings-v1'
const DAYS_GRACE = TRIAL_DAY - 1

const el = {
  start: $('#start-screen'), hud: $('#hud'), startBtn: $('#start-btn'), continueBtn: $('#continue-btn'),
  continueDetail: $('#continue-detail'), trialPill: $('#trial-pill'), trialLabel: $('#trial-label'),
  trialDays: $('#trial-days'), trialFill: $('#trial-fill'), clockTime: $('#clock-time'), clockDay: $('#clock-day'),
  objPanel: $('#objective-panel'), objProgress: $('#obj-progress'), objTitle: $('#obj-title'), objSub: $('#obj-sub'),
  objList: $('#obj-list'), reticle: $('#reticle'), retLabel: $('#ret-label'), hintText: $('#hint-text'),
  vitals: $('#vitals'), hpValue: $('#hp-value'), foodValue: $('#food-value'), waterValue: $('#water-value'),
  energyValue: $('#energy-value'), hotbar: $('#hotbar'), actionBtn: $('#action-btn'), actionIcon: $('#action-icon'),
  actionLabel: $('#action-label'), actionSub: $('#action-sub'), inventoryBtn: $('#inventory-btn'), craftBtn: $('#craft-btn'),
  inventoryPanel: $('#inventory-panel'), craftPanel: $('#craft-panel'), settingsPanel: $('#settings-panel'),
  invCount: $('#inv-count'), invLevel: $('#inv-level'), invGrid: $('#inv-grid'), invDetail: $('#inv-detail'),
  invXp: $('#inv-xp'), recipeList: $('#recipe-list'), lootOverlay: $('#loot-overlay'), lootTitle: $('#loot-title'),
  lootRarity: $('#loot-rarity'), lootItems: $('#loot-items'), lootNote: $('#loot-note'), lootClose: $('#loot-close'),
  deathOverlay: $('#death-overlay'), deathText: $('#death-text'), deathStats: $('#death-stats'), respawnBtn: $('#respawn-btn'),
  deathReset: $('#death-reset'), victoryOverlay: $('#victory-overlay'), victoryStats: $('#victory-stats'),
  victoryBtn: $('#victory-btn'), victoryReset: $('#victory-reset'), biteBanner: $('#bite-banner'),
  banner: $('#banner'), bannerKicker: $('#banner-kicker'), bannerTitle: $('#banner-title'), bannerSub: $('#banner-sub'),
  toastStack: $('#toast-stack'), interactPrompt: $('#interact-prompt'), interactLabel: $('#interact-label'),
  lookHint: $('#look-hint'), soundBtn: $('#sound-btn'), settingsBtn: $('#settings-btn'), joystick: $('#joystick'),
  castReadout: $('#cast-readout'), castState: $('#cast-state'), castFill: $('#cast-fill'), sensRange: $('#sens-range'),
  sensVal: $('#sens-val'), volRange: $('#vol-range'), volVal: $('#vol-val'), hintToggle: $('#hint-toggle'),
  saveBtn: $('#save-btn'), resetBtn: $('#reset-btn'), bossBar: $('#boss-bar'), bossName: $('#boss-name'),
  bossHp: $('#boss-hp'), bossFill: $('#boss-fill'), rotateNote: $('#rotate-note'), hitFlash: $('#hit-flash'),
}

function iconSvg(id) { return ICONS[id] || ICONS.shard }
function setIcon(node, id) { if (node) node.innerHTML = iconSvg(id) }
function injectStaticIcons(root = document) {
  $$('[data-icon]', root).forEach((node) => { node.innerHTML = iconSvg(node.dataset.icon) })
}

const settings = Object.assign({ sens: 1, volume: 0.6, hints: true, muted: false }, (() => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} }
})())

// ---------------------------------------------------------------------------
// game state
// ---------------------------------------------------------------------------
function defaultState() {
  const tiles = []
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) tiles.push(`${x},${z}`)
  return {
    day: 1, dayProgress: 0.065, phase: 'grace', postGame: false, victory: false, dead: false,
    level: 1, xp: 0, health: 100, hunger: 92, thirst: 90, energy: 100,
    inventory: [], selected: 'rod', tiles,
    castCount: 0, chestsOpened: 0, kills: 0, lureCasts: 0,
    trialTime: 0, bossSpawned: false, nextSpawn: 8,
    flags: {}, stats: { casts: 0, wood: 0, plots: 0, rested: 0, catches: 0 },
  }
}

let state = defaultState()
const player = { x: 0, z: 0, yaw: 0, pitch: -0.1, shake: 0, moving: false, bob: 0 }
const keys = {}
const touchMove = { x: 0, y: 0 }
let started = false
let uiLocked = false
let activePanel = null
let buildMode = false
let buildSpot = null
let buildSpots = []
let selectedItemId = null
let lastLoot = null
let cast = idleCast()
let swingT = 0
let restCooldown = 0
let lastUI = 0
let lastSave = 0
let saveAcc = 0
let lastActionKey = ''
let lastHotbarSig = ''
let lastObjSig = ''
let bannerTimer = null
let lootTimer = null
let lookHintTimer = null
let isNightCached = null
let lastFrame = performance.now()
let lastNightToast = -10
let lastAttackTime = 0
const raycaster = new THREE.Raycaster()
const centerVec = new THREE.Vector2(0, 0)
const tmpVec = new THREE.Vector3()

function idleCast() {
  return { state: 'idle', t: 0, target: null, from: null, waitStart: 0, waitUntil: 0, biteUntil: 0, chest: null, openAt: 0, loot: null, rarity: 'common' }
}

// ---------------------------------------------------------------------------
// inventory helpers
// ---------------------------------------------------------------------------
const capacity = () => 10 * (1 + Math.floor(state.level / 10))
const xpNeeded = () => 70 + (state.level - 1) * 48
const itemDef = (id) => ITEMS[id]
const findItem = (id) => state.inventory.find((entry) => entry.id === id)
const countItem = (id) => findItem(id)?.count || 0
const hasItem = (id) => countItem(id) > 0

function addItem(id, count = 1) {
  const def = ITEMS[id]
  if (!def) return count
  if (def.stack === 1 && hasItem(id)) return count
  let left = count
  for (const entry of state.inventory) {
    if (entry.id !== id) continue
    const room = def.stack - entry.count
    if (room > 0) {
      const take = Math.min(room, left)
      entry.count += take; left -= take
      if (left <= 0) break
    }
  }
  while (left > 0 && state.inventory.length < capacity()) {
    const take = Math.min(def.stack, left)
    state.inventory.push({ id, count: take })
    left -= take
  }
  if (left < count) hotbarDirty()
  return left
}

function removeItem(id, count = 1) {
  let left = count
  for (let i = state.inventory.length - 1; i >= 0 && left > 0; i--) {
    const entry = state.inventory[i]
    if (entry.id !== id) continue
    const take = Math.min(entry.count, left)
    entry.count -= take; left -= take
    if (entry.count <= 0) state.inventory.splice(i, 1)
  }
  if (left < count) hotbarDirty()
  return left
}

function hasWeapon() { return hasItem('blade') || hasItem('spear') }
function hasAxe() { return hasItem('axe') }
function bestFood() {
  return ['cooked', 'berry', 'fish'].find((id) => hasItem(id)) || null
}
function bestWeapon() {
  return hasItem('blade') ? 'blade' : hasItem('spear') ? 'spear' : null
}
function hotbarDirty() {
  lastHotbarSig = ''
}

function addXp(amount) {
  state.xp += amount
  let leveled = false
  while (state.xp >= xpNeeded()) {
    state.xp -= xpNeeded()
    state.level++
    leveled = true
  }
  if (leveled) {
    state.health = Math.min(100, state.health + 12)
    audio.play('level')
    showBanner('SIMULATION', 'LEVEL ' + state.level, `Backpack capacity: ${capacity()} slots`, false, 3600)
    showToast('Level up', `You are now level ${state.level}. +${capacity()} inventory slots`, '', 'shard')
    state.inventory.length = Math.min(state.inventory.length, capacity())
    hotbarDirty()
  }
  return leveled
}

// ---------------------------------------------------------------------------
// tile helpers
// ---------------------------------------------------------------------------
const tileKey = (gx, gz) => `${gx},${gz}`
const hasTile = (gx, gz) => state.tiles.includes(tileKey(gx, gz))
const worldPos = (gx, gz) => ({ x: gx * TILE, z: gz * TILE })

function pointOnTile(x, z) {
  const gx = Math.round(x / TILE), gz = Math.round(z / TILE)
  return hasTile(gx, gz) && Math.abs(x - gx * TILE) <= TILE / 2 && Math.abs(z - gz * TILE) <= TILE / 2
}
function canStand(x, z) {
  const m = 0.28
  const gx = Math.round(x / TILE), gz = Math.round(z / TILE)
  return hasTile(gx, gz) && Math.abs(x - gx * TILE) <= TILE / 2 - m && Math.abs(z - gz * TILE) <= TILE / 2 - m
}
function occupiedTiles() {
  const set = new Set()
  for (const t of world.trees) set.add(tileKey(t.gx, t.gz))
  for (const f of world.fires) set.add(tileKey(f.gx, f.gz))
  for (const s of world.stills) set.add(tileKey(s.gx, s.gz))
  return set
}
function freeTileAhead() {
  const occupied = occupiedTiles()
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw)
  const tryOrder = []
  for (const dist of [1.6, 2.6, 0.0, 3.6]) {
    const gx = Math.round((player.x + fx * dist) / TILE)
    const gz = Math.round((player.z + fz * dist) / TILE)
    tryOrder.push([gx, gz])
  }
  for (const [gx, gz] of tryOrder) {
    if (hasTile(gx, gz) && !occupied.has(tileKey(gx, gz))) return { gx, gz }
  }
  const tiles = state.tiles.map((key) => {
    const [gx, gz] = key.split(',').map(Number)
    return { gx, gz, d: Math.hypot(gx * TILE - player.x, gz * TILE - player.z) }
  }).filter((t) => !occupied.has(tileKey(t.gx, t.gz))).sort((a, b) => a.d - b.d)
  return tiles[0] || null
}
function perimeterSpots() {
  const occupied = new Set(state.tiles)
  const spots = new Map()
  for (const key of state.tiles) {
    const [gx, gz] = key.split(',').map(Number)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = gx + dx, nz = gz + dz
      const k = tileKey(nx, nz)
      if (!occupied.has(k)) spots.set(k, { gx: nx, gz: nz })
    }
  }
  return [...spots.values()]
}

// ---------------------------------------------------------------------------
// world synchronisation
// ---------------------------------------------------------------------------
function setupNewWorld() {
  for (const key of state.tiles) {
    const [gx, gz] = key.split(',').map(Number)
    world.createTile(gx, gz, false)
  }
  player.x = 0; player.z = 0; player.yaw = 0; player.pitch = -0.18
  world.equip('rod')
  state.selected = 'rod'
}

function applySave(data) {
  const saved = data.state || {}
  state = Object.assign(defaultState(), saved)
  state.inventory = Array.isArray(saved.inventory) ? saved.inventory.filter((e) => ITEMS[e.id] && e.count > 0) : []
  state.flags = saved.flags || {}
  state.stats = Object.assign({ casts: 0, wood: 0, plots: 0, rested: 0, catches: 0 }, saved.stats)
  state.tiles = Array.isArray(saved.tiles) && saved.tiles.length ? saved.tiles : defaultState().tiles
  const p = data.player || {}
  player.x = typeof p.x === 'number' ? p.x : 0
  player.z = typeof p.z === 'number' ? p.z : 0
  player.yaw = typeof p.yaw === 'number' ? p.yaw : 0
  player.pitch = typeof p.pitch === 'number' ? p.pitch : -0.18
  if (!canStand(player.x, player.z)) { player.x = 0; player.z = 0 }
  for (const key of state.tiles) {
    const [gx, gz] = key.split(',').map(Number)
    world.createTile(gx, gz, false)
  }
  const now = performance.now() / 1000
  for (const t of (data.trees || [])) {
    const growth = Math.max(0.05, Math.min(1, t.growth || 0))
    world.placeTree(t.gx, t.gz, now - growth * 45, growth)
  }
  for (const f of (data.fires || [])) world.placeCampfire(f.gx, f.gz)
  for (const s of (data.stills || [])) {
    const still = world.placeStill(s.gx, s.gz)
    still.nextReady = now + Math.max(0, s.readyIn || 0)
  }
  if (state.selected !== 'rod' && !hasItem(state.selected)) state.selected = 'rod'
  world.equip(modelFor(state.selected))
}

function modelFor(id) {
  if (id === 'axe') return 'axe'
  if (id === 'spear') return 'spear'
  if (id === 'blade') return 'blade'
  return 'rod'
}

function serialize() {
  const now = performance.now() / 1000
  return {
    v: 2, savedAt: Date.now(),
    state: {
      day: state.day, dayProgress: state.dayProgress, phase: state.phase, postGame: state.postGame,
      victory: state.victory, dead: state.dead, level: state.level, xp: state.xp,
      health: state.health, hunger: state.hunger, thirst: state.thirst, energy: state.energy,
      inventory: state.inventory, selected: state.selected, tiles: state.tiles,
      castCount: state.castCount, chestsOpened: state.chestsOpened, kills: state.kills,
      lureCasts: state.lureCasts, trialTime: state.trialTime, bossSpawned: state.bossSpawned,
      nextSpawn: state.nextSpawn, flags: state.flags, stats: state.stats,
    },
    player: { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch },
    trees: world.trees.map((t) => ({ gx: t.gx, gz: t.gz, growth: t.growth })),
    fires: world.fires.map((f) => ({ gx: f.gx, gz: f.gz })),
    stills: world.stills.map((s) => ({ gx: s.gx, gz: s.gz, readyIn: Math.max(0, (s.nextReady || now) - now) })),
  }
}

function saveGame(manual = false) {
  if (!started) return false
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()))
    if (manual) showToast('Simulation saved', `Day ${state.day} · Level ${state.level}`, '', 'check')
    return true
  } catch { return false }
}

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.v !== 2 || !data.state) return null
    return data
  } catch { return null }
}

// ---------------------------------------------------------------------------
// presentation helpers
// ---------------------------------------------------------------------------
function showToast(title, sub = '', kind = '', icon = 'shard') {
  if (!settings.hints && kind === '') return
  const node = document.createElement('div')
  node.className = `toast ${kind}`
  node.innerHTML = `<span class="t-icon">${iconSvg(icon)}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>`
  el.toastStack.prepend(node)
  while (el.toastStack.children.length > 4) el.toastStack.lastElementChild.remove()
  setTimeout(() => {
    node.classList.add('out')
    setTimeout(() => node.remove(), 280)
  }, 3400)
}

function showBanner(kicker, title, sub = '', danger = false, duration = 3200) {
  el.bannerKicker.textContent = kicker
  el.bannerTitle.textContent = title
  el.bannerSub.textContent = sub
  el.banner.classList.toggle('danger', danger)
  el.banner.classList.remove('hidden')
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => el.banner.classList.add('hidden'), duration)
}

function flashHit() {
  el.hitFlash.classList.remove('flash')
  void el.hitFlash.offsetWidth
  el.hitFlash.classList.add('flash')
}

function tryLock() {
  if (isTouch || !started || uiLocked || state.dead) return
  if (document.pointerLockElement === canvas) return
  try {
    const req = canvas.requestPointerLock?.()
    if (req?.catch) req.catch(() => {})
  } catch {}
}

function releaseLock() {
  if (document.pointerLockElement === canvas) document.exitPointerLock?.()
}

function showLookHint() {
  if (isTouch) return
  el.lookHint.classList.remove('hidden')
  clearTimeout(lookHintTimer)
  lookHintTimer = setTimeout(() => el.lookHint.classList.add('hidden'), 4200)
}

// ---------------------------------------------------------------------------
// start / continue
// ---------------------------------------------------------------------------
function refreshStartPreview() {
  const save = readSave()
  if (save) {
    el.continueBtn.classList.remove('hidden')
    el.continueDetail.textContent = `Day ${save.state.day || 1} · Lv ${save.state.level || 1}`
    el.startBtn.querySelector('span').textContent = 'New simulation'
  }
}

function beginGame(loadSave) {
  audio.init()
  audio.resume()
  audio.setMuted(settings.muted)
  if (audio.master) audio.master.gain.value = settings.muted ? 0 : settings.volume * 0.9

  const save = loadSave ? readSave() : null
  world.resetIsland()
  if (save) {
    applySave(save)
  } else {
    state = defaultState()
    setupNewWorld()
  }
  started = true
  uiLocked = false
  world.hand.visible = true
  world.equip(modelFor(state.selected))
  el.start.classList.add('hidden')
  el.hud.classList.remove('hidden')
  document.body.classList.toggle('touch', isTouch)
  if (isTouch) el.joystick.classList.remove('hidden')
  el.start.classList.add('hidden')
  if (!settings.hints) document.body.classList.add('no-hints')
  refreshAll()
  if (state.dead) {
    showDeathOverlay()
  } else if (state.postGame) {
    showBanner('SIMULATION', 'SIGNAL RESTORED', 'The trial is over. The void is quiet.', false, 3000)
  } else if (save) {
    showBanner('SIMULATION', 'SIGNAL RESTORED', `Day ${Math.min(state.day, 7)} · ${state.phase === 'trial' ? 'Trial active' : 'Prepare yourself'}`, false, 3200)
  } else {
    showBanner('WELCOME, CASTAWAY', 'THE SIMULATION HAS YOU', 'One rod. Nine flagstones. Seven days.', false, 4200)
    setTimeout(() => showToast('Cast into the void', isTouch ? 'Look past the edge, then tap CAST.' : 'Aim past the edge and press Space.', '', 'cast'), 1000)
  }
  if (state.phase === 'trial' && !state.postGame) {
    showToast('Trial active', 'The things beyond the void are awake.', 'bad', 'skull')
  }
  tryLock()
  if (state.dead) {
    uiLocked = true
    releaseLock()
  }
  lastFrame = performance.now()
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
function refreshAll() {
  hotbarDirty()
  lastObjSig = ''
  lastActionKey = ''
  refreshObjectives()
  refreshHotbar()
  if (activePanel === 'inventory') renderInventory()
  if (activePanel === 'craft') renderRecipes()
  updateUI(performance.now() / 1000, true)
}

function refreshObjectives() {
  if (!started) return
  const checks = [
    ['Void cache recovered', state.chestsOpened > 0],
    ['Lumenwood harvested', !!state.flags.wood],
    ['Plot expanded', !!state.flags.expanded],
    ['Campfire built', !!state.flags.campfire],
    ['Weapon equipped', hasWeapon()],
  ]
  const sig = checks.map((c) => (c[1] ? 1 : 0)).join('') + state.phase + state.postGame + state.chestsOpened + (buildMode ? 1 : 0)
  if (sig === lastObjSig) return
  lastObjSig = sig
  const done = checks.filter((c) => c[1]).length
  el.objProgress.textContent = `${done} / 5`
  el.objList.innerHTML = checks.map(([label, ok]) =>
    `<div class="obj-row ${ok ? 'done' : ''}"><i data-icon="check">${iconSvg('check')}</i><span>${label}</span></div>`
  ).join('')

  let title = '', sub = ''
  if (state.postGame) {
    title = 'The void is quiet'
    sub = 'You survived the trial. Keep building, or start again from settings.'
  } else if (state.phase === 'trial') {
    title = 'Survive the trial'
    sub = 'Strike down the Hollow Herald. Keep your weapon ready.'
  } else if (state.chestsOpened === 0) {
    title = 'Cast into the void'
    sub = isTouch ? 'Look past the edge of your plot, then tap CAST and wait for a bite.' : 'Aim past the edge of your plot and press Space. Wait for the bite, then reel.'
  } else if (!hasAxe()) {
    title = 'Find a Salvage Axe'
    sub = 'Keep casting. Early caches hide the tools you need.'
  } else if (!state.flags.planted) {
    title = 'Plant the Lumen Sapling'
    sub = 'Open your backpack and use the sapling. It will grow into lumber.'
  } else if (!state.flags.wood) {
    title = 'Harvest Lumenwood'
    sub = 'Equip the axe, walk to the grown tree, and chop it down.'
  } else if (!state.flags.expanded) {
    title = 'Expand your plot'
    sub = 'Use a Plot Deed. Look at a glowing tile, then confirm PLACE.'
  } else if (!state.flags.campfire) {
    title = 'Craft a campfire'
    sub = 'Collect 4 wood and 2 stone, then open the Fabricator.'
  } else if (!hasWeapon()) {
    title = 'Arm yourself'
    sub = 'Craft a spear or find a weapon in a cache before the trial.'
  } else {
    title = 'Rest until the trial'
    sub = 'Sleep at your campfire to pass a day. The trial begins when the seventh day ends.'
  }
  el.objTitle.textContent = title
  el.objSub.textContent = sub
}

function refreshHotbar() {
  if (!started) return
  const weapon = bestWeapon()
  const food = bestFood()
  const slots = [
    { kind: 'rod', id: 'rod', label: 'ROD' },
    { kind: 'axe', id: hasAxe() ? 'axe' : null },
    { kind: 'weapon', id: weapon },
    { kind: 'food', id: food },
    { kind: 'water', id: hasItem('water') ? 'water' : null },
  ]
  const sig = slots.map((s, i) => `${i}:${s.id || ''}:${s.id ? countItem(s.id) : 0}:${state.selected === s.id ? 1 : 0}`).join('|')
  if (sig === lastHotbarSig) return
  lastHotbarSig = sig
  el.hotbar.innerHTML = slots.map((s, i) => {
    const def = s.id ? ITEMS[s.id] : null
    const active = s.id && (state.selected === s.id || (s.kind === 'rod' && state.selected === 'rod'))
    return `<button class="slot ${def ? '' : 'empty'} ${active ? 'active' : ''}" data-slot="${i}" aria-label="${def ? def.name : 'Empty'}">
      <span class="slot-key">${i + 1}</span>
      <span class="slot-icon" style="color:${def ? (RARITY[def.rarity]?.color || '#74f0c8') : 'inherit'}">${def ? iconSvg(def.icon) : ''}</span>
      ${def && def.stack > 1 ? `<span class="slot-count">${countItem(s.id)}</span>` : ''}
    </button>`
  }).join('')
}

function updateUI(now, force = false) {
  if (!started) return
  if (!force && now - lastUI < 0.08) return
  lastUI = now

  const hp = Math.max(0, state.health)
  const bars = [
    ['health', hp], ['hunger', state.hunger], ['thirst', state.thirst], ['energy', state.energy],
  ]
  for (const [key, value] of bars) {
    const v = Math.max(0, Math.min(100, value))
    const bar = el.vitals.querySelector(`[data-vital="${key}"]`)
    if (!bar) continue
    bar.querySelector('.v-track i').style.width = `${v}%`
    bar.classList.toggle('low', v < 22)
    bar.querySelector('b').textContent = Math.round(v)
  }
  document.body.classList.toggle('low-health', state.health < 30 && !state.dead)

  const hour = (6 + state.dayProgress * 24) % 24
  const hh = String(Math.floor(hour)).padStart(2, '0')
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0')
  el.clockTime.textContent = `${hh}:${mm}`
  const activeTrial = state.phase === 'trial' && !state.postGame
  document.body.classList.toggle('trial-active', activeTrial)
  el.clockDay.textContent = state.postGame ? `SURVIVED · DAY ${state.day}` : activeTrial ? `TRIAL · DAY ${state.day}` : `DAY ${Math.min(state.day, DAYS_GRACE)} / ${DAYS_GRACE}`
  el.trialPill.classList.toggle('trial-active', activeTrial)
  if (activeTrial) {
    el.trialLabel.textContent = 'TRIAL ACTIVE'
    el.trialDays.textContent = state.bossSpawned ? 'SURVIVE' : 'HOLD THE LINE'
    el.trialFill.style.width = '100%'
  } else if (state.postGame) {
    el.trialLabel.textContent = 'TRIAL'
    el.trialDays.textContent = 'COMPLETE'
    el.trialFill.style.width = '100%'
  } else {
    const left = Math.max(0, TRIAL_DAY - state.day)
    el.trialLabel.textContent = 'TRIAL IN'
    el.trialDays.textContent = `${left} DAY${left === 1 ? '' : 'S'}`
    el.trialFill.style.width = `${Math.min(100, ((state.day - 1 + state.dayProgress) / DAYS_GRACE) * 100)}%`
  }

  refreshObjectives()
  refreshHotbar()
  updateContextUI(now)
  updateBossBar()
  updateCastReadout(now)
}

function updateBossBar() {
  const boss = world.monsters.find((m) => m.boss && !m.dead)
  if (!boss || state.postGame) { el.bossBar.classList.add('hidden'); return }
  el.bossBar.classList.remove('hidden')
  el.bossName.textContent = boss.def.name.toUpperCase()
  el.bossHp.textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`
  el.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`
}

function updateCastReadout(now) {
  if (cast.state === 'idle') { el.castReadout.classList.add('hidden'); return }
  el.castReadout.classList.remove('hidden')
  let label = 'CASTING', fill = 0
  if (cast.state === 'flying') { label = 'CASTING'; fill = Math.min(100, (cast.t / 0.65) * 100) }
  else if (cast.state === 'waiting') { label = 'WAITING FOR A BITE'; fill = Math.min(100, ((now - cast.waitStart) / Math.max(0.1, cast.waitUntil - cast.waitStart)) * 100) }
  else if (cast.state === 'bite') { label = 'REEL NOW'; fill = Math.max(0, ((cast.biteUntil - now) / 2.2) * 100) }
  else if (cast.state === 'reeling') { label = 'REELING IN'; fill = 100 }
  el.castState.textContent = label
  el.castFill.style.width = `${fill}%`
}

function computeCastTarget() {
  const dist = 10.5
  const x = player.x - Math.sin(player.yaw) * dist
  const z = player.z - Math.cos(player.yaw) * dist
  return { x, z, valid: !pointOnTile(x, z) }
}

// Only props roughly in front of the player can steal the contextual action.
// Without this a sapling planted at your feet blocks fishing even when you
// look away from it.
function facingAmount(x, z) {
  const dx = x - player.x, dz = z - player.z
  const d = Math.hypot(dx, dz) || 1
  return (-Math.sin(player.yaw) * dx - Math.cos(player.yaw) * dz) / d
}
function inReach(x, z, d) { return d < 1.0 || facingAmount(x, z) > 0.12 }

function nearby() {
  let tree = null, fire = null, still = null, monster = null
  let treeD = 3.1, fireD = 3.0, stillD = 3.0, monsterD = 4.6
  for (const t of world.trees) {
    const d = Math.hypot(t.x - player.x, t.z - player.z)
    if (d < treeD && inReach(t.x, t.z, d)) { treeD = d; tree = t }
  }
  for (const f of world.fires) {
    const d = Math.hypot(f.x - player.x, f.z - player.z)
    if (d < fireD && inReach(f.x, f.z, d)) { fireD = d; fire = f }
  }
  for (const s of world.stills) {
    const d = Math.hypot(s.x - player.x, s.z - player.z)
    if (d < stillD && inReach(s.x, s.z, d)) { stillD = d; still = s }
  }
  const now = performance.now() / 1000
  for (const m of world.monsters) {
    if (m.dead) continue
    const d = Math.hypot(m.x - player.x, m.z - player.z) - m.radius * 0.5
    if (d < monsterD) { monsterD = d; monster = m }
  }
  const prop = [
    tree && { type: 'tree', obj: tree, d: treeD },
    fire && { type: 'fire', obj: fire, d: fireD },
    still && { type: 'still', obj: still, d: stillD },
  ].filter(Boolean)
    // Growing trees and charging condensers have no action yet. A player
    // holding the rod should be able to cast instead of seeing a dead prompt.
    .filter((p) => !(state.selected === 'rod' && p.type === 'tree' && !p.obj.mature))
    .filter((p) => !(state.selected === 'rod' && p.type === 'still' && now < (p.obj.nextReady || 0)))
    .sort((a, b) => a.d - b.d)[0]
  return { tree, fire, still, monster, prop, now }
}

function computeContext(now) {
  if (buildMode) {
    return { key: 'build', type: 'build', label: 'PLACE', sub: `${countItem('deed')} deed · look at a tile`, icon: 'deed', hot: true }
  }
  if (cast.state !== 'idle') {
    if (cast.state === 'bite') return { key: 'bite', type: 'reel', label: 'REEL', sub: 'now!', icon: 'rod', hot: true, ready: true }
    if (cast.state === 'waiting') return { key: 'waiting', type: 'waiting', label: 'WAIT', sub: 'for a bite', icon: 'rod' }
    if (cast.state === 'flying') return { key: 'flying', type: 'waiting', label: 'CASTING', sub: 'into the dark', icon: 'rod' }
    if (cast.state === 'reeling') return { key: 'reeling', type: 'waiting', label: 'REELING', sub: 'hold on', icon: 'rod' }
    return { key: 'miss', type: 'waiting', label: 'MISSED', sub: 'try again', icon: 'rod' }
  }
  const near = nearby()
  if (near.monster) {
    const m = near.monster
    const armed = hasWeapon() || hasAxe()
    return {
      key: `monster-${m.id}`, type: 'monster', target: m,
      label: armed ? 'STRIKE' : 'UNARMED', sub: m.def.name, icon: hasWeapon() ? selectedItemId || 'blade' : 'axe',
      hot: true, warn: !armed,
    }
  }
  if (near.prop) {
    if (near.prop.type === 'tree') {
      const t = near.prop.obj
      if (!t.mature) return { key: 'tree-grow', type: 'growing', target: t, label: 'GROWING', sub: `${Math.round(t.growth * 100)}%`, icon: 'sapling' }
      if (!hasAxe()) return { key: 'tree-noaxe', type: 'noaxe', target: t, label: 'CHOP', sub: 'need an axe', icon: 'axe', warn: true }
      return { key: 'tree', type: 'chop', target: t, label: 'CHOP', sub: `${t.hp} swings left`, icon: 'axe', hot: true }
    }
    if (near.prop.type === 'fire') {
      const canRest = state.phase !== 'trial' || state.postGame
      return { key: 'fire', type: 'rest', target: near.prop.obj, label: canRest ? 'REST' : 'TRIAL', sub: canRest ? 'until dawn' : 'sleep forbidden', icon: 'campfire', hot: true, warn: !canRest }
    }
    if (near.prop.type === 'still') {
      const s = near.prop.obj
      if (now >= (s.nextReady || 0)) return { key: 'still', type: 'collect', target: s, label: 'COLLECT', sub: 'water', icon: 'water', hot: true }
      return { key: 'still-wait', type: 'stillwait', target: s, label: 'CHARGING', sub: `${Math.ceil((s.nextReady || now) - now)}s`, icon: 'water' }
    }
  }
  if (state.selected === 'rod') {
    const target = computeCastTarget()
    return {
      key: target.valid ? 'cast' : 'cast-invalid', type: 'cast', target,
      label: 'CAST', sub: target.valid ? 'into the void' : 'aim past the edge', icon: 'cast', hot: target.valid,
    }
  }
  if (hasWeapon() || hasAxe()) {
    return { key: 'swing', type: 'swing', label: 'SWING', sub: 'no target', icon: 'blade' }
  }
  return { key: 'need-rod', type: 'needrod', label: 'ROD', sub: 'select slot 1', icon: 'rod' }
}

let currentContext = null

function updateContextUI(now) {
  currentContext = computeContext(now)
  const c = currentContext
  const actionKey = `${c.key}:${c.label}:${c.sub}:${c.hot ? 1 : 0}${c.ready ? 1 : 0}`
  if (actionKey !== lastActionKey) {
    lastActionKey = actionKey
    el.actionLabel.textContent = c.label
    el.actionSub.textContent = c.sub || ''
    setIcon(el.actionIcon, c.icon || 'cast')
    el.actionBtn.classList.toggle('hot', !!c.hot)
    el.actionBtn.classList.toggle('ready', !!c.ready)
    el.actionBtn.classList.toggle('warn', !!c.warn)
  }

  // reticle and cast preview
  const target = computeCastTarget()
  const showCast = state.selected === 'rod' && cast.state === 'idle' && !buildMode && !state.dead
  if (showCast) world.showCastRing(target, target.valid, target.valid ? undefined : 0.12)
  else world.hideCastRing()

  let retLabel = ''
  let mode = ''
  if (buildMode) { mode = 'hot'; retLabel = 'PLACE A NEW FLAGSTONE' }
  else if (cast.state === 'bite') { mode = 'hot'; retLabel = 'REEL NOW' }
  else if (c.type === 'monster') { mode = 'hot'; retLabel = `HOSTILE · ${c.target.def.name.toUpperCase()}` }
  else if (c.type === 'chop') { mode = 'hot'; retLabel = `CHOP · LUMENWOOD (${c.target.hp})` }
  else if (c.type === 'growing') { mode = 'hot'; retLabel = `GROWING · ${Math.round(c.target.growth * 100)}%` }
  else if (c.type === 'rest') { mode = 'hot'; retLabel = state.phase === 'trial' && !state.postGame ? 'THE TRIAL FORBIDS SLEEP' : 'REST · CAMPFIRE' }
  else if (c.type === 'collect') { mode = 'hot'; retLabel = 'COLLECT · CONDENSER' }
  else if (c.type === 'stillwait') { retLabel = `CONDENSER CHARGING · ${c.sub}` }
  else if (state.selected === 'rod' && cast.state === 'idle') {
    if (target.valid) { mode = 'valid'; retLabel = 'CAST TARGET · VOID' }
    else { mode = 'invalid'; retLabel = 'AIM PAST THE EDGE' }
  }
  el.reticle.classList.toggle('valid', mode === 'valid')
  el.reticle.classList.toggle('invalid', mode === 'invalid')
  el.reticle.classList.toggle('hot', mode === 'hot')
  el.reticle.classList.toggle('show-label', !!retLabel)
  if (el.retLabel.textContent !== retLabel) el.retLabel.textContent = retLabel

  const nearProp = c.type === 'chop' || c.type === 'rest' || c.type === 'collect' || c.type === 'stillwait' || c.type === 'growing'
  if (nearProp && !isTouch) {
    el.interactPrompt.classList.remove('hidden')
    el.interactLabel.textContent = c.type === 'chop' ? 'Chop lumenwood'
      : c.type === 'rest' ? (state.phase === 'trial' && !state.postGame ? 'The trial forbids sleep' : 'Rest until dawn')
      : c.type === 'collect' ? 'Collect water'
      : c.type === 'stillwait' ? 'Charging' : 'Growing'
  } else {
    el.interactPrompt.classList.add('hidden')
  }
}

// ---------------------------------------------------------------------------
// panels
// ---------------------------------------------------------------------------
function hidePanels() {
  el.inventoryPanel.classList.add('hidden')
  el.craftPanel.classList.add('hidden')
  el.settingsPanel.classList.add('hidden')
  activePanel = null
}

function openPanel(name) {
  if (!started || state.dead) return
  if (activePanel === name) { closePanels(); return }
  cancelFishing(true)
  hidePanels()
  activePanel = name
  uiLocked = true
  releaseLock()
  if (name === 'inventory') {
    el.inventoryPanel.classList.remove('hidden')
    renderInventory()
  } else if (name === 'craft') {
    el.craftPanel.classList.remove('hidden')
    renderRecipes()
  } else if (name === 'settings') {
    el.settingsPanel.classList.remove('hidden')
    syncSettings()
  }
  audio.play('click')
}

function closePanels() {
  hidePanels()
  uiLocked = false
  audio.play('click')
  tryLock()
}

function renderInventory() {
  const cap = capacity()
  if (!selectedItemId || !findItem(selectedItemId)) selectedItemId = state.inventory[0]?.id || null
  el.invCount.textContent = `${state.inventory.length} / ${cap} slots`
  el.invLevel.textContent = `LEVEL ${state.level}`
  el.invXp.textContent = `${Math.floor(state.xp)} / ${xpNeeded()} XP`
  const slots = []
  for (let i = 0; i < cap + 5; i++) {
    const entry = state.inventory[i]
    if (!entry) {
      slots.push(`<div class="inv-slot ${i >= cap ? 'locked' : ''}">${i >= cap ? '' : ''}</div>`)
      continue
    }
    const def = ITEMS[entry.id]
    const rar = RARITY[def.rarity]?.color || '#74f0c8'
    slots.push(`<button class="inv-slot ${selectedItemId === entry.id ? 'selected' : ''}" data-item="${entry.id}">
      <span class="rar" style="background:${rar};box-shadow:0 0 7px ${rar}"></span>
      <span class="slot-icon" style="color:${rar}">${iconSvg(def.icon)}</span>
      ${entry.count > 1 ? `<span class="slot-count">${entry.count}</span>` : ''}
    </button>`)
  }
  el.invGrid.innerHTML = slots.join('')
  renderItemDetail()
}

function renderItemDetail() {
  if (!selectedItemId || !findItem(selectedItemId)) {
    el.invDetail.innerHTML = '<span class="empty-hint">Select an item to inspect it.</span>'
    return
  }
  const def = ITEMS[selectedItemId]
  const entry = findItem(selectedItemId)
  const rar = RARITY[def.rarity]?.color || '#74f0c8'
  const equipped = state.selected === selectedItemId
  let action = ''
  if (def.kind === 'tool') action = `<button data-act="equip" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>`
  else if (def.use) action = `<button data-act="use">${def.kind === 'deed' ? 'Place' : def.kind === 'plant' ? 'Plant' : def.kind === 'usable' ? 'Apply' : 'Use'}</button>`
  el.invDetail.innerHTML = `
    <div class="detail-head">
      <span class="detail-icon" style="color:${rar}">${iconSvg(def.icon)}</span>
      <div><h3>${def.name}</h3><span style="color:${rar}">${RARITY[def.rarity]?.label || 'Common'} · ×${entry.count}</span></div>
    </div>
    <p class="detail-desc">${def.desc}</p>
    <div class="detail-actions">${action}<button data-act="drop" class="danger">Drop 1</button></div>`
}

function useHotbar(index) {
  if (!started || uiLocked || state.dead) return
  const weapon = bestWeapon()
  const food = bestFood()
  if (index === 0) { equipItem('rod'); return }
  if (index === 1) { if (hasAxe()) equipItem('axe'); else showToast('No axe yet', 'Keep casting into the void', 'warn', 'axe'); return }
  if (index === 2) { if (weapon) equipItem(weapon); else showToast('No weapon yet', 'Craft a spear or fish up a blade', 'warn', 'spear'); return }
  if (index === 3) { if (food) useItem(food); else showToast('No food', 'Cast a line, or cook a voidfish', 'warn', 'fish'); return }
  if (index === 4) { if (hasItem('water')) useItem('water'); else showToast('No water', 'Build a condenser or find water in a cache', 'warn', 'water'); return }
}

function equipItem(id) {
  if (id !== 'rod' && !hasItem(id)) return
  state.selected = id
  world.equip(modelFor(id))
  if (ITEMS[id]?.tool === 'weapon' || ITEMS[id]?.tool === 'axe' || ITEMS[id]?.tool === 'rod') {
    state.flags.weaponEquipped = true
    lastObjSig = ''
  }
  refreshHotbar()
  refreshObjectives()
  audio.play('click')
  if (activePanel === 'inventory') renderInventory()
}

function useItem(id) {
  const def = ITEMS[id]
  if (!def || !hasItem(id)) return
  if (id === 'deed') { startBuildMode(); return }
  if (def.use?.plant) { plantSapling(); return }
  if (def.use?.lure) {
    removeItem(id, 1); state.lureCasts += 5
    showToast('Shimmer Lure applied', 'Next five catches favour rare loot', '', 'lure')
    audio.play('craft'); hotbarDirty(); renderInventory(); return
  }
  if (id === 'fish') {
    const nearFire = world.fires.some((f) => Math.hypot(f.x - player.x, f.z - player.z) < 3.2)
    if (nearFire) {
      removeItem(id, 1)
      const left = addItem('cooked', 1)
      if (left) addItem('fish', 1)
      else showToast('Emberfish cooked', 'Warm food restores more hunger', '', 'cooked')
      audio.play('craft'); renderInventory(); hotbarDirty(); return
    }
  }
  if (def.use?.hunger || def.use?.thirst || def.use?.health) {
    if (def.use.hunger) state.hunger = Math.min(100, state.hunger + def.use.hunger)
    if (def.use.thirst) state.thirst = Math.min(100, state.thirst + def.use.thirst)
    if (def.use.health) state.health = Math.min(100, state.health + def.use.health)
    removeItem(id, 1)
    audio.play(def.kind === 'drink' ? 'drink' : 'eat')
    showToast(`Used ${def.name}`, def.use.health ? `+${def.use.health} health` : def.use.thirst ? `+${def.use.thirst} thirst` : `+${def.use.hunger} hunger`, '', def.icon)
    hotbarDirty()
    if (activePanel === 'inventory') { if (!findItem(selectedItemId)) selectedItemId = state.inventory[0]?.id || null; renderInventory() }
    updateUI(performance.now() / 1000, true)
    return
  }
}

function dropItem(id) {
  removeItem(id, 1)
  showToast('Item released', `${ITEMS[id].name} fell into the void`, 'warn', ITEMS[id].icon)
  audio.play('place')
  if (!findItem(selectedItemId)) selectedItemId = state.inventory[0]?.id || null
  renderInventory(); hotbarDirty()
}

// ---------------------------------------------------------------------------
// fabricator
// ---------------------------------------------------------------------------
function renderRecipes() {
  if (!started) return
  el.recipeList.innerHTML = RECIPES.map((r) => {
    const costs = Object.entries(r.cost)
    const canMake = costs.every(([id, n]) => countItem(id) >= n)
    const costHtml = costs.map(([id, n]) => `<span class="cost ${countItem(id) >= n ? '' : 'missing'}"><span class="mini">${iconSvg(ITEMS[id].icon)}</span>${countItem(id)}/${n}</span>`).join('')
    return `<div class="recipe">
      <span class="recipe-icon">${iconSvg(r.icon)}</span>
      <div><h3>${r.name}<span>${r.time}</span></h3><p>${r.desc}</p><div class="recipe-cost">${costHtml}</div></div>
      <button class="craft-btn" data-craft="${r.id}" ${canMake ? '' : 'disabled'}>MAKE</button>
    </div>`
  }).join('')
}

function craft(id) {
  const recipe = RECIPES.find((r) => r.id === id)
  if (!recipe) return
  if (!Object.entries(recipe.cost).every(([item, n]) => countItem(item) >= n)) {
    showToast('Missing materials', 'Cast more caches or harvest lumenwood', 'warn', 'hammer')
    audio.play('error'); return
  }
  if (id === 'campfire' || id === 'still') {
    const tile = freeTileAhead()
    if (!tile) { showToast('No free flagstone', 'Use a Plot Deed to expand first', 'warn', 'deed'); audio.play('error'); return }
    for (const [item, n] of Object.entries(recipe.cost)) removeItem(item, n)
    if (id === 'campfire') {
      world.placeCampfire(tile.gx, tile.gz)
      state.flags.campfire = true
      showToast('Campfire built', 'Rest here to pass a day. Use raw fish nearby to cook.', '', 'campfire')
    } else {
      const still = world.placeStill(tile.gx, tile.gz)
      still.nextReady = performance.now() / 1000 + 40
      showToast('Condenser built', 'Collect water every 40 seconds', '', 'still')
    }
    state.stats.rested += 0
  } else {
    for (const [item, n] of Object.entries(recipe.cost)) removeItem(item, n)
    if (id === 'spear') { addItem('spear', 1); state.flags.weaponCrafted = true; showToast('Wooden Spear crafted', 'Equip it from slot 3', '', 'spear') }
    else if (id === 'medkit') { addItem('medkit', 1); showToast('Repair Gel crafted', '+45 health when used', '', 'medkit') }
    else if (id === 'lure') { addItem('lure', 1); showToast('Shimmer Lure crafted', 'Apply it from the backpack', '', 'lure') }
  }
  addXp(18)
  audio.play('craft')
  hotbarDirty(); lastObjSig = ''
  renderRecipes(); refreshHotbar(); refreshObjectives()
  if (activePanel === 'inventory') renderInventory()
}

// ---------------------------------------------------------------------------
// land expansion & planting
// ---------------------------------------------------------------------------
function startBuildMode() {
  if (!hasItem('deed')) { showToast('No Plot Deed', 'Fish the void for a deed', 'warn', 'deed'); audio.play('error'); return }
  if (buildMode) { cancelBuild(); return }
  const spots = perimeterSpots()
  if (!spots.length) { showToast('No room to expand', 'The plot is complete as far as it can go', 'warn', 'deed'); return }
  hidePanels()
  uiLocked = false
  buildMode = true
  buildSpots = spots
  buildSpot = spots[0]
  world.setGhostTiles(spots)
  world.highlightGhost(0)
  audio.play('click')
  showToast('Place your new flagstone', 'Look at a glowing tile, then tap PLACE', '', 'deed')
  updateUI(performance.now() / 1000, true)
}

function cancelBuild() {
  buildMode = false
  buildSpot = null
  world.clearGhosts()
  refreshObjectives()
  tryLock()
}

function updateBuildSelection() {
  if (!buildMode) return
  world.camera.updateMatrixWorld()
  raycaster.setFromCamera(centerVec, world.camera)
  const hits = raycaster.intersectObjects(world.ghosts, false)
  let index = -1
  if (hits.length) {
    const obj = hits[0].object
    index = world.ghosts.indexOf(obj)
  } else {
    const fwd = new THREE.Vector3(); world.camera.getWorldDirection(fwd)
    fwd.y = 0; fwd.normalize()
    let best = -2
    world.ghosts.forEach((g, i) => {
      tmpVec.set(g.position.x - player.x, 0, g.position.z - player.z).normalize()
      const dot = tmpVec.dot(fwd)
      if (dot > best) { best = dot; index = i }
    })
  }
  if (index >= 0 && world.ghosts[index]) {
    buildSpot = world.ghosts[index].userData.spot
    world.highlightGhost(index)
  }
}

function placePlot() {
  if (!buildMode || !buildSpot) return
  if (!hasItem('deed')) { cancelBuild(); showToast('No deed left', 'The blueprint fades', 'warn', 'deed'); return }
  const { gx, gz } = buildSpot
  if (hasTile(gx, gz)) { showToast('Already claimed', 'Choose another tile', 'warn', 'deed'); return }
  removeItem('deed', 1)
  state.tiles.push(tileKey(gx, gz))
  world.createTile(gx, gz, true)
  world.clearGhosts()
  buildMode = false
  buildSpot = null
  state.flags.expanded = true
  state.stats.plots++
  addXp(28)
  const p = worldPos(gx, gz)
  world.burst({ x: p.x, y: 0.4, z: p.z }, 0x74f0c8, 30, 3.5, 1.2)
  audio.play('place')
  showToast('Plot expanded', 'The void makes room for you. For now.', '', 'deed')
  hotbarDirty(); lastObjSig = ''
  refreshAll()
  tryLock()
}

function plantSapling() {
  const tile = freeTileAhead()
  if (!tile) { showToast('No free flagstone', 'Use a Plot Deed to expand', 'warn', 'deed'); return }
  removeItem('sapling', 1)
  const now = performance.now() / 1000
  world.placeTree(tile.gx, tile.gz, now, 0)
  state.flags.planted = true
  addXp(12)
  audio.play('place')
  world.burst({ x: tile.gx * TILE, y: 0.3, z: tile.gz * TILE }, 0x74f0c8, 16, 2.2, 0.9)
  showToast('Sapling planted', 'It grows in about 45 seconds. Bring an axe.', '', 'sapling')
  hotbarDirty(); lastObjSig = ''
  if (activePanel === 'inventory') renderInventory()
  refreshAll()
}

// ---------------------------------------------------------------------------
// fishing
// ---------------------------------------------------------------------------
function startCast() {
  if (cast.state !== 'idle') return
  if (state.selected !== 'rod') { showToast('Equip the rod', 'Select slot 1 to cast', 'warn', 'rod'); return }
  const target = computeCastTarget()
  if (!target.valid) { showToast('Aim past the edge', 'Cast only into the void, not onto your land', 'warn', 'cast'); audio.play('error'); return }
  const from = world.getRodTip()
  cast = idleCast()
  cast.state = 'flying'
  cast.t = 0
  cast.target = target
  cast.from = from.clone()
  cast.waitStart = performance.now() / 1000
  state.stats.casts++
  world.bobber.visible = true
  world.bobber.position.copy(from)
  world.hideCastRing()
  audio.play('cast')
  swingT = 0.38
}

function cancelFishing(silent = false) {
  if (cast.state === 'idle') return
  cast = idleCast()
  world.clearLine()
  world.bobber.visible = false
  el.biteBanner.classList.add('hidden')
  el.castReadout.classList.add('hidden')
  if (!silent) showToast('Line recalled', 'The void lets the line slip free', '', 'rod')
}

function reel() {
  if (cast.state !== 'bite') return
  const now = performance.now() / 1000
  audio.play('reel')
  el.biteBanner.classList.add('hidden')
  const loot = generateCatch(now)
  cast.loot = loot.items
  cast.rarity = loot.rarity
  const chest = world.createChest({ x: cast.target.x, z: cast.target.z, y: 0.06 }, loot.rarity)
  cast.chest = chest
  cast.openAt = now + 1.4
  cast.state = 'reeling'
  world.bobber.visible = false
  world.hideCastRing()
}

function generateCatch(now) {
  const index = state.castCount
  let rarity, items
  if (index < EARLY_LOOT.length) {
    items = EARLY_LOOT[index].map(([id, count]) => ({ id, count }))
    rarity = index === 2 || index === 4 ? 'rare' : 'uncommon'
  } else {
    let weights = { common: 56, uncommon: 29, rare: 11, void: 4 }
    if (state.lureCasts > 0) weights = { common: 24, uncommon: 34, rare: 29, void: 13 }
    if (state.level >= 8) { weights.common -= 6; weights.rare += 4; weights.void += 2 }
    rarity = pickWeighted(weights)
    const rolls = rarity === 'common' ? 2 : 3
    const table = LOOT[rarity]
    items = []
    for (let i = 0; i < rolls; i++) {
      let pick = null
      for (let tries = 0; tries < 6; tries++) {
        pick = pickWeightedItems(table)
        if (ITEMS[pick.id].stack === 1 && hasItem(pick.id) && !items.some((it) => it.id === pick.id)) { pick = null; continue }
        break
      }
      if (!pick) pick = pickWeightedItems(table)
      const count = randInt(pick.min, pick.max)
      const existing = items.find((it) => it.id === pick.id)
      if (existing) existing.count += count
      else items.push({ id: pick.id, count })
    }
  }
  state.castCount++
  state.stats.catches++
  if (state.lureCasts > 0) state.lureCasts--
  state.flags.firstCast = true
  return { rarity, items }
}

function pickWeighted(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const [key, w] of Object.entries(weights)) {
    r -= w
    if (r <= 0) return key
  }
  return 'common'
}
function pickWeightedItems(table) {
  const total = table.reduce((a, b) => a + b.w, 0)
  let r = Math.random() * total
  for (const item of table) {
    r -= item.w
    if (r <= 0) return item
  }
  return table[0]
}
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)) }

function grantCatch(loot, rarity) {
  let overflow = 0
  for (const item of loot) {
    const left = addItem(item.id, item.count)
    if (left > 0) overflow += left
  }
  state.chestsOpened++
  state.flags.cache = true
  const xp = 42 + (rarity === 'rare' ? 30 : rarity === 'void' ? 70 : rarity === 'uncommon' ? 12 : 0)
  addXp(xp)
  audio.play('chest')
  world.burst({ x: cast.target.x, y: 0.7, z: cast.target.z }, 0x74f0c8, 30, 4, 1.3)
  showLoot(loot, rarity, overflow)
  hotbarDirty(); lastObjSig = ''
  updateUI(performance.now() / 1000, true)
  if (overflow > 0) showToast('Backpack full', `${overflow} item${overflow > 1 ? 's' : ''} slipped back into the void`, 'bad', 'bag')
}

function showLoot(items, rarity, overflow) {
  lastLoot = { items, rarity }
  const rar = RARITY[rarity] || RARITY.common
  el.lootTitle.textContent = rarity === 'void' ? 'Voidwrought cache' : `${rar.label} cache`
  el.lootRarity.textContent = rar.label.toUpperCase()
  el.lootRarity.style.color = rar.color
  el.lootItems.innerHTML = items.map((it) => {
    const def = ITEMS[it.id]
    const color = RARITY[def.rarity]?.color || rar.color
    return `<div class="loot-item" style="--rarity:${color}">
      <span class="l-icon">${iconSvg(def.icon)}</span>
      <div><b>${def.name}</b><small>${RARITY[def.rarity]?.label || 'Common'}</small></div>
      <em>×${it.count}</em>
    </div>`
  }).join('')
  el.lootNote.textContent = overflow > 0 ? `Backpack full — ${overflow} item(s) lost to the void.` : 'Items stowed in your backpack.'
  el.lootOverlay.classList.remove('hidden')
  uiLocked = true
  releaseLock()
  clearTimeout(lootTimer)
  lootTimer = setTimeout(closeLoot, 6200)
}

function closeLoot() {
  if (el.lootOverlay.classList.contains('hidden')) return
  el.lootOverlay.classList.add('hidden')
  clearTimeout(lootTimer)
  lootTimer = null
  uiLocked = false
  tryLock()
  refreshAll()
}

function updateFishing(now, dt) {
  if (cast.state === 'idle') return
  const tip = world.getRodTip()
  if (cast.state === 'flying') {
    cast.t += dt
    const p = Math.min(1, cast.t / 0.65)
    const e = p * p * (3 - 2 * p)
    const x = THREE.MathUtils.lerp(cast.from.x, cast.target.x, e)
    const z = THREE.MathUtils.lerp(cast.from.z, cast.target.z, e)
    const y = THREE.MathUtils.lerp(cast.from.y, -2.24, e) + Math.sin(p * Math.PI) * 1.8
    world.bobber.position.set(x, y, z)
    world.setLine(tip, world.bobber.position, 0.4)
    if (p >= 1) {
      cast.state = 'waiting'
      cast.waitStart = now
      cast.waitUntil = now + 1.6 + Math.random() * 2.2
      world.placeBobber(cast.target.x, cast.target.z)
      world.splash(cast.target)
      audio.play('splash')
    }
    return
  }
  if (cast.state === 'waiting') {
    world.bobber.position.y = VOID_Y + 0.12 + Math.sin(now * 2.6) * 0.035
    world.setLine(tip, world.bobber.position, 0.8)
    if (now >= cast.waitUntil) {
      cast.state = 'bite'
      cast.biteUntil = now + 2.2
      el.biteBanner.classList.remove('hidden')
      audio.play('bite')
    }
    return
  }
  if (cast.state === 'bite') {
    world.bobber.position.y = VOID_Y + 0.04 + Math.sin(now * 22) * 0.08
    world.setLine(tip, world.bobber.position, 0.6)
    if (now >= cast.biteUntil) {
      cast.state = 'returning'
      cast.waitUntil = now + 0.7
      el.biteBanner.classList.add('hidden')
      audio.play('error')
      showToast('It slipped away', 'Reel the moment the line dips', 'warn', 'fish')
    }
    return
  }
  if (cast.state === 'returning') {
    world.bobber.position.y -= dt * 2.2
    world.setLine(tip, world.bobber.position, 0.4)
    if (now >= cast.waitUntil) {
      cast = idleCast()
      world.clearLine()
      world.bobber.visible = false
    }
    return
  }
  if (cast.state === 'reeling') {
    if (cast.chest) {
      world.setLine(tip, cast.chest.group.position, 0.5)
      if (!cast.chest.opened && now >= cast.openAt) {
        world.openChest(cast.chest)
        const target = { x: cast.chest.x, z: cast.chest.z }
        const loot = cast.loot, rarity = cast.rarity
        cast = idleCast()
        cast.target = target
        world.clearLine()
        world.bobber.visible = false
        el.biteBanner.classList.add('hidden')
        grantCatch(loot, rarity)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// interactions
// ---------------------------------------------------------------------------
function actionPress() {
  if (!started || uiLocked || state.dead) return
  audio.resume()
  const now = performance.now() / 1000
  if (buildMode) { placePlot(); return }
  if (cast.state === 'bite') { reel(); return }
  if (cast.state === 'waiting') {
    showToast('Wait for the bite', 'Reel only when the line dips', 'warn', 'rod')
    audio.play('error'); return
  }
  if (cast.state === 'flying' || cast.state === 'reeling' || cast.state === 'returning') return

  const near = nearby()
  if (near.monster) { tryAttack(near.monster); return }
  if (near.prop) {
    const { type, obj } = near.prop
    if (type === 'tree') {
      if (!obj.mature) { showToast('Still growing', `${Math.round(obj.growth * 100)}% grown`, 'warn', 'sapling'); return }
      if (!hasAxe()) { showToast('Axe required', 'Find a Salvage Axe in a void cache', 'warn', 'axe'); audio.play('error'); return }
      if (state.selected !== 'axe') { equipItem('axe'); showToast('Axe equipped', 'Swing to harvest lumenwood', '', 'axe') }
      chopTree(obj); return
    }
    if (type === 'fire') { restAtFire(); return }
    if (type === 'still') { collectStill(obj); return }
  }
  if (state.selected === 'rod') { startCast(); return }
  if (hasWeapon() || hasAxe()) {
    const item = ITEMS[state.selected]
    if (item?.tool === 'weapon' || item?.tool === 'axe') {
      swingT = 0.28
      audio.play('swing')
      return
    }
  }
  if (state.selected !== 'rod') {
    showToast('Rod required', 'Select slot 1 to cast into the void', 'warn', 'rod')
  }
}

function chopTree(tree) {
  if (!tree || !tree.mature) return
  tree.hp -= 1
  tree.shake = 1
  swingT = 0.28
  audio.play('chop')
  world.burst({ x: tree.x, y: 1.2, z: tree.z }, 0xd6c18f, 12, 2.2, 0.8)
  addItem('wood', 1)
  state.stats.wood++
  if (tree.hp <= 0) {
    world.removeTree(tree)
    addItem('wood', 2)
    state.stats.wood += 2
    if (Math.random() < 0.5) addItem('fiber', 1)
    state.flags.wood = true
    addXp(26)
    showToast('Lumenwood harvested', '+3 wood · the stump returns to the void', '', 'wood')
    hotbarDirty(); hotbarDirty(); lastObjSig = ''
    refreshAll()
  } else {
    showToast('Timber', `+1 wood · ${tree.hp} swing${tree.hp === 1 ? '' : 's'} left`, '', 'wood')
    hotbarDirty()
  }
  updateUI(performance.now() / 1000, true)
}

function collectStill(still) {
  const now = performance.now() / 1000
  if (now < (still.nextReady || 0)) {
    showToast('Condenser charging', `${Math.ceil((still.nextReady || now) - now)} seconds left`, 'warn', 'water')
    return
  }
  const amount = 1 + (state.level >= 5 ? 1 : 0)
  const left = addItem('water', amount)
  if (left > 0) { showToast('Backpack full', 'Drink some water first', 'bad', 'bag'); return }
  still.nextReady = now + 40
  addXp(6)
  audio.play('pickup')
  showToast('Water collected', `+${amount} filtered water`, '', 'water')
  hotbarDirty(); updateUI(now, true)
}

function restAtFire() {
  const now = performance.now() / 1000
  if (state.phase === 'trial' && !state.postGame) {
    showToast('The trial forbids sleep', 'Survive until the Herald falls', 'bad', 'skull')
    audio.play('error'); return
  }
  if (now < restCooldown) { showToast('The fire is settling', 'Give it a moment', 'warn', 'campfire'); return }
  restCooldown = now + 4
  state.health = Math.min(100, state.health + 26)
  state.energy = 100
  state.hunger = Math.max(8, state.hunger - 8)
  state.thirst = Math.max(8, state.thirst - 10)
  state.stats.rested++
  state.flags.rested = true
  advanceDay(true)
  if (state.phase !== 'trial' || state.postGame) {
    showBanner('REST', `DAY ${Math.min(state.day, DAYS_GRACE)} OF ${DAYS_GRACE}`, 'The fire keeps the dark at arm\'s length.', false, 2400)
  }
  audio.play('dawn')
  refreshAll()
  saveGame()
}

function tryAttack(monster) {
  if (!monster || monster.dead) return
  const now = performance.now() / 1000
  if (now - lastAttackTime < 0.55) return
  const item = ITEMS[state.selected]
  const isWeapon = item?.tool === 'weapon'
  const isAxe = item?.tool === 'axe'
  if (!isWeapon && !isAxe) {
    if (hasWeapon() || hasAxe()) showToast('Weapon not equipped', 'Use slot 3 for a weapon, slot 2 for the axe', 'warn', 'spear')
    else showToast('No weapon', 'Craft a spear in the Fabricator', 'bad', 'spear')
    audio.play('error'); return
  }
  // face check, forgiving
  const fwd = new THREE.Vector3(); world.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
  tmpVec.set(monster.x - player.x, 0, monster.z - player.z).normalize()
  if (fwd.dot(tmpVec) < -0.15) { showToast('Turn toward the threat', '', 'warn', 'skull'); return }
  const reach = Math.hypot(monster.x - player.x, monster.z - player.z) - monster.radius
  if (reach > 3.4) { showToast('Out of reach', 'Step closer to strike', 'warn', 'spear'); return }
  lastAttackTime = now
  swingT = 0.32
  const dmg = (isWeapon ? item.damage : 11) + Math.floor(state.level / 4) + randInt(0, 3)
  audio.play('hit')
  const died = world.damageMonster(monster, dmg)
  flashHit()
  if (died) onMonsterKilled(monster)
  refreshObjectives()
}

function onMonsterKilled(monster) {
  const xp = monster.def.xp || 35
  world.removeMonster(monster)
  state.kills++
  addXp(xp)
  audio.play('monster')
  if (monster.boss) {
    if (!state.victory) {
      setTimeout(() => winGame(), 900)
    }
    return
  }
  let sub = `+${xp} XP`
  if (Math.random() < 0.28) { addItem('shard', 1); sub += ' · +1 void shard' }
  if (Math.random() < 0.26) { addItem('cooked', 1); sub += ' · +1 emberfish' }
  showToast(`${monster.def.name} dissolved`, sub, '', 'skull')
  hotbarDirty(); lastObjSig = ''
}

// ---------------------------------------------------------------------------
// trial
// ---------------------------------------------------------------------------
function startTrial() {
  if (state.phase === 'trial' || state.postGame) return
  state.phase = 'trial'
  state.trialTime = 0
  state.nextSpawn = 7
  state.bossSpawned = false
  showBanner('GRACE ENDED', 'THE TRIAL BEGINS', 'The void is no longer empty.', true, 5200)
  showToast('Monsters beyond the void', 'They have permission now. Arm yourself.', 'bad', 'skull')
  audio.play('trial')
  setTimeout(() => audio.play('boss'), 800)
  lastObjSig = ''
  saveGame()
}

function spawnTrialMonster() {
  const angle = Math.random() * Math.PI * 2
  const dist = 12 + Math.random() * 4
  const x = player.x + Math.cos(angle) * dist
  const z = player.z + Math.sin(angle) * dist
  const type = state.trialTime > 28 && Math.random() < 0.42 ? 'crawler' : 'wisp'
  const m = world.spawnMonster(type, x, z)
  audio.play('monster')
  if (Math.random() < 0.35) showToast('Movement in the void', 'Something is crossing toward your plot', 'warn', 'skull')
  return m
}

function spawnBoss() {
  if (state.bossSpawned || state.postGame) return
  state.bossSpawned = true
  const angle = Math.random() * Math.PI * 2
  const dist = 13
  world.spawnMonster('herald', player.x + Math.cos(angle) * dist, player.z + Math.sin(angle) * dist)
  world.spawnMonster('wisp', player.x + Math.cos(angle + 0.5) * (dist + 1), player.z + Math.sin(angle + 0.5) * (dist + 1))
  world.spawnMonster('wisp', player.x + Math.cos(angle - 0.5) * (dist + 1), player.z + Math.sin(angle - 0.5) * (dist + 1))
  showBanner('THE TRIAL', 'THE HOLLOW HERALD', 'It has been waiting since before you woke.', true, 5200)
  audio.play('boss')
  lastObjSig = ''
}

function updateTrial(dt) {
  if (state.phase !== 'trial' || state.postGame || state.dead) return
  state.trialTime += dt
  state.nextSpawn -= dt
  const alive = world.monsters.filter((m) => !m.dead).length
  if (!state.bossSpawned) {
    if (state.nextSpawn <= 0 && alive < 5) {
      spawnTrialMonster()
      state.nextSpawn = 17 + Math.random() * 7
    }
    if (state.trialTime > 48) spawnBoss()
  }
}

function damagePlayer(amount) {
  if (state.dead || state.postGame) return
  state.health -= amount
  player.shake = 0.34
  flashHit()
  audio.play('hurt')
  if (state.health <= 0) {
    state.health = 0
    die()
  }
}

function die() {
  if (state.dead) return
  state.dead = true
  state.health = 0
  uiLocked = true
  releaseLock()
  cancelFishing(true)
  showDeathOverlay()
  audio.play('boss')
  saveGame()
}

function showDeathOverlay() {
  el.deathText.textContent = state.phase === 'trial'
    ? 'The trial took you. The simulation can print another body — but the Herald will remember.'
    : 'Your body failed. The simulation can print another, but the void keeps what it takes.'
  el.deathStats.innerHTML = [
    ['DAY', Math.min(state.day, DAYS_GRACE)],
    ['CACHES', state.chestsOpened],
    ['KILLS', state.kills],
    ['LEVEL', state.level],
  ].map(([label, value]) => `<div class="end-stat"><b>${value}</b><span>${label}</span></div>`).join('')
  el.deathOverlay.classList.remove('hidden')
}

function respawn() {
  state.dead = false
  state.health = 62
  state.hunger = Math.max(45, state.hunger)
  state.thirst = Math.max(45, state.thirst)
  state.energy = 75
  state.xp = Math.floor(state.xp * 0.8)
  player.x = 0; player.z = 0; player.yaw = 0; player.pitch = -0.16
  cancelFishing(true)
  world.clearMonsters()
  if (state.phase === 'trial' && !state.postGame) {
    state.bossSpawned = false
    state.trialTime = Math.min(state.trialTime, 26)
    state.nextSpawn = 12
  }
  el.deathOverlay.classList.add('hidden')
  uiLocked = false
  showBanner('RECONSTRUCTED', 'ANOTHER BODY', 'The simulation is patient. Try again.', false, 3000)
  audio.play('dawn')
  refreshAll()
  tryLock()
  saveGame()
}

function winGame() {
  if (state.victory) return
  state.victory = true
  state.postGame = true
  state.phase = 'won'
  state.kills++
  uiLocked = true
  releaseLock()
  world.clearMonsters()
  addItem('core', 1)
  addXp(120)
  audio.play('victory')
  el.victoryStats.innerHTML = [
    ['DAYS', state.day],
    ['CACHES', state.chestsOpened],
    ['KILLS', state.kills],
    ['LEVEL', state.level],
  ].map(([label, value]) => `<div class="end-stat"><b>${value}</b><span>${label}</span></div>`).join('')
  el.victoryOverlay.classList.remove('hidden')
  lastObjSig = ''
  saveGame()
}

function closeVictory() {
  el.victoryOverlay.classList.add('hidden')
  uiLocked = false
  tryLock()
  refreshAll()
  showToast('Herald Core stowed', 'The simulation has no more teeth. For now.', '', 'core')
}

// ---------------------------------------------------------------------------
// day cycle / stats
// ---------------------------------------------------------------------------
function advanceDay(fromRest = false) {
  state.day++
  state.dayProgress = 0.065
  state.flags.rested = true
  if (state.phase === 'grace' && state.day >= TRIAL_DAY) {
    startTrial()
  } else if (!fromRest) {
    showToast(`Day ${Math.min(state.day, DAYS_GRACE)}`, state.phase === 'trial' ? 'The trial continues.' : 'The void turns, patient as ever.', '', 'check')
    audio.play('dawn')
  }
  saveGame()
}

function updateStats(dt, now) {
  const sprinting = (keys.ShiftLeft || keys.ShiftRight) && state.energy > 2 && player.moving
  const moveExtra = player.moving ? 0.018 : 0
  state.hunger -= dt * (0.2 + moveExtra + (sprinting ? 0.04 : 0))
  state.thirst -= dt * (0.28 + moveExtra + (sprinting ? 0.05 : 0))
  state.energy -= dt * (0.025 + (player.moving ? 0.055 : 0) + (sprinting ? 0.14 : 0))
  if (!player.moving) state.energy += dt * 0.025
  state.hunger = Math.max(0, state.hunger)
  state.thirst = Math.max(0, state.thirst)
  state.energy = Math.max(0, Math.min(100, state.energy))

  if (state.hunger <= 0) state.health -= dt * 2.2
  if (state.thirst <= 0) state.health -= dt * 2.6
  if (state.hunger > 52 && state.thirst > 52 && state.health < 100 && state.health > 25) state.health += dt * 0.6
  state.health = Math.min(100, state.health)

  if (state.hunger < 22 && now - lastNightToast > 25) {
    lastNightToast = now
    showToast('Hunger gnaws', 'Eat something from the backpack', 'warn', 'berry')
  }
  if (state.thirst < 22 && now - lastNightToast > 25) {
    lastNightToast = now
    showToast('Thirst burns', 'Drink water or collect from a condenser', 'warn', 'water')
  }
  if (state.health <= 0 && !state.dead) die()

  const hour = (6 + state.dayProgress * 24) % 24
  const night = hour >= 18.4 || hour < 5.4
  if (night !== isNightCached) {
    isNightCached = night
    audio.setNight(night)
    if (night && now - lastNightToast > 20) {
      lastNightToast = now
      showToast('Night falls', state.phase === 'trial' ? 'They are closer in the dark.' : 'The void grows loud.', 'warn', 'skull')
    }
  }
}

// ---------------------------------------------------------------------------
// player movement / camera
// ---------------------------------------------------------------------------
function updatePlayer(dt) {
  if (uiLocked || state.dead) { player.moving = false; return }
  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - touchMove.y
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touchMove.x
  let mx = Math.abs(forward) > 0.08 ? forward : 0
  let mz = Math.abs(strafe) > 0.08 ? strafe : 0
  const mag = Math.hypot(mx, mz)
  if (mag > 1) { mx /= mag; mz /= mag }
  player.moving = mag > 0.06
  if (!player.moving) return

  const sprint = (keys.ShiftLeft || keys.ShiftRight) && state.energy > 2
  const speed = sprint ? 5.1 : 3.35
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw)
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw)
  const vx = (fx * mx + rx * mz) * speed
  const vz = (fz * mx + rz * mz) * speed
  const nx = player.x + vx * dt
  const nz = player.z + vz * dt
  if (canStand(nx, player.z)) player.x = nx
  if (canStand(player.x, nz)) player.z = nz
  player.bob += dt * (sprint ? 12 : 8.5)
}

function updateCamera(now, dt = 0.016) {
  if (!started) return
  player.shake = Math.max(0, player.shake - dt * 1.7)
  const bob = player.moving ? Math.sin(player.bob) * 0.035 : Math.sin(now * 1.5) * 0.006
  const shake = player.shake * 0.035
  world.camera.position.set(
    player.x + (Math.random() - 0.5) * shake,
    1.67 + bob + (Math.random() - 0.5) * shake,
    player.z + (Math.random() - 0.5) * shake
  )
  world.camera.rotation.order = 'YXZ'
  world.camera.rotation.set(player.pitch, player.yaw, Math.sin(now * 1.1) * 0.006 + (Math.random() - 0.5) * shake)

  if (swingT > 0) {
    swingT = Math.max(0, swingT - dt)
    const p = 1 - swingT / 0.32
    world.hand.rotation.x = -Math.sin(Math.min(1, p) * Math.PI) * 0.9
    world.hand.rotation.z = Math.sin(Math.min(1, p) * Math.PI) * -0.35
  } else if (cast.state !== 'idle') {
    world.hand.rotation.x = -0.35
    world.hand.rotation.z = 0.18
  } else {
    world.hand.rotation.x += (0 - world.hand.rotation.x) * 0.15
    world.hand.rotation.z += (0 - world.hand.rotation.z) * 0.15
  }
}

// ---------------------------------------------------------------------------
// main update
// ---------------------------------------------------------------------------
function updateGame(dt, now) {
  if (state.dead || uiLocked) return
  updatePlayer(dt)
  updateCamera(now, dt)

  // day cycle
  state.dayProgress += dt / DAY_SECONDS
  while (state.dayProgress >= 1) {
    state.dayProgress -= 1
    advanceDay(false)
  }

  updateStats(dt, now)
  updateFishing(now, dt)
  updateTrial(dt)
  updateBuildSelection()
  if (buildMode) world.hideCastRing()
  world.updateMonsters(dt, now, player, (m) => damagePlayer(m.damage), world.camera)

  const aliveBoss = world.monsters.find((m) => m.boss && !m.dead)
  if (aliveBoss && Math.random() < dt * 1.4) {
    // ambient dread
  }

  saveAcc += dt
  if (saveAcc > 8) { saveAcc = 0; saveGame() }

  updateUI(now)
}

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
function look(dx, dy) {
  const sens = 0.0021 * settings.sens
  player.yaw -= dx * sens
  player.pitch -= dy * sens
  player.pitch = Math.max(-1.35, Math.min(1.2, player.pitch))
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (!started) return
    if (e.code === 'Escape') {
      if (buildMode) { cancelBuild(); return }
      if (activePanel) { closePanels(); return }
      openPanel('settings')
      return
    }
    if (e.code === 'KeyB' || e.code === 'KeyI') { e.preventDefault(); openPanel('inventory'); return }
    if (e.code === 'KeyC') { e.preventDefault(); openPanel('craft'); return }
    if (uiLocked || state.dead) return
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { keys[e.code] = true; return }
    if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); actionPress(); return }
    if (/^Digit[1-5]$/.test(e.code)) { useHotbar(Number(e.code.slice(5)) - 1); return }
  })
  window.addEventListener('keyup', (e) => { keys[e.code] = false })
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; touchMove.x = 0; touchMove.y = 0 })

  document.addEventListener('mousemove', (e) => {
    if (!started || uiLocked || state.dead) return
    if (document.pointerLockElement === canvas) look(e.movementX || 0, e.movementY || 0)
  })

  let dragging = false, dragId = null, lastX = 0, lastY = 0, moved = 0
  canvas.addEventListener('pointerdown', (e) => {
    if (!started || uiLocked || state.dead) return
    if (e.pointerType === 'mouse' && document.pointerLockElement === canvas) {
      actionPress()
      return
    }
    dragging = true
    dragId = e.pointerId
    lastX = e.clientX; lastY = e.clientY; moved = 0
    canvas.setPointerCapture?.(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== dragId) return
    const dx = e.clientX - lastX, dy = e.clientY - lastY
    lastX = e.clientX; lastY = e.clientY
    moved += Math.abs(dx) + Math.abs(dy)
    look(dx, dy)
  })
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId !== dragId) return
    dragging = false; dragId = null
    if (e.pointerType === 'mouse' && moved < 6) tryLock()
  })
  canvas.addEventListener('pointercancel', () => { dragging = false; dragId = null })

  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  // joystick
  let stickId = null
  const base = el.joystick.querySelector('.stick-base')
  const knob = el.joystick.querySelector('.stick-knob')
  function stickMove(e) {
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    let dx = e.clientX - cx, dy = e.clientY - cy
    const max = rect.width * 0.32
    const len = Math.hypot(dx, dy)
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max }
    touchMove.x = dx / max
    touchMove.y = dy / max
    knob.style.transform = `translate(${dx}px, ${dy}px)`
  }
  el.joystick.addEventListener('pointerdown', (e) => {
    if (!started) return
    e.preventDefault(); e.stopPropagation()
    stickId = e.pointerId
    el.joystick.setPointerCapture?.(e.pointerId)
    stickMove(e)
  })
  el.joystick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return
    e.preventDefault(); e.stopPropagation()
    stickMove(e)
  })
  const endStick = (e) => {
    if (e.pointerId !== stickId) return
    stickId = null; touchMove.x = 0; touchMove.y = 0
    knob.style.transform = ''
  }
  el.joystick.addEventListener('pointerup', endStick)
  el.joystick.addEventListener('pointercancel', endStick)

  el.actionBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); actionPress() })
  el.inventoryBtn.addEventListener('click', () => openPanel('inventory'))
  el.craftBtn.addEventListener('click', () => openPanel('craft'))
  el.soundBtn.addEventListener('click', () => toggleMute())
  el.settingsBtn.addEventListener('click', () => openPanel('settings'))

  $$('[data-close]').forEach((btn) => btn.addEventListener('click', () => closePanels()))
  el.lootClose.addEventListener('click', closeLoot)
  el.respawnBtn.addEventListener('click', respawn)
  el.deathReset.addEventListener('click', resetGame)
  el.victoryBtn.addEventListener('click', closeVictory)
  el.victoryReset.addEventListener('click', resetGame)
  el.saveBtn.addEventListener('click', () => saveGame(true))
  el.resetBtn.addEventListener('click', confirmReset)

  el.startBtn.addEventListener('click', () => beginGame(false))
  el.continueBtn.addEventListener('click', () => beginGame(true))

  el.hotbar.addEventListener('click', (e) => {
    const slot = e.target.closest('[data-slot]')
    if (slot) useHotbar(Number(slot.dataset.slot))
  })
  el.invGrid.addEventListener('click', (e) => {
    const item = e.target.closest('[data-item]')
    if (!item) return
    selectedItemId = item.dataset.item
    renderInventory()
    audio.play('click')
  })
  el.invDetail.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (!act || !selectedItemId) return
    if (act === 'equip') equipItem(selectedItemId)
    else if (act === 'use') useItem(selectedItemId)
    else if (act === 'drop') dropItem(selectedItemId)
  })
  el.recipeList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-craft]')
    if (btn && !btn.disabled) craft(btn.dataset.craft)
  })

  el.sensRange.addEventListener('input', () => {
    settings.sens = Number(el.sensRange.value)
    el.sensVal.textContent = `${settings.sens.toFixed(1)}×`
    persistSettings()
  })
  el.volRange.addEventListener('input', () => {
    settings.volume = Number(el.volRange.value)
    el.volVal.textContent = `${Math.round(settings.volume * 100)}%`
    if (audio.master) audio.master.gain.value = settings.muted ? 0 : settings.volume * 0.9
    persistSettings()
  })
  el.hintToggle.addEventListener('click', () => {
    settings.hints = !settings.hints
    el.hintToggle.classList.toggle('on', settings.hints)
    document.body.classList.toggle('no-hints', !settings.hints)
    persistSettings()
  })
}

function syncSettings() {
  el.sensRange.value = settings.sens
  el.sensVal.textContent = `${Number(settings.sens).toFixed(1)}×`
  el.volRange.value = settings.volume
  el.volVal.textContent = `${Math.round(settings.volume * 100)}%`
  el.hintToggle.classList.toggle('on', settings.hints)
  el.soundBtn.classList.toggle('muted', settings.muted)
  setIcon(el.soundBtn, settings.muted ? 'mute' : 'sound')
}

function toggleMute() {
  settings.muted = !settings.muted
  audio.setMuted(settings.muted)
  if (audio.master) audio.master.gain.value = settings.muted ? 0 : settings.volume * 0.9
  el.soundBtn.classList.toggle('muted', settings.muted)
  setIcon(el.soundBtn, settings.muted ? 'mute' : 'sound')
  persistSettings()
  if (!settings.muted) audio.play('click')
}

function persistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch {}
}

let resetArmed = false
function confirmReset() {
  if (!resetArmed) {
    resetArmed = true
    el.resetBtn.textContent = 'Tap again to erase'
    setTimeout(() => { resetArmed = false; el.resetBtn.textContent = 'Reset simulation' }, 3200)
    return
  }
  resetGame()
}

function resetGame() {
  try { localStorage.removeItem(SAVE_KEY) } catch {}
  location.reload()
}

// ---------------------------------------------------------------------------
// loop / boot
// ---------------------------------------------------------------------------
function frame(t) {
  const dt = Math.min(0.05, Math.max(0.001, (t - lastFrame) / 1000))
  lastFrame = t
  const now = t / 1000

  if (!started) {
    world.cinematic(now)
    world.setDayNight(0.07, 1, false)
  } else {
    if (!uiLocked && !state.dead) updateGame(dt, now)
    else updateCamera(now, dt)
    world.setDayNight(state.dayProgress, state.day, state.phase === 'trial')
  }

  world.update(dt, now)
  if (started) updateUI(now)
  world.render()
  requestAnimationFrame(frame)
}

function setupPreview() {
  const save = readSave()
  world.resetIsland()
  const tiles = save?.state?.tiles || defaultState().tiles
  for (const key of tiles) {
    const [gx, gz] = key.split(',').map(Number)
    world.createTile(gx, gz, false)
  }
  if (save?.state) {
    const now = performance.now() / 1000
    for (const t of (save.trees || [])) {
      const growth = Math.max(0.05, Math.min(1, t.growth || 0))
      world.placeTree(t.gx, t.gz, now - growth * 45, growth)
    }
    for (const f of (save.fires || [])) world.placeCampfire(f.gx, f.gz)
    for (const s of (save.stills || [])) world.placeStill(s.gx, s.gz)
    state = Object.assign(defaultState(), save.state)
    state.inventory = Array.isArray(save.state.inventory) ? save.state.inventory : []
    state.flags = save.state.flags || {}
  }
}

// QA harness: append ?debug=1 to inspect or drive the simulation from the
// console. It is inert during normal play.
if (new URLSearchParams(location.search).has('debug')) {
  window.__VOIDLINE__ = {
    state: () => state,
    player,
    world,
    cast: () => cast,
    addItem,
    equipItem,
    useItem,
    startBuildMode,
    cancelBuild,
    startTrial,
    spawnBoss,
    spawnTrialMonster,
    advanceDay,
    damagePlayer,
    winGame,
    saveGame,
    refreshAll,
    setInv: (list) => { state.inventory = list.map(([id, count]) => ({ id, count })) },
    setFlags: (flags) => Object.assign(state.flags, flags),
  }
}

function boot() {
  injectStaticIcons()
  el.hintText.innerHTML = isTouch
    ? 'Drag to look · tap ACTION to act'
    : 'Drag to look · <kbd>Space</kbd> cast / act · <kbd>B</kbd> backpack'
  setupPreview()
  bindInput()
  syncSettings()
  refreshStartPreview()
  world.setDayNight(0.07, 1, false)
  world.hand.visible = false
  el.vitals.querySelector('[data-vital="health"] .v-track i').style.width = '100%'
  requestAnimationFrame(frame)
}

boot()
