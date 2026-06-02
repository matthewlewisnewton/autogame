# Player & entity models — author guide

Assets in this folder are served at `/models/…` by the Vite client. Follow the contracts below before committing or replacing a `.glb`.

## Canonical docs

| Document | Purpose |
|----------|---------|
| [../../../docs/MODEL_SPIKE.md](../../../docs/MODEL_SPIKE.md) | Base **player** path, scale, orientation, proportion keys, morph ranges |
| [../../../docs/SPIKE_DECISION.md](../../../docs/SPIKE_DECISION.md) | Source pack choice, license, poly budget |
| [CREDITS.md](./CREDITS.md) | Per-file license rows (required before wiring into the registry) |

## Base player (`player.glb`)

| Field | Contract |
|-------|----------|
| **Path** | `game/client/public/models/player.glb` |
| **Feet** | Model **`y = 0`** on the ground plane (sole contact, not mesh centroid) |
| **Forward** | **−Z** (bind-pose faces −Z; matches `rotation.y = playerRotation − π/2` in the renderer) |
| **Height** | **1.8** world units total (bounding box Y after import normalization) |
| **Collision** | Mid-torso footprint within **`PLAYER_RADIUS = 0.5`** (`game/server/simulation.js`, `game/client/collision.js`). T-pose limbs may extend farther—note it in the `player.glb` CREDITS row if wrists/ankles exceed 0.5 m from origin on XZ. |
| **Morph names** | Exactly: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth` (see MODEL_SPIKE.md) |
| **Morph range** | `0.0` … `1.0`, neutral **`0.5`** |

Import and normalization steps: **SPIKE_DECISION.md** + **MODEL_SPIKE.md**. Re-export helpers: `game/client/scripts/normalize-player-glb.mjs` (02 import) and `game/client/scripts/add-player-proportion-morphs.mjs` (03 morph targets; requires `@gltf-transform/*` dev deps). Six proportion morphs are committed on `player.glb` with `extras.targetNames` per **MODEL_SPIKE.md**. Runtime use of this file is ticket 187—until then the game keeps procedural avatars.

**Committed mesh (02):** Quaternius Universal Base Characters **Superhero Male** from the Standard zip (the free Standard tier ships Superhero male/female glTF only; Regular/Teen bodies are in the paid Source tier). Normalized to 1.8 m height, feet at `y = 0`, bind pose faces **−Z**.

**T-pose vs collision:** Mid-torso slice (y ≈ 0.85–0.95 m) fits inside **0.5 m** radius. T-pose arms reach **±0.92 m** on X at shoulder height—wider than `PLAYER_RADIUS`; gameplay collision stays the cylinder, not mesh-accurate limbs.

## Head anchor (hats)

Attach hat meshes to the rig bone **`Head`** (glTF node name in `player.glb`: **`Head`**). Hats should not rely on per-hat position offsets once bone attachment is live (ticket 190).

## Other models

Enemy and minion `.glb` files use the same license policy as [CREDITS.md](./CREDITS.md). Only **CC0**, **CC-BY** (with attribution), or project-owned originals. No ripped commercial game assets.

## Registry wiring

`game/client/models.js` `MODEL_REGISTRY` entries stay `null` until their integration ticket lands. Do not set `player` to a path in the 185 spike docs-only sub-tickets.
