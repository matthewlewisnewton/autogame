# `public/models/` — 3D asset conventions

Author-facing summary for glTF assets under this folder. Runtime loading and the model registry are owned by tickets **161** / **187**; this spike only commits files and documents contracts.

## Base player (`player.glb`)

| Item | Value |
|------|--------|
| Path | `game/client/public/models/player.glb` |
| Full contract | [`game/docs/MODEL_SPIKE.md`](../../../docs/MODEL_SPIKE.md) |
| Source decision | [`game/docs/SPIKE_DECISION.md`](../../../docs/SPIKE_DECISION.md) |
| License / attribution | [`CREDITS.md`](./CREDITS.md) — add or update a table row before wiring any file into the game |

**Transform rules (required on every export):**

- **Feet at `y = 0`** — origin on the ground plane, not pelvis-center floating.
- **Forward = −Z** — character looks down −Z; do not reorient to +Z without updating `renderer.js` (forbidden in spike tickets).
- **Height ≈ 1.8** world units — normalize uniform scale from the bounding box after apply.
- **XZ footprint** — fit inside radius **0.5** (`PLAYER_RADIUS` in `game/server/simulation.js` and `game/client/collision.js`).

**Proportion morphs (sub-ticket 03+):** six morph targets with exact names  
`height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth` — influence `0.0` (min) … `0.5` (neutral) … `1.0` (max). See `MODEL_SPIKE.md`.

**Head anchor (hats):** prefer rig bone **`Head`**; sub-ticket 02 documents the bone name or a fixed `(x, y, z)` offset from the foot origin for hat `.glb` attachment (ticket 190).

**Export tips:** glTF 2.0 binary, applied transforms, Draco compression off, single humanoid per `player.glb` until morph variants are merged in Blender.

## Other models

Enemy and minion `.glb` files follow the same **CC0 / CC-BY-only** policy. Each file needs a **`CREDITS.md`** row before registry use. Placeholder enemies use Quaternius **Ultimate Monsters**; see that pack’s row for format.

## Do not (spike scope)

- Add `player.glb` to `renderer.js` or the model registry in tickets **185** sub-tickets 01–03.
- Commit ripped or non-redistributable assets.
