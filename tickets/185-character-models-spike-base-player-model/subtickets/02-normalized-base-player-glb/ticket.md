# 02 — Normalized base `player.glb` (rigged humanoid, no morphs yet)

Acquire the source chosen in sub-ticket 01, normalize it in Blender (or
equivalent), and commit a rigged humanoid `player.glb` that meets scale/orientation
conventions. Shape keys for proportions are added in sub-ticket 03.

## Acceptance Criteria

- `game/client/public/models/player.glb` is replaced with the chosen CC0 (or
  permissively licensed) rigged humanoid base mesh (not the current ~15 KB stub).
- `game/client/public/models/CREDITS.md` row for `player.glb` is updated with
  accurate **Source**, **License**, **URL**, and **Status** (no longer “parked”).
- Model conventions verified and noted in `spike-decision.md` (update the file):
  - Feet/root origin at model **`y = 0`** (sits on sampled floor when placed at
    `(x, floorY, z)` in the renderer).
  - Model **forward = −Z** (compatible with
    `rotation.y = playerRotation - Math.PI / 2` in `game/client/renderer.js`).
  - Standing height ≈ **1.8** world units (top of mesh ~1.8 above feet).
  - Axis-aligned horizontal footprint (XZ) fits within a **0.5** radius circle
    (`PLAYER_RADIUS` in `game/client/collision.js`).
- Asset loads as valid glTF 2.0 binary (no corrupt buffer); game still starts with
  existing procedural player box (187 wires the registry later).
- Morph targets for the six proportion keys are **not** required yet in this
  sub-ticket.

## Technical Specs

- **Replace:** `game/client/public/models/player.glb`
- **Update:** `game/client/public/models/CREDITS.md`
- **Update:** `tickets/185-character-models-spike-base-player-model/spike-decision.md`
  (normalization measurements: height, footprint radius, forward axis check).
- Blender (or tool) export: glTF binary `.glb`, Y-up, apply transforms, single
  skinned humanoid root suitable for later shape-key work in sub-ticket 03.
- Do **not** change `game/client/renderer.js` or add registry wiring (ticket 187).

## Verification: code
