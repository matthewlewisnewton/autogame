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

Import source for the spike: **Quaternius Universal Base Characters — Regular Male** ([`SPIKE_DECISION.md`](../../../docs/SPIKE_DECISION.md)). Sub-ticket **02** commits the normalized `.glb`; sub-ticket **03** adds morph targets.

### Head anchor (hats)

Document here when `player.glb` is committed: **bone name** (e.g. `Head`) or **model-space offset** from the feet origin for hat attachment (ticket **190**). Procedural avatars today seat hats at ~**0.5** units on a ~1-unit body; the 1.8 m hero should place the anchor near the scalp (~**1.65–1.75** m Y).

## Other models

Enemy and minion placeholders use the same folder; each file needs a row in [`CREDITS.md`](./CREDITS.md). Only **redistributable** licenses (CC0, CC-BY, project-owned)—see the policy section there.

## Registry (runtime)

`game/client/models.js` maps entity keys to paths. Values are still `null` for most entities during the spike; wiring happens in later tickets. Do not change registry paths without updating tests and `CREDITS.md`.
