# Server — Archive Wyrm flying minion spawn

Stamp `flying: true` and an explicit `altitude` onto freshly summoned **Archive Wyrm** (`ancient_wyrm`) minions using the existing airborne model from ticket 376. Vault Wyrm (`dungeon_drake`) minions must remain floor-snapped ground crawlers.

## Acceptance Criteria

- Summoning `ancient_wyrm` via `useCard` creates a minion with `flying: true`, a positive numeric `altitude`, and `hp`/`maxHp` unchanged (90).
- Summoning `dungeon_drake` does **not** set `flying` or `altitude` on the minion.
- `updateMinions()` resolves an Archive Wyrm's `y` to `floorY + altitude` (not equal to bare `floorY`) via `resolveEntityY`.
- Hot/world snapshots expose `flying`, `altitude`, and resolved `y` on the live minion object (raw `buildWorldSnapshot` minion array — no field stripping).
- `game/shared/cardStats.json` defines `altitude` for `ancient_wyrm` only; `dungeon_drake` stats are untouched.
- Debug scenario `archive-wyrm-combat` pre-spawns a flying Archive Wyrm (matching card-summon behavior).
- Server tests cover: (a) socket spawn asserts flying fields, (b) `airborne.test.js` hover case for `ancient_wyrm`, (c) grounded `dungeon_drake` regression in the same airborne suite.

## Technical Specs

- **`game/server/cardEffects.js`**: in the creature-summon path, after `applyWyrmMinionBreathStats` for `ancient_wyrm` only, set `minion.flying = true` and `minion.altitude` from `cardDef.altitude` (mirror the `storm_eagle` / `thunderbird` pattern; do **not** apply to `dungeon_drake`).
- **`game/shared/cardStats.json`**: add `altitude` (suggested **4** world units — large evolved dragon, between Stormwing Drone and Thunderbird) to the `ancient_wyrm` object.
- **`game/server/debugScenarios.js`**: `archive-wyrm-combat` minion seed gets `flying: true` and the same `altitude` as card stats.
- **`game/server/simulation.js`**: update the airborne minion comment near the post-AI `resolveEntityY` loop to mention `ancient_wyrm` alongside `storm_eagle` / `thunderbird` (comment only unless a gap is found).
- **`game/server/test/ancient_wyrm.test.js`**: extend the gameplay spawn test to expect `{ flying: true, altitude: <card value> }`.
- **`game/server/test/airborne.test.js`**: add `ancient_wyrm` hover test; keep existing grounded-minion regression.

## Verification: code
