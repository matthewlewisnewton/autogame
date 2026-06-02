# Model spike — base player contract (tickets 185–191)

Canonical naming and conventions for the shared base player mesh, server cosmetic
`proportions{}`, glTF morph targets, and future customization UI sliders. Decision
rationale and source pack: [`SPIKE_DECISION.md`](./SPIKE_DECISION.md). Author
checklist: [`../client/public/models/README.md`](../client/public/models/README.md).

## Canonical proportion keys

These six strings are **case-sensitive** and must match everywhere with no aliases:

| Key | Role |
|-----|------|
| `height` | Overall stature (legs + torso scale) |
| `headSize` | Head volume / neck junction |
| `torsoWidth` | Chest and abdomen width |
| `armLength` | Upper + lower arm reach |
| `legLength` | Thigh + shin length |
| `shoulderWidth` | Clavicle span / shoulder bulk |

**Consumers (must use identical keys):**

- Server: `cosmetic.proportions` object (validation/clamping — ticket 186)
- glTF: morph target names on `player.glb` (ticket 03)
- Client: future slider / preset IDs (tickets 187–188)

Do not introduce synonyms (`head_size`, `HeadSize`, etc.).

## Morph influence ranges

All six keys share the same numeric contract for server clamping and client UI:

| Field | Value |
|-------|--------|
| **Minimum** | `0.0` |
| **Neutral (default)** | `0.5` |
| **Maximum** | `1.0` |

- **Server (ticket 186):** Clamp each `proportions[key]` to `[0.0, 1.0]`; treat missing
  keys as `0.5` when backfilling defaults.
- **Client / glTF:** Apply morph target influence `influence = clamp(value, 0, 1)` with
  `0.5` = bind/rest silhouette (no shape key at full ± extreme).
- **Authoring (ticket 03):** Shape keys should be sculpted so that `0.0` and `1.0` are
  visible, distinct extremes without inverted normals or collapsed volumes; neutral mesh
  is exported at `0.5` influence baseline.

## Base player asset conventions

| Convention | Requirement |
|------------|-------------|
| **Committed path** | `game/client/public/models/player.glb` |
| **Origin / feet** | Model root placed so the **soles rest at `y = 0`** on the ground plane (origin at feet, not pelvis center). |
| **Forward axis** | Character faces **−Z** in model space. |
| **Standing height** | After import normalization, axis-aligned bounding box height ≈ **1.8** world units (tolerance ±0.05 for export float). |
| **Horizontal footprint** | XZ extent must fit inside a cylinder of radius **`PLAYER_RADIUS = 0.5`** (see `game/server/simulation.js`, `game/client/collision.js`). Measure at `y ≈ 0.9` (mid-torso) if limbs poke at ankles. |
| **Facing vs simulation** | Simulation `playerRotation` is radians in the XZ plane (`atan2(dz, dx)` style). Renderer sets `mesh.rotation.y = playerRotation − π/2` so model **−Z** aligns with game facing. |
| **Format** | glTF 2.0 binary (`.glb`); Draco compression **off** for simpler diffing and tests. |
| **Units** | 1 Blender unit = 1 world unit after export; apply scale/rotation on export. |

## Head anchor (hats — ticket 190)

Not required until `player.glb` exists (sub-ticket 02). Planned convention:

- Prefer the humanoid **`Head` bone** from the Quaternius rig (world position + rotation
  at runtime once the avatar is wired in ticket 187).
- If a bone is unavailable after export, document a fixed offset from the feet origin in
  `README.md` (e.g. `(0, 1.65, 0)` in model space for a 1.8u tall Regular Male).

Hat `.glb` files attach to this anchor; per-hat fudge factors are discouraged.

## Blender authoring notes (sub-tickets 02–03)

- **Source file:** Import **Regular Male** from Quaternius Universal Base Characters
  Standard zip; save working `.blend` outside `public/models/` (not committed).
- **Normalization steps:** Apply transforms; center feet at world origin; rotate so
  forward is **−Z**; scale to 1.8u tall; verify XZ radius ≤ 0.5.
- **Shape keys (03):** Name shape keys exactly as the six proportion keys; export as
  glTF morph targets with the same names.
- **Re-export checklist:** feet `y=0`, −Z forward, ~1.8u height, six morph names present,
  tris ≤ 20k where possible.

## Runtime wiring (not in spike doc scope)

| Ticket | Work |
|--------|------|
| 02 | Commit normalized `player.glb` + `CREDITS.md` |
| 03 | Morph targets + vitest name check |
| 186 | Server `proportions` validation |
| 187+ | `MODEL_REGISTRY.player`, avatar in `renderer.js` |

Until 187, the game may keep procedural avatar meshes; the contract still governs the
on-disk asset.

## Related files

- [`SPIKE_DECISION.md`](./SPIKE_DECISION.md) — source pack, license, poly budget
- [`../client/public/models/README.md`](../client/public/models/README.md) — author summary
- [`../client/public/models/CREDITS.md`](../client/public/models/CREDITS.md) — license rows
