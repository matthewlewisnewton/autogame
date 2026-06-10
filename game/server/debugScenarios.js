// ── Debug-Scenario Setup Module ──
// Houses the per-`name` debug-scenario setup chain that previously lived inline
// inside applyDebugScenario() in index.js. This is a behavior-preserving
// extraction: the up-front guards, shared player reset, branch evaluation order,
// emitted payload shapes, and the { ok, ... } return contract all match the
// original handler exactly.
//
// ── Circular-dependency resolution ──
// Like simulation.js / cardEffects.js, this module must NOT require('./index')
// (circular). Plain helpers come from the leaf modules
// (dungeon/quests/config/simulation/progression/users/cosmetic) via direct
// require; the handful of index.js-local helpers (io, getLobbyForSocket,
// withLobbyContext, enterPlayingPhase, ensureNearbyEnemy, applyLayoutForQuest)
// and the DEBUG_SCENARIOS set are supplied via setCallbacks() after the modules
// are loaded.

const { SERVER_TO_CLIENT } = require('../shared/events.js');
const crypto = require('crypto');
const { generateLayout, questLayoutSeed, sampleFloorY, resolveFloorY } = require('./dungeon');
const { DEFAULT_QUEST_ID, getLayoutProfileForQuest, buildQuestUpdatePayload } = require('./quests');
const { APPEARANCE_CHANGE_COST, DETECTION_RADIUS, MAX_HP, MAX_MAGIC_STONES, MAX_HAND_SLOTS, MEDIC_HEAL_COST } = require('./config');
const CARD_DEFS = require('../shared/cardDefs.json');
const {
  firstRoomPosition,
  computeDungeonBounds,
  computeWalkableAABBs,
  rebuildWallColliders,
  ENEMY_DEFS,
} = require('./simulation');
const {
  normalizePlayerInventory,
  validateDeck,
  createDrawDeckFromSelectedDeck,
  initPlayerHand,
  createInventoryFromCardIds,
  createCardInstance,
  inventoryToOwnedCards,
  spawnEnemy,
  spawnEnemies,
  startDungeonRun,
  updateQuestScriptTriggers,
  syncRunObjectiveToEnemies,
  checkRunTerminalState,
  stateSnapshot,
  assignRunSpawnPositions,
  suspendRunToLobby,
  abandonSuspendedRun,
  emitPlayerDeckUpdate,
} = require('./progression');
const { unlockHat: unlockHatForAccount, unlockQuestTier } = require('./users');
const { backfillUnlockedHats, HAT_CATALOG } = require('./cosmetic');
const { VARIANT_DEFS } = require('./enemyVariants');
const { PHASES, setPhase } = require('./lobbies');
const {
  tryActivateEncounter,
  activateEncounter,
  lockEncounter,
  ENCOUNTER_TRIGGER_RADIUS,
  isEncounterDormant,
  areAllNonBossEnemiesDefeated,
  resolveEncounterAnchor,
} = require('./encounters');

// index.js-local helpers + the DEBUG_SCENARIOS set, injected after modules load.
let io = null;
let getLobbyForSocket = null;
let withLobbyContext = null;
let enterPlayingPhase = null;
let ensureNearbyEnemy = null;
let applyLayoutForQuest = null;
let broadcastLobbyUpdate = null;
let emitQuestPayloadToLobby = null;
let DEBUG_SCENARIOS = null;

function setCallbacks(deps) {
  io = deps.io;
  getLobbyForSocket = deps.getLobbyForSocket;
  withLobbyContext = deps.withLobbyContext;
  enterPlayingPhase = deps.enterPlayingPhase;
  ensureNearbyEnemy = deps.ensureNearbyEnemy;
  applyLayoutForQuest = deps.applyLayoutForQuest;
  broadcastLobbyUpdate = deps.broadcastLobbyUpdate;
  emitQuestPayloadToLobby = deps.emitQuestPayloadToLobby;
  DEBUG_SCENARIOS = deps.DEBUG_SCENARIOS;
}

/** Drop in-progress card wind-up so the next debug scenario can cast immediately. */
function clearPlayerCardCommitment(player) {
  delete player.cardUseState;
  delete player.cardWindupUntil;
  delete player.cardWindupStartTime;
  delete player.cardWindupMs;
  delete player.cardWindupCardId;
  delete player.pendingCardUse;
}

function setupFrostCrossingTier1Deploy(lobby, state, player) {
  const questId = 'frost_crossing';
  const tier = 1;
  state.selectedQuestId = questId;
  state.selectedQuestTier = tier;
  applyLayoutForQuest(state, questId, tier);

  player.ready = true;
  player.hp = MAX_HP;
  player.magicStones = MAX_MAGIC_STONES;
  const startSpawn = firstRoomPosition();
  player.x = startSpawn.x;
  player.z = startSpawn.z;
  player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

  enterPlayingPhase(lobby);

  if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
    createDrawDeckFromSelectedDeck(player);
    initPlayerHand(player);
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    if (!player.pendingSummons) {
      player.pendingSummons = new Set();
    }
  }

  state.enemies = [];
  state.loot = [];
  delete state.run;
  delete state._pendingEncounterBossId;
  spawnEnemies();
  startDungeonRun();
}

function deepestCombatRoom(layout) {
  return layout.rooms
    .filter((room) => room.role === 'combat')
    .sort((a, b) => a.x - b.x || a.z - b.z)
    .pop();
}

function setupTrainingCavernsTier1Deploy(lobby, state, player) {
  const questId = 'training_caverns';
  const tier = 1;
  state.selectedQuestId = questId;
  state.selectedQuestTier = tier;
  applyLayoutForQuest(state, questId, tier);

  player.ready = true;
  player.hp = MAX_HP;
  player.magicStones = MAX_MAGIC_STONES;
  const startSpawn = firstRoomPosition();
  player.x = startSpawn.x;
  player.z = startSpawn.z;
  player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

  enterPlayingPhase(lobby);

  if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
    createDrawDeckFromSelectedDeck(player);
    initPlayerHand(player);
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    if (!player.pendingSummons) {
      player.pendingSummons = new Set();
    }
  }

  state.enemies = [];
  state.loot = [];
  delete state.run;
  delete state._pendingEncounterBossId;
  spawnEnemies();
  startDungeonRun();
}

function setupArenaTrialsTier2StageBossDebug(lobby, state, player) {
  const questId = 'arena_trials';
  const tier = 2;
  unlockQuestTier(player.accountId, questId, tier);
  state.selectedQuestId = questId;
  state.selectedQuestTier = tier;
  applyLayoutForQuest(state, questId, tier);

  player.ready = true;
  player.hp = MAX_HP;
  player.magicStones = MAX_MAGIC_STONES;
  const plazaSpawn = firstRoomPosition();
  player.x = plazaSpawn.x;
  player.z = plazaSpawn.z;
  player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

  enterPlayingPhase(lobby);

  if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
    createDrawDeckFromSelectedDeck(player);
    initPlayerHand(player);
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    if (!player.pendingSummons) {
      player.pendingSummons = new Set();
    }
  }

  state.enemies = [];
  state.loot = [];
  delete state.run;
  delete state._pendingEncounterBossId;
  spawnEnemies();
  startDungeonRun();
}

function resolveArenaDaisAnchor(state) {
  const dais = state.layout?.landmarks?.find((lm) => lm.type === 'arena_dais');
  return dais ? { x: dais.x, z: dais.z } : firstRoomPosition();
}

function resolveVaultDaisAnchor(state) {
  const dais = state.layout?.landmarks?.find((lm) => lm.type === 'vault_dais');
  return dais ? { x: dais.x, z: dais.z } : firstRoomPosition();
}

function liveTrainingCavernsAdds(state, bossType = 'annex_overseer') {
  return (state.enemies || []).filter(
    (e) => e.hp > 0 && e.type !== bossType && (e.type === 'grunt' || e.type === 'skirmisher'),
  );
}

function resolveSpireSummitAnchor(state) {
  const summit = state.layout?.landmarks?.find((lm) => lm.type === 'spire_summit');
  return summit ? { x: summit.x, z: summit.z } : firstRoomPosition();
}

function liveSpireAscentAdds(state, bossType = 'spire_warden') {
  return (state.enemies || []).filter(
    (e) => e.hp > 0 && e.type !== bossType,
  );
}

function liveCanyonDescentAdds(state, bossType = 'miniboss') {
  return (state.enemies || []).filter(
    (e) => e.hp > 0 && e.type !== bossType && (e.type === 'grunt' || e.type === 'skirmisher'),
  );
}

function liveEmberDescentAdds(state) {
  return (state.enemies || []).filter(
    (e) => e.hp > 0 && e.type !== 'ember_wraith' && (e.type === 'grunt' || e.type === 'skirmisher'),
  );
}

function liveArenaTrialsAdds(state, bossType = 'arena_champion') {
  const bossId = state.run?.encounter?.bossEnemyId;
  return (state.enemies || []).filter(
    (e) => e.hp > 0 && e.id !== bossId && e.type !== bossType,
  );
}

function roomAt(layout, x, z) {
  return layout.rooms.find((r) => {
    const hw = r.width / 2;
    const hd = r.depth / 2;
    return x >= r.x - hw && x <= r.x + hw && z >= r.z - hd && z <= r.z + hd;
  });
}

function bandAt(layout, x, z) {
  const room = roomAt(layout, x, z);
  return room ? room.band : null;
}

function clusterAnchorForBand(layout, band, player) {
  if (band === 'plateau' || !band) {
    return { x: player.x, z: player.z };
  }
  const room = layout.rooms.find((r) => r.band === band);
  if (room) return { x: room.x, z: room.z };
  return { x: player.x, z: player.z };
}

function repositionNearEnemy(player, enemy, standoff = 3.5) {
  const dx = player.x - enemy.x;
  const dz = player.z - enemy.z;
  const dist = Math.hypot(dx, dz);
  if (dist >= 2 && dist <= standoff + 1) return;
  if (dist > 0.01) {
    player.x = enemy.x + (dx / dist) * standoff;
    player.z = enemy.z + (dz / dist) * standoff;
  } else {
    player.x = enemy.x + standoff;
    player.z = enemy.z;
  }
}

function finishStageBossDebugScenario(lobby, state, player, name) {
  emitLobbyQuestUpdate(lobby, state, {
    layoutSeed: state.layoutSeed,
    layout: state.layout,
  });
  broadcastLobbyUpdate(lobby);
  io.to(lobby.id).emit('stateUpdate', stateSnapshot());
  return {
    ok: true,
    scenario: name,
    unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
  };
}

function syncCardProbeHand(player) {
  if (player?.id) emitPlayerDeckUpdate(player.id);
}

function resumePlayingRunForCardProbe(state, player) {
  if (!state?.run) return;
  state.run.status = 'playing';
  if (state.run.objective?.type === 'defeat_enemies') {
    const liveCount = (state.enemies || []).filter((e) => e && e.hp > 0).length;
    state.run.objective.defeatedEnemies = 0;
    state.run.objective.totalEnemies = Math.max(liveCount, 1);
  }
  if (player) {
    player.dead = false;
    player.burningUntil = 0;
    player.slowedUntil = 0;
    player.slowFactor = 1;
    player.lastBurnTickAt = null;
    player.debuffs = [];
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.cardUseState = null;
    player.pendingCardUse = null;
  }
}

function emitLobbyQuestUpdate(lobby, state, extraFields = {}) {
  if (emitQuestPayloadToLobby) {
    emitQuestPayloadToLobby(lobby, { extraFields });
    return;
  }
  io.to(lobby.id).emit(SERVER_TO_CLIENT.QUEST_UPDATE, {
    ...buildQuestUpdatePayload(state),
    ...extraFields,
  });
}

