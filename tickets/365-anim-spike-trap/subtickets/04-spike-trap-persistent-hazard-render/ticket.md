# Spike Trap — persistent armed-trap rendering + trigger feedback

Render active `spike_trap` enchantments as a persistent steel/blood-red ground
hazard for their whole server-side lifetime (instead of only a one-shot cast
flourish), and play the erupting-spikes VFX as synced hit feedback when the trap
fires. Depends on sub-ticket 03 (which puts `enchantments` in the state snapshot
and emits `SPIKE_TRAP_TRIGGERED`) and sub-ticket 01 (`spawnSpikeTrapEffect`).

## Acceptance Criteria

- The renderer maintains a persistent mesh per armed `spike_trap`: a new mesh map
  (e.g. `spikeTrapMeshes`) is reconciled from `gameState.enchantments` inside the
  main `animate()` loop, mirroring the enemy/minion mesh-sync pattern. For each
  enchantment with `effect === 'spike_trap'` and `armed === true`, a ground-hazard
  mesh is created on first sight (keyed by `enc.id`), positioned at `enc.x/enc.z`,
  and reused on subsequent frames (no per-frame mesh/geometry/material allocation).
- The persistent hazard visibly reads as an armed spike trap and is distinct from
  `cinder_snare`: it uses the steel-grey + blood-red palette (reuse the
  `SPIKE_TRAP_*` palette constants / styling introduced in sub-ticket 01), e.g. a
  hostile ground ring sized to `enc.radius` plus a small cluster of static
  upward steel spikes — NOT the orange fire look.
- The trap mesh persists across state updates for as long as the enchantment stays
  in `gameState.enchantments` (i.e. for its armed `ttlMs` window), and is removed
  via `disposeStaleMeshes` (or equivalent) when the enchantment id is no longer in
  the snapshot — so it disappears exactly when the server drops the trap. No mesh
  leak across multiple casts or after the trap is gone.
- Only `spike_trap` enchantments are rendered by this path; other `effect` values
  in `enchantments` (e.g. `cinder_snare`) are ignored here (left to their existing
  handling), avoiding conflicts with other card animations.
- A `SERVER_TO_CLIENT.SPIKE_TRAP_TRIGGERED` handler is added in
  `game/client/main.js` (mirroring the `VOLATILE_EXPLOSION` handler) that
  validates finite `x`/`z` and calls the eruption primitive
  (`rendererSpawnSpikeTrapEffect({ x, z }, radius)`) so the spikes burst up as
  synced hit feedback when the server reports the trap firing. It is a guarded
  no-op if `getScene()` is falsy or the primitive is unavailable, and adds no new
  network traffic or server payload.
- No perf regression: the persistent hazard reuses shared geometry/materials and
  fixed mesh counts; the reconcile loop adds no per-frame allocation.
- The full client + server vitest suites pass, and client tests are
  added/extended to assert: (a) given a `gameState.enchantments` entry with
  `effect: 'spike_trap', armed: true`, the `animate()` reconcile creates a
  persistent mesh keyed by its id and updates position; (b) when that entry is
  removed from `enchantments`, the mesh is disposed/removed from the scene;
  (c) `cinder_snare` enchantment entries do NOT create a spike-trap hazard mesh;
  (d) the `SPIKE_TRAP_TRIGGERED` handler invokes `spawnSpikeTrapEffect` at the
  reported `x`/`z`/`radius`.

## Technical Specs

- `game/client/renderer.js` — add a `spikeTrapMeshes = {}` map near `minionsMeshes`
  (~L129) and include it in `getMeshMaps()` (~L1215). Add a small
  `createSpikeTrapHazardMesh(enc)` helper near the spike VFX primitive
  (`spawnSpikeTrapEffect`, ~L4577) that builds a steel/red ground ring at
  `enc.radius` plus a static spike cluster using the existing `SPIKE_TRAP_*`
  palette constants (reuse, do not redefine). In `animate()` (~L5702), AFTER the
  minion mesh-sync block (~L6259), add a reconcile loop: build
  `currentSpikeTrapIds` from `gs.enchantments` filtered to
  `effect === 'spike_trap' && armed`, create/position meshes via
  `createSpikeTrapHazardMesh`, and call
  `disposeStaleMeshes(spikeTrapMeshes, currentSpikeTrapIds, scene)`. Guard for
  `gs.enchantments` being undefined.
- `game/client/main.js` — add `s.on(SERVER_TO_CLIENT.SPIKE_TRAP_TRIGGERED, ...)`
  next to the `VOLATILE_EXPLOSION` handler (~L1528). Reuse the existing
  `rendererSpawnSpikeTrapEffect` import wired in sub-ticket 01; call it with
  `{ x, z }` and the record `radius` (fallback to a sane default). Also dispose
  `spikeTrapMeshes` in the entity-mesh cleanup on run start (~L1919) alongside the
  other `rendererDisposeMeshMap` calls so traps don't leak between runs.
- `game/client/test/` — extend `renderer`/`animate` client tests (and/or
  `cardRenderers.test.js`) to cover the reconcile create/dispose, the
  `cinder_snare`-ignored case, and the trigger-event handler.
- Do NOT modify the server, `spawnSpikeTrapEffect` internals (sub-ticket 01), or
  `renderSpikeTrap` (sub-ticket 02). This sub-ticket only ADDS the persistent
  reconcile path and the trigger handler.

## Verification: code
