# Cleanup nits from 187-character-customization-client-gltf-avatar

> **Staleness note.** This follow-up ticket was written against commit
> `f3f3b02` (2026-06-03). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `187-character-customization-client-gltf-avatar`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Accent color is invisible on the current single-material player.glb

Body tint shows on the glTF avatar, but `cosmetic.accentColor` only applies when
the loaded body mesh exposes a second (accent) material. The committed
`SuperHero_Male` mesh has a single material, so the accent color a player picks
never appears in-world on the avatar (the procedural primitive did show it).
This is permitted by the current spike contract, but the customization UI lets
players choose an accent that has no visible effect — worth closing once a
player.glb with a distinguishable accent submesh/material lands, or by deriving
an accent surface (e.g. a second material slot or a trim mesh) in authoring.

### Acceptance Criteria
- A player's chosen `accentColor` is visibly reflected somewhere on the loaded
  glTF avatar (an accent material/submesh), OR
- the customization UI/docs make explicit that accent has no avatar effect with
  the current model so players aren't choosing a no-op.

## No direct unit coverage for applyProportionMorphs / applyLoadedModelCosmetic

The model-swap, fallback, and footprint paths are well unit-tested, but the
morph-mapping (`applyProportionMorphs`) and the per-frame tint/morph re-apply
(`applyLoadedModelCosmetic`) have no dedicated unit test asserting that
`morphTargetInfluences[dictionary[key]]` is set from `proportions[key]`, that
missing/non-finite/unknown keys are skipped, and that body tint flows through
`baseColor`. These are the core of sub-ticket 02 and currently only exercised
indirectly.

### Acceptance Criteria
- A unit test feeds a fake skinned mesh + a partial/dirty `proportions` object
  to `applyProportionMorphs` and asserts mapped keys are written, missing/
  non-finite/unknown keys are left at rest, and no `undefined` is written.
- A unit test asserts `applyLoadedModelCosmetic` sets `userData.baseColor` from
  `bodyColor` and no-ops cleanly on the procedural fallback.
