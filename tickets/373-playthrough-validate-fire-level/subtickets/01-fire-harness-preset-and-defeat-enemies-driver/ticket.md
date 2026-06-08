# Fire harness preset and defeat-enemies driver path

Add a `fire` playthrough preset for **Ember Descent tier 1** (`ember_descent`, `fire-cavern` layout) and teach the existing 277 playthrough driver to run a **defeat_enemies** victory path instead of the stage-boss encounter flow. Ember Descent has no stage boss yet — boss encounter steps must be skipped for this preset.

## Acceptance Criteria

- `harness/validate/presets/fire.mjs` exports `{ questId: 'ember_descent', questTier: 1, objectiveType: 'defeat_enemies', deployScenario: 'fire-cavern', layoutProfile: 'fire-cavern', lobbyName: 'Fire Level Validation', … }` with placeholder scenario keys (`nearAddsScenario`, `emberBurnScenario`, `lastEnemyScenario`, `cardMechanicsScenario`, `telepipeScenario`) to be filled by later sub-tickets.
- `harness/validate/playthrough.mjs` registers preset `fire` in `PRESET_MODULES` and `STAGE_PRESETS`.
- `runHubStep` uses `preset.objectiveType` (default `stage_boss` for existing presets): for `fire`, wait for `phase === 'playing'`, `layout.profile === 'fire-cavern'`, and `objective.type === 'defeat_enemies'`; do **not** require `encounter` or a boss in `enemyHp`.
- New `runDefeatEnemiesCombatStep` (or equivalent) replaces `runBossEncounterStep` when `objectiveType === 'defeat_enemies'`: god-mode on, optional `nearAddsScenario`, `defeatAdds` with mid-combat screenshot `03-mid-combat.png`, floor-alignment probe — no dormant/active boss screenshots.
- `runVictoryStep` supports defeat-enemies: optional `lastEnemyScenario`, defeat remaining enemies, wait for `runStatus === 'victory'` and `runObjectiveComplete === true` (no `bossDefeated` requirement); screenshots `06-objective-complete.png` and `07-victory.png`.
- `buildAssertions` for `fire` returns `{ layoutDeployed, enemiesCleared, victoryFired }` (or similar defeat-enemies keys) instead of boss encounter booleans; existing presets keep current boss assertions unchanged.
- `game/package.json` adds `"validate:fire": "node ../harness/validate/playthrough.mjs --preset fire --steps full --out game/validation/fire"`.
- `node harness/validate/playthrough.mjs --preset fire --steps auth` exits `0`.
- `cd game && pnpm test:quick` passes. No `game/server/` or `game/client/` gameplay changes in this sub-ticket.

## Technical Specs

- **New:** `harness/validate/presets/fire.mjs` — mirror `presets/sunken-canyon.mjs` shape but `objectiveType: 'defeat_enemies'`, `deployScenario: 'fire-cavern'` (existing handler in `game/server/debugScenarios.js`), `findingsTitle: 'Fire level validation findings'`.
- **Edit:** `harness/validate/playthrough.mjs` — branch hub deploy wait, combat step, victory step, and `buildAssertions` on `preset.objectiveType`; generalize screenshot collection for defeat-enemies filenames.
- **Edit:** `harness/validate/lib/combat.mjs` — optional `defeatAllEnemies` helper or parameterize `defeatAdds` when no boss type filter is needed.
- **Edit:** `game/package.json` — add `validate:fire` script.
- **Scope:** `harness/validate/**` and `game/package.json` only.

## Verification: code
