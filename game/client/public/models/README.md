# Client 3D models (`public/models/`)

Static glTF binaries served at `/models/<filename>.glb` (Vite `public/`). See
`CREDITS.md` for license and placeholder status per file.

## Base player mesh

| File | Registry key | Role |
|------|--------------|------|
| `player.glb` | `player` | Neutral rest-pose humanoid for character customization (tickets 181–188). **Not wired in the renderer yet** — gameplay still uses the procedural `BoxGeometry(1, 1, 1)` fallback in `renderer.js` until ticket 187. |

### Scale and anchor conventions

All models in this folder should match the game world unit system (1 unit ≈ 1 meter).

| Property | Target | `player.glb` (committed) |
|----------|--------|---------------------------|
| Bounding height | 1.6–2.0 u | ~1.80 u |
| Feet / ground contact | y ≈ 0 | min Y ≈ 0 |
| Forward (facing) | **−Z** | visor / chest toward −Z |
| Footprint (X×Z) | humanoid, ≤ legacy player box | ~1.0 × 0.31 u vs **1 × 1** `BoxGeometry` cube |

Legacy player proxy in `renderer.js`: a **1×1×1** axis-aligned box centered at
`(x, y + 0.5, z)` so its feet sit at `y = 0` and its top at `y = 1`. The committed
`player.glb` is taller (~1.8 u) with the same feet anchor so a future loader can swap
meshes without retuning floor height.

### Proportion morph targets (sub-ticket 02+)

Sub-ticket **02** will add glTF morph targets on the **`PlayerBody`** mesh primitive
(visor / accent stays morph-free). Names must match server `proportions.<key>` exactly:

| Proportion key | glTF morph target name | Notes |
|----------------|------------------------|-------|
| `height` | `height` | Scale about soles; feet stay at y ≈ 0 |
| `headSize` | `headSize` | Head region only |
| `torsoWidth` | `torsoWidth` | Symmetric ±X |
| `armLength` | `armLength` | Symmetric arms |
| `legLength` | `legLength` | Symmetric legs |
| `shoulderWidth` | `shoulderWidth` | Symmetric ±X |

Morph export, validation test (`playerModel.test.js`), and README export notes are
handled in sub-ticket **02** — not present on the base mesh yet.

### Regenerating `player.glb`

Original low-poly mesh authored via `game/client/scripts/generate-player-glb.mjs`:

```bash
cd game/client && node scripts/generate-player-glb.mjs
```

Re-run after editing that script; then update `player.glb.license.md` and the
`CREDITS.md` row if source or license changes.
