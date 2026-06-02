# Cleanup nits from 185-character-models-spike-base-player-model

> **Staleness note.** This follow-up ticket was written against commit
> `cac7967` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `185-character-models-spike-base-player-model`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Compress / decimate player.glb before runtime wiring

`game/client/public/models/player.glb` is ~16 MB, almost entirely 7 embedded
textures, and the body mesh is ~12.6k tris versus the ≤8k target noted in
`SPIKE_DECISION.md`. As a dormant spike asset this is fine, but shipping a 16 MB
avatar to every client when ticket 187 wires it in would be a real download/perf
cost. Worth a texture-compression (KTX2/basis) and/or decimation pass before
integration.

### Acceptance Criteria
- `player.glb` file size is materially reduced (e.g. texture compression to KTX2
  or downscaled atlases) without losing the six morph targets or the `Head` rig
  node.
- Body mesh tri count is documented against the ≤8k target (decimate or
  explicitly justify keeping ~12.6k).
- `test/playerModelMorphs.test.js` still passes and `CREDITS.md` tri/size figures
  are updated.

## Sync poly/size figures across the contract docs

`CREDITS.md` lists "~14.3k tris", `SPIKE_DECISION.md` cites ~13k with a ≤8k
target, and `MODEL_SPIKE.md` describes the silhouette without a final committed
tri/size row. Once the asset is finalized, reconcile these into one source of
truth so downstream tickets read consistent numbers.

### Acceptance Criteria
- One authoritative tri-count and file-size figure for the committed `player.glb`
  is referenced consistently across `CREDITS.md`, `SPIKE_DECISION.md`, and
  `MODEL_SPIKE.md`.
