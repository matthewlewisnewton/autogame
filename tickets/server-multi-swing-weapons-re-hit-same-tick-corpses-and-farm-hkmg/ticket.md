# Server: multi-swing weapons re-hit same-tick corpses and farm magicStoneOnHit before cleanup

## Difficulty: easy

## Goal

collectConeHits/collectRadialHits do not filter enemy.hp <= 0 (unlike the chain-lightning and phase-beam paths), so weapons with swingsPerUse > 1 re-hit enemies already killed by an earlier swing in the same tick and grant magicStoneOnHit per swing before cleanupAfterDamage runs (game/server/simulation.js:1309-1359). Fix: filter dead enemies in both collectors, matching the chain-lightning behavior. Found in code review 2026-06-09.

## Acceptance Criteria

- Cone/radial hit collection skips enemies with hp <= 0; a multi-swing weapon kill grants on-hit stones only for swings that landed on a living target; a test covers the corpse re-hit case

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
