// ── Server Progression Module ──
// Player persistence, rewards, deck/hand management, run state, spawning, snapshots.
// Imported by index.js; re-exported from index.js for test compatibility.

const crypto = require('crypto');
const {
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  MAX_MAGIC_STONES,
  SPAWN_PADDING,
  LOOT_SPAWN_CHANCE,
  VICTORY_REWARD_ROTATION
} = require('./config');
const {
  mulberry32,
  roomsByRole,
  randomRoomPositionByRole
} = require('./dungeon');
const {
  ENEMY_DEFS,
  firstRoomPosition,
  randomRoomPosition,
  randomWanderTarget
} = require('./simulation');
const { getQuest, getSelectedQuest } = require('./quests');

let _gameState = null;
let _getIo = () => null;
let _broadcastLobbyUpdate = () => {};
let provider = null;

function initProgression(deps) {
  _gameState = deps.gameState;
  if (deps.getIo) _getIo = deps.getIo;
  else if (deps.io) _getIo = () => deps.io;
}

function setBroadcastLobbyUpdate(fn) {
  _broadcastLobbyUpdate = fn;
}

function setTestProvider(p) {
  provider = p;
}

function getProvider() {
  return provider;
}

// Server-side card definitions (mirrors game/client/cards.js, weapon entries include damage)
const CARD_DEFS = {
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', type: 'weapon', damage: 15, charges: 5 },
  flame_blade: { id: 'flame_blade', name: 'Flame Blade', type: 'weapon', damage: 25, charges: 3 },
  battle_familiar: { id: 'battle_familiar', name: 'Battle Familiar', type: 'summon', charges: 1, magicStoneCost: 50, damage: 40 },
  dungeon_drake: { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'monster', charges: 1 },
  steel_broadsword: {
    id: 'steel_broadsword',
    name: 'Steel Broadsword',
    type: 'weapon',
    damage: 28,
    charges: 6,
    isEvolved: true,
    specialEffect: 'knockback'
  },
  inferno_edge: {
    id: 'inferno_edge',
    name: 'Inferno Edge',
    type: 'weapon',
    damage: 40,
    charges: 4,
    isEvolved: true,
    specialEffect: 'fire_trail'
  },
  guardian_familiar: {
    id: 'guardian_familiar',
    name: 'Guardian Familiar',
    type: 'summon',
    charges: 1,
    magicStoneCost: 65,
    damage: 70,
    isEvolved: true,
    specialEffect: 'barrier_burst'
  },
  ancient_drake: {
    id: 'ancient_drake',
    name: 'Ancient Drake',
    type: 'monster',
    charges: 1,
    minionHp: 90,
    isEvolved: true,
    specialEffect: 'bleed'
  },
  mana_prism: {
    id: 'mana_prism',
    name: 'Mana Prism',
    type: 'summon',
    charges: 1,
    magicStoneCost: 0,
    effect: 'mana_prism',
    durationSeconds: 12,
    magicStonePulse: 10,
    pulseIntervalMs: 2000,
  },
  harvesting_scythe: {
    id: 'harvesting_scythe',
    name: 'Harvesting Scythe',
    type: 'weapon',
    damage: 8,
    charges: 3,
    attackConeAngle: Math.PI,
    magicStoneOnHit: 5,
    magicStoneOnKill: 15,
  },
  sacrificial_altar: {
    id: 'sacrificial_altar',
    name: 'Sacrificial Altar',
    type: 'summon',
    charges: 1,
    magicStoneCost: 0,
    effect: 'sacrificial_altar',
    sacrificeRadius: 10,
    magicStoneGain: 100,
    chargeRestore: 2,
  },
  battery_automaton: {
    id: 'battery_automaton',
    name: 'Battery Automaton',
    type: 'monster',
    charges: 1,
    magicStoneCost: 50,
    effect: 'battery_automaton',
    minionHp: 80,
    minionTtl: 30,
    chargeRestore: 1,
    chargePulseIntervalMs: 6000,
  },
  chrono_trigger: {
    id: 'chrono_trigger',
    name: 'Chrono Trigger',
    type: 'summon',
    charges: 1,
    magicStoneCost: 0,
    effect: 'chrono_trigger',
    adjacentChargeRestore: 2,
  },
};

