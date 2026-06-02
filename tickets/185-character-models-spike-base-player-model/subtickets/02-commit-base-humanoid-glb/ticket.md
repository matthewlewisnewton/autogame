# Asset: commit base humanoid player.glb with license

Add the chosen or authored base rigged humanoid model to the client static
assets tree, with clear license attribution. This is the neutral “rest pose” mesh
that sub-ticket 03 will extend with morph targets; it must not change in-game
rendering yet (ticket 161 keeps the procedural box fallback until wired).

## Acceptance Criteria

- `game/client/public/models/player.glb` is committed and is a valid glTF 2.0
  binary (parses without error).
- The model is a **low-poly rigged humanoid** (single skinned or static mesh body
  suitable for later morph authoring — no requirement for morph targets in this
  step).
- Bounding height is **1.6–2.0 world units** with feet near **y = 0** and forward
  facing **−Z**, per `MODEL_SPIKE.md` / `public/models/README.md` conventions.
- A license file sits alongside the asset (e.g.
  `game/client/public/models/player.glb.license.md`) stating the exact license
  (SPDX identifier or URL), author/source, and any attribution requirements.
- `game/client/public/models/README.md` is updated to reference `player.glb` as
  the base model filename.
- No client renderer or loader code changes in this sub-ticket (asset drop only).

## Technical Specs

- `game/client/public/models/player.glb` — NEW committed binary. May be downloaded
  from a permissive source identified in `MODEL_SPIKE.md` or exported from
  Blender; trim materials to ≤2 PBR slots if needed for later tinting in ticket
  187.
- `game/client/public/models/player.glb.license.md` — NEW attribution and license
  text for the committed asset.
- `game/client/public/models/README.md` — update base-model section to point at
  `player.glb` and restate scale/anchor conventions.

If starting from the existing `assets/models` branch `player.glb` (~15 KB, CC0-style
placeholder), it may be used as the base only if `MODEL_SPIKE.md` documents that
choice and the license file matches the actual source.

## Verification: code
