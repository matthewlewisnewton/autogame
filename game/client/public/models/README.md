# Client character models (`public/models/`)

Static glTF 2.0 assets served by Vite at `/models/<filename>`. The renderer does
not load these files yet (procedural `BoxGeometry` fallback remains until ticket
161 wires the loader).

## Base player mesh

Spike decision rationale (source, license, poly budget, anchor/scale): [`MODEL_SPIKE.md`](../../../docs/MODEL_SPIKE.md).

| File | Role |
|------|------|
| **`player.glb`** | Neutral rest-pose low-poly humanoid body with six proportion morph targets on the body primitive |

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
`PlayerVisor`). Morph targets apply to the **`PlayerBody`** primitive only (visor unchanged).

## Proportion morph targets

Server and client cosmetic field `proportions.<key>` maps 1:1 to the glTF morph target
name on the player body mesh. Neutral default **0**; intended UI / server clamp
**−1 … 1**. At influence **0** the mesh matches the rest pose (no morph delta applied).

| `proportions` key | glTF morph target name | Default | Range |
|-------------------|------------------------|---------|-------|
| `height` | `height` | 0 | −1 … 1 |
| `headSize` | `headSize` | 0 | −1 … 1 |
| `torsoWidth` | `torsoWidth` | 0 | −1 … 1 |
| `armLength` | `armLength` | 0 | −1 … 1 |
| `legLength` | `legLength` | 0 | −1 … 1 |
| `shoulderWidth` | `shoulderWidth` | 0 | −1 … 1 |

Names are stored on the mesh as `extras.targetNames` (Blender / Three.js convention) and
must match the table **case-sensitively**.

### Blender shape-key authoring constraints

- **Six separate shape keys** — one per row above; do not use a single uniform scale key for all proportions.
- **Symmetry** — author on the mirrored body mesh; X-positive and X-negative regions should stay symmetric for `torsoWidth`, `armLength`, and `shoulderWidth`.
- **Feet anchor** — `height` scales about the lowest sole Y (root-style vertical stretch), not per-toe shear, so the feet stay on the ground plane at influence 0.
- **Axis limits** — keep deltas on **Y-up**; avoid rotating the rest pose; prefer translate/scale deltas in local X/Y/Z bands (head band, torso band, shoulder band, leg chain from hip).
- **Neutral** — rest pose with every shape-key value **0** before export; morph deltas are offsets from that rest shape.
- **Visor** — do not add morph targets to the visor primitive; proportions apply to `PlayerBody` only.

### glTF export settings

- Format: **glTF Binary (.glb)**.
- Include **shape keys** as morph targets on the body mesh primitive.
- **Apply modifiers**: off (export base mesh + shape keys).
- **+Y up** (glTF default).
- Confirm `extras.targetNames` on export (Blender glTF exporter) or equivalent so names match the table.

### Regenerating morph data

Maintainers can re-apply programmatic deltas with:

```bash
node client/scripts/inject-player-morph-targets.mjs
```

(run from `game/`). Prefer re-authoring in Blender when art changes; use the script only for delta regeneration on the committed topology.

## Validation

`game/client/test/playerModel.test.js` parses the committed GLB JSON chunk and asserts all six
morph target names are present on the body primitive (runs under `pnpm test:quick`).
