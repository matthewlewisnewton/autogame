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

### Proportion morph targets

Six glTF morph targets live on the **`PlayerBody`** mesh primitive only. The visor /
accent primitive has **no** morphs. Names are case-sensitive and match future server
field `proportions.<key>` exactly.

| Proportion key | glTF morph target name | Default influence | Clamp range | Authoring notes |
|----------------|------------------------|-------------------|-------------|-----------------|
| `height` | `height` | `0` | −1…1 | Scale about sole Y=0; feet stay at y ≈ 0 |
| `headSize` | `headSize` | `0` | −1…1 | Head region (y ≥ ~1.2); pivot near neck |
| `torsoWidth` | `torsoWidth` | `0` | −1…1 | Torso band; symmetric ±X about origin |
| `armLength` | `armLength` | `0` | −1…1 | Outer arms; symmetric |
| `legLength` | `legLength` | `0` | −1…1 | Legs / feet; scale Y from ground |
| `shoulderWidth` | `shoulderWidth` | `0` | −1…1 | Upper torso / shoulders; symmetric ±X |

**Neutral pose:** `weights` are all **0**; rest geometry is the default avatar with no
morph influence applied.

**Blender authoring (if re-exporting):**

- Add shape keys on the body mesh only; exclude visor / accent.
- Keep feet on the ground plane when authoring `height` (scale about soles, not per-toe shear).
- Width / arm / shoulder keys must be symmetric on ±X.
- Y-up, forward −Z, feet at y = 0 before export.

**glTF export notes:**

- Emit morph target names in `mesh.extras.targetNames` (same order as `primitives[].targets`).
- Coordinate system: **Y-up**; player faces **−Z**.
- Verify with `game/client/test/playerModel.test.js` after export.

### Regenerating `player.glb`

Low-poly mesh and morph deltas are authored in `game/client/scripts/generate-player-glb.mjs`:

```bash
cd game/client && node scripts/generate-player-glb.mjs
```

Re-run after editing that script (idempotent overwrite). Then update `player.glb.license.md` and
the `CREDITS.md` row if source or license changes.

Automated check: `pnpm test:quick` runs `client/test/playerModel.test.js`, which parses the
committed GLB JSON chunk and asserts all six `targetNames` on `PlayerBody`.