// Starting deck card ids — mirrors createStartingDeck() in client/cards.js.
const STARTING_DECK_IDS = [
  'iron_sword',
  'flame_blade',
  'battle_familiar',
  'dungeon_drake',
  'iron_sword',
  'iron_sword',
  'battle_familiar',
  'flame_blade'
];

const EVOLUTION_GRIND_REQUIRED = 10;
const EVOLUTION_TRANSFORMS = {
  iron_sword: 'steel_broadsword',
  flame_blade: 'inferno_edge',
  battle_familiar: 'guardian_familiar',
  dungeon_drake: 'ancient_drake'
};

function createCardInstance(cardId, overrides = {}) {
  if (!CARD_DEFS[cardId]) return null;
  const grind = Number.isFinite(overrides.grind) ? overrides.grind : 0;
  const level = Number.isFinite(overrides.level) ? overrides.level : 1;
  const instanceId = typeof overrides.instanceId === 'string' && overrides.instanceId.length > 0
    ? overrides.instanceId
    : crypto.randomUUID();
  return {
    ...overrides,
    instanceId,
    cardId,
    grind,
    level
  };
}

function createInventoryFromCardIds(cardIds) {
  return cardIds.map(cardId => createCardInstance(cardId)).filter(Boolean);
}

function createInventoryFromOwnedCards(ownedCards = {}) {
  const inventory = [];
  for (const [cardId, count] of Object.entries(ownedCards || {})) {
    if (!CARD_DEFS[cardId]) continue;
    const copies = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    for (let i = 0; i < copies; i++) {
      inventory.push(createCardInstance(cardId));
    }
  }
  return inventory;
}

function normalizeInventory(inventory, ownedCards) {
  if (!Array.isArray(inventory)) {
    return createInventoryFromOwnedCards(ownedCards);
  }

  const usedIds = new Set();
  const normalized = [];
  for (const entry of inventory) {
    if (!entry || typeof entry !== 'object' || !CARD_DEFS[entry.cardId]) continue;
    let instance = createCardInstance(entry.cardId, entry);
    if (!instance) continue;
    if (usedIds.has(instance.instanceId)) {
      instance = { ...instance, instanceId: crypto.randomUUID() };
    }
    usedIds.add(instance.instanceId);
    normalized.push(instance);
  }
  return normalized;
}

function inventoryToOwnedCards(inventory = []) {
  const ownedCards = {};
  for (const instance of Array.isArray(inventory) ? inventory : []) {
    if (!instance || !CARD_DEFS[instance.cardId]) continue;
    ownedCards[instance.cardId] = (ownedCards[instance.cardId] || 0) + 1;
  }
  return ownedCards;
}

function getInventoryInstance(inventory, instanceId) {
  if (!Array.isArray(inventory) || typeof instanceId !== 'string') return null;
  return inventory.find(instance => instance && instance.instanceId === instanceId) || null;
}

function cardIdForDeckEntry(entry, inventory) {
  const instance = getInventoryInstance(inventory, entry);
  if (instance) return instance.cardId;
  return CARD_DEFS[entry] ? entry : null;
}

function normalizeSelectedDeck(selectedDeck, inventory) {
  if (!Array.isArray(selectedDeck)) return [];
  const usedInstanceIds = new Set();
  const normalized = [];

  for (const entry of selectedDeck) {
    if (typeof entry !== 'string') continue;

    const exactInstance = getInventoryInstance(inventory, entry);
    if (exactInstance) {
      if (!usedInstanceIds.has(exactInstance.instanceId)) {
        usedInstanceIds.add(exactInstance.instanceId);
        normalized.push(exactInstance.instanceId);
      }
      continue;
    }

    if (CARD_DEFS[entry]) {
      const available = inventory.find(instance =>
        instance.cardId === entry && !usedInstanceIds.has(instance.instanceId)
      );
      if (available) {
        usedInstanceIds.add(available.instanceId);
        normalized.push(available.instanceId);
      } else {
        normalized.push(entry);
      }
      continue;
    }

    normalized.push(entry);
  }

  return normalized;
}

