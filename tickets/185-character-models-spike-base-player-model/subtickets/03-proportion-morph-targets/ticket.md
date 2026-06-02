# 03 — Proportion morph targets on `player.glb`

Author Blender shape keys (exported as glTF morph targets) on the normalized
`player.glb` from sub-ticket 02, using the exact names required by downstream
server fields, sliders, and the glTF avatar renderer.

## Acceptance Criteria

- `game/client/public/models/player.glb` includes morph targets (shape keys)
  named **exactly** (case-sensitive, no prefixes/suffixes):
  `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`.
- Each morph produces a visible, intentional body-part change when influence is
  driven to the documented maximum (document per-key min/max or 0–1 range in
  `spike-decision.md`).
- Normalization conventions from sub-ticket 02 remain satisfied after export
  (feet `y = 0`, forward −Z, ~1.8 height, footprint within `PLAYER_RADIUS`).
- `spike-decision.md` updated with morph authoring notes (which bones/verts were
  edited, recommended influence range for ticket 186 server clamps).
- **Add** `game/client/test/playerModel.glb.test.js` (or similar under
  `game/client/test/`) that loads `public/models/player.glb` and asserts:
  - All six morph-target names are present on the loaded scene/mesh.
  - Bounding-box height is within ±0.1 of **1.8** world units.
  - Horizontal extent (max of X/Z half-width) is ≤ **0.5**.
- Test is included in the existing client vitest suite (`pnpm test:quick` passes).

## Technical Specs

- **Re-export:** `game/client/public/models/player.glb` (with morph targets).
- **Create:** `game/client/test/playerModel.glb.test.js` — use Three.js
  `GLTFLoader` (same stack as ticket 161) or `@gltf-transform/core` to inspect
  the file without starting a browser.
- **Update:** `tickets/185-character-models-spike-base-player-model/spike-decision.md`
- Optional: commit a `.blend` source under
  `tickets/185-character-models-spike-base-player-model/artifacts/` for handoff
  (git-lfs or small file only if reasonable size).
- Do **not** wire morph influences in `renderer.js` (ticket 187).

## Verification: code
