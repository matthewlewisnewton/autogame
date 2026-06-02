# Player and entity models (`public/models/`)

Author-facing summary for 3D assets served from `/models/…` on the Vite client. Full contracts live in the docs below—keep exports aligned with them so server, glTF, and UI stay in sync.

## Canonical docs

| Document | Purpose |
|----------|---------|
| [`../../../docs/MODEL_SPIKE.md`](../../../docs/MODEL_SPIKE.md) | **Base player** path, orientation, scale, proportion keys, morph ranges |
| [`../../../docs/SPIKE_DECISION.md`](../../../docs/SPIKE_DECISION.md) | Source pack choice (Quaternius vs custom), license, poly budget |
| [`CREDITS.md`](./CREDITS.md) | Per-file license rows (required before wiring into `MODEL_REGISTRY`) |

## Base player (`player.glb`)

| Rule | Value |
|------|--------|
| **Path** | `game/client/public/models/player.glb` (URL: `/models/player.glb`) |
| **Feet** | Origin at ground: **`y = 0`** |
| **Forward** | Character faces **−Z** (renderer uses `rotation.y = playerRotation − π/2`) |
| **Height** | ≈ **1.8** world units after normalization |
| **Collision cylinder** | Mid-torso XZ fit within radius **0.5** (`PLAYER_RADIUS` in server/client collision) |
| **Morph names** | Exactly: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth` |
| **Morph range** | Influence **0.0–1.0**, neutral **0.5** (see `MODEL_SPIKE.md`) |

Import source: **Quaternius Universal Base Characters — Superhero Male** (`Superhero_Male_FullBody.gltf` from the CC0 Standard zip; see [`SPIKE_DECISION.md`](../../../docs/SPIKE_DECISION.md)). The free Standard tier ships Superhero/Teen previews only—**Regular Male** lives in the paid Source zip; swap the import path in `scripts/normalize-player-glb.mjs` when that asset is available.

**Morph targets (sub-ticket 03):** committed `player.glb` includes all six keys on body + eyes meshes. Regenerate after re-normalizing with `node scripts/add-player-proportion-morphs.mjs`. Automated check: `game/client/test/playerModelMorphs.test.js`.

### Head anchor (hats)

Attach hat `.glb` files to skinned bone **`Head`** (Mixamo-style rig). After normalization, the bone origin sits at about **(0, 1.59, 0)** model-space units (feet at **y = 0**; top of scalp ~**1.82**). Ticket **190** can parent hats to `Head` without per-hat offsets.

**T-pose overhang:** At **y ≈ 0.9** m the body fits inside collision radius **0.5**; outstretched arms span ~**1.86** m on **X** (expected for T-pose; only torso width is collision-clamped).

## Other models

Enemy and minion placeholders use the same folder; each file needs a row in [`CREDITS.md`](./CREDITS.md). Only **redistributable** licenses (CC0, CC-BY, project-owned)—see the policy section there.

## Registry (runtime)

`game/client/models.js` maps entity keys to paths. Values are still `null` for most entities during the spike; wiring happens in later tickets. Do not change registry paths without updating tests and `CREDITS.md`.
