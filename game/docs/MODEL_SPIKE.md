# Character model spike — decision note

Ticket **185** evaluated how to replace the procedural `BoxGeometry(1, 1, 1)` player placeholder with a real low-poly humanoid mesh suitable for proportion morph targets. This note records the **final choice** already committed as `game/client/public/models/player.glb` (sub-tickets 02–03). Asset specs and morph schema live in [`../client/public/models/README.md`](../client/public/models/README.md).

## Source vs authored

| Candidate | Outcome |
|-----------|---------|
| **Quaternius CC0 packs** | Rejected for the spike — third-party topology and licensing would complicate morph authoring; packs are rigged for animation, not six independent body proportion keys. |
| **Mixamo / Adobe auto-rig** | Rejected — high triangle counts, external ToS, and skinned rigs are out of scope for a static morph-target body spike. |
| **Scratch Blender original (chosen)** | **Selected.** A project-authored low-poly humanoid was modeled in Blender, exported to the repository `assets/models` branch, and copied into `game/client/public/models/player.glb`. |

**Path taken:** in-repo **Blender-authored original**, not a downloaded asset pack.

- **Committed asset:** `player.glb` — neutral rest-pose humanoid with visor, two PBR material slots (`PlayerBody`, `PlayerVisor`), and six proportion morph targets on the body primitive only.
- **Provenance:** exported from branch `assets/models`, commit `fdbcccc` (“low-poly GameCube-style hero” v1). See [`../client/public/models/player.glb.license.md`](../client/public/models/player.glb.license.md) for author and source details.

The live renderer still uses the procedural box fallback until ticket 161 wires the GLB loader; this spike only lands the asset, license, morph schema, and validation tests.

## License

**SPDX:** [CC0-1.0](https://spdx.org/licenses/CC0-1.0.html) (Creative Commons CC0 1.0 Universal — public domain dedication).

Full terms and optional attribution wording: [`../client/public/models/player.glb.license.md`](../client/public/models/player.glb.license.md).

## Poly budget

| Metric | Target (spike) | Measured (`player.glb`) |
|--------|----------------|-------------------------|
| Triangles | ≤ ~1,000 for a single static body + visor | **~740** |
| Materials | Minimal PBR slots | **2** (`PlayerBody`, `PlayerVisor`) |

The budget keeps the mesh cheap enough for many on-screen players while leaving headroom for morph deltas. Triangle count is documented in [`../client/public/models/README.md`](../client/public/models/README.md) and can be re-verified by inspecting the GLB or running `pnpm test:quick` (`playerModel.test.js`).

## Anchor and scale conventions

Conventions align with the legacy player entity in `game/client/renderer.js` — a `BoxGeometry(1, 1, 1)` mesh whose display yaw is `rotation.y = playerRotation − π/2` (movement facing derived from `atan2` on the XZ plane).

| Property | Convention | `player.glb` (committed) |
|----------|------------|---------------------------|
| **Up axis** | Y-up (glTF default) | Y-up |
| **Feet / ground** | Model **y ≈ 0** at sole contact | **y ≈ 0.08** (bounding-box sole) |
| **Forward** | **−Z** (thin depth axis = facing) | **−Z** (depth ~0.33, width ~1.11 on X) |
| **Height** | ~1.6–2.0 world units vs 1×1×1 box | **~1.84** (bbox height) |
| **Footprint (XZ)** | ~1×1 vs legacy cube | ~1.11 × 0.33 |

When the GLB replaces the box, keep feet on the sampled floor plane and preserve the existing yaw offset so network `rotation` and lock-on facing stay unchanged.

## Downstream (tickets 186–188)

Proportion customization consumes server/client field **`proportions.<key>`**, mapped 1:1 to glTF morph target names on the `PlayerBody` primitive. Keys, ranges (−1 … 1), Blender authoring constraints, and export settings are defined in [`../client/public/models/README.md`](../client/public/models/README.md#proportion-morph-targets). Do not rename morph targets without updating that table and `playerModel.test.js`.
