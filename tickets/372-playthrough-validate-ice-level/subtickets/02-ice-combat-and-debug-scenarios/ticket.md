# Ice combat and debug scenarios

Add debug-only positioning scenarios so the ice playthrough driver can clear adds on the multi-band `ice-cavern` layout, exercise **Glacial Thrower** ice-ball slow-on-hit (ticket 293), probe slippery-floor transitions, and finish the `defeat_enemies` objective reliably.

## Acceptance Criteria

- `game/server/debugScenarios.js` adds handlers for an in-progress `frost_crossing` tier-1 run on `ice-cavern` layout:
  - `frost-crossing-near-adds` — clusters live support adds (wounded, shields stripped) near the player at valid `sampleFloorY` for their band (entry/stone/ice/ramp); forces a charged weapon in hand slot 0.
  - `frost-crossing-glacial-thrower-slow` — clears other enemies, spawns one `glacial_thrower` in ice-ball range, sets `player.debugGodmode = false` so the thrower attack can apply `slowedUntil`; player HP high enough to survive the hit.
  - `frost-crossing-surface-transition` — seats the player on the stone→ice boundary with forward velocity toward the slippery ice band (or adjacent stone/ice rooms) for normal↔ice transition probes; zeroes conflicting enemies.
  - `frost-crossing-telepipe-ready` — mirrors `fire-telepipe-ready` but for `frost_crossing` tier 1 on `ice-cavern`: partial HP/MS/charges and telepipe injected on ready-up for harness telepipe-reset.
- Existing scenarios remain usable: `frost-crossing-tier-1` (deploy), `frost-crossing-last-enemy` (victory shortcut), `slippery-floor-lab` (isolated ice-room momentum lab).
- `harness/validate/presets/ice.mjs` sets `nearAddsScenario`, `slipperyFloorScenario: 'slippery-floor-lab'`, `surfaceTransitionScenario`, `glacialSlowScenario`, `lastEnemyScenario: 'frost-crossing-last-enemy'`, and `telepipeScenario` to the new names above.
- `game/server/test/debug-scenarios.test.js` covers near-adds (live adds remain on ice-cavern layout), glacial-thrower-slow (`glacial_thrower` present, godmode off), surface-transition (player on stone band facing ice, non-zero velocity or position on ice after nudge), and telepipe-ready (playing-phase frost_crossing with telepipe in hand and partial vitals).
- `cd game && pnpm test:quick` passes.
- No changes under `harness/validate/` except updating `presets/ice.mjs` scenario name fields. Depends on passed sub-ticket **01**.

## Technical Specs

- **`game/server/debugScenarios.js`:** add ice helpers mirroring fire/canyon patterns; use `sampleFloorY` / `resolveFloorY` and `setupFrostCrossingTier1Deploy` for band-correct placement; reuse `repositionNearEnemy` and existing `glacial-thrower` spawn tuning where possible.
- **`game/server/test/debug-scenarios.test.js`:** extend with fixtures via `frost-crossing-tier-1` deploy scenario.
- **`harness/validate/presets/ice.mjs`:** wire the scenario string fields.
- **Scope:** `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`, and preset scenario fields only.

## Verification: code
