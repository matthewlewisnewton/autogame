# Cleanup nits from 039-cleanup-public-state-and-shared-data-nits

> **Staleness note.** This follow-up ticket was written against commit
> `fbed71c` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `039-cleanup-public-state-and-shared-data-nits`.
None blocked acceptance — clean them up when convenient.

## Telegraph mesh removal still inlines disposal inside the per-frame loop

`game/client/main.js:1566-1573` removes a telegraph mesh and disposes its
geometry/material inline when an enemy leaves windup, instead of delegating to
the new `disposeMeshMap` helper. This is the one remaining hand-rolled
remove+dispose+delete in the animate loop and is precisely the pattern the
helper was extracted for. Folding it in (e.g. via a `disposeOne(map, id,
scene)` companion, or by extending `disposeMeshMap` to accept a single id)
would finish the consolidation.

### Acceptance Criteria
- The per-frame telegraph removal path no longer hand-rolls the
  remove/dispose/delete sequence.
- Telegraph behavior is unchanged in screenshots / `030-encounter-telegraphs`
  visual QA.

## Stale-id cleanup builds throwaway map objects each frame

`game/client/main.js:1581-1599, 1607-1615, 1591-1599` collect stale ids, then
build a temporary `{ id: mesh }` object solely to hand to `disposeMeshMap`,
then delete the same ids from the real map. Each animate frame allocates and
discards these temporary objects. A small helper variant like
`disposeMeshSubset(map, ids, scene, skipDispose)` — or accepting a predicate
— would make the call sites one line each and eliminate the per-frame
allocations.

### Acceptance Criteria
- Per-frame stale-mesh cleanup no longer constructs intermediate object maps
  before disposal.
- All existing client tests still pass.

## Snapshot renames `dungeonBounds` to `bounds`

`game/server/index.js:879-889` emits `bounds: gameState.dungeonBounds`. The
client currently reads neither name, so nothing breaks, but the field name now
differs between the server-internal `gameState.dungeonBounds` and the
client-facing `bounds`. Either standardise on one name end-to-end or add a
short comment at the snapshot site explaining the intentional rename so future
readers don't think one or the other was a typo.

### Acceptance Criteria
- Either the snapshot key matches the server-internal name, or a comment at
  the rename site documents the public name choice.
