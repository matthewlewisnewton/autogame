# Commit the normalized base `player.glb`

Import or export the humanoid chosen in sub-ticket 01, normalize it to the documented
conventions, and commit it as the shared base player mesh. Downstream tickets (187 glTF
avatar, 190 hat assets) depend on this file and its documented head anchor.

## Acceptance Criteria

- `game/client/public/models/player.glb` exists, is tracked in git, and is loadable as
  glTF 2.0 binary (valid magic header / non-empty file).
- The mesh is normalized per `game/docs/MODEL_SPIKE.md`:
  - origin at the **feet** (`y = 0` on the ground plane)
  - character **forward = −Z**
  - total height ≈ **1.8** world units (measure bounding box after export)
  - XZ extent fits within a **0.5**-radius cylinder at mid-torso (T-pose limbs may extend
    beyond at ankles; document in README if so)
- `game/client/public/models/CREDITS.md` row for `player.glb` is updated with the real
  source creature/pack name, **license** (CC0 / CC-BY / project-owned), URL, and
  `Status` no longer `parked` (use `placeholder` or `spike` as appropriate).
- `game/client/public/models/README.md` (from 01) documents the **head anchor** used for
  future hats: either a named bone (e.g. `Head`) or a documented offset from the origin
  so ticket 190 can attach hat `.glb` files without per-hat fudge factors.
- Morph targets are **not** required yet (sub-ticket 03 adds them); a single skinned or
  static humanoid mesh is sufficient.
- No renderer or registry changes — the game may still draw procedural avatars until 187.

## Technical Specs

- **Replace** `game/client/public/models/player.glb` — export from Blender (or copy from the
  chosen CC0 pack) with applied scale/rotation fixes; prefer a single humanoid variant
  aligned with the source named in `SPIKE_DECISION.md` (Quaternius Universal Base
  Characters is the expected default per downstream beads notes).
- **Edit** `game/client/public/models/CREDITS.md` — accurate attribution row for
  `player.glb`.
- **Edit** `game/client/public/models/README.md` — head-anchor / bone name section.
- Optional dev-only authoring helpers under `game/client/scripts/` (e.g. Blender export
  or Node normalizer) and `.gitignore` entries for local `.blend` inputs — not required
  for acceptance if the committed `.glb` already meets the contract.
- Do **not** wire `player.glb` into `game/client/renderer.js` or set a non-null path in
  `game/client/models.js` `MODEL_REGISTRY.player` in this sub-ticket.

## Verification: code
