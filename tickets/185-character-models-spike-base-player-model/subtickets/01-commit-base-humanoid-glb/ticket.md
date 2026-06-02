# Asset: commit base humanoid player.glb with license

Add the chosen or authored base rigged humanoid model to the client static assets
tree, with clear license attribution. This is the neutral rest-pose mesh that
sub-ticket 02 will extend with morph targets; it must not change in-game rendering
yet (ticket 161 keeps the procedural box fallback until wired in ticket 187).

## Acceptance Criteria

- `game/client/public/models/player.glb` is committed and is a valid glTF 2.0
  binary (parses without error).
- The model is a **low-poly humanoid** suitable for later proportion morph authoring
  (static or lightly rigged body mesh — morph targets are not required in this step).
- Bounding height is **1.6–2.0 world units** with feet near **y = 0** and forward
  facing **−Z**, per the scale/anchor table in `public/models/README.md`.
- A license file sits alongside the asset (e.g.
  `game/client/public/models/player.glb.license.md`) stating the exact license
  (SPDX identifier or URL), author/source, and any attribution requirements.
- `game/client/public/models/README.md` exists (or is updated) with a **Base player
  mesh** section naming `player.glb` and documenting target height, feet-at-y≈0,
  and **−Z** forward conventions.
- `game/client/public/models/CREDITS.md` row for `player.glb` matches the committed
  source and license (update Status from “parked” to reflect the spike asset).
- No client renderer, loader, or registry code changes in this sub-ticket (asset and
  docs only).

## Technical Specs

- `game/client/public/models/player.glb` — NEW or replace the existing ~15 KB
  placeholder. May be exported from Blender (`assets/models` branch) or downloaded
  from a permissive CC0/CC-BY source; trim to ≤2 PBR material slots for later tinting
  in ticket 187.
- `game/client/public/models/player.glb.license.md` — NEW attribution and license
  text for the committed asset.
- `game/client/public/models/README.md` — NEW or update: base-model filename,
  scale/anchor table (height ~1.8 u, feet y≈0, forward −Z, footprint vs legacy
  `BoxGeometry(1,1,1)` in `renderer.js`). List the six proportion **keys** that
  sub-ticket 02 will bind as morph targets: `height`, `headSize`, `torsoWidth`,
  `armLength`, `legLength`, `shoulderWidth` (names only — morph export is sub-ticket 02).
- `game/client/public/models/CREDITS.md` — align the `player.glb` table row with the
  actual source and license.

Do **not** create files under `tickets/` — implementer scope allows `game/**` only.

## Verification: code