function applyDebugScenario(socket, name) {
  const lobby = getLobbyForSocket(socket);
  if (!lobby) return { ok: false, reason: 'Not in a lobby' };
  const state = lobby.state;

  if (!DEBUG_SCENARIOS.has(name)) {
    return { ok: false, reason: `Unknown debug scenario: ${name}` };
  }

  const player = state.players[socket.playerId];
  if (!player) return { ok: false, reason: 'No player for debug scenario' };
  const spawn = firstRoomPosition();

  return withLobbyContext(lobby, () => {
    normalizePlayerInventory(player);
    const result = validateDeck(player.selectedDeck, player.inventory);
    if (!result.valid) return { ok: false, reason: result.reason };

    player.dead = false;
    player.firstMoveAfterSpawn = false;
    player.lastMoveTime = Date.now();
    clearPlayerCardCommitment(player);
    player.debugScenario = name;
    if (!player.pendingSummons) {
      player.pendingSummons = new Set();
    } else {
      player.pendingSummons.clear();
    }

    if (name === 'telepipe-ready') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      return { ok: true, scenario: name };
    }

    if (name === 'fire-telepipe-ready') {
      // ember_descent Tier 1 with fire-cavern layout; telepipe injected on ready-up
      // (see checkAllReady). Mirrors telepipe-ready for harness telepipe-reset on fire.
      // Reachable normally by earning Telepipe, selecting Ember Descent, and deploying.
      const questId = 'ember_descent';
      const tier = 1;
      state.selectedQuestId = questId;
      state.selectedQuestTier = tier;
      applyLayoutForQuest(state, questId, tier);
      player.ready = false;
      if (state.suspendedCheckpoint) {
        // Fresh sortie after telepipe suspend: abandon checkpoint, keep lobby vitals.
        abandonSuspendedRun(state);
        player._telepipeFreshSortie = true;
        player._msRegenGraceUntil = Date.now() + 20000;
      } else {
        // Partial vitals so harness depletion probes pass without MS regen overshooting STARTING_MAGIC_STONES.
        player.hp = 60;
        player.magicStones = 20;
      }
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'fireball-hand-ready') {
      // Swap Fireball into hand without resetting enemies or status — for sequential
      // card exercises (e.g. slow then burn on the same target after ice-ball-ready).
      // The same card is reachable normally by earning or drawing Fireball mid-run.
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const replaceSlot = player.hand.findIndex(c => c != null);
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = {
          id: 'fireball',
          name: 'Fireball',
          type: 'weapon',
          charges: 4,
          remainingCharges: 4,
        };
      }
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'lobby-partial-vitals') {
      // Lobby after a prior run with reduced HP and spent magic stones, ready to
      // redeploy. The same state is reachable normally by finishing or abandoning
      // a run and returning to the hub with partial vitals.
      setPhase(lobby, PHASES.LOBBY);
      player.ready = false;
      player.hp = 42;
      player.magicStones = 15;
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name, hp: player.hp, magicStones: player.magicStones };
    }

    if (name === 'hub-med-booth-ready') {
      // Hub lobby with partial HP and enough currency for the Medic station.
      // The same state is reachable by returning from a damaged run with earned gold.
      setPhase(lobby, PHASES.LOBBY);
      delete state.run;
      player.ready = false;
      player.hp = 42;
      player.currency = Math.max(player.currency || 0, MEDIC_HEAL_COST + 15);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name, hp: player.hp, currency: player.currency };
    }

    if (name === 'hat-shop-currency') {
      // Stay in the lobby with enough currency for a paid booth appearance change
      // (at least APPEARANCE_CHANGE_COST) and to unlock any catalog hat without
      // grinding runs first. The same state is reachable normally by earning
      // currency in dungeons.
      setPhase(lobby, PHASES.LOBBY);
      player.ready = false;
      player.hp = MAX_HP;
      player.currency = Math.max(player.currency || 0, APPEARANCE_CHANGE_COST, 1000);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name, currency: player.currency };
    }

    if (name === 'quest-tier-2-unlocked') {
      // Lobby with training_caverns Tier 2 unlocked and selected so the quest board
      // shows an unlocked Tier 2 row without completing Tier 1 first. The same state is
      // reachable normally by clearing the Tier 1 contract once.
      setPhase(lobby, PHASES.LOBBY);
      player.ready = false;
      player.hp = MAX_HP;
      const questId = 'training_caverns';
      const tier = 2;
      unlockQuestTier(player.accountId, questId, tier);
      state.selectedQuestId = questId;
      state.selectedQuestTier = tier;
      applyLayoutForQuest(state, questId, tier);
      assignRunSpawnPositions(Object.values(state.players));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
    }

    if (name === 'training-caverns-vault-marauder') {
      // training_caverns Tier 1 with run-start grunts cleared and Vault Marauder
      // spawned in the deepest vault room for named-rare QA. Reachable normally by
      // clearing the annex and entering the deep vault; this scenario is a shortcut.
      setupTrainingCavernsTier1Deploy(lobby, state, player);

      const vaultRoom = deepestCombatRoom(state.layout);
      const runStartWave = state.run?.waveScript?.waves?.find((wave) => wave.id === 'wave_run_start');
      if (runStartWave) {
        for (const enemyId of runStartWave.spawnedEnemyIds) {
          const enemy = state.enemies.find((entry) => entry.id === enemyId);
          if (enemy) enemy.hp = 0;
        }
        state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
        runStartWave.status = 'cleared';
        if (state.run?.objective) {
          state.run.objective.defeatedEnemies = runStartWave.spawnedEnemyIds.length;
        }
      }

      player.x = vaultRoom?.x ?? 0;
      player.z = vaultRoom?.z ?? 0;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      updateQuestScriptTriggers();

      const marauder = state.enemies.find((enemy) => enemy.namedRare?.name === 'Vault Marauder');
      if (marauder) {
        marauder.wanderTarget = { x: marauder.x, z: marauder.z };
        repositionNearEnemy(player, marauder);
        player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      }

      if (!player.hand.some((c) => c && c.type === 'weapon' && (c.remainingCharges == null || c.remainingCharges > 0))) {
        const replaceSlot = player.hand.findIndex((c) => c && c.type !== 'weapon');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = {
            id: 'iron_sword',
            name: 'Rust-Forged Saber',
            type: 'weapon',
            charges: 5,
            remainingCharges: 5,
            grind: 0,
          };
        }
      }

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'training-caverns-tier-2') {
      // training_caverns Tier 2 stage_boss encounter with rigid crowded layout and
      // vault_dais boss spawn. Quest/tier and layout must be set before
      // enterPlayingPhase so startDungeonRun snapshots the correct run.questTier/
      // objective and spawnEnemy variant rolls. Reachable normally by clearing
      // Initiate Vault Tier 1, unlocking Tier 2, and deploying.
      const questId = 'training_caverns';
      const tier = 2;
      unlockQuestTier(player.accountId, questId, tier);
      state.selectedQuestId = questId;
      state.selectedQuestTier = tier;
      applyLayoutForQuest(state, questId, tier);

      player.ready = true;
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const startSpawn = firstRoomPosition();
      player.x = startSpawn.x;
      player.z = startSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

      enterPlayingPhase(lobby);

      if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
        player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
        if (!player.pendingSummons) {
          player.pendingSummons = new Set();
        }
      }

      state.enemies = [];
      state.loot = [];
      delete state.run;
      delete state._pendingEncounterBossId;
      spawnEnemies();
      startDungeonRun();

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
    }

    if (name === 'training-caverns-near-adds') {
      // Reposition beside live Training Caverns Tier 2 adds for harness add-combat QA.
      // Reachable normally by traversing combat rooms toward wandering adds.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'training_caverns'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires training_caverns Tier 2 stage-boss run' };
      }
      const adds = liveTrainingCavernsAdds(state);
      if (adds.length === 0) {
        return { ok: false, reason: 'No live adds to approach' };
      }
      let nearest = adds[0];
      let bestDist = Infinity;
      for (const add of adds) {
        const dist = Math.hypot(add.x - player.x, add.z - player.z);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = add;
        }
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      // Force slot 1 (key `1`) to a fully-charged weapon so the harness lock-on +
      // weapon-swing path is deterministic regardless of the shuffled opening hand.
      player.hand[0] = {
        id: 'iron_sword',
        name: 'Rust-Forged Saber',
        type: 'weapon',
        damage: 17,
        charges: 5,
        remainingCharges: 5,
        grind: 0,
      };
      // Cluster every live add in the start room (wounded, shields stripped) so the
      // harness can clear the pack through real lock-on + swings without crossing the
      // vault_dais boss trigger. The same wounded cluster is reachable normally by
      // pulling wandering adds together away from the overseer.
      const clusterAnchor = firstRoomPosition();
      const clusterRadius = 4;
      let angle = 0;
      const step = adds.length > 0 ? (Math.PI * 2) / adds.length : 0;
      for (const add of adds) {
        add.hp = 1;
        add.shieldHp = 0;
        add.maxShieldHp = 0;
        add.x = clusterAnchor.x + Math.cos(angle) * clusterRadius;
        add.z = clusterAnchor.z + Math.sin(angle) * clusterRadius;
        add.wanderTarget = { x: add.x, z: add.z };
        angle += step;
      }
      player.x = clusterAnchor.x;
      player.z = clusterAnchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      repositionNearEnemy(player, nearest);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'training-caverns-boss-approach') {
      // Place the player just outside the dormant overseer trigger after adds are cleared.
      // Reachable normally by defeating adds then walking to the vault_dais boss room.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'training_caverns'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires training_caverns Tier 2 stage-boss run' };
      }
      if (liveTrainingCavernsAdds(state).length > 0) {
        return { ok: false, reason: 'Adds must be cleared before boss approach' };
      }
      if (state.run.encounter.phase !== 'dormant') {
        return { ok: false, reason: 'Encounter must be dormant' };
      }
      const anchor = resolveVaultDaisAnchor(state);
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS + 1;
      player.z = anchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      player.debugScenarioNudgeAfter = Date.now() + 1500;
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'training-caverns-boss-low-hp') {
      // Training Caverns Tier 2 annex_overseer beside the player at 1 HP for fast
      // harness victory. Reachable normally by clearing adds and engaging the boss;
      // this scenario is a shortcut after deploy or mid-encounter.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'training_caverns'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires training_caverns Tier 2 stage-boss run' };
      }
      const bossId = state.run.encounter.bossEnemyId;
      for (const enemy of state.enemies || []) {
        if (enemy.id !== bossId) enemy.hp = 0;
      }
      state.enemies = (state.enemies || []).filter((e) => e.hp > 0);
      const boss = state.enemies.find((e) => e.id === bossId);
      if (!boss || boss.type !== 'annex_overseer') {
        return { ok: false, reason: 'Annex overseer boss not found' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      repositionNearEnemy(player, boss, 4);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      boss.hp = 1;
      boss.maxHp = boss.maxHp || boss.hp;
      boss.shieldHp = 0;
      boss.maxShieldHp = 0;
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'arena-trials-tier-2') {
      // arena_trials Tier 2 with rigid open-plaza layout and cover-aware spawns.
      // Reachable normally by clearing Arena Trials Tier 1, unlocking Tier 2, and
      // deploying; this scenario is a shortcut into that state.
      setupArenaTrialsTier2StageBossDebug(lobby, state, player);
      return finishStageBossDebugScenario(lobby, state, player, name);
    }

    if (name === 'stage-boss-dormant') {
      // arena_trials Tier 2 stage_boss encounter left dormant for QA.
      // Reachable normally by unlocking Arena Trials Tier 2 and deploying.
      setupArenaTrialsTier2StageBossDebug(lobby, state, player);
      const anchor = resolveArenaDaisAnchor(state);
      player.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS + 2;
      player.z = anchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      return finishStageBossDebugScenario(lobby, state, player, name);
    }

    if (name === 'stage-boss-active') {
      // arena_trials Tier 2 stage_boss encounter activated for quick-defeat QA.
      // Reachable normally by clearing adds or entering the trigger radius.
      setupArenaTrialsTier2StageBossDebug(lobby, state, player);
      const anchor = resolveArenaDaisAnchor(state);
      const bossId = state.run.encounter.bossEnemyId;
      for (const enemy of state.enemies) {
        if (enemy.id !== bossId) enemy.hp = 0;
      }
      state.enemies = state.enemies.filter((e) => e.hp > 0);
      player.x = anchor.x + 4;
      player.z = anchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      tryActivateEncounter(state);
      const boss = state.enemies.find((e) => e.id === bossId);
      if (boss) {
        boss.hp = 1;
        boss.maxHp = boss.maxHp || boss.hp;
      }
      return finishStageBossDebugScenario(lobby, state, player, name);
    }

    if (name === 'arena-trials-near-adds') {
      // Reposition beside live Arena Trials Tier 2 adds for harness add-combat QA.
      // Reachable normally by traversing the open plaza toward wandering adds.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'arena_trials'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires arena_trials Tier 2 stage-boss run' };
      }
      const adds = liveArenaTrialsAdds(state);
      if (adds.length === 0) {
        return { ok: false, reason: 'No live adds to approach' };
      }
      let nearest = adds[0];
      let bestDist = Infinity;
      for (const add of adds) {
        const dist = Math.hypot(add.x - player.x, add.z - player.z);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = add;
        }
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.hand[0] = {
        id: 'iron_sword',
        name: 'Rust-Forged Saber',
        type: 'weapon',
        damage: 17,
        charges: 5,
        remainingCharges: 5,
        grind: 0,
      };
      // Cluster every live add on the start plaza (wounded, shields stripped) so the
      // harness can clear the pack through lock-on + swings without crossing the
      // arena_champion boss trigger. Each add gets correct floor Y via sampleFloorY.
      const clusterAnchor = firstRoomPosition();
      const clusterRadius = 4;
      let angle = 0;
      const step = adds.length > 0 ? (Math.PI * 2) / adds.length : 0;
      for (const add of adds) {
        add.hp = 1;
        add.shieldHp = 0;
        add.maxShieldHp = 0;
        add.x = clusterAnchor.x + Math.cos(angle) * clusterRadius;
        add.z = clusterAnchor.z + Math.sin(angle) * clusterRadius;
        add.y = resolveFloorY(sampleFloorY(state.layout, add.x, add.z));
        add.wanderTarget = { x: add.x, z: add.z };
        angle += step;
      }
      player.x = clusterAnchor.x;
      player.z = clusterAnchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      repositionNearEnemy(player, nearest);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'arena-trials-boss-approach') {
      // Place the player just outside the dormant arena_champion trigger after adds clear.
      // Reachable normally by defeating adds then walking to the arena dais anchor.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'arena_trials'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires arena_trials Tier 2 stage-boss run' };
      }
      const bossId = state.run.encounter.bossEnemyId;
      if (!areAllNonBossEnemiesDefeated(state, bossId)) {
        return { ok: false, reason: 'Adds must be cleared before boss approach' };
      }
      if (state.run.encounter.phase !== 'dormant') {
        return { ok: false, reason: 'Encounter must be dormant' };
      }
      const anchor = resolveEncounterAnchor(state.run, state) || resolveArenaDaisAnchor(state);
      if (!anchor) {
        return { ok: false, reason: 'No encounter anchor for boss approach' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS + 1;
      player.z = anchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      player.debugScenarioNudgeAfter = Date.now() + 1500;
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'arena-trials-boss-low-hp') {
      // Arena Trials Tier 2 arena_champion beside the player at 1 HP for fast victory.
      // Reachable normally by clearing adds and engaging the boss; shortcut after deploy.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'arena_trials'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires arena_trials Tier 2 stage-boss run' };
      }
      const bossId = state.run.encounter.bossEnemyId;
      for (const enemy of state.enemies || []) {
        if (enemy.id !== bossId) enemy.hp = 0;
      }
      state.enemies = (state.enemies || []).filter((e) => e.hp > 0);
      const boss = state.enemies.find((e) => e.id === bossId);
      if (!boss || boss.type !== 'arena_champion') {
        return { ok: false, reason: 'Arena champion not found' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      boss.x = player.x + 4;
      boss.z = player.z;
      boss.y = resolveFloorY(sampleFloorY(state.layout, boss.x, boss.z));
      repositionNearEnemy(player, boss, 4);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      boss.hp = 1;
      boss.maxHp = boss.maxHp || boss.hp;
      boss.shieldHp = 0;
      boss.maxShieldHp = 0;
      // Harness activates the encounter before boss-low-hp; direct URL/debug use may still be dormant.
      if (isEncounterDormant(state.run)) {
        activateEncounter(state.run);
      }
      if (!state.run.encounter.locked) {
        lockEncounter(state.run);
      }
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'frost-crossing-tier-1') {
      // frost_crossing Tier 1 with ice-cavern layout and defeat_enemies objective.
      // Quest/tier and layout must be set before enterPlayingPhase so startDungeonRun
      // snapshots the correct run.questTier/objective. Reachable normally by selecting
      // Frost Crossing and deploying; this scenario is a shortcut into that state.
      setupFrostCrossingTier1Deploy(lobby, state, player);

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
    }

    if (name === 'frost-crossing-last-enemy') {
      // frost_crossing Tier 1 run one 1-HP enemy from victory: one hit wins and the
      // post-victory reward panel shows the quest's signature card (Ice Ball) as the
      // first choice. Reachable normally by selecting Frost Crossing and clearing all
      // but the last hostile; this scenario is a shortcut into that state.
      setupFrostCrossingTier1Deploy(lobby, state, player);

      const total = state.run.objective.totalEnemies ?? 6;
      state.enemies = [];
      const enemyType = 'grunt';
      const enemy = spawnEnemy(player.x + 2, player.z, enemyType);
      enemy.hp = 1;
      enemy.maxHp = ENEMY_DEFS[enemyType]?.hp ?? enemy.maxHp;
      enemy.y = resolveFloorY(sampleFloorY(state.layout, enemy.x, enemy.z));
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      repositionNearEnemy(player, enemy);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.run.objective.totalEnemies = total;
      state.run.objective.defeatedEnemies = Math.max(0, total - 1);
      if (!player.hand.some((c) => c && c.type === 'weapon' && (c.remainingCharges == null || c.remainingCharges > 0))) {
        const replaceSlot = player.hand.findIndex((c) => c && c.type !== 'weapon');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = {
            id: 'iron_sword',
            name: 'Rust-Forged Saber',
            type: 'weapon',
            charges: 5,
            remainingCharges: 5,
            grind: 0,
          };
        }
      }

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'frost-crossing-frostmaw') {
      // frost_crossing Tier 1 with run-start grunts cleared and Frostmaw spawned on
      // the ice field for named-rare QA. Reachable normally by crossing to the ice
      // sheet; this scenario is a shortcut into that encounter.
      setupFrostCrossingTier1Deploy(lobby, state, player);

      const iceRoom = state.layout.rooms.find((room) => room.band === 'ice');
      const runStartWave = state.run?.waveScript?.waves?.find((wave) => wave.id === 'wave_run_start');
      if (runStartWave) {
        for (const enemyId of runStartWave.spawnedEnemyIds) {
          const enemy = state.enemies.find((entry) => entry.id === enemyId);
          if (enemy) enemy.hp = 0;
        }
        state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
        runStartWave.status = 'cleared';
        if (state.run?.objective) {
          state.run.objective.defeatedEnemies = runStartWave.spawnedEnemyIds.length;
        }
      }

      player.x = iceRoom?.x ?? 0;
      player.z = iceRoom?.z ?? 0;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      updateQuestScriptTriggers();

      const frostmaw = state.enemies.find((enemy) => enemy.namedRare?.name === 'Frostmaw');
      if (frostmaw) {
        frostmaw.wanderTarget = { x: frostmaw.x, z: frostmaw.z };
        repositionNearEnemy(player, frostmaw);
        player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      }

      if (!player.hand.some((c) => c && c.type === 'weapon' && (c.remainingCharges == null || c.remainingCharges > 0))) {
        const replaceSlot = player.hand.findIndex((c) => c && c.type !== 'weapon');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = {
            id: 'iron_sword',
            name: 'Rust-Forged Saber',
            type: 'weapon',
            charges: 5,
            remainingCharges: 5,
            grind: 0,
          };
        }
      }

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'crystal-rescue-tier-2') {
      // crystal_rescue Tier 2 with rigid open layout, prism collect_items objective,
      // and cover/platform/hazard-aware spawns. Quest/tier and layout must be set
      // before enterPlayingPhase so startDungeonRun snapshots the correct run.questTier
      // and spawnEnemy variant rolls. Reachable normally by clearing Prism Salvage
      // Tier 1, unlocking Tier 2, and deploying; this scenario is a shortcut.
      const questId = 'crystal_rescue';
      const tier = 2;
      unlockQuestTier(player.accountId, questId, tier);
      state.selectedQuestId = questId;
      state.selectedQuestTier = tier;
      applyLayoutForQuest(state, questId, tier);

      player.ready = true;
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const startSpawn = firstRoomPosition();
      player.x = startSpawn.x;
      player.z = startSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

      enterPlayingPhase(lobby);

      if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
        player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
        if (!player.pendingSummons) {
          player.pendingSummons = new Set();
        }
      }

      state.enemies = [];
      state.loot = [];
      spawnEnemies();
      syncRunObjectiveToEnemies();

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
    }

    if (name === 'fire-cavern') {
      // ember_descent Tier 1 with fire-cavern layout and rim spawn.
      // Quest/tier and layout must be set before enterPlayingPhase so startDungeonRun
      // snapshots the correct run.questTier/objective and spawnEnemy variant rolls.
      // Reachable normally by selecting Ember Descent tier 1 and deploying;
      // this scenario is a shortcut into that state.
      const questId = 'ember_descent';
      const tier = 1;
      state.selectedQuestId = questId;
      state.selectedQuestTier = tier;
      applyLayoutForQuest(state, questId, tier);

      player.ready = true;
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const rimSpawn = firstRoomPosition();
      player.x = rimSpawn.x;
      player.z = rimSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

      enterPlayingPhase(lobby);

      if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
        player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
        if (!player.pendingSummons) {
          player.pendingSummons = new Set();
        }
      }

      state.enemies = [];
      state.loot = [];
      delete state.run;
      delete state._pendingEncounterBossId;
      spawnEnemies();
      startDungeonRun();

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return {
        ok: true,
        scenario: name,
      };
    }

    if (name === 'ember-descent-near-adds') {
      // Reposition beside live Ember Descent Tier 1 support adds for harness add-combat QA.
      // Reachable normally by traversing rim/ramp/basin bands toward wandering adds.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'ember_descent'
        || state.selectedQuestTier !== 1
        || state.run?.objective?.type !== 'defeat_enemies') {
        return { ok: false, reason: 'Requires ember_descent Tier 1 defeat_enemies run' };
      }
      const supportAdds = liveEmberDescentAdds(state);
      const liveEnemies = (state.enemies || []).filter((e) => e.hp > 0);
      if (supportAdds.length === 0) {
        return { ok: false, reason: 'No live support adds to approach' };
      }
      if (liveEnemies.length === 0) {
        return { ok: false, reason: 'No live enemies to approach' };
      }
      let nearest = supportAdds[0];
      let bestDist = Infinity;
      for (const add of supportAdds) {
        const dist = Math.hypot(add.x - player.x, add.z - player.z);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = add;
        }
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.hand[0] = {
        id: 'iron_sword',
        name: 'Rust-Forged Saber',
        type: 'weapon',
        damage: 17,
        charges: 5,
        remainingCharges: 5,
        grind: 0,
      };
      const playerBand = bandAt(state.layout, player.x, player.z) || 'rim';
      const clusterAnchor = clusterAnchorForBand(state.layout, playerBand, player);
      const clusterRadius = 4;
      let angle = 0;
      const step = liveEnemies.length > 0 ? (Math.PI * 2) / liveEnemies.length : 0;
      for (const enemy of liveEnemies) {
        enemy.hp = 1;
        enemy.shieldHp = 0;
        enemy.maxShieldHp = 0;
        enemy.x = clusterAnchor.x + Math.cos(angle) * clusterRadius;
        enemy.z = clusterAnchor.z + Math.sin(angle) * clusterRadius;
        enemy.y = resolveFloorY(sampleFloorY(state.layout, enemy.x, enemy.z));
        enemy.wanderTarget = { x: enemy.x, z: enemy.z };
        angle += step;
      }
      player.x = clusterAnchor.x;
      player.z = clusterAnchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      repositionNearEnemy(player, nearest);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'ember-descent-ember-wraith-burn') {
      // One Ember Wraith in cone-strike range with godmode off for burn-on-hit QA.
      // Reachable normally on ember_descent runs when an ember_wraith attacks the player.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'ember_descent'
        || state.selectedQuestTier !== 1
        || state.run?.objective?.type !== 'defeat_enemies') {
        return { ok: false, reason: 'Requires ember_descent Tier 1 defeat_enemies run' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.debugGodmode = false;
      socket.emit(SERVER_TO_CLIENT.DEBUG_GODMODE_RESULT, { ok: true, enabled: false });
      state.enemies = [];
      const wraith = spawnEnemy(player.x + 3, player.z, 'ember_wraith');
      wraith.y = resolveFloorY(sampleFloorY(state.layout, wraith.x, wraith.z));
      wraith.wanderTarget = { x: wraith.x, z: wraith.z };
      syncRunObjectiveToEnemies();
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'ember-descent-last-enemy') {
      // Leave a defeat_enemies run one 1-HP enemy from victory on fire-cavern bands.
      // Reachable normally by clearing all but the last hostile of an Ember Descent run.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'ember_descent'
        || state.selectedQuestTier !== 1
        || state.run?.objective?.type !== 'defeat_enemies') {
        return { ok: false, reason: 'Requires ember_descent Tier 1 defeat_enemies run' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const total = state.run.objective.totalEnemies ?? 6;
      const defeated = Math.max(0, total - 1);
      state.enemies = [];
      const enemyType = 'grunt';
      const enemy = spawnEnemy(player.x + 2, player.z, enemyType);
      enemy.hp = 1;
      enemy.maxHp = ENEMY_DEFS[enemyType]?.hp ?? enemy.maxHp;
      enemy.y = resolveFloorY(sampleFloorY(state.layout, enemy.x, enemy.z));
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      repositionNearEnemy(player, enemy);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.run.objective.totalEnemies = total;
      state.run.objective.defeatedEnemies = defeated;
      if (!player.hand.some((c) => c && c.type === 'weapon' && (c.remainingCharges == null || c.remainingCharges > 0))) {
        const replaceSlot = player.hand.findIndex((c) => c && c.type !== 'weapon');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = {
            id: 'iron_sword',
            name: 'Rust-Forged Saber',
            type: 'weapon',
            charges: 5,
            remainingCharges: 5,
            grind: 0,
          };
        }
      }
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'canyon-descent-tier-2' || name === 'canyon-descent-telepipe-ready') {
      // canyon_descent Tier 2 with rigid sunken-canyon layout and band-aware spawns.
      // Quest/tier and layout must be set before enterPlayingPhase so startDungeonRun
      // snapshots the correct run.questTier/objective and spawnEnemy variant rolls.
      // Reachable normally by clearing Canyon Descent Tier 1, unlocking Tier 2, and
      // deploying; this scenario is a shortcut into that state.
      const questId = 'canyon_descent';
      const tier = 2;
      unlockQuestTier(player.accountId, questId, tier);
      state.selectedQuestId = questId;
      state.selectedQuestTier = tier;
      applyLayoutForQuest(state, questId, tier);

      player.ready = true;
      const deployHp = Number.isFinite(player.hp) ? player.hp : null;
      const deployMagicStones = Number.isFinite(player.magicStones) ? player.magicStones : null;
      if (deployHp != null) {
        player.hp = deployHp;
      } else {
        player.hp = MAX_HP;
        player.dead = false;
      }
      if (deployMagicStones != null) {
        player.magicStones = deployMagicStones;
      } else {
        player.magicStones = MAX_MAGIC_STONES;
      }
      const plateauSpawn = firstRoomPosition();
      player.x = plateauSpawn.x;
      player.z = plateauSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

      enterPlayingPhase(lobby);

      if (state.gamePhase === 'playing') {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
        player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
        if (!player.pendingSummons) {
          player.pendingSummons = new Set();
        } else {
          player.pendingSummons.clear();
        }
      }

      state.enemies = [];
      state.loot = [];
      delete state.run;
      delete state._pendingEncounterBossId;
      spawnEnemies();
      startDungeonRun();

      if (name === 'canyon-descent-telepipe-ready') {
        // Debug QA shortcut: telepipe in hand for canyon telepipe harness exercises.
        // Same card is reachable normally by purchasing Telepipe from the shop before deploy.
        const telepipeDef = CARD_DEFS.telepipe;
        const replaceSlot = player.hand.findIndex((c) => c);
        if (telepipeDef && replaceSlot >= 0) {
          player.hand[replaceSlot] = {
            id: 'telepipe',
            name: telepipeDef.name,
            type: telepipeDef.type,
            charges: 1,
            remainingCharges: 1,
            magicStoneCost: telepipeDef.magicStoneCost || 0,
            effect: 'telepipe',
          };
        }
      }

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
    }

    if (name === 'canyon-descent-near-adds') {
      // Reposition beside live Canyon Descent Tier 2 adds for harness add-combat QA.
      // Reachable normally by traversing plateau/canyon bands toward wandering adds.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'canyon_descent'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires canyon_descent Tier 2 stage-boss run' };
      }
      const adds = liveCanyonDescentAdds(state);
      if (adds.length === 0) {
        return { ok: false, reason: 'No live adds to approach' };
      }
      let nearest = adds[0];
      let bestDist = Infinity;
      for (const add of adds) {
        const dist = Math.hypot(add.x - player.x, add.z - player.z);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = add;
        }
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.hand[0] = {
        id: 'iron_sword',
        name: 'Rust-Forged Saber',
        type: 'weapon',
        damage: 17,
        charges: 5,
        remainingCharges: 5,
        grind: 0,
      };
      // Cluster every live add on the start plateau (wounded, shields stripped) so the
      // harness can clear the pack through lock-on + swings without crossing bands or
      // the canyon_monolith boss trigger. Each add still gets band-correct floor Y via
      // sampleFloorY at its cluster position.
      const clusterAnchor = firstRoomPosition();
      const clusterRadius = 4;
      let angle = 0;
      const step = adds.length > 0 ? (Math.PI * 2) / adds.length : 0;
      for (const add of adds) {
        add.hp = 1;
        add.shieldHp = 0;
        add.maxShieldHp = 0;
        add.x = clusterAnchor.x + Math.cos(angle) * clusterRadius;
        add.z = clusterAnchor.z + Math.sin(angle) * clusterRadius;
        add.y = resolveFloorY(sampleFloorY(state.layout, add.x, add.z));
        add.wanderTarget = { x: add.x, z: add.z };
        angle += step;
      }
      player.x = clusterAnchor.x;
      player.z = clusterAnchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      repositionNearEnemy(player, nearest);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'canyon-descent-boss-approach') {
      // Place the player just outside the dormant miniboss trigger after adds are cleared.
      // Reachable normally by defeating adds then walking to the canyon_monolith anchor.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'canyon_descent'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires canyon_descent Tier 2 stage-boss run' };
      }
      if (liveCanyonDescentAdds(state).length > 0) {
        return { ok: false, reason: 'Adds must be cleared before boss approach' };
      }
      if (state.run.encounter.phase !== 'dormant') {
        return { ok: false, reason: 'Encounter must be dormant' };
      }
      const bossId = state.run.encounter.bossEnemyId;
      const boss = state.enemies.find((e) => e.id === bossId);
      if (!boss || boss.type !== 'miniboss') {
        return { ok: false, reason: 'Canyon miniboss not found' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      repositionNearEnemy(player, boss, ENCOUNTER_TRIGGER_RADIUS + 1);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      player.debugScenarioNudgeAfter = Date.now() + 1500;
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'canyon-descent-encounter-trigger') {
      // Debug QA: activate the dormant canyon miniboss after boss-approach without
      // keyboard walking across elevation bands. Same transition is reachable by
      // walking into the encounter trigger in normal play.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'canyon_descent'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires canyon_descent Tier 2 stage-boss run' };
      }
      const bossId = state.run.encounter.bossEnemyId;
      for (const enemy of state.enemies || []) {
        if (enemy.id !== bossId) enemy.hp = 0;
      }
      state.enemies = (state.enemies || []).filter((e) => e.hp > 0);
      syncRunObjectiveToEnemies();
      const boss = state.enemies.find((e) => e.id === bossId);
      if (!boss || boss.type !== 'miniboss') {
        return { ok: false, reason: 'Canyon miniboss not found' };
      }
      player.debugScenarioNudgeAfter = 0;
      repositionNearEnemy(player, boss, ENCOUNTER_TRIGGER_RADIUS - 1);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      if (isEncounterDormant(state.run)) {
        activateEncounter(state.run);
      }
      if (!state.run.encounter.locked) {
        lockEncounter(state.run);
      }
      // Harness bossVisualIdentity probe needs a live non-boss enemy beside the
      // active miniboss (adds are cleared before activation in normal play).
      const visualAdd = spawnEnemy(boss.x + 2.5, boss.z, 'grunt');
      visualAdd.hp = 1;
      visualAdd.y = resolveFloorY(sampleFloorY(state.layout, visualAdd.x, visualAdd.z));
      visualAdd.wanderTarget = { x: visualAdd.x, z: visualAdd.z };
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'canyon-descent-boss-low-hp') {
      // Canyon Descent Tier 2 miniboss beside the player at 1 HP for fast harness victory.
      // Reachable normally by clearing adds and engaging the boss; shortcut after deploy.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'canyon_descent'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires canyon_descent Tier 2 stage-boss run' };
      }
      const bossId = state.run.encounter.bossEnemyId;
      for (const enemy of state.enemies || []) {
        if (enemy.id !== bossId) enemy.hp = 0;
      }
      state.enemies = (state.enemies || []).filter((e) => e.hp > 0);
      const boss = state.enemies.find((e) => e.id === bossId);
      if (!boss || boss.type !== 'miniboss') {
        return { ok: false, reason: 'Canyon miniboss not found' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      boss.x = player.x + 4;
      boss.z = player.z;
      boss.y = resolveFloorY(sampleFloorY(state.layout, boss.x, boss.z));
      repositionNearEnemy(player, boss, 4);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      boss.hp = 1;
      boss.maxHp = boss.maxHp || boss.hp;
      boss.shieldHp = 0;
      boss.maxShieldHp = 0;
      // Harness activates the encounter before boss-low-hp; direct URL/debug use may still be dormant.
      if (isEncounterDormant(state.run)) {
        activateEncounter(state.run);
      }
      if (!state.run.encounter.locked) {
        lockEncounter(state.run);
      }
      // Re-pin the boss to 1 HP immediately before the snapshot so activation/lock (or any
      // game-loop tick they enable on this active canyon encounter) cannot leak a full-HP boss
      // into the emitted state. The final stateSnapshot() is built strictly after this pin.
      boss.hp = 1;
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'spire-ascent-tier-2') {
      // spire_ascent Tier 2 with rigid spire-ascent layout and bottom/top-weighted spawns.
      // Quest/tier and layout must be set before enterPlayingPhase so startDungeonRun
      // snapshots the correct run.questTier/objective and spawnEnemy variant rolls.
      // Reachable normally by clearing Spire Ascent Tier 1, unlocking Tier 2, and
      // deploying; this scenario is a shortcut into that state.
      const questId = 'spire_ascent';
      const tier = 2;
      unlockQuestTier(player.accountId, questId, tier);
      state.selectedQuestId = questId;
      state.selectedQuestTier = tier;
      applyLayoutForQuest(state, questId, tier);

      player.ready = true;
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const bottomSpawn = firstRoomPosition();
      player.x = bottomSpawn.x;
      player.z = bottomSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));

      enterPlayingPhase(lobby);

      if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
        player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
        if (!player.pendingSummons) {
          player.pendingSummons = new Set();
        }
      }

      state.enemies = [];
      state.loot = [];
      delete state.run;
      delete state._pendingEncounterBossId;
      spawnEnemies();
      startDungeonRun();

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
    }

    if (name === 'spire-ascent-near-adds') {
      // Reposition beside live Spire Ascent Tier 2 adds for harness add-combat QA.
      // Reachable normally by traversing combat tiers toward wandering adds.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'spire_ascent'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires spire_ascent Tier 2 stage-boss run' };
      }
      const adds = liveSpireAscentAdds(state);
      if (adds.length === 0) {
        return { ok: false, reason: 'No live adds to approach' };
      }
      let nearest = adds[0];
      let bestDist = Infinity;
      for (const add of adds) {
        const dist = Math.hypot(add.x - player.x, add.z - player.z);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = add;
        }
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.hand[0] = {
        id: 'iron_sword',
        name: 'Rust-Forged Saber',
        type: 'weapon',
        damage: 17,
        charges: 5,
        remainingCharges: 5,
        grind: 0,
      };
      const clusterAnchor = firstRoomPosition();
      const clusterRadius = 4;
      let angle = 0;
      const step = adds.length > 0 ? (Math.PI * 2) / adds.length : 0;
      for (const add of adds) {
        add.hp = 1;
        add.shieldHp = 0;
        add.maxShieldHp = 0;
        add.x = clusterAnchor.x + Math.cos(angle) * clusterRadius;
        add.z = clusterAnchor.z + Math.sin(angle) * clusterRadius;
        add.wanderTarget = { x: add.x, z: add.z };
        angle += step;
      }
      player.x = clusterAnchor.x;
      player.z = clusterAnchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      repositionNearEnemy(player, nearest);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'spire-ascent-boss-approach') {
      // Place the player just outside the dormant Summit Warden trigger after adds are cleared.
      // Reachable normally by defeating adds then walking to the spire_summit boss room.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'spire_ascent'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires spire_ascent Tier 2 stage-boss run' };
      }
      if (liveSpireAscentAdds(state).length > 0) {
        return { ok: false, reason: 'Adds must be cleared before boss approach' };
      }
      if (state.run.encounter.phase !== 'dormant') {
        return { ok: false, reason: 'Encounter must be dormant' };
      }
      const anchor = resolveEncounterAnchor(state.run, state) || resolveSpireSummitAnchor(state);
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS + 1;
      player.z = anchor.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      player.debugScenarioNudgeAfter = Date.now() + 1500;
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'spire-ascent-boss-low-hp') {
      // Spire Ascent Tier 2 spire_warden beside the player at 1 HP for fast
      // harness victory. Reachable normally by clearing adds and engaging the boss;
      // this scenario is a shortcut after deploy or mid-encounter.
      if (state.gamePhase !== 'playing'
        || state.selectedQuestId !== 'spire_ascent'
        || state.selectedQuestTier !== 2
        || !state.run?.encounter) {
        return { ok: false, reason: 'Requires spire_ascent Tier 2 stage-boss run' };
      }
      const bossId = state.run.encounter.bossEnemyId;
      for (const enemy of state.enemies || []) {
        if (enemy.id !== bossId) enemy.hp = 0;
      }
      state.enemies = (state.enemies || []).filter((e) => e.hp > 0);
      const boss = state.enemies.find((e) => e.id === bossId);
      if (!boss || boss.type !== 'spire_warden') {
        return { ok: false, reason: 'Summit Warden boss not found' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      repositionNearEnemy(player, boss, 4);
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      boss.hp = 1;
      boss.maxHp = boss.maxHp || boss.hp;
      boss.shieldHp = 0;
      boss.maxShieldHp = 0;
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return { ok: true, scenario: name };
    }

    if (name === 'hats-unlocked') {
      // Persist a couple of catalog-hat unlocks on the account (leaving at least
      // one hat locked) so the customization panel's equip flow can be exercised
      // on owned, non-'none' hats — and the locked-hat branch too — without
      // grinding currency and unlocking each hat first. The returned
      // `unlockedHats` lets the client refresh its cached owned set. The same
      // owned state is reachable normally by earning currency and unlocking hats
      // via the unlock/shop flow.
      setPhase(lobby, PHASES.LOBBY);
      player.ready = false;
      player.hp = MAX_HP;
      // Leave the last catalog hat locked so both owned and locked entries show.
      const toUnlock = HAT_CATALOG.filter((h) => h.id !== 'none').slice(0, -1);
      let unlockedHats = backfillUnlockedHats(null);
      for (const hat of toUnlock) {
        const r = unlockHatForAccount(player.accountId, hat.id);
        if (r.ok) unlockedHats = r.unlockedHats;
      }
      return { ok: true, scenario: name, unlockedHats };
    }

    if (name === 'evolution-ready') {
      // Stay in the lobby with a skeleton_knight card at +10 grind (the
      // EVOLUTION_GRIND_REQUIRED threshold) so the card-evolution flow can be
      // exercised without grinding runs first. The same state is reachable
      // normally by leveling a skeleton_knight through +10 defeats and then
      // evolving it in the deck editor.
      setPhase(lobby, PHASES.LOBBY);
      player.ready = false;
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const instance = createCardInstance('skeleton_knight', { grind: 10 });
      player.inventory.push(instance);
      normalizePlayerInventory(player);
      player.ownedCards = inventoryToOwnedCards(player.inventory);
      if (!Array.isArray(player.selectedDeck)) player.selectedDeck = [];
      if (!player.selectedDeck.includes(instance.instanceId)) {
        player.selectedDeck.push(instance.instanceId);
      }
      // Sync the modified inventory/deck to the client so __AUTOGAME_HARNESS_STATE__
      // reflects the new skeleton_knight instance for the smoke test.
      socket.emit(SERVER_TO_CLIENT.DECK_UPDATE, {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });
      return { ok: true, scenario: name };
    }

    if (name === 'collect-prisms-progress') {
      // Prism Salvage (collect_items) with partial progress for objective-HUD QA.
      // The same state is reachable by selecting crystal_rescue, deploying, and
      // collecting prisms in the dungeon.
      state.selectedQuestId = 'crystal_rescue';
    }

    if (name === 'slippery-floor-lab') {
      // Frost Crossing tier 1 deploy, then seat the player on a production slippery
      // ice room for momentum physics QA. Reachable normally by deploying Frost
      // Crossing and walking onto the ice band.
      setupFrostCrossingTier1Deploy(lobby, state, player);

      const slipperyRoom = state.layout.rooms.find((r) => r.floorSurface === 'slippery')
        || state.layout.rooms.find((r) => r.band === 'ice');
      if (slipperyRoom) {
        player.x = slipperyRoom.x;
        player.z = slipperyRoom.z;
        player.vx = 0;
        player.vz = 0;
        player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      }

      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
    }

    player.ready = true;
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
    enterPlayingPhase(lobby);

    if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
      createDrawDeckFromSelectedDeck(player);
      initPlayerHand(player);
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
      if (!player.pendingSummons) {
        player.pendingSummons = new Set();
      }
    }

    ensureNearbyEnemy(state, player.x, player.z);

    if (name === 'summon-low-mana') {
      player.hp = MAX_HP;
      player.magicStones = 0;
    } else if (name === 'summon-ready') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      if (!player.hand.some(c => c && c.type === 'spell')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'spell');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'battle_familiar', name: 'Battle Familiar', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 44 };
        }
      }
      // The opening hand is drawn from a shuffled deck, so a weapon card is not
      // guaranteed (~1% of hands have none). Force one in (without clobbering the
      // spell above) so weapon-card flows entering via this scenario are deterministic.
      if (!player.hand.some(c => c && c.type === 'weapon')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'weapon' && c.type !== 'spell');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5, grind: 0 };
        }
      }
    } else if (name === 'summon-recall') {
      // Place player in playing phase with two minions far away to test recall
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.x = spawn.x;
      player.z = spawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.enemies = [];
      state.minions = [
        {
          id: crypto.randomUUID(),
          ownerId: player.id,
          type: 'astral_guardian',
          x: player.x + 8,
          z: player.z + 8,
          hp: 40,
          maxHp: 40,
          maxTtl: 60,
          ttl: 60,
          attackDamage: 10,
          attackRange: 1.5,
          attackIntervalMs: 1000,
          lastAttackAt: 0,
        },
        {
          id: crypto.randomUUID(),
          ownerId: player.id,
          type: 'dungeon_drake',
          x: player.x - 8,
          z: player.z - 8,
          hp: 50,
          maxHp: 50,
          maxTtl: 60,
          ttl: 60,
          attackDamage: 15,
          attackRange: 1.5,
          attackIntervalMs: 1500,
          lastAttackAt: 0,
        },
      ];
      // Equip the recall whistle so the user can test it immediately
      player.equippedKeyItemId = 'summon_recall';
      player.keyItemCooldownUntil = 0;
    } else if (name === 'combat-damaged-player') {
      player.hp = 25;
      player.magicStones = MAX_MAGIC_STONES;
    } else if (name === 'saber-grind-max') {
      // Enter a normal run holding a saber_of_light at +10 grind so the gentle
      // AoE-per-grind reach widening can be observed against a nearby enemy
      // without grinding the card first. The same state is reachable normally by
      // owning a saber_of_light, leveling it through +10 grinds, and deploying.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      // Match the real card definition's charge count (6) so the fabricated
      // Saber mirrors a normally owned, grinded, deployed one rather than an
      // impossible 5-charge variant.
      const saberCharges = CARD_DEFS.saber_of_light.charges;
      const saberSlot = player.hand.findIndex(c => c && c.id === 'saber_of_light');
      const saberCard = { id: 'saber_of_light', name: 'Saber of Light', type: 'weapon', charges: saberCharges, remainingCharges: saberCharges, grind: 10 };
      if (saberSlot >= 0) {
        player.hand[saberSlot].grind = 10;
        player.hand[saberSlot].remainingCharges = player.hand[saberSlot].charges || saberCharges;
      } else {
        player.hand[0] = saberCard;
      }
    } else if (name === 'economy-cards-ready') {
      // Enter a normal run with the three economy utility cards (deck_sifter,
      // chrono_trigger, mana_prism) in hand plus an iron_sword filler, full HP
      // and mana, and a nearby enemy so the VFX can be observed immediately.
      // The same state is reachable normally by acquiring these reward cards
      // through dungeon runs and deploying with them in hand.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.hand[0] = { id: 'deck_sifter', name: 'Deck Sifter', type: 'weapon', charges: 3, remainingCharges: 3, magicStoneCost: 0, effect: 'draw_card', drawsOnUse: 1 };
      player.hand[1] = { id: 'chrono_trigger', name: 'Chrono Trigger', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 0, effect: 'chrono_trigger', adjacentChargeRestore: 2 };
      player.hand[2] = { id: 'mana_prism', name: 'Mana Prism', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 0, effect: 'mana_prism', durationSeconds: 12, magicStonePulse: 10, pulseIntervalMs: 2000 };
      player.hand[3] = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5, grind: 0 };
    } else if (name === 'extracted-in-hub') {
      // Partial extract: the local player has stepped through the Telepipe and is
      // standing in the walkable hub while the run stays in `playing` (as it
      // would with squadmates still in the dungeon). Marking the player
      // `extracted` while the run status remains 'playing' drives the client's
      // `isExtracted && gamePhase === 'playing'` branch every stateUpdate, so the
      // extracted-in-hub render path can be verified without a second player.
      // The same state is reachable normally by extracting in a multiplayer run
      // while a squadmate remains in the dungeon. Enemies are cleared so the lone
      // extracted player can't trip a terminal/suspend transition.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      state.telepipe = { x: player.x, z: player.z, placedAt: Date.now() };
      player.extracted = true;
      player.inputActive = false;
      player.inputDx = 0;
      player.inputDz = 0;
    } else if (name === 'suspended-run-hub') {
      // Stand in the walkable hub after the whole squad extracted through a
      // Telepipe, with durable hp/magicStones but no in-progress run. Spend
      // magic stones before the hub return so redeploy visibly preserves vitals.
      // The same state is reachable by deploying, placing a Telepipe, and
      // extracting every squadmate through it.
      player.hp = 42;
      player.magicStones = 15;
      suspendRunToLobby();
      return { ok: true, scenario: name };
    } else if (name === 'deck-viewer-instances') {
      // Enter a normal run whose draw pile is built entirely from owned-card
      // *instances* — the deck/selectedDeck store inventory instance IDs rather
      // than plain card ids (as happens for acquired/forged cards). This drives
      // the deck viewer's (V key) instance-id resolution path so the grid is
      // populated, not empty. The same state is reachable normally by acquiring
      // or forging cards into the inventory, building a deck from those owned
      // cards in the lobby, then starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.inventory = createInventoryFromCardIds([
        'iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake', 'steel_claymore',
      ]);
      normalizePlayerInventory(player);
      player.selectedDeck = player.inventory.map((instance) => instance.instanceId);
      createDrawDeckFromSelectedDeck(player);
      initPlayerHand(player);
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    } else if (name === 'custom-avatar-demo') {
      // Enter a normal run with a distinctive non-default cosmetic so the
      // cosmetic-driven avatar (non-box body shape + accent color) can be
      // verified without first going through the customization UI. The same
      // visual state is reachable normally by saving a cosmetic via the
      // character-customization profile route, then starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.cosmetic = {
        bodyColor: '#e74c3c',
        accentColor: '#2ecc71',
        bodyShape: 'cylinder',
        hat: 'none',
      };
    } else if (name === 'avatar-proportions-demo') {
      // Enter a normal run with distinctive (non-default) body proportions so
      // the glTF avatar's proportion morph-target influences can be verified
      // without first going through the customization sliders. Values stay
      // inside the server clamp (0.75–1.25) and read clearly against the 1.0
      // default. The same visual state is reachable normally by saving
      // proportions via the character-customization profile route, then
      // starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.cosmetic = {
        bodyColor: '#e74c3c',
        accentColor: '#2ecc71',
        bodyShape: 'box',
        hat: 'none',
        proportions: {
          height: 1.25,
          headSize: 1.25,
          torsoWidth: 0.75,
          armLength: 0.75,
          legLength: 1.25,
          shoulderWidth: 1.25,
        },
      };
    } else if (name === 'avatar-wizard-hat') {
      // Enter a normal run with a hat equipped so the avatar's hat child mesh
      // can be verified without first unlocking/equipping a hat in the shop UI.
      // The wizard hat (tall cone) is the most visually distinctive. The same
      // visual state is reachable normally by unlocking + equipping a hat via
      // the cosmetic/profile routes, then starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.cosmetic = {
        bodyColor: '#4f9dde',
        accentColor: '#f2c94c',
        bodyShape: 'box',
        hat: 'wizard',
      };
    } else if (name === 'mixed-enemies') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      spawnEnemy(player.x + 3, player.z, 'grunt');
      spawnEnemy(player.x - 3, player.z, 'skirmisher');
      spawnEnemy(player.x, player.z + 4, 'miniboss');
      spawnEnemy(player.x, player.z - 4, 'spawner');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x + (Math.random() * 4 - 2), z: e.z + (Math.random() * 4 - 2) };
      }
    } else if (name === 'annex-overseer-ready') {
      // Spawn an Annex Overseer beside the player for rooms-boss QA. Reachable
      // normally once training-caverns tier-2 stage boss wiring lands (sub-ticket 03).
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const overseer = spawnEnemy(player.x + 4, player.z, 'annex_overseer');
      overseer.wanderTarget = { x: overseer.x, z: overseer.z };
    } else if (name === 'field-medic') {
      // Field Medic with a wounded grunt ally for heal/flee/bead QA. Same enemies
      // are reachable on tier-2 runs with tier2EnemyPool; this is a shortcut.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const medic = spawnEnemy(player.x + 3, player.z, 'field_medic');
      const grunt = spawnEnemy(player.x + 1, player.z + 2, 'grunt');
      grunt.hp = Math.max(1, Math.floor(grunt.maxHp * 0.4));
      medic.wanderTarget = { x: medic.x, z: medic.z };
      grunt.wanderTarget = { x: grunt.x, z: grunt.z };
    } else if (name === 'field-medic-spawn') {
      // Spawn a Field Medic beside the player for tier-2 rare-spawn QA. The same
      // enemy type is reachable normally on tier-2 runs for quests with
      // tier2EnemyPool (e.g. crystal_rescue); this is a deterministic shortcut.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const medic = spawnEnemy(player.x + 4, player.z, 'field_medic');
      medic.wanderTarget = { x: medic.x, z: medic.z };
    } else if (name === 'glacial-thrower') {
      // Spawn a Glacial Thrower in front of the player so QA can watch it lob a
      // slow giant ice ball, see the projectile travel, and take the SLOW + damage
      // on contact. The same enemy is reachable normally on Frost Crossing runs
      // (it is in that quest's enemyPool); this is a deterministic shortcut.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      state.iceBalls = [];
      const thrower = spawnEnemy(player.x + 6, player.z, 'glacial_thrower');
      thrower.wanderTarget = { x: thrower.x, z: thrower.z };
    } else if (name === 'ember-wraith') {
      // One Ember Wraith in cone-strike range for burning-on-hit QA. The same
      // enemy is reachable on ember_descent runs (or via fire-cavern); shortcut only.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const wraith = spawnEnemy(player.x + 3, player.z, 'ember_wraith');
      wraith.wanderTarget = { x: wraith.x, z: wraith.z };
    } else if (name === 'variant-enemy') {
      // Spawn one variant ("elite") enemy beside a plain one of the same type so
      // the client variant marker can be verified side-by-side. The same state is
      // reachable normally when an enemy rolls a variant on spawn (applyVariant);
      // this is just a deterministic shortcut into it.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const variant = spawnEnemy(player.x + 3, player.z, 'grunt');
      variant.variant = 'test';
      spawnEnemy(player.x - 3, player.z, 'grunt');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'named-rare-enemy') {
      // Spawn a scripted named-rare grunt beside a plain grunt for tint/scale/
      // nameplate QA. The same state is reachable on quests with inline named-rare
      // spawns (e.g. frost_crossing); this is a deterministic shortcut.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      spawnEnemy(player.x - 3, player.z, 'grunt');
      const rare = spawnEnemy(player.x + 3, player.z, 'grunt', undefined, {
        namedRareVariant: {
          name: 'The Fake in Yellow',
          tint: '#ffdd00',
          scaleMult: 1.25,
          drop: { currency: 50 },
        },
      });
      rare.wanderTarget = { x: rare.x, z: rare.z };
      for (const e of state.enemies) {
        if (!e.wanderTarget) {
          e.wanderTarget = { x: e.x, z: e.z };
        }
      }
    } else if (name === 'volatile-enemy') {
      // Spawn a `volatile`-variant grunt (hot-orange badge) at 1 HP beside a
      // plain grunt, so the QA can confirm the distinct volatile tint and then
      // kill it to trigger the on-death radial explosion VFX. The same state is
      // reachable normally when an enemy rolls the volatile variant on spawn
      // (applyVariant) and is defeated; this is just a deterministic shortcut.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const volatileEnemy = spawnEnemy(player.x + 3, player.z, 'grunt');
      volatileEnemy.variant = 'volatile';
      volatileEnemy.hp = 1;
      volatileEnemy.maxHp = ENEMY_DEFS.grunt.hp;
      spawnEnemy(player.x - 3, player.z, 'grunt');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x, z: e.z };
      }
      // Force a fully-charged weapon so the 1-HP volatile enemy is reliably
      // killable through the real lock-on + weapon-swing path.
      if (!player.hand.some(c => c && c.type === 'weapon' && (c.remainingCharges == null || c.remainingCharges > 0))) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'weapon');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5, grind: 0 };
        }
      }
    } else if (name === 'warded-enemy') {
      // Warded grunt with shield beside a plain grunt for side-by-side QA. Same
      // state is reachable via combat spawn + applyVariant rolling warded at tier > 0.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const warded = spawnEnemy(player.x + 3, player.z, 'grunt');
      warded.variant = 'warded';
      VARIANT_DEFS.warded.apply(warded);
      spawnEnemy(player.x - 3, player.z, 'grunt');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'variant-leeching') {
      // Spawn one leeching grunt beside a plain grunt for side-by-side client QA.
      // The same state is reachable when applyVariant rolls leeching on spawn.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const leeching = spawnEnemy(player.x + 3, player.z, 'grunt');
      leeching.variant = 'leeching';
      spawnEnemy(player.x - 3, player.z, 'grunt');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'variant-frenzied') {
      // Spawn one frenzied grunt beside a plain grunt for side-by-side client QA.
      // The same state is reachable when applyVariant rolls frenzied on spawn.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const frenzied = spawnEnemy(player.x + 3, player.z, 'grunt');
      frenzied.variant = 'frenzied';
      spawnEnemy(player.x - 3, player.z, 'grunt');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'frenzied-enemy') {
      // Frenzied grunt below 50% HP (enraged) beside a full-HP frenzied grunt for
      // side-by-side chase/wind-up QA. Same state is reachable by damaging a
      // frenzied enemy in normal combat after applyVariant rolls frenzied on spawn.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const full = spawnEnemy(player.x + 3, player.z, 'grunt');
      full.variant = 'frenzied';
      full.maxHp = ENEMY_DEFS.grunt.hp;
      full.hp = full.maxHp;
      const enraged = spawnEnemy(player.x - 3, player.z, 'grunt');
      enraged.variant = 'frenzied';
      enraged.maxHp = ENEMY_DEFS.grunt.hp;
      enraged.hp = Math.floor(enraged.maxHp * 0.4);
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'spawner-active') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const spawner = spawnEnemy(player.x + 4, player.z, 'spawner');
      spawner.lastSpawnTime = Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 500;
    } else if (name === 'monster-card') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      if (!player.hand.some(c => c && c.type === 'creature')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'creature', charges: 1, remainingCharges: 1 };
          const deckMonsterIndex = player.deck ? player.deck.indexOf('dungeon_drake') : -1;
          if (deckMonsterIndex !== -1) {
            player.deck.splice(deckMonsterIndex, 1);
          }
        }
      }
    } else if (name === 'aegis-sentinel-ready') {
      // Playing phase with Aegis Sentinel in hand and enough Magic Stones to cast.
      // Same state is reachable by buying the card from the shop and entering a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const replaceSlot = player.hand.findIndex(c => c != null);
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = {
          id: 'aegis_sentinel',
          name: 'Aegis Sentinel',
          type: 'creature',
          charges: 1,
          remainingCharges: 1,
          magicStoneCost: 45,
          damage: 0,
        };
      }
    } else if (name === 'minion-combat') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const anchorX = player.x;
      const anchorZ = player.z;
      // Keep the player out of aggro range while a pre-spawned minion brawls nearby.
      player.x = anchorX - DETECTION_RADIUS - 1;
      state.enemies = [];
      const enemy = spawnEnemy(anchorX + 2, anchorZ, 'grunt');
      enemy.hp = 500;
      enemy.maxHp = 500;
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      enemy.attackState = 'idle';
      state.minions = [{
        id: crypto.randomUUID(),
        ownerId: player.id,
        type: 'dungeon_drake',
        x: anchorX + 1,
        z: anchorZ,
        hp: 50,
        maxHp: 50,
        maxTtl: 30,
        ttl: 30,
        breathRange: 6,
        breathHoldDistance: 3.5,
        breathConeAngle: Math.PI / 4,
        breathDamage: 2,
        burnDurationMs: 2000,
        breathDurationMs: 2000,
        breathTickMs: 500,
        breathIntervalMs: 2500,
        lastBreathAt: 0,
      }];
      if (!player.hand.some(c => c && c.type === 'creature')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'creature', charges: 1, remainingCharges: 1 };
          const deckMonsterIndex = player.deck ? player.deck.indexOf('dungeon_drake') : -1;
          if (deckMonsterIndex !== -1) {
            player.deck.splice(deckMonsterIndex, 1);
          }
        }
      }
    } else if (name === 'storm-eagle-combat') {
      // Stormwing Drone ranged lightning QA — pre-spawned minion with a grunt in
      // attack range. Reachable normally by earning the reward card and deploying.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const anchorX = player.x;
      const anchorZ = player.z;
      player.x = anchorX - DETECTION_RADIUS - 1;
      state.enemies = [];
      const enemy = spawnEnemy(anchorX + 5, anchorZ, 'grunt');
      enemy.hp = 500;
      enemy.maxHp = 500;
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      enemy.attackState = 'idle';
      state.minions = [{
        id: crypto.randomUUID(),
        ownerId: player.id,
        type: 'storm_eagle',
        x: anchorX + 1,
        z: anchorZ,
        hp: 45,
        maxHp: 45,
        attackRange: 7,
        attackDamage: 13,
        attackIntervalMs: 1500,
        lastAttackAt: 0,
        maxTtl: 30,
        ttl: 30,
      }];
      if (!player.hand.some(c => c && c.id === 'storm_eagle')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'storm_eagle', name: 'Stormwing Drone', type: 'creature', charges: 1, remainingCharges: 1 };
        }
      }
    } else if (name === 'thunderbird-combat') {
      // Thunderbird chain-lightning QA — pre-spawned minion with two grunts in
      // range for a full chain. Reachable by evolving storm_eagle and deploying.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const anchorX = player.x;
      const anchorZ = player.z;
      player.x = anchorX - DETECTION_RADIUS - 1;
      state.enemies = [];
      const primary = spawnEnemy(anchorX + 6, anchorZ, 'grunt');
      primary.hp = 500;
      primary.maxHp = 500;
      primary.wanderTarget = { x: primary.x, z: primary.z };
      primary.attackState = 'idle';
      const chained = spawnEnemy(anchorX + 8, anchorZ, 'grunt');
      chained.hp = 500;
      chained.maxHp = 500;
      chained.wanderTarget = { x: chained.x, z: chained.z };
      chained.attackState = 'idle';
      state.minions = [{
        id: crypto.randomUUID(),
        ownerId: player.id,
        type: 'thunderbird',
        x: anchorX + 1,
        z: anchorZ,
        hp: 68,
        maxHp: 68,
        attackRange: 11,
        attackDamage: 20,
        attackIntervalMs: 1500,
        chainRadius: 5,
        maxChainTargets: 2,
        lastAttackAt: 0,
        maxTtl: 30,
        ttl: 30,
      }];
      if (!player.hand.some(c => c && c.id === 'thunderbird')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'thunderbird', name: 'Thunderbird', type: 'creature', charges: 1, remainingCharges: 1 };
        }
      }
    } else if (name === 'phase-stalker-combat') {
      // Phase Stalker phase-beam QA — pre-spawned minion mid windup with a grunt
      // in beam range. Reachable by earning null_crawler (reward:12) and deploying.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const anchorX = player.x;
      const anchorZ = player.z;
      player.x = anchorX - DETECTION_RADIUS - 1;
      state.enemies = [];
      const enemy = spawnEnemy(anchorX + 8, anchorZ, 'grunt');
      enemy.hp = 500;
      enemy.maxHp = 500;
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      enemy.attackState = 'idle';
      const now = Date.now();
      state.minions = [{
        id: crypto.randomUUID(),
        ownerId: player.id,
        type: 'null_crawler',
        x: anchorX + 1,
        z: anchorZ,
        hp: 55,
        maxHp: 55,
        attackRange: 14,
        attackDamage: 22,
        attackIntervalMs: 2000,
        attackWindupMs: 1000,
        projectileHitWidth: 0.8,
        lastAttackAt: 0,
        attackState: 'windup',
        windupStartTime: now,
        windupDirX: 1,
        windupDirZ: 0,
        maxTtl: 30,
        ttl: 30,
      }];
      if (!player.hand.some(c => c && c.id === 'null_crawler')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = {
            id: 'null_crawler',
            name: 'Phase Stalker',
            type: 'creature',
            charges: 1,
            remainingCharges: 1,
            magicStoneCost: 35,
          };
        }
      }
    } else if (name === 'legion-marshal-ready') {
      // Legion Marshal skeleton-summon QA — full mana and the evolved card in hand
      // after deploy. Reachable by evolving skeleton_knight and deploying in combat.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      if (!player.hand.some(c => c && c.id === 'undead_commander')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = {
            id: 'undead_commander',
            name: 'Legion Marshal',
            type: 'creature',
            charges: 1,
            remainingCharges: 1,
            isEvolved: true,
          };
        }
      }
    } else if (name === 'archive-wyrm-combat') {
      // Archive Wyrm fire-breath QA — same layout as minion-combat but with the
      // evolved wyrm. Reachable normally by evolving dungeon_drake to ancient_wyrm
      // and deploying into combat.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const anchorX = player.x;
      const anchorZ = player.z;
      player.x = anchorX - DETECTION_RADIUS - 1;
      state.enemies = [];
      const enemy = spawnEnemy(anchorX + 7, anchorZ, 'grunt');
      enemy.hp = 500;
      enemy.maxHp = 500;
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      enemy.attackState = 'idle';
      state.minions = [{
        id: crypto.randomUUID(),
        ownerId: player.id,
        type: 'ancient_wyrm',
        x: anchorX + 1,
        z: anchorZ,
        hp: 90,
        maxHp: 90,
        maxTtl: 30,
        ttl: 30,
        breathRange: 10,
        breathHoldDistance: 5.5,
        breathConeAngle: Math.PI / 3,
        breathDamage: 4,
        breathDurationMs: 2500,
        breathTickMs: 500,
        breathIntervalMs: 3000,
        lastBreathAt: 0,
      }];
      if (!player.hand.some(c => c && c.id === 'ancient_wyrm')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'ancient_wyrm', name: 'Archive Wyrm', type: 'creature', charges: 1, remainingCharges: 1 };
        }
      }
    } else if (name === 'run-failed') {
      for (const p of Object.values(state.players)) {
        p.hp = 0;
        p.dead = true;
      }
      state.minions = [];
      checkRunTerminalState();
    } else if (name === 'run-exhausted') {
      for (const p of Object.values(state.players)) {
        p.deck = [];
        p.hand = [];
        p.desperationDeck = [];
      }
      state.enemies = [{
        id: 'e_remaining',
        x: player.x + 5,
        z: player.z,
        hp: ENEMY_DEFS.grunt.hp,
        maxHp: ENEMY_DEFS.grunt.hp,
        state: 'idle',
        wanderTarget: { x: player.x + 5, z: player.z },
      }];
      state.run.objective.totalEnemies = 1;
      state.run.objective.defeatedEnemies = 0;
      checkRunTerminalState();
    } else if (name === 'collect-prisms-progress') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      if (!state.run || state.run.status !== 'playing' || state.run.objective?.type !== 'collect_items') {
        return { ok: false, reason: 'No active collect_items run for collect-prisms-progress' };
      }
      const objective = state.run.objective;
      const total = Number.isFinite(objective.totalItems) ? objective.totalItems : 3;
      objective.totalItems = total;
      objective.collectedItems = Math.min(2, Math.max(0, total - 1));
    } else if (name === 'quest-objective-near-complete') {
      // Leave a defeat_enemies run one trigger away from victory: a single
      // low-HP grunt stands between the player and an objective-complete win.
      // Defeating it flows through the real recordEnemyDefeated →
      // checkRunTerminalState → victory path (no special-case completion logic
      // here). The player keeps their hand so they can finish through real
      // combat. The same near-complete state is reachable normally by clearing
      // all but the last enemy of a defeat_enemies quest.
      if (!state.run || state.run.status !== 'playing' || state.run.objective.type !== 'defeat_enemies') {
        return { ok: false, reason: 'No active defeat_enemies run for quest-objective-near-complete' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const enemy = spawnEnemy(player.x + 2, player.z, 'grunt');
      enemy.hp = 1;
      enemy.maxHp = ENEMY_DEFS.grunt.hp;
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      state.run.objective.totalEnemies = 1;
      state.run.objective.defeatedEnemies = 0;
      // The opening hand is drawn from a shuffled deck, so a weapon card is not
      // guaranteed (~1% of hands have none). Force a fully-charged weapon in so
      // the lone 1-HP grunt is reliably killable through the real lock-on +
      // weapon-swing path (the QA smoke depends on this determinism). The same
      // near-complete state is still reachable normally with whatever hand play
      // deals; this only fixes the entry hand for the debug shortcut.
      if (!player.hand.some(c => c && c.type === 'weapon' && (c.remainingCharges == null || c.remainingCharges > 0))) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'weapon');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5, grind: 0 };
        }
      }
    } else if (name === 'sloped-dungeon') {
      // Regenerate the dungeon layout with slopes enabled for visual verification.
      // Uses the same seed as the current quest for determinism.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || questLayoutSeed(state.selectedQuestId || DEFAULT_QUEST_ID);
      const profile = getLayoutProfileForQuest(state.selectedQuestId || DEFAULT_QUEST_ID);
      state.layout = generateLayout(seed, profile, { slopes: true });
      state.layoutSeed = seed;
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      withLobbyContext({ state }, () => rebuildWallColliders());
      // Send updated layout to all clients in the lobby
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'sunken-canyon-stage') {
      // Load the sunken-canyon stage layout for client render / collision QA.
      // Same profile as generateLayout(seed, 'sunken-canyon'); reachable via quests
      // once a quest uses layoutProfile 'sunken-canyon'.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'sunken-canyon');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const startRoom = state.layout.rooms.find(r => r.role === 'start');
      if (startRoom) {
        player.x = startRoom.x;
        player.z = startRoom.z;
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'fire-cavern-stage') {
      // Load the fire-cavern stage layout for client render / collision QA.
      // Same profile as generateLayout(seed, 'fire-cavern').
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'fire-cavern');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const startRoom = state.layout.rooms.find(r => r.role === 'start');
      if (startRoom) {
        player.x = startRoom.x;
        player.z = startRoom.z;
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'sunken-canyon-cliff-hazard') {
      // Sunken-canyon with the player on the plateau south cliff hazard strip —
      // same layout as canyon_descent; shortcut for cliff-hazard QA.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'sunken-canyon');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const hazard = (state.layout.edgeHazards || [])[0];
      if (hazard) {
        player.x = (hazard.minX + hazard.maxX) / 2;
        player.z = (hazard.minZ + hazard.maxZ) / 2;
      } else {
        const plateau = state.layout.rooms.find((r) => r.band === 'plateau');
        if (plateau) {
          player.x = plateau.x;
          player.z = plateau.z;
        }
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'spire-ascent-stage') {
      // Load the spire-ascent tower layout for client render / collision QA.
      // Same profile as generateLayout(seed, 'spire-ascent'); reachable via quests
      // once a quest uses layoutProfile 'spire-ascent'.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'spire-ascent');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const startRoom = state.layout.rooms.find(r => r.role === 'start');
      if (startRoom) {
        player.x = startRoom.x;
        player.z = startRoom.z;
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'spire-summit-beacon') {
      // Spire-ascent layout with the player at the summit treasure tier beside the
      // beacon — same state as climbing spire_ascent normally; shortcut for beacon QA.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'spire-ascent');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const summitRoom = state.layout.rooms.find(r => r.role === 'treasure');
      if (summitRoom) {
        player.x = summitRoom.x;
        player.z = summitRoom.z;
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'spire-mid-tier-hazard') {
      // Spire-ascent with the player on the first combat tier inside an edge
      // hazard strip — same layout as spire_ascent; shortcut for hazard QA.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'spire-ascent');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const hazard = (state.layout.edgeHazards || [])[0];
      if (hazard) {
        player.x = (hazard.minX + hazard.maxX) / 2;
        player.z = (hazard.minZ + hazard.maxZ) / 2;
      } else {
        const combatTier = state.layout.rooms.find((r) => r.role === 'combat');
        if (combatTier) {
          player.x = combatTier.x;
          player.z = combatTier.z;
        }
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'open-verticality') {
      // Crystal Rescue open grid with platforms, pits, and slopes — same layout
      // profile as deploying into crystal_rescue with slopes enabled; shortcut
      // places the player beside a platform/hazard for fast visual QA.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.selectedQuestId = 'crystal_rescue';
      const seed = state.layoutSeed || questLayoutSeed('crystal_rescue');
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'open', { slopes: true });
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const anchor =
        (state.layout.platforms && state.layout.platforms[0]) ||
        (state.layout.hazards && state.layout.hazards[0]);
      if (anchor) {
        player.x = anchor.x + 2;
        player.z = anchor.z + 2;
      } else {
        const startRoom = state.layout.rooms.find(r => r.role === 'start');
        if (startRoom) {
          player.x = startRoom.x;
          player.z = startRoom.z;
        }
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'open-plaza-arena') {
      // Load the open-plaza arena (the arena_trials quest layout) for visual /
      // collision verification. Reachable normally by selecting the arena_trials
      // quest; this scenario is just a shortcut into that state.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.selectedQuestId = 'arena_trials';
      applyLayoutForQuest(state, 'arena_trials');
      // Re-place the player at the plaza spawn (centre) on the regenerated layout.
      const plazaSpawn = firstRoomPosition();
      player.x = plazaSpawn.x;
      player.z = plazaSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      // Populate the arena with the trial pack via the cover-aware spawn path so
      // enemy/loot placement on the open plaza is directly observable. This is
      // the same spawn that runs when deploying into arena_trials normally.
      state.enemies = [];
      state.loot = [];
      spawnEnemies();
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'sunken-canyon') {
      // Canyon Descent quest with band-aware spawns — same state as deploying into
      // canyon_descent normally; shortcut for QA (enemies, layout, plateau spawn).
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.selectedQuestId = 'canyon_descent';
      applyLayoutForQuest(state, 'canyon_descent');
      const plateauSpawn = firstRoomPosition();
      player.x = plateauSpawn.x;
      player.z = plateauSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.enemies = [];
      state.loot = [];
      spawnEnemies();
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'spire-ascent') {
      // Spire Ascent quest with tier-aware spawns — same state as deploying into
      // spire_ascent normally; shortcut for QA (enemies, layout, bottom-tier spawn).
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.selectedQuestId = 'spire_ascent';
      applyLayoutForQuest(state, 'spire_ascent');
      const bottomSpawn = firstRoomPosition();
      player.x = bottomSpawn.x;
      player.z = bottomSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.enemies = [];
      state.loot = [];
      spawnEnemies();
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'key-item-cooldown') {
      // Put player in a playing dungeon with key item cooldown active to test on_cooldown rejection.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.equippedKeyItemId = 'dodge_roll';
      player.keyItemCooldownUntil = Date.now() + 5000; // 5-second cooldown remaining
    } else if (name === 'medic-kit-ready') {
      // Put player at low HP with low MS to test Field Medic Kit MS restore.
      player.hp = Math.floor(MAX_HP * 0.3);
      player.magicStones = 5;
      player.equippedKeyItemId = 'field_medic_kit';
      player.keyItemCooldownUntil = 0;
    } else if (name === 'purifying-pulse-ready') {
      // Low-HP player with Purifying Pulse in hand and a single active burn
      // status (burn/slow are mutually exclusive in normal play). Same state is
      // reachable by earning the reward card deep in a dungeon run and casting
      // while burning.
      resumePlayingRunForCardProbe(state, player);
      const statusNow = Date.now();
      player.hp = Math.floor(MAX_HP * 0.4);
      player.magicStones = MAX_MAGIC_STONES;
      player.slowedUntil = 0;
      player.slowFactor = 1;
      player.burningUntil = statusNow + 5000;
      player.lastBurnTickAt = statusNow;
      player.debuffs = [{ type: 'burn', expiresAt: statusNow + 5000 }];
      player.hand[0] = {
        id: 'purifying_pulse',
        name: 'Purifying Pulse',
        type: 'spell',
        charges: 1,
        remainingCharges: 1,
        magicStoneCost: 0,
        specialEffect: 'heal_and_cleanse',
      };
      syncCardProbeHand(player);
    } else if (name === 'heal-spell-ready') {
      // Low-HP player with Restoration Beacon and Sanctum Pulse in hand so heal
      // cast/impact VFX can be compared without earning reward cards in a run.
      // Same state is reachable by acquiring healing_font (and evolving to
      // divine_grace), deploying, and taking damage in combat.
      player.hp = Math.floor(MAX_HP * 0.4);
      player.magicStones = MAX_MAGIC_STONES;
      const healCards = [
        {
          id: 'healing_font',
          name: CARD_DEFS.healing_font.name,
          type: 'spell',
          charges: CARD_DEFS.healing_font.charges,
          remainingCharges: CARD_DEFS.healing_font.charges,
          magicStoneCost: 0,
          specialEffect: 'mana_restore',
        },
        {
          id: 'divine_grace',
          name: CARD_DEFS.divine_grace.name,
          type: 'spell',
          charges: CARD_DEFS.divine_grace.charges,
          remainingCharges: CARD_DEFS.divine_grace.charges,
          magicStoneCost: 0,
          specialEffect: 'mana_restore',
        },
      ];
      let slot = 0;
      for (const card of healCards) {
        while (slot < player.hand.length && player.hand[slot] != null) slot += 1;
        if (slot < player.hand.length) {
          player.hand[slot] = card;
          slot += 1;
        }
      }
    } else if (name === 'guard-block-ready') {
      // Put player at low HP with guard_block equipped and no cooldown to test blocking.
      player.hp = Math.floor(MAX_HP * 0.5);
      player.magicStones = 5;
      player.equippedKeyItemId = 'guard_block';
      player.keyItemCooldownUntil = 0;
    } else if (name === 'flare-beacon-ready') {
      // Put player with flare_beacon equipped and nearby enemies to test reveal VFX.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'flare_beacon';
      player.keyItemCooldownUntil = 0;
      // Ensure a few enemies are nearby to reveal
      ensureNearbyEnemy(state, player.x, player.z);
      spawnEnemy(player.x + 5, player.z + 3, 'skirmisher');
      spawnEnemy(player.x - 4, player.z - 2, 'grunt');
    } else if (name === 'loot-magnet-ready') {
      // Put player with loot_magnet equipped and scattered ground loot to test pull/collect.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'loot_magnet';
      player.keyItemCooldownUntil = 0;
      state.loot = [
        { id: crypto.randomUUID(), x: player.x + 2, z: player.z + 2, y: 0, kind: 'gold', value: 10 },
        { id: crypto.randomUUID(), x: player.x - 3, z: player.z + 4, y: 0, kind: 'gold', value: 15 },
        { id: crypto.randomUUID(), x: player.x + 5, z: player.z - 3, y: 0, kind: 'gold', value: 20 },
        { id: crypto.randomUUID(), x: player.x - 6, z: player.z - 5, y: 0, kind: 'gold', value: 25 },
        { id: crypto.randomUUID(), x: player.x + 12, z: player.z + 10, y: 0, kind: 'gold', value: 50 },
        { id: crypto.randomUUID(), x: player.x + 1, z: player.z - 1, y: 0, kind: 'magic_stone', value: 5 },
      ];
    } else if (name === 'overclock-ready') {
      // Put player with overclock key item equipped and charges ready to test slot cooldown bypass.
      player.hp = MAX_HP;
      player.magicStones = 50;
      player.equippedKeyItemId = 'overclock';
      player.keyItemCooldownUntil = 0;
      player.overclockChargesRemaining = 2;
    } else if (name === 'phase-step-ready') {
      // Equip and position only the local caster with phase_step ready to fire.
      // No synthetic ally is injected — an actual position swap requires a real
      // second player to join the run and stand in range (see phase_step.test.js
      // for swap-logic coverage).
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.equippedKeyItemId = 'phase_step';
      player.keyItemCooldownUntil = 0;
      state.enemies = [];
    } else if (name === 'echo-strike-ready') {
      // Equip echo_strike with no cooldown, a weapon card in hand, and a tanky
      // enemy directly in front so QA can arm the echo then swing and observe two
      // damage events (primary + delayed echo) on the same surviving enemy.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'echo_strike';
      player.keyItemCooldownUntil = 0;
      player.echoStrikePending = false;
      player.rotation = 0;
      if (!player.hand.some(c => c && c.type === 'weapon' && c.effect !== 'draw_card')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'weapon');
        const weaponCard = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', damage: 17, charges: 5, remainingCharges: 5 };
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = weaponCard;
        } else {
          player.hand[0] = weaponCard;
        }
      }
      // Tanky enemy straight ahead (rotation 0 → +x) that survives both packets.
      state.enemies = [];
      spawnEnemy(player.x + 2.5, player.z, 'grunt');
    } else if (name === 'smoke-bomb-ready') {
      // Equip smoke_bomb with no cooldown and place a couple of enemies in
      // attack range so QA can cast the bomb and observe enemies losing their
      // target / cancelling wind-ups while the caster stands in the smoke zone.
      // The same state is reachable normally by equipping the Smoke Bomb key
      // item, entering a run, and approaching enemies.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'smoke_bomb';
      player.keyItemCooldownUntil = 0;
      state.enemies = [];
      spawnEnemy(player.x + 3, player.z, 'grunt');
      spawnEnemy(player.x - 3, player.z + 1, 'skirmisher');
    } else if (name === 'rally-cry-ready') {
      // Equip rally_cry with no cooldown so QA can cast the party move-speed buff
      // and observe the caster (and any allies in radius) speed up for ~4s. The
      // same state is reachable normally by equipping the Rally Cry key item in
      // the lobby and entering a run. A real second player must join to observe
      // the ally-buff aspect; here only the local caster is set up.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'rally_cry';
      player.keyItemCooldownUntil = 0;
      player.rallyUntil = 0;
      player.rallySpeedMultiplier = 1;
      state.enemies = [];
    } else if (name === 'cinder-snare-ready') {
      // Playing phase with Cinder Snare in hand, full Magic Stones, and a grunt
      // wandering nearby so QA can drop the trap and watch an enemy walk into it
      // and take the lingering inferno DoT. The same state is reachable normally
      // by buying the card from the shop, entering a run, and approaching enemies.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const replaceSlot = player.hand.findIndex(c => c != null);
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = {
          id: 'cinder_snare',
          name: 'Cinder Snare',
          type: 'enchantment',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const grunt = spawnEnemy(player.x + 4, player.z, 'grunt');
      grunt.wanderTarget = { x: grunt.x, z: grunt.z };
    } else if (name === 'mirror-ward-ready') {
      // Playing phase with Mirror Ward in hand, full Magic Stones, and a grunt
      // nearby so QA can self-cast and see the instant shell + lingering ward VFX
      // (and later test reflect on hit). Same state is reachable by earning the
      // reward card deep in a dungeon run and casting in combat.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const replaceSlot = player.hand.findIndex(c => c != null);
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = {
          id: 'mirror_ward',
          name: 'Mirror Ward',
          type: 'enchantment',
          charges: 1,
          remainingCharges: 1,
          effect: 'mirror_ward',
        };
      }
      state.enemies = [];
      const grunt = spawnEnemy(player.x + 4, player.z, 'grunt');
      grunt.wanderTarget = { x: grunt.x, z: grunt.z };
    } else if (name === 'chain-lightning-ready') {
      // Playing phase with Voltaic Chain in hand, full Magic Stones, and three
      // grunts lined up along +X so a cast chains primary → two half-damage hops.
      // Same state is reachable by earning the reward card and entering combat.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const replaceSlot = player.hand.findIndex(c => c != null);
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = {
          id: 'chain_lightning',
          name: 'Voltaic Chain',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const primary = spawnEnemy(player.x + 5, player.z, 'grunt');
      primary.hp = 80;
      primary.maxHp = 80;
      primary.wanderTarget = { x: primary.x, z: primary.z };
      const chain1 = spawnEnemy(player.x + 8, player.z, 'grunt');
      chain1.hp = 80;
      chain1.maxHp = 80;
      chain1.wanderTarget = { x: chain1.x, z: chain1.z };
      const chain2 = spawnEnemy(player.x + 11, player.z, 'grunt');
      chain2.hp = 80;
      chain2.maxHp = 80;
      chain2.wanderTarget = { x: chain2.x, z: chain2.z };
    } else if (name === 'status-mutual-exclusion-ready') {
      // Playing phase with Fireball and Permafrost Lance in hand, full Magic
      // Stones, and one grunt in cast range for sequential burn→slow probes.
      // Reachable normally by earning both reward cards in a dungeon run.
      resumePlayingRunForCardProbe(state, player);
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      player.hand = [
        {
          id: 'fireball',
          name: 'Fireball',
          type: 'weapon',
          charges: 4,
          remainingCharges: 4,
        },
        {
          id: 'permafrost_lance',
          name: 'Permafrost Lance',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        },
        null,
        null,
        null,
        null,
      ];
      state.enemies = [];
      const target = spawnEnemy(player.x + 4, player.z, 'grunt');
      target.hp = 200;
      target.maxHp = 200;
      target.wanderTarget = { x: target.x, z: target.z };
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
      syncCardProbeHand(player);
    } else if (name === 'fireball-ready') {
      // Playing phase with Fireball in hand, full Magic Stones, and two grunts
      // lined up along +X so a single cast pierces both, deals impact damage,
      // and leaves them BURNING (visible damage-over-time afterward). The same
      // state is reachable normally by earning the reward card and entering combat.
      resumePlayingRunForCardProbe(state, player);
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      player.hand = [
        {
          id: 'fireball',
          name: 'Fireball',
          type: 'weapon',
          charges: 4,
          remainingCharges: 4,
        },
        null,
        null,
        null,
        null,
        null,
      ];
      state.enemies = [];
      const near = spawnEnemy(player.x + 4, player.z, 'grunt');
      near.hp = 80;
      near.maxHp = 80;
      near.wanderTarget = { x: near.x, z: near.z };
      const far = spawnEnemy(player.x + 7, player.z, 'grunt');
      far.hp = 80;
      far.maxHp = 80;
      far.wanderTarget = { x: far.x, z: far.z };
      syncCardProbeHand(player);
    } else if (name === 'lock-on-elevated-projectile') {
      // Playing phase with Fireball in hand and a grunt elevated on the same
      // (x, z) as the player — flat aim misses; Z-lock + cast should tilt upward
      // and hit. The same state is reachable in vertical quests (e.g. spire ascent)
      // with a reward projectile card and an enemy on a higher platform.
      resumePlayingRunForCardProbe(state, player);
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      player.hand = [
        {
          id: 'fireball',
          name: 'Fireball',
          type: 'weapon',
          charges: 4,
          remainingCharges: 4,
        },
        null,
        null,
        null,
        null,
        null,
      ];
      state.enemies = [];
      const elevated = spawnEnemy(player.x, player.z, 'grunt');
      elevated.y = (player.y || 0.5) + 5;
      elevated.hp = 200;
      elevated.maxHp = 200;
      elevated.wanderTarget = { x: elevated.x, z: elevated.z };
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
      syncCardProbeHand(player);
    } else if (name === 'height-aware-projectile') {
      // Spire-ascent sloped tower: player on the bottom tier, enemy on the top
      // tier — both Y values from sampleFloorY on real ramp/tier geometry. Fireball
      // in hand for lock-on height-aim QA. Reachable normally by climbing spire_ascent
      // with a projectile reward card; this is a deterministic shortcut.
      resumePlayingRunForCardProbe(state, player);
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'spire-ascent');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const tiers = state.layout.rooms
        .filter((r) => r.band === 'tier')
        .sort((a, b) => (a.tierIndex ?? 0) - (b.tierIndex ?? 0));
      const bottomTier = tiers[0];
      const topTier = tiers[tiers.length - 1];
      if (bottomTier) {
        player.x = bottomTier.x;
        player.z = bottomTier.z;
        player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      }
      player.hand = [
        {
          id: 'fireball',
          name: 'Fireball',
          type: 'weapon',
          charges: 4,
          remainingCharges: 4,
        },
        null,
        null,
        null,
        null,
        null,
      ];
      state.enemies = [];
      if (topTier) {
        const elevated = spawnEnemy(topTier.x, topTier.z, 'grunt');
        elevated.y = resolveFloorY(sampleFloorY(state.layout, elevated.x, elevated.z));
        elevated.hp = 200;
        elevated.maxHp = 200;
        elevated.wanderTarget = { x: elevated.x, z: elevated.z };
        elevated.attackState = 'idle';
      }
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
      syncCardProbeHand(player);
      emitLobbyQuestUpdate(lobby, state, {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'ice-ball-ready') {
      // Playing phase with Glacial Orb in hand, full Magic Stones, and grunts
      // lined up along +X so a cast hits the nearest and can roll SLOW. The same
      // state is reachable normally by earning the reward card and entering combat.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      // Harness casts via keyboard (client rotation), not server-only useCard; force
      // the next slow roll so playthrough validation is deterministic (65% is flaky).
      player.debugForceStatusRoll = 'slow';
      const replaceSlot = player.hand.findIndex(c => c != null);
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = {
          id: 'ice_ball',
          name: 'Glacial Orb',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const near = spawnEnemy(player.x + 4, player.z, 'grunt');
      near.hp = 80;
      near.maxHp = 80;
      near.wanderTarget = { x: near.x, z: near.z };
      const far = spawnEnemy(player.x + 7, player.z, 'grunt');
      far.hp = 80;
      far.maxHp = 80;
      far.wanderTarget = { x: far.x, z: far.z };
    } else if (name === 'frost-spells-ready') {
      // Playing phase with Cryo Burst and Permafrost Lance in hand, full Magic
      // Stones, and clustered grunts so both AoE freeze casts are exercisable.
      // The same state is reachable by earning early reward spells in a dungeon run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const filledSlots = player.hand
        .map((c, i) => (c != null ? i : -1))
        .filter((i) => i >= 0);
      if (filledSlots[0] !== undefined) {
        player.hand[filledSlots[0]] = {
          id: 'frost_nova',
          name: 'Cryo Burst',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      if (filledSlots[1] !== undefined) {
        player.hand[filledSlots[1]] = {
          id: 'permafrost_lance',
          name: 'Permafrost Lance',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const near = spawnEnemy(player.x + 3, player.z, 'grunt');
      near.hp = 80;
      near.maxHp = 80;
      near.wanderTarget = { x: near.x, z: near.z };
      const mid = spawnEnemy(player.x + 5, player.z + 1, 'grunt');
      mid.hp = 80;
      mid.maxHp = 80;
      mid.wanderTarget = { x: mid.x, z: mid.z };
      const far = spawnEnemy(player.x + 6, player.z - 1, 'grunt');
      far.hp = 80;
      far.maxHp = 80;
      far.wanderTarget = { x: far.x, z: far.z };
    } else if (name === 'glacier-collapse-ready') {
      // Playing phase with Glacier Rupture in hand, full Magic Stones, and
      // grunts in AoE range so the wind-up shatter cast is exercisable without
      // evolving frost_nova first. The same state is reachable via evolution.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const replaceSlot = player.hand.findIndex(c => c != null);
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = {
          id: 'glacier_collapse',
          name: 'Glacier Rupture',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const near = spawnEnemy(player.x + 3, player.z, 'grunt');
      near.hp = 80;
      near.maxHp = 80;
      near.wanderTarget = { x: near.x, z: near.z };
      const mid = spawnEnemy(player.x + 5, player.z + 1, 'grunt');
      mid.hp = 80;
      mid.maxHp = 80;
      mid.wanderTarget = { x: mid.x, z: mid.z };
    } else if (name === 'fire-spells-ready') {
      // Playing phase with Wyrmflare and Thermal Column in hand, full Magic Stones,
      // and grunts in breath-cone and pillar-AoE range. The same state is reachable
      // by earning late reward/evolved fire spells in a dungeon run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const filledSlots = player.hand
        .map((c, i) => (c != null ? i : -1))
        .filter((i) => i >= 0);
      if (filledSlots[0] !== undefined) {
        player.hand[filledSlots[0]] = {
          id: 'dragons_breath',
          name: 'Wyrmflare',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      if (filledSlots[1] !== undefined) {
        player.hand[filledSlots[1]] = {
          id: 'inferno_pillar',
          name: 'Thermal Column',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const breathNear = spawnEnemy(player.x + 4, player.z, 'grunt');
      breathNear.hp = 80;
      breathNear.maxHp = 80;
      breathNear.wanderTarget = { x: breathNear.x, z: breathNear.z };
      const breathFar = spawnEnemy(player.x + 6, player.z, 'grunt');
      breathFar.hp = 80;
      breathFar.maxHp = 80;
      breathFar.wanderTarget = { x: breathFar.x, z: breathFar.z };
      const pillarMid = spawnEnemy(player.x + 3, player.z + 1.5, 'grunt');
      pillarMid.hp = 80;
      pillarMid.maxHp = 80;
      pillarMid.wanderTarget = { x: pillarMid.x, z: pillarMid.z };
    } else if (name === 'gravity-spells-ready') {
      // Playing phase with Gravity Well and Event Horizon in hand, full Magic
      // Stones, and clustered grunts inside pull/crush AoE. The same state is
      // reachable by earning late reward/evolved gravity spells in a dungeon run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const filledSlots = player.hand
        .map((c, i) => (c != null ? i : -1))
        .filter((i) => i >= 0);
      if (filledSlots[0] !== undefined) {
        player.hand[filledSlots[0]] = {
          id: 'gravity_well',
          name: 'Gravity Well',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      if (filledSlots[1] !== undefined) {
        player.hand[filledSlots[1]] = {
          id: 'event_horizon',
          name: 'Event Horizon',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const near = spawnEnemy(player.x + 4, player.z, 'grunt');
      near.hp = 80;
      near.maxHp = 80;
      near.wanderTarget = { x: near.x, z: near.z };
      const mid = spawnEnemy(player.x + 6, player.z + 1, 'grunt');
      mid.hp = 80;
      mid.maxHp = 80;
      mid.wanderTarget = { x: mid.x, z: mid.z };
      const far = spawnEnemy(player.x + 7, player.z - 1, 'grunt');
      far.hp = 80;
      far.maxHp = 80;
      far.wanderTarget = { x: far.x, z: far.z };
    } else if (name === 'arcane-radial-ready') {
      // Playing phase with Signal Familiar, Ether Siphon, and Soul Drain in hand,
      // full Magic Stones, and clustered grunts inside radial AoE. The same state
      // is reachable by earning reward/evolved arcane spells in a dungeon run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const filledSlots = player.hand
        .map((c, i) => (c != null ? i : -1))
        .filter((i) => i >= 0);
      if (filledSlots[0] !== undefined) {
        player.hand[filledSlots[0]] = {
          id: 'battle_familiar',
          name: 'Signal Familiar',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      if (filledSlots[1] !== undefined) {
        player.hand[filledSlots[1]] = {
          id: 'mana_leach',
          name: 'Ether Siphon',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      if (filledSlots[2] !== undefined) {
        player.hand[filledSlots[2]] = {
          id: 'soul_drain',
          name: 'Soul Drain',
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
        };
      }
      state.enemies = [];
      const near = spawnEnemy(player.x + 3, player.z, 'grunt');
      near.hp = 80;
      near.maxHp = 80;
      near.wanderTarget = { x: near.x, z: near.z };
      const mid = spawnEnemy(player.x + 4, player.z + 1, 'grunt');
      mid.hp = 80;
      mid.maxHp = 80;
      mid.wanderTarget = { x: mid.x, z: mid.z };
      const far = spawnEnemy(player.x + 5, player.z - 1, 'grunt');
      far.hp = 80;
      far.maxHp = 80;
      far.wanderTarget = { x: far.x, z: far.z };
    } else if (name === 'utility-spells-ready') {
      // Playing phase with Astral Guardian, Mana Prism, Offering Terminal, and
      // Chrono Trigger in hand, a friendly minion for sacrifice, and grunts in
      // radial range. The same state is reachable by earning late reward spells
      // and evolving battle_familiar in a dungeon run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const filledSlots = player.hand
        .map((c, i) => (c != null ? i : -1))
        .filter((i) => i >= 0);
      const utilitySpells = [
        { id: 'astral_guardian', name: 'Astral Guardian', magicStoneCost: 65 },
        { id: 'mana_prism', name: 'Mana Prism', magicStoneCost: 0 },
        { id: 'sacrificial_altar', name: 'Offering Terminal', magicStoneCost: 0 },
        { id: 'chrono_trigger', name: 'Chrono Trigger', magicStoneCost: 0 },
      ];
      for (let i = 0; i < utilitySpells.length && filledSlots[i] !== undefined; i++) {
        const spell = utilitySpells[i];
        player.hand[filledSlots[i]] = {
          id: spell.id,
          name: spell.name,
          type: 'spell',
          charges: 1,
          remainingCharges: 1,
          magicStoneCost: spell.magicStoneCost,
        };
      }
      state.minions = [{
        id: crypto.randomUUID(),
        ownerId: player.id,
        type: 'battery_automaton',
        x: player.x + 2,
        z: player.z,
        hp: 80,
        maxHp: 80,
        ttl: 30,
        maxTtl: 30,
        createdAt: Date.now(),
      }];
      state.enemies = [];
      const near = spawnEnemy(player.x + 3, player.z, 'grunt');
      near.hp = 80;
      near.maxHp = 80;
      near.wanderTarget = { x: near.x, z: near.z };
      const mid = spawnEnemy(player.x + 4, player.z + 1, 'grunt');
      mid.hp = 80;
      mid.maxHp = 80;
      mid.wanderTarget = { x: mid.x, z: mid.z };
    } else if (name === 'magma-windup-ready') {
      // Playing phase with Corebreaker Greatsword (windUpMs) in hand and a grunt
      // in melee range so commitment entry and input lock are exercisable without
      // evolving flame_blade first. The same state is reachable via normal evolution.
      resumePlayingRunForCardProbe(state, player);
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      player.hand = [
        {
          id: 'magma_greatsword',
          name: 'Corebreaker Greatsword',
          type: 'weapon',
          charges: 2,
          remainingCharges: 2,
        },
        null,
        null,
        null,
        null,
        null,
      ];
      state.enemies = [];
      const target = spawnEnemy(player.x + 2.5, player.z, 'grunt');
      target.hp = 200;
      target.maxHp = 200;
      target.wanderTarget = { x: target.x, z: target.z };
      syncCardProbeHand(player);
    } else if (name === 'weapon-slash-ready') {
      // Playing phase with the three distinct-slash blades — Rust-Forged Saber
      // (iron_sword, steely arc), Solar Edge (flame_blade, fiery arc + trail),
      // and Ether Scythe (harvesting_scythe, wide ghostly sweep) — in hand at
      // full Magic Stones with grunts lined up along +X so each can be swung
      // back-to-back to compare their slash visuals. The same state is reachable
      // normally: iron_sword and flame_blade are starter cards and the scythe is
      // an earnable reward; this only skips the grind.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const blades = [
        { id: 'iron_sword', name: 'Rust-Forged Saber', charges: 5 },
        { id: 'flame_blade', name: 'Solar Edge', charges: 3 },
        { id: 'harvesting_scythe', name: 'Ether Scythe', charges: 3 },
      ];
      for (let i = 0; i < blades.length && i < player.hand.length; i++) {
        player.hand[i] = {
          id: blades[i].id,
          name: blades[i].name,
          type: 'weapon',
          charges: blades[i].charges,
          remainingCharges: blades[i].charges,
        };
      }
      state.enemies = [];
      for (const dx of [3, 5, 7]) {
        const e = spawnEnemy(player.x + dx, player.z, 'grunt');
        e.hp = 120;
        e.maxHp = 120;
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'energy-blade-slash-ready') {
      // Playing phase holding the energy/photon-class blades — Saber of Light
      // (radiant pale-gold arc), Photon Slicer (cyan spin slice), Arcane Bolt
      // (violet energy lance), Resonance Edge (magenta resonant double pulse),
      // Phase Echo (pink delayed twin-slash), and Infinite Disk (three-disk fan
      // with cyan trail polish) — at full Magic Stones with grunts lined up
      // along +X so each blade can be swung back-to-back to compare its slash
      // visual. The same state is reachable normally: every card here is an
      // earnable reward weapon; this only skips the grind to acquire them.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const energyBlades = [
        { id: 'saber_of_light', name: 'Saber of Light', charges: 6 },
        { id: 'photon_slicer', name: 'Photon Slicer', charges: 4 },
        { id: 'arcane_bolt', name: 'Arcane Bolt', charges: 4 },
        { id: 'resonance_edge', name: 'Resonance Edge', charges: 5 },
        { id: 'echo_blade', name: 'Phase Echo', charges: 5 },
        { id: 'infinite_disk', name: 'Infinite Disk', charges: 4 },
      ];
      player.hand = energyBlades.slice(0, MAX_HAND_SLOTS).map((b) => ({
        id: b.id,
        name: b.name,
        type: 'weapon',
        charges: b.charges,
        remainingCharges: b.charges,
      }));
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
      state.enemies = [];
      for (const dx of [3, 5, 7]) {
        const e = spawnEnemy(player.x + dx, player.z, 'grunt');
        e.hp = 120;
        e.maxHp = 120;
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'heavy-greatsword-slash-ready') {
      // Playing phase holding the three heavy wind-up greatswords — Alloy
      // Greatblade (steel_claymore, slate cleave), Corebreaker Greatsword
      // (magma_greatsword, magma erupt), and Excalibur Photon (excalibur_photon,
      // magenta photon greatslash) — at full Magic Stones with sturdy grunts
      // lined up along +X so each heavy slash + impact can be swung back-to-back
      // to compare the weighty visuals (and the 315 charge telegraph during each
      // wind-up). The same state is reachable normally: all three are evolved
      // reward weapons; this only skips the grind to acquire and evolve them.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.rotation = 0;
      const greatswords = [
        { id: 'steel_claymore', name: 'Alloy Greatblade', charges: 5 },
        { id: 'magma_greatsword', name: 'Corebreaker Greatsword', charges: 4 },
        { id: 'excalibur_photon', name: 'Excalibur Photon', charges: 4 },
      ];
      player.hand = greatswords.slice(0, MAX_HAND_SLOTS).map((b) => ({
        id: b.id,
        name: b.name,
        type: 'weapon',
        charges: b.charges,
        remainingCharges: b.charges,
      }));
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
      state.enemies = [];
      for (const dx of [3, 5, 7]) {
        const e = spawnEnemy(player.x + dx, player.z, 'grunt');
        e.hp = 200;
        e.maxHp = 200;
        e.wanderTarget = { x: e.x, z: e.z };
      }
    }

    syncRunObjectiveToEnemies();

    broadcastLobbyUpdate(lobby);
    io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
    return { ok: true, scenario: name };
  });
}

const BOSS_APPROACH_NUDGE_SCENARIOS = new Set([
  'training-caverns-boss-approach',
  'canyon-descent-boss-approach',
  'arena-trials-boss-approach',
  'spire-ascent-boss-approach',
]);

/**
 * Debug-only: while a boss-approach scenario is active, inch the player toward
 * the encounter anchor each tick so headless harness walks can enter the trigger radius.
 * Nudging is deferred briefly after setup so dormant probes can read stable state.
 */
function nudgeDebugBossApproachPlayers(state) {
  if (!state || state.gamePhase !== 'playing' || !state.run?.encounter) return;
  if (!isEncounterDormant(state.run)) return;
  const bossId = state.run.encounter.bossEnemyId;
  if (!bossId || !areAllNonBossEnemiesDefeated(state, bossId)) return;
  const anchor = resolveEncounterAnchor(state.run, state);
  if (!anchor) return;

  const now = Date.now();
  for (const player of Object.values(state.players)) {
    if (!player || !BOSS_APPROACH_NUDGE_SCENARIOS.has(player.debugScenario)) continue;
    if (player.debugScenarioNudgeAfter && now < player.debugScenarioNudgeAfter) continue;
    const dx = anchor.x - player.x;
    const dz = anchor.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= ENCOUNTER_TRIGGER_RADIUS) {
      tryActivateEncounter(state);
      continue;
    }
    if (dist < 0.01) continue;
    const step = Math.min(2, dist - ENCOUNTER_TRIGGER_RADIUS + 0.5);
    if (step <= 0) continue;
    player.x += (dx / dist) * step;
    player.z += (dz / dist) * step;
    player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
  }
}

module.exports = {
  setCallbacks,
  applyDebugScenario,
  nudgeDebugBossApproachPlayers,
};
