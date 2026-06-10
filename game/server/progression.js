// ── Server Progression Module ──
// Thin barrel re-exporting persistence, inventory, economy, trades, hand, and run lifecycle.
// Imported by index.js; re-exported from index.js for test compatibility.

const { TICK_RATE } = require('./config');
const CARD_IDENTITY = require('../shared/cardDefs.json');
const CARD_STATS = require('../shared/cardStats.json');

const hand = require('./progression/hand');
const inventory = require('./progression/inventory');
const economy = require('./progression/economy');
const persistence = require('./progression/persistence');
const trades = require('./progression/trades');
const runLifecycle = require('./progression/runLifecycle');
const io = require('./progression/io');

// Server-side card definitions, rebuilt from shared single sources.
const CARD_STAT_OVERLAY = {
  dungeon_drake: { breathConeAngle: Math.PI / 4 },
  bulkhead_mauler: { attackConeAngle: (Math.PI * 2) / 3 },
  ancient_wyrm: { breathConeAngle: Math.PI / 3 },
  harvesting_scythe: { attackConeAngle: Math.PI },
  reapers_scythe: { attackConeAngle: Math.PI },
  dragons_breath: { attackConeAngle: Math.PI / 3 },
  astral_guardian: { attackIntervalMs: Math.floor(1000 / TICK_RATE) },
};

const CARD_DEFS = Object.fromEntries(
  Object.keys(CARD_IDENTITY).map((id) => [
    id,
    { ...CARD_IDENTITY[id], ...CARD_STATS[id], ...CARD_STAT_OVERLAY[id] },
  ])
);

// Key item definitions registry — mirrors CARD_DEFS pattern.
const KEY_ITEM_DEFS = {
  dodge_roll: {
    id: 'dodge_roll',
    name: 'Dodge Roll',
    description: 'Quick roll forward with brief invincibility frames',
    cooldownMs: 800,
    type: 'movement',
    invincibleDurationMs: 300,
    rollDistanceMs: 200,
  },
  summon_recall: {
    id: 'summon_recall',
    name: 'Recall Whistle',
    description: 'Recall all your summoned minions to ring positions around you',
    cooldownMs: 10000,
    type: 'summon',
    ringRadiusMin: 1.5,
    ringRadiusMax: 2.5,
  },
  field_medic_kit: {
    id: 'field_medic_kit',
    name: 'Field Medic Kit',
    description: 'Restore HP for nearby allies in an area',
    cooldownMs: 7000,
    type: 'support',
    healRadius: 5,
    hpRestore: 8,
  },
  guard_block: {
    id: 'guard_block',
    name: 'Guard Block',
    description: 'Raise a shield to reduce incoming damage',
    cooldownMs: 3500,
    type: 'defensive',
    damageReduction: 0.7,
    durationMs: 700,
  },
  flare_beacon: {
    id: 'flare_beacon',
    name: 'Flare Beacon',
    description: 'Reveal all enemies in a large radius on your HUD for a few seconds',
    cooldownMs: 10000,
    type: 'utility',
    revealRadius: 25,
    revealDurationMs: 3000,
  },
  loot_magnet: {
    id: 'loot_magnet',
    name: 'Loot Magnet',
    description: 'Attract nearby drops automatically',
    cooldownMs: 8000,
    type: 'utility',
    attractRadius: 8,
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    description: 'Next 2 card uses ignore slot cooldown',
    cooldownMs: 13000,
    type: 'offensive',
    charges: 2,
  },
  smoke_bomb: {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    description: 'Drop a smoke zone that conceals players inside it from enemies',
    cooldownMs: 8000,
    type: 'stealth',
    durationMs: 2000,
    radius: 4,
  },
  ground_anchor: {
    id: 'ground_anchor',
    name: 'Ground Anchor',
    description: 'Become immune to knockback and displacement',
    cooldownMs: 6000,
    type: 'defensive',
    durationMs: 1500,
    speedMultiplier: 0.7,
  },
  phase_step: {
    id: 'phase_step',
    name: 'Phase Step',
    description: 'Swap positions with an ally within range',
    cooldownMs: 12000,
    type: 'utility',
    range: 6,
  },
  purge_charm: {
    id: 'purge_charm',
    name: 'Purge Charm',
    description: 'Remove all negative effects',
    cooldownMs: 7000,
    type: 'utility',
  },
  echo_strike: {
    id: 'echo_strike',
    name: 'Echo Strike',
    description: 'Arm an echo: your next weapon hit strikes a second time for 50% damage',
    cooldownMs: 10000,
    type: 'offensive',
    echoFraction: 0.5,
  },
  barrier_dome: {
    id: 'barrier_dome',
    name: 'Barrier Dome',
    description: 'Project a protective dome that blocks incoming projectiles',
    cooldownMs: 14000,
    type: 'defensive',
    radius: 3,
    durationMs: 1000,
  },
  rally_cry: {
    id: 'rally_cry',
    name: 'Rally Cry',
    description: 'Grant a short party-wide move-speed buff to nearby allies',
    cooldownMs: 10000,
    type: 'support',
    radius: 8,
    durationMs: 4000,
    speedMultiplier: 1.1,
  },
};

function getKeyItemDef(id) {
  return KEY_ITEM_DEFS[id] || undefined;
}

function getUnlockedKeyItems() {
  return Object.values(KEY_ITEM_DEFS);
}

function isKeyItemUnlocked(player, keyItemId) {
  return keyItemId in KEY_ITEM_DEFS;
}

function initProgression(deps) {
  const getIo = deps.getIo || (deps.io ? () => deps.io : undefined);
  io.setProgressionCallbacks({
    getIo,
    previewReturnRewards: (state, playerId) => runLifecycle.previewReturnRewards(state, playerId),
  });
  hand.setHandCallbacks({
    onTerminalCheck: (state) => runLifecycle.checkRunTerminalState(state),
    onDeckUpdate: (state, player) => io.maybeEmitPlayerDeckUpdate(state, player),
  });
}

function setBroadcastLobbyUpdate(fn) {
  io.setProgressionCallbacks({ broadcastLobbyUpdate: fn });
}

function setRebuildWallColliders(fn) {
  io.setProgressionCallbacks({ rebuildWallColliders: fn });
}

module.exports = {
  initProgression,
  setBroadcastLobbyUpdate,
  setRebuildWallColliders,
  CARD_DEFS,
  KEY_ITEM_DEFS,
  getKeyItemDef,
  getUnlockedKeyItems,
  isKeyItemUnlocked,
  ...hand,
  ...inventory,
  ...economy,
  ...persistence,
  ...trades,
  ...runLifecycle,
  ...io,
};
