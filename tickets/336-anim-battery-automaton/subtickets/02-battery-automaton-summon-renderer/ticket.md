# Battery Automaton — summon renderer, registration & minion mesh preset

Give `battery_automaton` a dedicated card-specific summon renderer and a thematic `MINION_VISUAL` preset so deploying a Battery Automaton reads unmistakably as a mechanical energy battery taking the field — not the generic green creature default. Compose sub-ticket 01's deploy primitive with the shared `spawnMinionSummonInEffect` flourish, timed to the minion summon-in window. Depends on sub-ticket 01 (`spawnBatteryAutomatonDeployEffect`).

## Background (verified, do not re-derive)

- Server `cardEffects.js` `battery_automaton` branch resolves **instantly** (no `windUpMs`): it pushes one minion at the cast origin in a single `CARD_USED` emit with `{ origin, minionId, hits: [] }`.
- Client `minionSync.js` scales new minion meshes in over `MINION_SUMMON_IN_MS` (750 ms). Summon VFX must fire **synchronously** on `CARD_USED` receipt (no projectile travel, no `scheduleAfter` deferral).
- Card stats (`shared/cardStats.json`): `magicStoneCost: 50`, `minionHp: 80`, `minionTtl: 30`, `chargeRestore: 1`, `chargePulseIntervalMs: 6000`. No attacks, no projectile, no wind-up telegraph.
- Today `resolveRenderers('battery_automaton')` falls through to the type default `renderCreatureSummon`.

## Acceptance Criteria

- A new card-specific renderer function (e.g. `renderBatteryAutomaton`) exists in `game/client/cardRenderers.js` and is registered in `CARD_RENDERERS` under the Creatures section keyed by `battery_automaton`.
- `resolveRenderers('battery_automaton')` returns exactly one renderer, and it is NOT the generic `creature` type-default renderer (`renderCreatureSummon`).
- On summon (`data.minionId` present), the renderer calls:
  - `ctx.spawnBatteryAutomatonDeployEffect(originOf(data), batteryStyle)` for the mechanical deploy flourish.
  - `ctx.spawnMinionSummonInEffect(originOf(data), batteryStyle)` with amber/cyan palette and parameters distinct from the generic green default.
- All flourish durations passed to primitives use `MINION_SUMMON_IN_MS` (750 ms) so VFX lifetime matches the minion mesh scale-in.
- `MINION_VISUAL.battery_automaton` is defined in `renderer.js` with a box or compact mechanical silhouette (amber body, cyan emissive) so the persistent minion mesh matches the card theme — not the generic green cylinder fallback.
- Battery Automaton has **no** `windUpMs` — summon VFX fires synchronously on `CARD_USED` with no `scheduleAfter` delay.
- Every `ctx.*` call is guarded so optional primitives never throw.
- `main.js` `cardRenderCtx` exposes `spawnBatteryAutomatonDeployEffect` from `renderer.js`.
- `pnpm test:quick` passes; sub-ticket 04 owns extended test assertions.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Add `BATTERY_AUTOMATON_COLOR` / `BATTERY_AUTOMATON_EMISSIVE` constants and `renderBatteryAutomaton(data, ctx)`.
  - Early-return unless `data.minionId && ctx.spawnMinionSummonInEffect`; compose `spawnBatteryAutomatonDeployEffect` + `spawnMinionSummonInEffect` at `originOf(data)`.
  - Register `battery_automaton: renderBatteryAutomaton` in `CARD_RENDERERS` under `// Creatures`.
  - Update the ctx interface comment block to document `spawnBatteryAutomatonDeployEffect`.
- **`game/client/renderer.js`**: add `MINION_VISUAL.battery_automaton` entry (box-shaped mechanical preset with amber/cyan palette).
- **`game/client/main.js`**: import and wire `spawnBatteryAutomatonDeployEffect` on `cardRenderCtx`.
- **Server reference** (read-only): `cardEffects.js` ~L1321–1325 sets `lastChargePulseAt`, `chargePulseIntervalMs`, `chargeRestore` on spawn. Do not modify server code.
- Do **not** modify `spawnBatteryAutomatonDeployEffect` internals (owned by sub-ticket 01) or implement charge-pulse sync (owned by sub-ticket 03).

## Verification: code
