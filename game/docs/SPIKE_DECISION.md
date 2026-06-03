# Player base model — spike decision record

Canonical source comparison and final choice for ticket **185** (character model spike).
Downstream tickets **186–188** and the committed `player.glb` should treat this file as
the authoritative decision; technical contracts (morph clamps, tests, authoring) remain in
[`MODEL_SPIKE.md`](MODEL_SPIKE.md).

## Final choice

| Field | Value |
|-------|--------|
| **Source** | [Quaternius — Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) |
| **License** | **CC0** (public domain; redistribution allowed) |
| **Base mesh (committed)** | `SuperHero_Male` skinned body from `Superhero_Male_FullBody.gltf` (Standard CC0 tier) |
| **Target triangle budget** | **≤ 18_000** triangles (rest pose + six morph targets); committed asset ~**12.6k** on `SuperHero_Male` |
| **Export path** | `game/client/public/models/player.glb` |

**Rationale:** CC0 rigged humanoid with a neutral rest pose, consistent with existing
Quaternius enemy placeholders, and enough topology on `SuperHero_Male` for six proportion
morph targets without a custom Blender sculpt for the spike — within the ≤ 18k cap in
[`MODEL_SPIKE.md`](MODEL_SPIKE.md).

## Anchor, scale, and orientation

All follow-on exports and morph authoring MUST match these world-space conventions (also
enforced in `game/client/test/playerModel.test.js`):

| Rule | Value |
|------|--------|
| **Feet** | Sole contact at model **y = 0** (origin on the ground plane) |
| **Forward** | Character faces **−Z** (matches renderer: `rotation.y = playerRotation − π/2`) |
| **Height** | Total axis-aligned height **≈ 1.8** world units (acceptable **1.7–1.9** in tests) |
| **Footprint** | Horizontal extent at the feet fits inside a circle of radius **`PLAYER_RADIUS = 0.5`** (`game/server/simulation.js`, mirrored in `game/client/collision.js`) |

## Proportion morph targets (glTF)

Six dimensions become glTF morph targets on the skinned body mesh. Names are **exact** —
case-sensitive, **no aliases** between server, UI, and asset:

`height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`

Server field, morph target, and UI slider `id` all use the same string. See
[`MODEL_SPIKE.md`](MODEL_SPIKE.md) for clamps, defaults, and authoring notes.

## Candidate comparison

| Candidate | License | Approx. poly count (single humanoid, rest) | Notes |
|-----------|---------|-----------------------------------------------|--------|
| **Quaternius Universal Base Characters** (chosen) | CC0 | ~**13k** vendor average; **~12.6k** on committed `SuperHero_Male` + morphs ≤ **18k** | Standard tier ships superhero bodies; matches enemy pack artist; rig + skin ready for morph script |
| **KayKit / Kenney low-poly characters** | CC0 | ~**5k–12k** per character (varies by asset) | Good for props/enemies; fewer stock humanoids with a single consistent rig and proportion-friendly topology for six body morphs |
| **Custom Blender humanoid** | Project-owned | Budget-defined (~**15k** target) | Full control but spike time dominated by sculpt/rig/morph authoring; deferred until pack path fails contract tests |
| **Sketchfab one-offs** (CC0 / CC-BY filtered) | CC0 or CC-BY | ~**8k–30k** (high variance) | Per-model license review and inconsistent rig/naming; poor fit for a shared `proportions{}` vocabulary across all players |

## Related docs

- Technical contract and morph authoring: [`MODEL_SPIKE.md`](MODEL_SPIKE.md)
- Replacement steps: [`game/client/public/models/README.md`](../client/public/models/README.md)
- Attribution: [`game/client/public/models/CREDITS.md`](../client/public/models/CREDITS.md)