function normalizePlayerInventory(player) {
  if (!player) return player;
  player.inventory = normalizeInventory(player.inventory, player.ownedCards);
  player.ownedCards = inventoryToOwnedCards(player.inventory);
  player.selectedDeck = normalizeSelectedDeck(player.selectedDeck || [], player.inventory);
  return player;
}

function findAvailableInventoryInstance(cardId, deck, inventory) {
  if (!CARD_DEFS[cardId] || !Array.isArray(inventory)) return null;
  const selected = new Set(Array.isArray(deck) ? deck : []);
  return inventory.find(instance => instance.cardId === cardId && !selected.has(instance.instanceId)) || null;
}

function canAddCardInstanceToDeck(instanceId, deck, inventory) {
  if (!Array.isArray(deck) || deck.length >= DECK_MAX_SIZE) return false;
  const instance = getInventoryInstance(inventory, instanceId);
  if (!instance) return false;
  return !deck.includes(instance.instanceId);
}

function evolveCard(player, instanceId) {
  if (!player) return { ok: false, reason: 'Player not found' };
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, reason: 'Missing instanceId' };
  }

  normalizePlayerInventory(player);

  const instance = getInventoryInstance(player.inventory, instanceId);
  if (!instance) {
    return { ok: false, reason: `Unknown card instance: ${instanceId}` };
  }

  if ((instance.grind || 0) < EVOLUTION_GRIND_REQUIRED) {
    return { ok: false, reason: `Card must be +${EVOLUTION_GRIND_REQUIRED} to evolve` };
  }

  const fromCardId = instance.cardId;
  const toCardId = EVOLUTION_TRANSFORMS[fromCardId];
  if (!toCardId || !CARD_DEFS[toCardId]) {
    return { ok: false, reason: `No evolution available for ${fromCardId}` };
  }

  instance.cardId = toCardId;
  instance.grind = 0;
  instance.evolvedFrom = fromCardId;
  instance.evolvedAt = Date.now();
  instance.isEvolved = true;

  player.ownedCards = inventoryToOwnedCards(player.inventory);

  // Legacy decks are card-id based, so replace one matching base entry to keep
  // deck validation compatible after the owned base-card count decreases.
  if (Array.isArray(player.selectedDeck)) {
    const deckIndex = player.selectedDeck.indexOf(fromCardId);
    if (deckIndex !== -1) {
      player.selectedDeck[deckIndex] = toCardId;
    }
  }

  return {
    ok: true,
    instance: { ...instance },
    fromCardId,
    toCardId
  };
}

function createPlayerProgress() {
  const inventory = createInventoryFromCardIds(STARTING_DECK_IDS);
  return {
    currency: 0,
    inventory,
    ownedCards: inventoryToOwnedCards(inventory),
    runRewards: null,
    currencyEarnedThisRun: 0
  };
}

function extractPersistentData(player) {
  normalizePlayerInventory(player);
  return {
    currency: player.currency || 0,
    inventory: player.inventory.map(instance => ({ ...instance })),
    ownedCards: inventoryToOwnedCards(player.inventory),
    selectedDeck: player.selectedDeck || [],
    x: player.x || 0,
    y: player.y || 0.5,
    z: player.z || 0,
    rotation: player.rotation || 0
  };
}

function persistenceKey(playerId) {
  const player = _gameState.players[playerId];
  if (!player) return playerId;
  return player.accountId || playerId;
}

