# Model spike — base player (`player.glb`)

Canonical contract for tickets **186** (server proportion clamps), **187** (glTF
renderer wiring), **188** (customization UI sliders), and **190** (capture/docs).
Code-facing verbatim rules live in
[`game/client/public/models/README.md`](../client/public/models/README.md).

## Source vs authored

| Aspect | Decision |
|--------|----------|
| **Source** | [Quaternius — Universal Base Characters](https://quaternius.itch.io/universal-base-characters) (CC0). Committed mesh: **`Superhero_Male_FullBody`** from the free **Standard** zip (`License_Standard.txt`). Sub-ticket 01 targeted **Regular Male** (paid **Source** kit only); same pack/rig, documented tier mismatch until Source is obtained. |
| **Authored** | Normalization transforms (scale/translate) and six proportion morph deltas via `game/scripts/add-player-morph-targets.mjs` — not a from-scratch mesh. |
| **License** | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — attribution recorded in [`CREDITS.md`](../client/public/models/CREDITS.md), not required in-game. |
| **Poly budget** | **8,000–14,000** triangles target for spike hero mesh. **Measured** on committed asset: ~**8,483** unique uploaded vertices (`@gltf-transform/core` inspect after normalization). |

### Export / pipeline tool versions

| Step | Tool | Version |
|------|------|---------|
| Upstream export | Quaternius pack (Godot/UE glTF) | `Superhero_Male_FullBody.gltf` from itch Standard zip |
| Normalize to game units | Manual transform + glTF binary export | Y-up glTF 2.0; root wrapper `PlayerNormalized` |
| Morph targets | `game/scripts/add-player-morph-targets.mjs` | **@gltf-transform/core** and **@gltf-transform/functions** **^4.3.0** (`game/package.json`) |
| Contract tests | `game/client/test/playerModel.glb.test.js` | Same gltf-transform **4.3.x** + `getBounds()` |

Re-run `node scripts/add-player-morph-targets.mjs` from `game/` after any base-mesh
re-normalization.

## Committed asset

- **Path:** [`game/client/public/models/player.glb`](../client/public/models/player.glb)
- **Credits row:** [`game/client/public/models/CREDITS.md`](../client/public/models/CREDITS.md)
- **Registry (future):** `modelId` default **`"player"`** → loads `player.glb` (ticket 187)
- **Renderer today:** procedural box avatar unchanged until 187

## Anchor / scale conventions

All measurements use glTF **Y-up** world space on the committed file (influence
**0** on all morphs), verified by `getBounds()` on the default scene in
`playerModel.glb.test.js` and `assertBaseBounds()` in the morph script.

| Convention | Target | How measured on committed `player.glb` |
|------------|--------|------------------------------------------|
| Feet / root | **y = 0** | Scene AABB `min[1] ≈ 0` (±0.01) |
| Forward | **−Z** | Source T-pose: arms along **±X**, thin **Z** depth → character faces **−Z**; client yaw uses `mesh.rotation.y = playerRotation − π/2` (`game/client/renderer.js`) so **+X movement** aligns with **−Z** model forward |
| Standing height | **1.8** world units | AABB height `max[1] − min[1] ≈ 1.8` |
| Horizontal footprint | Axis-aligned **XZ** extent ≤ **`PLAYER_RADIUS = 0.5`** | `max(|min[0]|, |max[0]|, |min[2]|, |max[2]|) ≤ 0.5` — measured **X half = 0.5**, **Z half ≈ 0.078** (limiting extent **0.5**). Matches collision cylinder in `game/client/collision.js` and `game/server/simulation.js` (`PLAYER_RADIUS`). |

Normalization (sub-ticket 02): non-uniform scale — **Y → 1.8 m**, **XZ → 0.5 m**
max half-width — then translate so feet sit at **y = 0**.

## Proportion keys (ticket 186 server clamps)

Six keys, **case-sensitive**, identical across:

- server `player.proportions{}` (ticket 186),
- glTF morph names (`mesh.extras.targetNames` / Three.js `morphTargetDictionary`),
- customization slider DOM ids (ticket 188).

| Key | Recommended server clamp | Morph at influence **1.0** (authored max) |
|-----|--------------------------|-------------------------------------------|
| `height` | **0 – 1** | +12% standing height (uniform **Y**, scaled from feet **y = 0**) |
| `headSize` | **0 – 1** | ~18% radial expand about neck pivot **(0, 1.55, z)** |
| `torsoWidth` | **0 – 1** | ~18% lateral **X** (+ slight **Z**) on torso band |
| `armLength` | **0 – 1** | ~14% outward **X** on arms |
| `legLength` | **0 – 1** | ~14% leg lengthen from hip (**y < 0.95**) |
| `shoulderWidth` | **0 – 1** | ~12% outward **X** at shoulders |

**Base pose (all influences 0):** normalization table above unchanged.

**Mesh coverage:** three skinned meshes (body + two face parts). Body carries all
six deltas; face meshes carry non-zero **`headSize`** only (zeros on other five).
Every primitive binds six named targets (see `add-player-morph-targets.mjs`).

**Region hints (authoring):** head **y ≳ 1.42**; torso **0.95–1.38**; shoulders
**1.32–1.52**; arms **|x| ≳ 0.22**, **y 1.0–1.48**; legs from hip **y = 0.95**.

## Evaluated alternatives (not chosen)

| Source | License | URL | Why not |
|--------|---------|-----|---------|
| Kenney Animated Characters (Retro) | CC0 | https://kenney.nl/assets/animated-characters-1 | Modular slices; weak single-body base for six morphs |
| Kenney Blocky Characters | CC0 | https://kenney.nl/assets/blocky-characters | Blocky look; poor PSO-style hero match |
| Sketchfab (CC0/CC-BY filter) | varies | https://sketchfab.com/search?features=downloadable&licenses=cc0&licenses=by&type=models | Inconsistent rig/topology; high per-asset review cost |

## Related docs

- Verbatim implementer contract: [`game/client/public/models/README.md`](../client/public/models/README.md)
- Spike summary (≤1 screen): [`game/tickets/185-character-models-spike-base-player-model/spike-decision.md`](../tickets/185-character-models-spike-base-player-model/spike-decision.md)
