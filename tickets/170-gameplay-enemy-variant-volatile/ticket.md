# 170-gameplay-enemy-variant-volatile

## Difficulty: medium

## Goal

Volatile enemy variant (builds on 169 framework). On death, a Volatile enemy deals radial damage to nearby players/entities, reusing the existing areaEffects system (updateAreaEffects in game/server/simulation.js) for the explosion. Distinct tint/badge on the client.

## Acceptance Criteria

- A Volatile-tagged enemy deals radial area damage on death within a defined radius; the effect is visible client-side and covered by a server test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