function savePlayerData(playerId) {
  if (!provider) return;
  const player = _gameState.players[playerId];
  if (!player) return;
  try {
    const key = persistenceKey(playerId);
    provider.savePlayer(key, extractPersistentData(player));
  } catch (err) {
    console.error(`[persistence] savePlayerData failed for ${playerId}:`, err.message);
  }
}

function saveAllPlayers() {
  for (const playerId of Object.keys(_gameState.players)) {
    try {
      savePlayerData(playerId);
    } catch (err) {
      console.error(`[persistence] saveAllPlayers failed for ${playerId}:`, err.message);
    }
  }
}

function createRunState() {
  const quest = getSelectedQuest(_gameState);
  const objectiveLabel = quest.objectiveType === 'collect_items'
    ? `${quest.name}: defeat ${quest.enemyCount} enemies (collect ${quest.itemCount} crystals — coming soon)`
    : `${quest.name}: ${quest.description}`;

  return {
    id: crypto.randomUUID(),
    status: 'playing',
    questId: quest.id,
    questName: quest.name,
    questDescription: quest.description,
    rewardCurrency: quest.rewardCurrency,
    objective: {
      type: 'defeat_enemies',
      label: objectiveLabel,
      totalEnemies: _gameState.enemies.length,
      defeatedEnemies: 0
    },
    startedAt: Date.now()
  };
}

function startDungeonRun() {
  _gameState.run = createRunState();
  for (const p of Object.values(_gameState.players)) {
    p.currencyEarnedThisRun = 0;
    p.runRewards = null;
  }
}

function clampObjectiveProgress(run) {
  run.objective.defeatedEnemies = Math.min(run.objective.defeatedEnemies, run.objective.totalEnemies);
}

function syncRunObjectiveToEnemies() {
  if (!_gameState.run) return;
  _gameState.run.objective.totalEnemies = _gameState.enemies.length;
  clampObjectiveProgress(_gameState.run);
}

function recordEnemyDefeated(count = 1) {
  if (!_gameState.run) return;
  _gameState.run.objective.defeatedEnemies += count;
  clampObjectiveProgress(_gameState.run);
}

function buildRunSummary(status) {
  const run = _gameState.run;
  if (!run) return null;

  const players = Object.entries(_gameState.players).map(([id, p]) => ({
    id,
    hp: p.hp,
    dead: p.dead,
    currency: p.currency,
    rewards: buildPlayerRewardSummary(id)
  }));

  return {
    runId: run.id,
    status,
    durationMs: Date.now() - run.startedAt,
    objective: { ...run.objective },
    players,
    defeatedEnemies: run.objective.defeatedEnemies,
    currencyCollected: players.reduce((sum, p) => sum + p.currency, 0)
  };
}

function grantCard(player, cardId) {
  if (!CARD_DEFS[cardId]) return false;
  normalizePlayerInventory(player);
  player.inventory.push(createCardInstance(cardId));
  player.ownedCards = inventoryToOwnedCards(player.inventory);
  return true;
}

function grantRunRewards(playerId, summary) {
  const player = _gameState.players[playerId];
  if (!player) return;

  const lootCurrency = player.currencyEarnedThisRun || 0;

  if (summary.status === 'victory') {
    const quest = _gameState.run && _gameState.run.questId
      ? getQuest(_gameState.run.questId)
      : getSelectedQuest(_gameState);
    const currencyBonus = (quest && quest.rewardCurrency) || 10;
    player.currency += currencyBonus;

    if (!_gameState._victoryCounters) _gameState._victoryCounters = {};
    const idx = _gameState._victoryCounters[playerId] || 0;
    const cardId = VICTORY_REWARD_ROTATION[idx % VICTORY_REWARD_ROTATION.length];
    _gameState._victoryCounters[playerId] = idx + 1;

    const cards = [];
    if (grantCard(player, cardId)) {
      const cardDef = CARD_DEFS[cardId];
      cards.push({ id: cardId, name: cardDef.name, count: 1 });
    }

    player.runRewards = {
      currency: currencyBonus + lootCurrency,
      cards
    };
  } else {
    player.runRewards = {
      currency: lootCurrency,
      cards: []
    };
  }
}

