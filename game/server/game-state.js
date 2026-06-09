const { DEFAULT_QUEST_ID, DEFAULT_QUEST_TIER } = require('./quests');

/**
 * Create a fresh game-state object with the canonical shape.
 *
 * Used by both the module-level singleton (index.js) and per-lobby state
 * (lobbies.js).  Keeping a single definition avoids latent `undefined` errors
 * when lobby-created state is consumed by combat code that expects fields such
 * as `enchantments`, `lobby`, or `_pendingVolatileExplosions`.
 *
 * @returns {object} A fresh game-state object.
 */
function createGameState() {
  return {
    players: {},
    enemies: [],
    minions: [],
    loot: [],
    // Traveling enemy projectiles (glacial thrower ice balls). Advanced each tick
    // by simulation.updateEnemyProjectiles(); shipped in every world snapshot.
    iceBalls: [],
    areaEffects: [],
    enchantments: [],
    lobby: [],
    gamePhase: 'lobby',
    selectedQuestId: DEFAULT_QUEST_ID,
    selectedQuestTier: DEFAULT_QUEST_TIER,
    pendingTrades: {},
    shopOffer: null,
    telepipe: null,
    suspendedCheckpoint: null,
    // Pending Echo Strike packets ({ attackerId, targets:[{enemyId,damage}], applyAt }),
    // applied on a later tick by simulation.processPendingEchoes().
    pendingEchoes: [],
    // Per-tick queue of minion cardUsed payloads; flushed after updateMinions each tick.
    _pendingMinionBreaths: [],
    // Per-tick queue of mirror-ward reflect cardUsed payloads; drained in runGameLoopTick.
    _pendingMirrorReflects: [],
    // Per-tick queue of volatile-enemy detonations ({ x, z, radius }); drained
    // in runGameLoopTick to emit 'volatileExplosion' to the lobby room.
    _pendingVolatileExplosions: [],
    // Per-tick queue of leech-heal audio cues ({ enemyId }); drained in
    // runGameLoopTick to emit 'leechHeal' to the lobby room.
    _pendingLeechHeals: [],
    // Per-tick queue of shield-break audio cues ({ enemyId }); drained in
    // runGameLoopTick to emit 'shieldBreak' to the lobby room.
    _pendingShieldBreaks: [],
    // Per-tick queue of field-medic ally heals ({ medicId, targetId, x, z, healRadius }).
    _pendingMedicHeals: [],
    // Per-tick queue of field-medic energy beads (origin, direction, hits).
    _pendingMedicBeads: [],
  };
}

module.exports = { createGameState };
