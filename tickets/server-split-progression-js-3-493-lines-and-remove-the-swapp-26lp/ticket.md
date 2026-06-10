# Server: split progression.js (3,493 lines) and remove the swappable module-global _gameState

## Difficulty: hard

## Goal

game/server/progression.js mixes ~8 domains (shop/economy, card instances/inventory, trades, run lifecycle, hand/draw/desperation decks, enemy spawn/drops, persistence) across ~150 top-level functions, coupled through a module-level _gameState that withLobbyContext (game/server/index.js:352-368) swaps per call — a manual stack, duplicated in simulation.js. Many functions default state = _gameState (healAtMedic:459, ensureShopOffer:443, buildCardChoices:1173), so any call path that forgets the context wrapper silently mutates the WRONG lobby state — invisible cross-lobby corruption at the call site. Only strict synchrony makes it safe today; one await inside a context corrupts the stack. Fix: split into modules (persistence, economy, trades, runLifecycle, hand) and pass state explicitly as the first argument, deleting the ambient-global pattern; start with persistence (savePlayerData/extractPersistentData/provider) as the smallest seam. Mechanical but wide — should be decomposed into per-module sub-tickets. Found in code review 2026-06-09.

## Acceptance Criteria

- No module-level _gameState remains in progression.js; state is an explicit parameter; progression.js split into focused modules; all existing tests pass

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
