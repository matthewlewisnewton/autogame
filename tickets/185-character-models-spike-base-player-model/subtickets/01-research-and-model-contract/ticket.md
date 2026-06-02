# Research sources and publish the model contract

Evaluate CC0 / permissively licensed low-poly rigged humanoids (Quaternius Universal
Base Characters, Kenney, Sketchfab CC0/CC-BY, etc.) versus authoring a custom Blender
base. Record the chosen path, license, poly budget, and anchor/scale conventions in
`game/docs/` so tickets 186–191 share one canonical naming scheme.

## Acceptance Criteria

- `game/docs/SPIKE_DECISION.md` exists with:
  a short comparison of at least two candidate sources, the final choice (source pack
  URL or “authored in Blender”), license, approximate triangle count, and rationale.
- `game/docs/MODEL_SPIKE.md` documents the **canonical proportion keys** (exact strings,
  shared by server `proportions{}`, glTF morph-target names, and future slider ids):
  `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`.
- The same doc specifies **model conventions** for the base player asset:
  - committed path: `game/client/public/models/player.glb`
  - feet at model `y = 0`
  - forward facing **−Z** (matches renderer `rotation.y = playerRotation − π/2`)
  - standing height **1.8** world units after import normalization
  - horizontal footprint within **`PLAYER_RADIUS = 0.5`** (`game/server/simulation.js`,
    `game/client/collision.js`)
  - recommended morph influence range per key (e.g. `0.0–1.0` with `0.5` neutral) for
    ticket 186 server clamping
- `game/client/public/models/README.md` summarizes the contract for asset authors
  (paths, naming, orientation, scale) and points to `MODEL_SPIKE.md`, `SPIKE_DECISION.md`,
  and `CREDITS.md`.
- No `.glb` binary is added or replaced in this sub-ticket (asset import is sub-ticket 02).
- No files under `tickets/` are created or modified (implementer scope is `game/**` only).

## Technical Specs

- **New or edit** `game/docs/SPIKE_DECISION.md` — decision record (canonical in-repo copy;
  do not duplicate under `tickets/`).
- **New or edit** `game/docs/MODEL_SPIKE.md` — canonical contract for the character-model chain.
- **New or edit** `game/client/public/models/README.md` — author-facing summary; link to
  `game/client/public/models/CREDITS.md` for license rows.
- Do **not** modify `game/client/renderer.js`, `game/client/models.js`, server cosmetic code,
  or wire `player.glb` into the model registry (tickets 161 / 187 own runtime wiring).

## Verification: code
