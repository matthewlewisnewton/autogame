# Canyon-descent combat debug scenarios for playthrough

Add minimal debug-only positioning scenarios so the 277 playthrough driver can clear plateau/canyon adds, approach the dormant Canyon Warden (`miniboss` on `canyon_monolith`), and finish the boss on the multi-level sunken-canyon layout. This is the unavoidable game-side test hook for reliable harness combat on vertical geometry.

## Acceptance Criteria

- `game/server/debugScenarios.js` adds handlers `canyon-descent-near-adds`, `canyon-descent-boss-approach`, and `canyon-descent-boss-low-hp` for an in-progress `canyon_descent` Tier 2 `stage_boss` run (`state.run.encounter` present).
- `canyon-descent-near-adds` clusters live support adds (wounded, shields stripped) near the player on valid floor Y for their band (plateau or canyon); forces a charged weapon in hand slot 0; does not disturb the dormant `miniboss` on the monolith.
- `canyon-descent-boss-approach` requires adds cleared and `encounter.phase === 'dormant'`; places the player just outside `ENCOUNTER_TRIGGER_RADIUS` of the canyon monolith anchor with `debugScenarioNudgeAfter` deferral (same pattern as `training-caverns-boss-approach`); nudge targets `resolveEncounterAnchor`, not the boss body.
- `canyon-descent-boss-low-hp` clears non-boss enemies, sets the encounter `miniboss` to 1 HP beside the player at sampled floor Y, and leaves encounter `active`/`locked` as appropriate for harness `defeatBoss`.
- `harness/validate/presets/sunken-canyon.mjs` sets `nearAddsScenario`, `bossApproachScenario`, and `bossLowHpScenario` to the three scenario names above.
- `game/server/test/debug-scenarios.test.js` covers near-adds (live adds remain), boss-approach (30 ticks stay dormant outside trigger), and boss-low-hp (miniboss at 1 HP).
- `cd game && pnpm test:quick` passes.
- No changes under `harness/validate/` except updating `presets/sunken-canyon.mjs` scenario name fields.

## Technical Specs

- **`game/server/debugScenarios.js`:** add canyon helpers (e.g. `liveCanyonDescentAdds`) mirroring `liveTrainingCavernsAdds`; use `sampleFloorY` / `resolveFloorY` for band-correct player and add placement; reuse `resolveEncounterAnchor`, `repositionNearEnemy`, `ENCOUNTER_TRIGGER_RADIUS`, and `nudgeDebugBossApproachPlayers` deferral.
- **`game/server/test/debug-scenarios.test.js`:** extend with canyon Tier 2 fixture via `canyon-descent-tier-2` (or shared test helper from `canyon_descent_tier2.test.js`).
- **`harness/validate/presets/sunken-canyon.mjs`:** wire the three scenario string fields.
- **Scope:** `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`, and preset scenario fields only. Depends on passed sub-ticket **01**.

## Verification: code
