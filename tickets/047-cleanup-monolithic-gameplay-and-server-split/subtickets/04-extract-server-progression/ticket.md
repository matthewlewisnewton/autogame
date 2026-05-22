# Extract Server Progression Module

Move reward rotation logic, currency grants, deck validation, card drawing, hand management, player persistence, run state, enemy/loot spawning, and state snapshot out of `game/server/index.js` into a dedicated `game/server/progression.js` module.

## Acceptance Criteria

- `game/server/progression.js` exists and exports:
  - `CARD_DEFS` — card definitions (iron_sword, flame_blade, battle_familiar, dungeon_drake)
  - `STARTING_DECK_IDS` — default 8-card starting deck
  - `createPlayerProgress()` — builds `{ currency, ownedCards, runRewards, currencyEarnedThisRun }`
  - `extractPersistentData(player)` — pulls persistent fields from a player object
  - `savePlayerData(playerId)` / `saveAllPlayers()` — persists player data via storage provider
  - `persistenceKey(playerId)` — resolves accountId vs playerId for storage key
  - `grantCard(player, cardId)` — increments owned card count
  - `grantRunRewards(playerId, summary)` — victory currency bonus + rotation card from `VICTORY_REWARD_ROTATION`
  - `buildPlayerRewardSummary(playerId)` — returns per-player reward summary
  - `validateDeck(deck, ownedCards)` — checks deck size, card existence, copy ownership
  - `canAddCardToDeck(cardId, deck, ownedCards)` — pre-check for deck editor
  - `createDrawDeckFromSelectedDeck(player)` — copies selected deck, shuffles, assigns to `player.deck`
  - `drawCardFromDeck(player)` — pops from draw deck, returns card object
  - `initPlayerHand(player)` — draws 4 cards into hand
  - `drawReplacementCard(player, slotIndex)` — draws replacement or splices if deck empty
  - `createRunState()` — builds `{ id, status, objective, startedAt }`
  - `startDungeonRun()` — assigns `gameState.run`, resets per-run tracking
  - `recordEnemyDefeated(count)` — increments defeated counter
  - `removeDeadEnemies()` — filters dead enemies, records count
  - `cleanupAfterDamage()` — remove dead enemies + check terminal state
  - `checkRunTerminalState()` — victory/failure detection, grants rewards, emits runComplete/runFailed
  - `resetTransientRunState()` — clears enemies, minions, loot
  - `returnPlayersToLobby()` — persists, resets phase to lobby, restores HP/position, broadcasts
  - `checkAllReady()` — when all ready: starts game, spawns enemies, emits startGame
  - `spawnEnemy(x, z, type, spawnedBy)` — creates enemy from ENEMY_DEFS
  - `spawnEnemies()` — spawns initial enemy set using spawn table
  - `spawnLoot(layout, rng)` — spawns loot in treasure rooms
  - `stateSnapshot()` — builds serializable game state for client broadcast
  - `ENEMY_DEFS` is NOT re-exported here (lives in simulation.js); progression imports it for `spawnEnemy`
- `game/server/index.js` imports all progression functions from `./progression.js`
- Socket event handlers in `index.js` call progression functions (validateDeck, grantCard, deckAddCard, useCard card logic, lootPickup, etc.)
- The `useCard` handler's card-specific logic (weapon cone, summon AoE, monster spawn) can remain in `index.js` but calls `drawCardFromDeck`, `drawReplacementCard`, `initPlayerHand` from progression
- All existing server unit tests pass (`npm test` in `game/server/`)
- `module.exports` in `index.js` re-exports progression functions for test compatibility

## Technical Specs

- **New file:** `game/server/progression.js` — CommonJS module containing: player progress/persistence (lines ~455-531), reward/progression logic (lines ~664-804), run state management (lines ~550-662), run terminal state/lobby return (lines ~873-973), enemy/loot spawning (lines ~1008-1115), state snapshot (lines ~1518-1562), card data (lines ~401-454 — CARD_DEFS, STARTING_DECK_IDS, MINION_FOLLOW_*)
- **Modify:** `game/server/index.js` — remove inline progression code; import from `./progression.js`; keep Express/Socket.IO bootstrapping, connection handler, socket event handlers (move, useCard, playerReady, returnToLobby, deckAddCard, deckRemoveCard, disconnect, heartbeat, lootPickup, debugScenario), game loop wiring, timer management, state reset
- **Dependencies:** `gameState` (from `index.js`), `./config` constants, `./dungeon` (roomsByRole, randomRoomPositionByRole), `./providers` (InMemoryProvider, FileProvider), `ENEMY_DEFS` from `./simulation.js`, `damagePlayer` from `./simulation.js` (for checkRunTerminalState → damagePlayer path), `io` (for emit calls in checkRunTerminalState, returnPlayersToLobby, checkAllReady)
- **Circular dependency note:** `damagePlayer()` in simulation.js calls `checkRunTerminalState()` in progression.js. Resolve by passing `checkRunTerminalState` as a parameter to `damagePlayer()`, or having progression export a callback that simulation registers.
- **Re-exports:** `index.js` must re-export all progression functions in its `module.exports` so existing tests that import from `index.js` continue to work

## Verification: code
