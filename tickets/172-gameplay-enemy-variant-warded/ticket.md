# 172-gameplay-enemy-variant-warded

## Difficulty: medium

## Goal

Warded enemy variant (builds on 169 framework). Spawns with a damage-absorbing shield that must be depleted before HP is affected, reusing existing status/debuff fields in game/server/simulation.js. Distinct tint/badge + shield indicator on the client.

## Acceptance Criteria

- A Warded-tagged enemy spawns with a shield that absorbs a defined amount of damage before HP drops; shield state is visible client-side and covered by a server test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
