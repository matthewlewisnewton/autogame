# Proportion morph targets in `player.glb`

Author or tune six Blender shape keys on the base humanoid and re-export
`player.glb` so glTF morph targets exist with **exact** names used by server and
UI: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`.
Each target should read clearly at influence **1.0** while **0.0** matches the
sub-ticket 03 rest pose.

## Acceptance Criteria

- `game/client/public/models/player.glb` includes six morph targets named exactly:
  `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`
  (case-sensitive; no extra proportion morphs required).
- Rest pose (all influences 0) preserves sub-ticket 03 conventions: feet at
  y = 0, forward −Z, ~1.8 height, footprint within `PLAYER_RADIUS`.
- `game/docs/MODEL_SPIKE.md` notes any Blender authoring quirks (which mesh has
  shape keys, recommended influence range per target).
- `CREDITS.md` unchanged unless license/source changed during re-export.

## Technical Specs

- **Replace** `game/client/public/models/player.glb` with the morph-enabled export.
- **Edit** `game/docs/MODEL_SPIKE.md` — brief morph-authoring section (rest vs max).
- Shape keys must be exported as glTF morph targets on the skinned mesh(es) the
  client will tint in ticket 187; keep triangle count within the budget in
  `DECISION.md`.
- Do **not** wire morphs in `renderer.js` or add customization sliders (tickets
  187–188).

## Verification: code
