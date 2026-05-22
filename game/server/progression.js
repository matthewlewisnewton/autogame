// ── Server Progression Module ──
// Player persistence, rewards, deck/hand management, run state, spawning, snapshots.
// Imported by index.js; re-exported from index.js for test compatibility.

const crypto = require('crypto');
const {
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
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

function createPlayerProgress() {
  const ownedCards = {};
  for (const cardId of STARTING_DECK_IDS) {
    ownedCards[cardId] = (ownedCards[cardId] || 0) + 1;
  }
  return {
    currency: 0,
    ownedCards,
    runRewards: null,
    currencyEarnedThisRun: 0
  };
}

function extractPersistentData(player) {
  return {
    currency: player.currency || 0,
    ownedCards: player.ownedCards || {},
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
  return {
    id: crypto.randomUUID(),
    status: 'playing',
    objective: {
      type: 'defeat_enemies',
      label: 'Defeat all enemies',
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
  if (!player.ownedCards) player.ownedCards = {};
  if (player.ownedCards[cardId] === undefined) {
    player.ownedCards[cardId] = 0;
  }
  player.ownedCards[cardId] += 1;
  return true;
}

function grantRunRewards(playerId, summary) {
  const player = _gameState.players[playerId];
  if (!player) return;

  const lootCurrency = player.currencyEarnedThisRun || 0;

  if (summary.status === 'victory') {
    const currencyBonus = 10;
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

function validateDeck(deck, ownedCards) {
  if (deck.length < DECK_MIN_SIZE) {
    return { valid: false, reason: `Deck must have at least ${DECK_MIN_SIZE} cards` };
  }
  if (deck.length > DECK_MAX_SIZE) {
    return { valid: false, reason: `Deck can have at most ${DECK_MAX_SIZE} cards` };
  }

  const counts = {};
  for (const cardId of deck) {
    if (!CARD_DEFS[cardId]) {
      return { valid: false, reason: `Unknown card id: ${cardId}` };
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

function canAddCardToDeck(cardId, deck, ownedCards) {
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
  const deck = player.selectedDeck.slice();
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

  const spawnTable = ['skirmisher', 'skirmisher', 'grunt', 'miniboss', 'spawner'];
  for (const type of spawnTable) {
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
      ownedCards: p.ownedCards,
      runRewards: p.runRewards,
      currencyEarnedThisRun: p.currencyEarnedThisRun,
      selectedDeck: p.selectedDeck,
      inventory: p.inventory,
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
    const preservedOwnedCards = player.ownedCards;
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
  canAddCardToDeck,
  createDrawDeckFromSelectedDeck,
  drawCardFromDeck,
  initPlayerHand,
  drawReplacementCard,
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
