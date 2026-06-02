# Tests and docs: Smoke Veil

## Description

Add automated coverage for Smoke Veil cast, cooldown, snapshot fields, and enemy targeting suppression, and document behavior in `controls.md`. Update the generic key-items test so `smoke_bomb` is no longer expected to return `not_implemented`.

## Acceptance Criteria

- **Cast / cooldown**: `useKeyItem` with `smoke_bomb` sets `smokeVeilUntil` ~2s ahead, veil center at caster position, `keyItemCooldownUntil` ~8s ahead, and `keyItemUsed` `{ ok: true }`.
- **Targeting cleared**: With a player inside their veil, a nearby enemy does not enter `windup` targeting that player (or an in-progress windup on that player deals no damage when the strike resolves inside the veil).
- **Outside veil**: After the player leaves the disc (or `smokeVeilUntil` expires), enemies can target and damage them normally.
- **`game/docs/controls.md`**: New **Smoke Veil** subsection under Key Items describing fixed cast-point zone, ~2s duration, ~8s cooldown, and targeting suppression inside the cloud.
- Existing suite passes (`pnpm test` from `game/`).

## Technical Specs

- **`game/server/test/smoke_bomb.test.js`** (new): Def values; socket integration for cast + cooldown; unit or integration tests for `isPlayerInSmokeVeil` and `updateEnemies` targeting (use `setGameState` / test server helpers like `barrier_dome.test.js` and `key-items.test.js`).
- **`game/server/test/key-items.test.js`**: Remove or rewrite the `not_implemented` expectation for `smoke_bomb`.
- **`game/docs/controls.md`**: Document Smoke Veil (fixed zone at feet, targeting cleared while inside, not a miss-rate roll).

## Verification: code
