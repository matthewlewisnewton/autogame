# Move minion + hazard sync into game/client/renderer/minionSync.js

Move the minion-domain and spike-trap-hazard mesh sync out of `renderer.js` into
a real module imported by `renderer.js`. `syncMinionMeshes()` and
`syncSpikeTrapMeshes()` plus their minion-only helpers move to the new file;
behavior unchanged. Depends on sub-ticket 06.

## Acceptance Criteria

- A new file `game/client/renderer/minionSync.js` exists and exports
  `syncMinionMeshes(gs)` and `syncSpikeTrapMeshes(gs)`, with bodies unchanged in
  behavior.
- Minion-only helpers/state used solely here move into the module (e.g.
  `createMinionMesh`, the null-crawler telegraph create/update helpers,
  `seenMinionIds` / `minionSpawnTimes` / `minionBaseScales` summon-in state, and
  the `MINION_SUMMON_IN_MS` constant). The spike-trap mesh builder
  (`createSpikeTrapHazardMesh`) moves with `syncSpikeTrapMeshes`.
- Cross-cutting helpers (`flashMesh`, `syncFlyingShadow`, `spawnDamageNumber`,
  `disposeOne`, `flyingRenderOffset`, `spawnTelegraphRing`) and the mesh-map
  stores are imported, not duplicated; scene/maps come from `./rendererState.js`
  and generic reconcile/dispose helpers from `./meshSync.js`.
- `syncSpikeTrapMeshes` continues to reconcile via the shared `syncMeshMap`
  helper (as it already does), and minion cleanup uses `disposeStaleMeshes`
  rather than a re-implemented stale loop.
- `renderer.js` no longer defines these functions locally — it imports them from
  `./renderer/minionSync.js` and `animate()` still calls each once per frame.
- `pnpm test` (from `game/`) passes; game boots with minions summoning
  (scale-in), taking damage flashes/damage numbers, null-crawler windup
  telegraph, and armed spike-trap hazards rendering as before (no console
  `pageerror`).

## Technical Specs

- New: `game/client/renderer/minionSync.js`.
- Edit: `game/client/renderer.js` — cut `syncMinionMeshes` (~lines 6765–6863) and
  `syncSpikeTrapMeshes` (~lines 6865–6877) and their minion-only helper cluster;
  add `import { syncMinionMeshes, syncSpikeTrapMeshes } from
  './renderer/minionSync.js'`. Export back any cross-cutting helper the module
  imports (call-time-only, cycle-safe).
- Do NOT touch any sub-ticket folder containing a `.passed` marker.

## Verification: code
