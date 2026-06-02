# Add proportion morph targets to `player.glb`

Author Blender shape keys (or equivalent) for the six body-part proportion dimensions,
export them as glTF morph targets on `player.glb`, and lock the names to the canonical
contract so server fields and client sliders can map 1:1 in tickets 186–188.

## Acceptance Criteria

- `game/client/public/models/player.glb` includes **exactly these** morph-target names
  (case-sensitive, no aliases): `height`, `headSize`, `torsoWidth`, `armLength`,
  `legLength`, `shoulderWidth`.
- Each morph produces a visible, distinct silhouette change when driven from `0.0` to
  `1.0` (or the neutral/endpoints documented in `game/docs/MODEL_SPIKE.md`); extremes
  must not invert normals or collapse the mesh.
- `game/docs/MODEL_SPIKE.md` states the **neutral influence** per key (e.g. `0.5`) and
  the **min/max** range ticket 186 should clamp (same numbers for server and future UI).
- A small automated check exists that loads `player.glb` and asserts all six morph
  names are present (test may live under `game/client/test/` or `game/scripts/`; follow
  existing vitest patterns). The test is included in `pnpm test:quick`.
- Normalization from sub-ticket 02 is preserved (feet `y=0`, −Z forward, ~1.8u height).
- Still **no** runtime avatar swap — do not modify `renderer.js` or the model registry.

## Technical Specs

- **Edit** `game/client/public/models/player.glb` — re-export from Blender with shape
  keys bound to the six proportion dimensions; morph names must match the contract
  verbatim.
- **Edit** `game/docs/MODEL_SPIKE.md` — morph ranges, neutral values, and any Blender
  object/bone names used during authoring.
- **New** test file, e.g. `game/client/test/playerModelMorphs.test.js` (name flexible):
  use `@gltf-transform/core`, `three` `GLTFLoader`, or a lightweight glTF JSON peek to
  verify morph target names without starting the game loop.
- **Edit** `game/client/package.json` only if needed so the new test is picked up by the
  existing vitest config.
- Do **not** change server `cosmetic.js`, customization UI, or `createPlayerAvatar`.

## Verification: code
