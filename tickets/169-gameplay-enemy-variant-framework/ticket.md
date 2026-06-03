# 169-gameplay-enemy-variant-framework

## Difficulty: hard

## Goal

Introduce the CONCEPT of enemy variants (affixes) without yet shipping specific effects. A variant is a named tag applied to a fraction of spawned enemies that modifies behavior and gives a visual marker + bonus drop. This ticket lays the plumbing only: a variant registry, an applyVariant(enemy, tier, rng) seam wired into spawnEnemy (game/server/simulation.js ~691, game/server/progression.js ~2453), gating probability on the currently-unused room.encounterTier (game/server/dungeon.js:874-914), a public-state field so the client can tint/badge a variant enemy (game/client/renderer.js), and guaranteed-bonus-drop hooks (recordEnemyCardDrop / spawnMagicStoneDrop). Ship with a no-op/trivial test variant to prove the seam; specific variants land in follow-up tickets 170-173.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: visual`
