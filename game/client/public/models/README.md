# Client character models (`public/models/`)

Static glTF 2.0 assets served by Vite at `/models/<filename>`. The renderer does
not load these files yet (procedural `BoxGeometry` fallback remains until ticket
161 wires the loader).

## Base player mesh

| File | Role |
|------|------|
| **`player.glb`** | Neutral rest-pose low-poly humanoid body (single mesh, no morph targets in this commit) |

License and attribution: [`player.glb.license.md`](./player.glb.license.md).

### Scale and anchor (world units)

These conventions match the character-model spike and the current player entity in
`renderer.js` (`BoxGeometry(1, 1, 1)` with `rotation.y = playerRotation − π/2`).

| Property | Target | `player.glb` (committed) |
|----------|--------|---------------------------|
| Height | 1.6–2.0 | ~**1.84** (bbox) |
| Feet | Model **y ≈ 0** (ground contact) | **y ≈ 0.08** (sole contact) |
| Forward | **−Z** (thin depth axis = facing) | **−Z** (depth ~0.33, width ~1.11 on X) |
| Footprint | ~1×1 on XZ vs legacy 1×1×1 box | ~1.11 × 0.33 XZ |

Poly budget for this asset: ~**740** triangles, **2** PBR material slots (`PlayerBody`,
`PlayerVisor`).

## Proportion morph targets (sub-ticket 03+)

Server and client cosmetic field `proportions.<key>` maps 1:1 to the glTF morph target
name on the player body mesh. Neutral default **0**; intended UI / server clamp
**−1 … 1**.

| `proportions` key | glTF morph target name | Default | Range |
|-------------------|------------------------|---------|-------|
| `height` | `height` | 0 | −1 … 1 |
| `headSize` | `headSize` | 0 | −1 … 1 |
| `torsoWidth` | `torsoWidth` | 0 | −1 … 1 |
| `armLength` | `armLength` | 0 | −1 … 1 |
| `legLength` | `legLength` | 0 | −1 … 1 |
| `shoulderWidth` | `shoulderWidth` | 0 | −1 … 1 |

Morph targets are **not** present in the committed `player.glb` yet; sub-ticket 03
adds Blender shape keys and validation.
