# Aegis Sentinel — cast VFX primitives

Add dedicated Aegis Sentinel VFX primitives in `renderer.js` so the card reads unmistakably as a green protective shield sentinel — not the generic creature puff or the indigo Astral Guardian spell burst. These primitives are the visual foundation sub-ticket 02 composes via the card renderer.

## Acceptance Criteria

- `spawnAegisSentinelShieldFlourish(origin, style = {})` creates a brief caster shield wrap at cast time:
  1. A pulsing green ground ring (default radius ~1.5) that expands and fades.
  2. A short translucent shield facet or dome rising around the origin (modeled on `spawnMirrorWardShellEffect` / `spawnBatteryAutomatonDeployEffect` column paths, but in the Aegis palette).
  3. Default duration aligns with `MINION_SUMMON_IN_MS` (750 ms) when `style.duration` is omitted.
- `spawnAegisSentinelDeployEffect(origin, style = {})` creates the minion-deploy flourish at the summon point:
  1. An expanding green ward ring (default radius ~2.0).
  2. A rising shield-wall silhouette (wide box or tapered column) so the sentinel materialization reads as a taunt wall, not an offensive blast.
  3. Default duration aligns with `MINION_SUMMON_IN_MS` (750 ms).
- Default palette: body `0x4ade80` (card accent green), emissive `0x22c55e` with optional gold highlight `0xfbbf24` overridable via `style.color` / `style.emissive`.
- Both primitives register meshes in `activeEffects` with finite `duration`, distinct flags (e.g. `isAegisSentinelShield`, `isAegisSentinelDeploy`), and cleanup via `updateAttackEffects()`.
- Every mesh is added to `window.___test_scene || scene`; no per-frame allocation in the update loop.
- Primitives are pure additive VFX: no network traffic, no server changes, no changes to `cardRenderers.js` or `minionSync.js` in this sub-ticket.
- `game/client/test/vfx-primitives.test.js` adds smoke tests for both primitives: each pushes expected `activeEffects` entries with the aegis palette, finite duration, and cleanup after `updateAttackEffects()` past duration.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near other VFX blocks (e.g. `AEGIS_SENTINEL_COLOR = 0x4ade80`, `AEGIS_SENTINEL_EMISSIVE = 0x22c55e`, `AEGIS_SENTINEL_GOLD = 0xfbbf24`).
  - Implement `spawnAegisSentinelShieldFlourish(origin, style = {})` — shield wrap for `shieldGranted` cast feedback.
  - Implement `spawnAegisSentinelDeployEffect(origin, style = {})` — ward ring + rising shield-wall silhouette for minion spawn.
  - Export both functions; add `updateAttackEffects()` branches for the new flags.
- **`game/client/test/vfx-primitives.test.js`**: import both primitives; assert `activeEffects` entries, palette, finite duration, and post-duration cleanup.
- Do **not** modify `cardRenderers.js`, `main.js`, `minionSync.js`, or server code.

## Verification: code