function buildPlayerRewardSummary(playerId) {
  const player = _gameState.players[playerId];
  if (!player || !player.runRewards) return { currency: 0, cards: [] };
  return player.runRewards;
}

function validateDeck(deck, ownedOrInventory) {
  if (deck.length < DECK_MIN_SIZE) {
    return { valid: false, reason: `Deck must have at least ${DECK_MIN_SIZE} cards` };
  }
  if (deck.length > DECK_MAX_SIZE) {
    return { valid: false, reason: `Deck can have at most ${DECK_MAX_SIZE} cards` };
  }

  const inventory = Array.isArray(ownedOrInventory) ? normalizeInventory(ownedOrInventory) : null;
  const ownedCards = inventory ? inventoryToOwnedCards(inventory) : (ownedOrInventory || {});
  const usedInstanceIds = new Set();
  const counts = {};
  for (const entry of deck) {
    let cardId = null;

    if (inventory) {
      const instance = getInventoryInstance(inventory, entry);
      if (instance) {
        if (usedInstanceIds.has(instance.instanceId)) {
          return { valid: false, reason: `Duplicate card instance in deck: ${instance.instanceId}` };
        }
        usedInstanceIds.add(instance.instanceId);
        cardId = instance.cardId;
      } else {
        cardId = CARD_DEFS[entry] ? entry : null;
      }
    } else {
      cardId = CARD_DEFS[entry] ? entry : null;
    }

    if (!CARD_DEFS[cardId]) {
      return { valid: false, reason: `Unknown card id: ${entry}` };
    }
    counts[cardId] = (counts[cardId] || 0) + 1;
  }

  for (const [cardId, count] of Object.entries(counts)) {
    const owned = ownedCards[cardId] || 0;
    if (count > owned) {
      return { valid: false, reason: `Not enough copies of ${cardId} (have ${owned}, need ${count})` };
    }
  }

  return { valid: true };
}

