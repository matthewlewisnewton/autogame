# Fire combat and ember-burn debug scenarios

Add debug-only positioning scenarios so the fire playthrough driver can clear adds on the multi-band `fire-cavern` layout, exercise **Ember Wraith** burn-on-hit (ticket 296), and finish the `defeat_enemies` objective reliably.

## Acceptance Criteria

- `game/server/debugScenarios.js` adds handlers for an in-progress `ember_descent` tier-1 run on `fire-cavern` layout:
  - `ember-descent-near-adds` — clusters live support adds (wounded, shields stripped) near the player at valid `sampleFloorY` for their band (rim/ramp/basin); forces a charged weapon in hand slot 0.
  - `ember-descent-ember-wraith-burn` — clears other enemies, spawns one `ember_wraith` in cone-strike range, sets `player.debugGodmode = false` so the wraith attack can apply `burningUntil`; player HP high enough to survive ticks.
  - `ember-descent-last-enemy` — all adds cleared, one grunt (or remaining pool type) at 1 HP beside the player at sampled floor Y for harness victory.
- `harness/validate/presets/fire.mjs` sets `nearAddsScenario`, `emberBurnScenario`, and `lastEnemyScenario` to the three names above.
- `game/server/test/debug-scenarios.test.js` covers near-adds (live adds remain on fire-cavern layout), ember-wraith-burn (`ember_wraith` present, godmode off), and last-enemy (single 1-HP enemy, objective not yet complete).
- `cd game && pnpm test:quick` passes.
- No changes under `harness/validate/` except updating `presets/fire.mjs` scenario name fields. Depends on passed sub-ticket **01**.

## Technical Specs

- **`game/server/debugScenarios.js`:** add fire helpers mirroring canyon patterns; use `sampleFloorY` / `resolveFloorY` for band-correct placement; reuse `repositionNearEnemy` and existing `ember-wraith` spawn logic where possible.
- **`game/server/test/debug-scenarios.test.js`:** extend with fixtures via `fire-cavern` deploy scenario.
- **`harness/validate/presets/fire.mjs`:** wire the three scenario string fields.
- **Scope:** `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`, and preset scenario fields only.

## Verification: code
