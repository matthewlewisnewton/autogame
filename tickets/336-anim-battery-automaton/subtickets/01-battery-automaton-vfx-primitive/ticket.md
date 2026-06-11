# Battery Automaton — deploy & charge-pulse VFX primitives

Add dedicated `spawnBatteryAutomatonDeployEffect` and `spawnBatteryChargePulseEffect` primitives in `renderer.js` so the Battery Automaton reads unmistakably as a mechanical energy battery — amber/gold chassis with cyan electric sparks — instead of the generic green minion puff and silent charge ticks. These primitives are the visual foundation sub-tickets 02–03 compose via the card renderer and minion sync loop.

## Acceptance Criteria

- `spawnBatteryAutomatonDeployEffect(origin, style = {})` spawns at least two visible elements registered in `activeEffects` with finite `duration`:
  1. An expanding amber/gold ground assembly ring at deploy radius (reuse the `spawnSummonEffect` expand→fade lifecycle pattern).
  2. A short vertical electric column or tapered cylinder rising from the origin (modeled on `spawnEtherSiphonColumn` / `spawnLegionMarshalRallyEffect` column paths, but in the Battery Automaton palette).
- `spawnBatteryChargePulseEffect(origin, style = {})` spawns a brief charge-delivery flourish (default duration ~600–800 ms, overridable via `style.duration`):
  1. A quick expanding cyan/amber pulse ring at the minion origin.
  2. An upward electric spark burst via `spawnParticleBurst` (or equivalent registered mesh) so the pulse reads as energy being discharged.
- Default palette: body color `0xfbbf24` (amber/gold), emissive `0x38bdf8` (electric cyan), overridable via `style.color` / `style.emissive`.
- Column/ring entries use distinct flags (e.g. `isBatteryAutomatonColumn`, `isBatteryAutomatonRing`) animated in `updateAttackEffects()`.
- Every mesh is added to `window.___test_scene || scene` and cleaned up via `updateAttackEffects` when past duration.
- Primitives are pure additive VFX: no network traffic, no server changes, no changes to `cardRenderers.js` or `minionSync.js` in this sub-ticket.
- `game/client/test/vfx-primitives.test.js` adds smoke tests for both primitives: each pushes the expected `activeEffects` entries with the battery palette, finite duration, and cleanup after `updateAttackEffects()` past duration.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near other VFX blocks (e.g. `BATTERY_AUTOMATON_COLOR = 0xfbbf24`, `BATTERY_AUTOMATON_EMISSIVE = 0x38bdf8`, column height ~2.5).
  - Implement `spawnBatteryAutomatonDeployEffect(origin, style = {})` composing an expanding ground ring + rising electric column; default deploy duration aligns with `MINION_SUMMON_IN_MS` (750 ms) when `style.duration` is omitted.
  - Implement `spawnBatteryChargePulseEffect(origin, style = {})` composing a brief pulse ring + upward spark burst; default duration ~700 ms.
  - Export both functions; add `updateAttackEffects()` branches for the new flags.
- **`game/client/test/vfx-primitives.test.js`**: import both primitives; assert `activeEffects` entries, palette, finite duration, and post-duration cleanup.
- Do **not** modify `cardRenderers.js`, `main.js`, `minionSync.js`, or server code.

## Verification: code
