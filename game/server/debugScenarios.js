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

const crypto = require('crypto');
const { generateLayout, questLayoutSeed, sampleFloorY, resolveFloorY } = require('./dungeon');
const { DEFAULT_QUEST_ID, getLayoutProfileForQuest, buildQuestUpdatePayload } = require('./quests');
const { DETECTION_RADIUS, MAX_HP, MAX_MAGIC_STONES, MAX_HAND_SLOTS } = require('./config');
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
  syncRunObjectiveToEnemies,
  checkRunTerminalState,
  stateSnapshot,
  assignRunSpawnPositions,
  suspendRunToLobby,
} = require('./progression');
const { unlockHat: unlockHatForAccount, unlockQuestTier } = require('./users');
const { backfillUnlockedHats, HAT_CATALOG } = require('./cosmetic');
const { VARIANT_DEFS } = require('./enemyVariants');
const { PHASES, setPhase } = require('./lobbies');

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

function emitLobbyQuestUpdate(lobby, state, extraFields = {}) {
  if (emitQuestPayloadToLobby) {
    emitQuestPayloadToLobby(lobby, { extraFields });
    return;
  }
  io.to(lobby.id).emit('questUpdate', {
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
    player.debugScenario = name;
    player.pendingSummons.clear();

    if (name === 'telepipe-ready') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      return { ok: true, scenario: name };
    }

    if (name === 'hat-shop-currency') {
      // Stay in the lobby with enough currency to unlock any catalog hat,
      // so the unlockHat flow can be exercised without grinding runs first.
      // The same state is reachable normally by earning currency in dungeons.
      setPhase(lobby, PHASES.LOBBY);
      player.ready = false;
      player.hp = MAX_HP;
      player.currency = Math.max(player.currency || 0, 1000);
      return { ok: true, scenario: name };
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

    if (name === 'arena-trials-tier-2') {
      // arena_trials Tier 2 with rigid open-plaza layout and cover-aware spawns.
      // Quest/tier and layout must be set before enterPlayingPhase so startDungeonRun
      // snapshots the correct run.questTier/objective and spawnEnemy variant rolls.
      // Reachable normally by clearing Arena Trials Tier 1, unlocking Tier 2, and
      // deploying; this scenario is a shortcut into that state.
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
      spawnEnemies();
      syncRunObjectiveToEnemies();

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

    if (name === 'sunken-canyon-tier-2') {
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
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const plateauSpawn = firstRoomPosition();
      player.x = plateauSpawn.x;
      player.z = plateauSpawn.z;
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
      io.to(lobby.id).emit('stateUpdate', stateSnapshot());
      return {
        ok: true,
        scenario: name,
        unlockedQuestTiers: buildQuestUpdatePayload(state, player.accountId).unlockedQuestTiers,
      };
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
      spawnEnemies();
      syncRunObjectiveToEnemies();

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
      socket.emit('deckUpdate', {
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
      // Stand in the walkable hub on top of a suspended run so the distinct
      // Resume affordance (vs. the new-mission Deploy) can be verified without
      // playing a full run then extracting the whole squad through a Telepipe.
      // We spend magic stones, drain a hand card's charges, and advance the
      // objective before capturing the checkpoint so the resume round-trip has
      // visibly non-default values to preserve. The SAME suspended-lobby state
      // is reachable normally by deploying, placing a Telepipe, and extracting
      // every squadmate through it, which suspends the run to the hub.
      player.hp = MAX_HP;
      // A clearly-spent stone count (well under the run-start total) so resume
      // visibly preserves the partial bar rather than refilling it.
      player.magicStones = 15;
      const weaponSlot = player.hand.findIndex(c => c && c.type === 'weapon');
      if (weaponSlot >= 0) {
        const card = player.hand[weaponSlot];
        card.charges = card.charges ?? 5;
        card.remainingCharges = Math.max(1, Math.min(2, card.charges - 1));
      } else {
        const replaceSlot = player.hand.findIndex(c => c);
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', damage: 17, charges: 5, remainingCharges: 2 };
        }
      }
      const objective = state.run && state.run.objective;
      if (objective) {
        if (objective.type === 'defeat_enemies' && objective.totalEnemies > 1) {
          objective.defeatedEnemies = 1;
        } else if (objective.type === 'collect_items' && objective.totalItems > 1) {
          objective.collectedItems = 1;
        }
      }
      // Capture the checkpoint and drop the squad into the hub lobby with the
      // suspended-run banner + Resume control showing.
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
        breathDamage: 3,
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
      // Put player at low HP with some MS to test Field Medic Kit healing.
      player.hp = Math.floor(MAX_HP * 0.3);
      player.magicStones = 5;
      player.equippedKeyItemId = 'field_medic_kit';
      player.keyItemCooldownUntil = 0;
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
    }

    syncRunObjectiveToEnemies();

    broadcastLobbyUpdate(lobby);
    io.to(lobby.id).emit('stateUpdate', stateSnapshot());
    return { ok: true, scenario: name };
  });
}

module.exports = {
  setCallbacks,
  applyDebugScenario,
};
