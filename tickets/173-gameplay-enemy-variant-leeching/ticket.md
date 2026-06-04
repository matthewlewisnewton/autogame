# 173-gameplay-enemy-variant-leeching

## Difficulty: medium

## Goal

Leeching enemy variant (builds on 169 framework). Heals itself for a fraction of the damage it deals to players, reusing existing damage-application paths in game/server/simulation.js. Distinct tint/badge on the client.

## Acceptance Criteria

- A Leeching-tagged enemy heals for a defined fraction of damage dealt to players (capped at its max HP); covered by a server test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
