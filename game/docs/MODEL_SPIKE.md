# MODEL_SPIKE — base player mesh decision (ticket 185)

Decision note for the character-models spike. Downstream tickets **161** (loader/registry),
**186** (server `proportions` fields), **187** (glTF avatar in `renderer.js`), and **188**
(sliders/UI) should treat this file plus
[`game/client/public/models/README.md`](../client/public/models/README.md) as the source of
truth for asset path, license, scale, and morph naming.

## Source vs authored

### Candidates considered

| Option | Pros | Why not chosen (spike) |
|--------|------|-------------------------|
| **Quaternius CC0 packs** (e.g. Ultimate Monsters, already used for enemy placeholders) | Fast, permissive license, matches art direction of existing GLBs | Humanoid packs are stylized monsters, not a neutral customizable avatar; proportion morphs would fight authored topology |
| **Mixamo / similar rigged downloads** | Production-quality silhouettes | License and redistribution friction; skinned rigs are heavier than needed for a proportion-morph spike |
| **Scratch Blender humanoid** | Full control over topology and shape keys | Extra toolchain step for a spike that only needs a stable rest pose and six morph channels |
| **In-repo procedural mesh** (`generate-player-glb.mjs`) | Reproducible, project-owned, morph-friendly box topology, matches README conventions exactly | Less visual polish than a sculpted mesh — acceptable for spike and loader wiring |

### Final choice

**Authored in-repo (procedural), not a downloaded pack.**

The committed asset is **`game/client/public/models/player.glb`**: a rest-pose low-poly
humanoid built from merged `BoxGeometry` parts in
[`game/client/scripts/generate-player-glb.mjs`](../client/scripts/generate-player-glb.mjs).
Meshes: **`PlayerBody`** (six glTF morph targets) and **`PlayerVisor`** (accent, no morphs).
Regenerate with:

```bash
cd game/client && node scripts/generate-player-glb.mjs
```

Full license and attribution text:
[`game/client/public/models/player.glb.license.md`](../client/public/models/player.glb.license.md).

Gameplay still uses the legacy **`BoxGeometry(1, 1, 1)`** proxy in `renderer.js` until ticket
187 wires the GLB loader.

## License

Matches [`player.glb.license.md`](../client/public/models/player.glb.license.md):

- **Terms:** **Project-owned** — copyright held by Autogame project contributors; redistribute
  only as part of this repository’s game client; do not extract or relicense the mesh separately
  without maintainer approval.
- **SPDX:** No third-party SPDX identifier applies (original work, not CC0/CC-BY).
- **Attribution:** None required in-game for this asset.

If the mesh is later replaced by an external CC0/CC-BY source, update the license file,
`CREDITS.md`, and this section together.

## Poly budget

| | Value |
|---|--------|
| **Spike target** | ≤ **200** triangles for the visible base avatar (excluding morph delta storage); ≤ **2** PBR material slots for later tinting (ticket 187) |
| **Measured (`player.glb`, committed)** | **84** triangles total — **72** `PlayerBody`, **12** `PlayerVisor` |
| **Material slots** | **2** (`Body`, `Visor`) |
| **File size** | ~17 KB GLB |

Counts verified by parsing the committed GLB index buffers (see also
`game/client/test/playerModel.test.js` for morph schema). The spike intentionally stays well
under budget so morph authoring and multiplayer instances stay cheap.

## Anchor / scale conventions

Aligned with
[`public/models/README.md`](../client/public/models/README.md) and current player facing in
`renderer.js` (`rotation.y = playerRotation − π/2` for local and remote proxies).

| Property | Convention | `player.glb` (measured) |
|----------|------------|-------------------------|
| World unit | 1 unit ≈ 1 meter | same |
| Feet / ground | **y ≈ 0** (sole contact) | min **Y ≈ 0** (~1.2×10⁻⁹) |
| Forward (facing) | **−Z** (chest / visor toward −Z) | visor toward **−Z** |
| Bounding height | **1.6–2.0** u | **~1.80** u |
| Footprint (X × Z) | humanoid, narrower than legacy cube footprint | **~1.00 × 0.31** u |
| Legacy proxy | `BoxGeometry(1, 1, 1)` — **1** u tall, **1 × 1** footprint; remote mesh Y uses server `pData.y` (default **0.5**) so feet sit at **y = 0**; local mesh tracks `sampleFloorY()` | taller GLB keeps **same feet anchor** so ticket 187 can swap meshes without retuning floor height |

The GLB is taller than the 1 u cube but shares the **feet-at-y≈0** anchor so elevation and
floor sampling logic remain valid when the loader replaces the box.

Coordinate system at export: **Y-up**, player faces **−Z**, feet on the ground plane before
write (enforced in `generate-player-glb.mjs`).

## Downstream

- **Ticket 186 — server fields:** Persist customization as `proportions.<key>` on the player
  record. Keys (exact strings): `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`,
  `shoulderWidth`.
- **Ticket 187 — client loader:** Load `/models/player.glb` (registry key `player`); apply
  morph influences from server proportions; preserve **−Z** forward and
  `rotation.y = playerRotation − π/2` mapping.
- **Ticket 188 — UI:** Sliders/clamps should match README: default influence **0**, clamp
  **−1…1** per key.
- **Morph names:** glTF `mesh.extras.targetNames` on **`PlayerBody`** must match
  `proportions.<key>` exactly (case-sensitive). See the proportion table in
  [`public/models/README.md`](../client/public/models/README.md).
