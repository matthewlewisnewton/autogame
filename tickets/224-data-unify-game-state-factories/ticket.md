# 224-data-unify-game-state-factories

## Difficulty: easy

## Goal

Two hand-written factories for the same god-state object, already out of sync: createGameState (game/server/index.js:81-105) has enchantments:[], lobby:[], _pendingVolatileExplosions:[]; createLobbyGameState (game/server/lobbies.js:12-28) has none of those three. Any lobby-created state that later reads state.enchantments or pushes _pendingVolatileExplosions hits undefined.

## Acceptance Criteria

- 1. Have createLobbyGameState delegate to createGameState (or both delegate to one shared factory) so the shape is defined once. 2. Smoke test asserting both factories produce the same key set.

## Verification

CORRECTNESS (latent undefined-field bug) + SIMPLICITY. Low risk (additive fields on lobby state).
