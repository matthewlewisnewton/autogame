# Commit oriented base `player.glb` (no morph targets yet)

Acquire or export the chosen humanoid from sub-ticket 01 and commit a baseline
`player.glb` scaled and oriented to game conventions. Morph targets for body
proportions are added in sub-ticket 04; this file may ship without them.

## Acceptance Criteria

- `game/client/public/models/player.glb` is committed and loads without error via
  the existing `loadModel('/models/player.glb')` helper in `game/client/models.js`.
- Model conventions match `game/docs/MODEL_SPIKE.md`: **feet at y = 0**,
  **forward = −Z**, total height **≈ 1.8** units (±0.1), and the horizontal
  extent at the feet fits within a **0.5**-radius circle (matches `PLAYER_RADIUS`).
- `game/client/public/models/CREDITS.md` documents the file with correct
  source, license, URL, and status (not “parked”).
- `MODEL_REGISTRY.player` remains `null` — gameplay still uses the procedural avatar
  until ticket 187; no renderer behavior change required.

## Technical Specs

- **Add** `game/client/public/models/player.glb` — rigged low-poly humanoid from the
  source named in `DECISION.md` (e.g. Quaternius Universal Base Characters CC0),
  cleaned in Blender if needed for scale/orientation only.
- **Edit** `game/client/public/models/CREDITS.md` — final attribution row for
  `player.glb`.
- Optional: note export settings used (units, applied scale) in `MODEL_SPIKE.md`.
- Do **not** edit `game/client/models.js` registry path, `renderer.js`, or server
  cosmetic schema in this sub-ticket.

## Verification: code
