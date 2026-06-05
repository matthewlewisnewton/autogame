# glTF hat seating, proportion morphs, and body tint

Verify and complete the cosmetic rendering path that `cosmetic-preview.js` already relies on: proportions via `applyAvatarProportions`, body tint via `applyLoadedModelCosmetic`, and equipped hat via `attachGltfHat` on the loaded head bone. Export test hooks if needed and add unit coverage for the morph/tint/hat paths that currently lack direct tests.

## Acceptance Criteria

- With a mocked loaded player glTF, `createPlayerAvatar` sets `userData.gltfHatMesh` when `cosmetic.hat` is a catalog id other than `none`; `none`/unknown adds no glTF hat.
- Changing `cosmetic.hat` (signature change → rebuild) produces a new `gltfHatMesh` with the updated hat id.
- `applyProportionMorphs` maps all six keys (`height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`) 1:1 onto `morphTargetInfluences`; absent/non-finite/unknown keys are skipped (no `undefined` written).
- `applyLoadedModelCosmetic` sets `userData.baseColor` from `bodyColor` on a loaded glTF avatar and is a no-op when `modelOverride` is absent (procedural fallback).
- Proportion-only changes (same signature) update morph influences on the existing mesh without requiring a page reload — exercised in a unit test via two consecutive apply calls with different `proportions`.
- `cosmetic-preview.js` continues to use `createPlayerAvatar` + `applyAvatarProportions`; no duplicate avatar-building logic.

## Technical Specs

- `game/client/renderer.js`:
  - Confirm/fix `attachGltfHat`, `applyProportionMorphs`, `applyLoadedModelCosmetic`, and `applyAvatarProportions` behavior; export helpers for testing if they are currently module-private (e.g. `applyProportionMorphs`, `applyLoadedModelCosmetic`, or a thin `__testOnly` re-export block).
  - If hat rebuild on cosmetic change leaves a stale `gltfHatMesh`, dispose/remove the old hat before attaching the new one.
- `game/client/cosmetic-preview.js` — audit only; adjust imports if exports move.
- `game/client/test/avatar-cosmetic.test.js` (new) — morph mapping, tint/baseColor, glTF hat presence/absence, proportion live re-apply; reuse GLTFLoader mock patterns from `models-registry.test.js`.

## Verification: code
