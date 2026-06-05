# 250-enemy-per-level-spawn-pools

## Difficulty: medium

## Goal

Per-level enemy spawn pools + rates so each stage draws thematically-appropriate enemies, with some types level-exclusive. Touches ENEMY_DEFS (simulation.js), quest/stage defs, spawn logic (progression.js spawnEnemy).

## Acceptance Criteria

- A level->enemy-pool+spawn-weight table; some enemies level-exclusive; spawn logic uses it. Tests asserting per-level pools + weights.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