function canAddCardToDeck(cardId, deck, ownedOrInventory) {
  const inventory = Array.isArray(ownedOrInventory) ? normalizeInventory(ownedOrInventory) : null;
  if (inventory) {
    const instance = getInventoryInstance(inventory, cardId);
    if (instance) return canAddCardInstanceToDeck(instance.instanceId, deck, inventory);
    if (!CARD_DEFS[cardId]) return false;
    return !!findAvailableInventoryInstance(cardId, deck, inventory) && deck.length < DECK_MAX_SIZE;
  }

  const ownedCards = ownedOrInventory || {};
  if (!CARD_DEFS[cardId]) return false;
  if (deck.length >= DECK_MAX_SIZE) return false;

  const currentCount = deck.filter(id => id === cardId).length;
  const owned = ownedCards[cardId] || 0;
  if (currentCount >= owned) return false;

  return true;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDrawDeckFromSelectedDeck(player) {
  normalizePlayerInventory(player);
  const deck = player.selectedDeck
    .map(entry => cardIdForDeckEntry(entry, player.inventory))
    .filter(Boolean);
  shuffleArray(deck);
  player.deck = deck;
  return deck;
}

function drawCardFromDeck(player) {
  if (!player.deck || player.deck.length === 0) return null;
  const cardId = player.deck.pop();
  const def = CARD_DEFS[cardId];
  if (!def) return null;
  const card = {
    id: def.id,
    name: def.name,
    type: def.type,
    charges: def.charges,
    remainingCharges: def.charges,
  };
  if (def.magicStoneCost != null) {
    card.magicStoneCost = def.magicStoneCost;
  }
  if (def.isEvolved) {
    card.isEvolved = true;
  }
  if (def.specialEffect) {
    card.specialEffect = def.specialEffect;
  }
  return card;
}

function initPlayerHand(player) {
  player.hand = [];
  for (let i = 0; i < 4; i++) {
    const card = drawCardFromDeck(player);
    if (card) {
      player.hand.push(card);
    }
  }
  return player.hand;
}

function drawReplacementCard(player, slotIndex) {
  const card = drawCardFromDeck(player);
  if (card) {
    player.hand[slotIndex] = card;
  } else {
    player.hand.splice(slotIndex, 1);
  }
}

function addMagicStones(player, amount) {
  if (!player || !Number.isFinite(amount) || amount <= 0) return 0;
  const before = Number.isFinite(player.magicStones) ? player.magicStones : 0;
  player.magicStones = Math.min(MAX_MAGIC_STONES, before + amount);
  return player.magicStones - before;
}

function restoreCardCharges(card, amount) {
  if (!card || !Number.isFinite(amount) || amount <= 0) return 0;
  const maxCharges = Number.isFinite(card.charges) ? card.charges : 0;
  const before = Number.isFinite(card.remainingCharges) ? card.remainingCharges : maxCharges;
  const after = Math.min(maxCharges, before + amount);
  card.remainingCharges = after;
  return after - before;
}

function restoreHandCharges(player, amount, options = {}) {
  if (!player || !Array.isArray(player.hand)) return [];

  const allowedTypes = options.types ? new Set(options.types) : null;
  const slots = Array.isArray(options.slots)
    ? options.slots
    : player.hand.map((_, index) => index);

  let candidates = slots
    .filter((slotIndex) => slotIndex >= 0 && slotIndex < player.hand.length)
    .map((slotIndex) => ({ slotIndex, card: player.hand[slotIndex] }))
    .filter(({ card }) => {
      if (!card) return false;
      if (allowedTypes && !allowedTypes.has(card.type)) return false;
      return Number.isFinite(card.remainingCharges) && Number.isFinite(card.charges) && card.remainingCharges < card.charges;
    });

  if (options.selection === 'mostDepleted') {
    candidates = candidates.sort((a, b) => {
      const aMissing = a.card.charges - a.card.remainingCharges;
      const bMissing = b.card.charges - b.card.remainingCharges;
      return bMissing - aMissing || a.slotIndex - b.slotIndex;
    });
  } else if (options.selection === 'random' && candidates.length > 1) {
    const start = Math.floor(Math.random() * candidates.length);
    candidates = candidates.slice(start).concat(candidates.slice(0, start));
  }

  const limit = Number.isFinite(options.maxTargets) ? options.maxTargets : candidates.length;
  const restored = [];
  for (const { slotIndex, card } of candidates.slice(0, limit)) {
    const restoredAmount = restoreCardCharges(card, amount);
    if (restoredAmount > 0) {
      restored.push({ slotIndex, cardId: card.id, amount: restoredAmount });
    }
  }
  return restored;
}

function spawnEnemy(x, z, type = 'grunt', spawnedBy) {
  if (!ENEMY_DEFS[type]) {
    throw new Error(`Unknown enemy type: ${type} (valid: ${Object.keys(ENEMY_DEFS).join(', ')})`);
  }
  const def = ENEMY_DEFS[type];
  const enemy = {
    id: crypto.randomUUID(),
    x,
    z,
    type,
    hp: def.hp,
    maxHp: def.hp,
    state: 'idle',
    attackState: 'idle',
    wanderTarget: { x, z }
  };
  if (type === 'spawner') {
    enemy.lastSpawnTime = Date.now();
  }
  if (spawnedBy !== undefined) {
    enemy.spawnedBy = spawnedBy;
  }
  _gameState.enemies.push(enemy);
  return enemy;
}

function removeDeadEnemies() {
  const before = _gameState.enemies.length;
  _gameState.enemies = _gameState.enemies.filter(e => e.hp > 0);
  const removed = before - _gameState.enemies.length;
  if (removed > 0) {
    recordEnemyDefeated(removed);
  }
  return removed;
}

function cleanupAfterDamage() {
  if (removeDeadEnemies() > 0) {
    checkRunTerminalState();
  }
}

function spawnLoot(layout, rng) {
  if (Math.random() >= LOOT_SPAWN_CHANCE) return;

  const treasureRooms = roomsByRole(layout, 'treasure');
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');
  let pos;

  if (treasureRooms.length > 0) {
    const room = treasureRooms[Math.floor(rng() * treasureRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else if (nonStartRooms.length > 0) {
    const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else {
    pos = randomRoomPosition();
  }

  const value = Math.floor(Math.random() * 16) + 5;
  const id = crypto.randomUUID();
  _gameState.loot.push({ id, x: pos.x, z: pos.z, value, createdAt: Date.now() });
  console.log(`[loot] spawned id=${id} value=${value}`);
}

function spawnEnemies() {
  const layout = _gameState.layout;
  const seed = _gameState.layoutSeed || 42;
  const rng = mulberry32(seed + 1000);

  const combatRooms = roomsByRole(layout, 'combat');
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');

  const quest = getSelectedQuest(_gameState);
  const spawnTypes = ['skirmisher', 'skirmisher', 'grunt', 'miniboss', 'spawner'];
  const enemyCount = Number.isFinite(quest.enemyCount) ? quest.enemyCount : spawnTypes.length;
  const typesToSpawn = [];
  for (let i = 0; i < enemyCount; i++) {
    typesToSpawn.push(spawnTypes[i % spawnTypes.length]);
  }

  for (const type of typesToSpawn) {
    let pos;
    if (combatRooms.length > 0) {
      pos = randomRoomPositionByRole(layout, 'combat', rng);
    } else if (nonStartRooms.length > 0) {
      const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
      const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
      const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
      pos = {
        x: room.x + (rng() * 2 - 1) * halfW,
        z: room.z + (rng() * 2 - 1) * halfD,
      };
    } else {
      pos = randomRoomPosition();
    }
    const enemy = spawnEnemy(pos.x, pos.z, type);
    enemy.wanderTarget = randomWanderTarget();
  }

  spawnLoot(layout, rng);
}

function checkRunTerminalState() {
  if (!_gameState.run || _gameState.run.status !== 'playing') return;

  let status = null;

  if (_gameState.run.objective.defeatedEnemies >= _gameState.run.objective.totalEnemies) {
    status = 'victory';
  }

  if (!status) {
    const activePlayers = Object.values(_gameState.players);
    if (activePlayers.length > 0 && activePlayers.every(p => p.hp <= 0)) {
      status = 'failed';
    }
  }

  if (!status) return;

  _gameState.run.status = status;

  for (const playerId of Object.keys(_gameState.players)) {
    grantRunRewards(playerId, { status });
  }

  for (const playerId of Object.keys(_gameState.players)) {
    savePlayerData(playerId);
  }

  const summary = buildRunSummary(status);
  const io = _getIo();
  if (io) {
    io.emit(status === 'victory' ? 'runComplete' : 'runFailed', summary);
  }
}

function resetTransientRunState() {
  _gameState.enemies = [];
  _gameState.minions = [];
  _gameState.loot = [];
}

function stateSnapshot() {
  const players = {};
  for (const [id, p] of Object.entries(_gameState.players)) {
    players[id] = {
      x: p.x,
      y: p.y,
      z: p.z,
      rotation: p.rotation,
      deck: p.deck,
      hand: p.hand,
      hp: p.hp,
      dead: p.dead,
      ready: p.ready,
      magicStones: p.magicStones,
      currency: p.currency,
      ownedCards: p.ownedCards ?? (p.inventory ? inventoryToOwnedCards(p.inventory) : undefined),
      runRewards: p.runRewards,
      currencyEarnedThisRun: p.currencyEarnedThisRun,
      selectedDeck: p.selectedDeck,
      inventory: Array.isArray(p.inventory) ? p.inventory.map(instance => ({ ...instance })) : p.inventory,
      debugScenario: p.debugScenario
    };
  }

  return {
    players,
    enemies: _gameState.enemies,
    minions: _gameState.minions,
    loot: _gameState.loot,
    lobby: _gameState.lobby,
    gamePhase: _gameState.gamePhase,
    selectedQuestId: _gameState.selectedQuestId,
    run: _gameState.run,
    dungeonBounds: _gameState.dungeonBounds,
    layoutSeed: _gameState.layoutSeed,
    currency: _gameState.currency
  };
}

function returnPlayersToLobby() {
  for (const playerId of Object.keys(_gameState.players)) {
    savePlayerData(playerId);
  }

  resetTransientRunState();

  _gameState.gamePhase = 'lobby';
  delete _gameState.run;

  const spawn = firstRoomPosition();
  for (const playerId of Object.keys(_gameState.players)) {
    const player = _gameState.players[playerId];
    const preservedCurrency = player.currency;
    const preservedInventory = player.inventory;
    const preservedOwnedCards = player.ownedCards || inventoryToOwnedCards(player.inventory);
    const preservedRunRewards = player.runRewards;

    player.ready = false;
    player.dead = false;
    player.hp = MAX_HP;
    player.x = spawn.x;
    player.y = 0.5;
    player.z = spawn.z;
    player.currency = preservedCurrency;
    player.inventory = preservedInventory;
    player.ownedCards = preservedOwnedCards;
    player.runRewards = preservedRunRewards;
    player.currencyEarnedThisRun = 0;
    player.lastMoveTime = Date.now();
    player.pendingSummons.clear();
    player.slotCooldowns = [null, null, null, null];
  }

  const io = _getIo();
  if (io) {
    io.emit('stateUpdate', stateSnapshot());
  }
  _broadcastLobbyUpdate();
}

function checkAllReady() {
  const all = Object.values(_gameState.players);
  if (all.length > 0 && all.every(p => p.ready)) {
    _gameState.gamePhase = 'playing';
    const spawn = firstRoomPosition();
    for (const player of all) {
      player.x = spawn.x;
      player.y = 0.5;
      player.z = spawn.z;
      player.lastMoveTime = Date.now();
      createDrawDeckFromSelectedDeck(player);
      initPlayerHand(player);
      player.slotCooldowns = [null, null, null, null];
    }
    spawnEnemies();
    startDungeonRun();
    const io = _getIo();
    if (io) {
      io.emit('startGame');
    }
  }
}

module.exports = {
  initProgression,
  setBroadcastLobbyUpdate,
  setTestProvider,
  getProvider,
  CARD_DEFS,
  STARTING_DECK_IDS,
  EVOLUTION_GRIND_REQUIRED,
  EVOLUTION_TRANSFORMS,
  createCardInstance,
  createInventoryFromCardIds,
  createInventoryFromOwnedCards,
  normalizeInventory,
  inventoryToOwnedCards,
  normalizeSelectedDeck,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  evolveCard,
  createPlayerProgress,
  extractPersistentData,
  persistenceKey,
  savePlayerData,
  saveAllPlayers,
  createRunState,
  startDungeonRun,
  clampObjectiveProgress,
  syncRunObjectiveToEnemies,
  recordEnemyDefeated,
  buildRunSummary,
  grantCard,
  grantRunRewards,
  buildPlayerRewardSummary,
  validateDeck,
  canAddCardInstanceToDeck,
  canAddCardToDeck,
  createDrawDeckFromSelectedDeck,
  drawCardFromDeck,
  initPlayerHand,
  drawReplacementCard,
  addMagicStones,
  restoreCardCharges,
  restoreHandCharges,
  spawnEnemy,
  removeDeadEnemies,
  cleanupAfterDamage,
  spawnLoot,
  spawnEnemies,
  checkRunTerminalState,
  resetTransientRunState,
  returnPlayersToLobby,
  checkAllReady,
  stateSnapshot
};
