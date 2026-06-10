# Ice harness preset and driver registration

Add an `ice` playthrough preset for **Frost Crossing tier 1** (`frost_crossing`, `ice-cavern` layout) and register it with the existing 277 playthrough driver. Reuse the **defeat_enemies** victory path already generalized for the fire preset; Frost Crossing has no stage boss — only the named rare Rimecast on the ice band.

## Acceptance Criteria

- `harness/validate/presets/ice.mjs` exports `{ questId: 'frost_crossing', questTier: 1, objectiveType: 'defeat_enemies', deployScenario: 'frost-crossing-tier-1', layoutProfile: 'ice-cavern', lobbyName: 'Ice Level Validation', findingsTitle: 'Ice level validation findings', … }` with placeholder scenario keys (`nearAddsScenario`, `slipperyFloorScenario`, `surfaceTransitionScenario`, `glacialSlowScenario`, `lastEnemyScenario`, `cardMechanicsScenarios`, `telepipeScenario`) to be filled by later sub-tickets.
- `harness/validate/playthrough.mjs` registers preset `ice` in `PRESET_MODULES` and `STAGE_PRESETS`.
- `runHubStep` accepts the ice preset: wait for `phase === 'playing'`, `layout.profile === 'ice-cavern'`, and `objective.type === 'defeat_enemies'` after `frost-crossing-tier-1` deploy; do **not** require `encounter` or a boss in `enemyHp`.
- `game/package.json` adds `"validate:ice": "node ../harness/validate/playthrough.mjs --preset ice --steps full --out game/validation/ice"`.
- `node harness/validate/playthrough.mjs --preset ice --steps auth` exits `0`.
- `cd game && pnpm test:quick` passes. No `game/server/` or `game/client/` gameplay changes in this sub-ticket.

## Technical Specs

- **New:** `harness/validate/presets/ice.mjs` — mirror `presets/fire.mjs` shape but `questId: 'frost_crossing'`, `deployScenario: 'frost-crossing-tier-1'` (existing handler in `game/server/debugScenarios.js`), `layoutProfile: 'ice-cavern'`, screenshot basename overrides for the shifted ice sequence (`objectiveCompleteScreenshot: '07-objective-complete'`, `victoryScreenshot: '08-victory'`, `telepipeBeforeScreenshot: '09-telepipe-before'`, `telepipeAfterScreenshot: '10-telepipe-after'`).
- **Edit:** `harness/validate/playthrough.mjs` — import/register `ice` preset only; do **not** wire slippery/glacial/card/telepipe steps yet (later sub-tickets).
- **Edit:** `game/package.json` — add `validate:ice` script.
- **Scope:** `harness/validate/**` and `game/package.json` only.

## Verification: code
