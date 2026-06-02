# Player model contract (`player.glb`)

**Verbatim contract** — future server, client, and UI code must follow these
names and paths exactly.

- Full spec: [`game/docs/MODEL_SPIKE.md`](../../../docs/MODEL_SPIKE.md)
- ≤1-screen summary: [`game/tickets/185-character-models-spike-base-player-model/spike-decision.md`](../../../tickets/185-character-models-spike-base-player-model/spike-decision.md)
- Credits: [`CREDITS.md`](./CREDITS.md)

## Model path and registry

| Field | Value |
|-------|--------|
| File | `player.glb` (this directory) |
| Default `modelId` | `"player"` |

## Proportion keys (1:1 everywhere)

Use these six strings **case-sensitively** with **no** prefixes or suffixes on:

- server `proportions{}`,
- glTF morph target names,
- customization slider element ids.

```
height
headSize
torsoWidth
armLength
legLength
shoulderWidth
```

Server should clamp each influence to **0 – 1** unless a later ticket narrows a
key (see `MODEL_SPIKE.md` for per-key authoring notes).

## Orientation and scale (base pose, morph influence 0)

| Rule | Value |
|------|--------|
| Feet | Model root/feet at **y = 0** |
| Forward | **−Z** (client: `rotation.y = playerRotation − π/2`) |
| Height | **~1.8** world units (standing AABB) |
| Footprint | Axis-aligned **XZ** within **`PLAYER_RADIUS = 0.5`** (`game/client/collision.js`) |

Asset tests: `game/client/test/playerModel.glb.test.js`. Re-apply morphs after
base mesh changes: `node scripts/add-player-morph-targets.mjs` from `game/`.
