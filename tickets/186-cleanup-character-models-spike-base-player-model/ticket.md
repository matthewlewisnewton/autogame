# Cleanup nits from 185-character-models-spike-base-player-model

> **Staleness note.** This follow-up ticket was written against commit
> `cba89e0` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `185-character-models-spike-base-player-model`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stale morph-target wording in player.glb.license.md

The license file still says morph targets land in a "later sub-ticket," but sub-ticket 03 already committed six targets on the body mesh. Update the Work section so legal/provenance text matches the current asset.

### Acceptance Criteria
- `player.glb.license.md` describes the committed mesh as including six proportion morph targets on the body primitive (no "later sub-ticket" language).

## Re-author proportion morphs in Blender before client wiring

Morph deltas were injected programmatically (`inject-player-morph-targets.mjs`) for schema stability, not hand-tuned shape keys. Before ticket 187 applies influences in-game, art should verify each key at ±1 looks correct and keeps the feet anchor.

### Acceptance Criteria
- Each of the six morph names produces a visible, symmetric body-region change at influence +1 and −1 without lifting feet off Y ≈ 0 rest contact.
- README "Regenerating morph data" section notes whether Blender export replaced the scripted deltas.

## Soften feet-ground wording vs measured sole Y

Documented convention is feet at **y ≈ 0**; measured sole contact is **y ≈ 0.08**. This is documented consistently but may need a small vertical offset when ticket 161 mounts the GLB on the floor sampler.

### Acceptance Criteria
- `MODEL_SPIKE.md` or README includes a one-line note for integrators: expected `position.y` offset when swapping box for GLB (~0.08 u) unless the mesh is re-exported with soles at exactly 0.
