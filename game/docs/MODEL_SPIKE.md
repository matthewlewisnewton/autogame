# Model spike contract — base player (`player.glb`)

Canonical contract for the character-model chain (tickets **185–191**). **Do not** rename proportion keys or change world-scale conventions without updating server validation, glTF morph targets, and UI slider ids in the same change.

Related docs:

- Source decision: [`SPIKE_DECISION.md`](./SPIKE_DECISION.md)
- Author checklist: [`../client/public/models/README.md`](../client/public/models/README.md)
- License rows: [`../client/public/models/CREDITS.md`](../client/public/models/CREDITS.md)

## Committed asset path

| Item | Value |
|------|--------|
| File | `game/client/public/models/player.glb` |
| Registry key (future) | `player` in `game/client/models.js` `MODEL_REGISTRY` |
| Runtime wiring | Sub-tickets **187+**; spike keeps procedural avatars until then |

No `.glb` is required in sub-ticket **01**; import is sub-ticket **02**, morph targets sub-ticket **03**.

## World orientation and scale

These match how the client places entities today (`game/client/renderer.js`: `rotation.y = playerRotation − π/2`).

| Convention | Requirement |
|------------|-------------|
| **Ground anchor** | Model origin at **feet**; lowest vertex / foot bone at **`y = 0`** on the ground plane. Entity `position.y` is floor height from `sampleFloorY()` (ticket **117**). |
| **Forward axis** | Character faces **−Z** in model space. With `rotation.y = 0`, the mesh should look down **−Z**; gameplay facing (+X at `playerRotation = 0`) applies `rotation.y = playerRotation − π/2`. |
| **Standing height** | After import normalization, axis-aligned bounding box height ≈ **1.8** world units (same order of magnitude as current ~1-unit procedural bodies scaled for readability). |
| **Horizontal footprint** | At **mid-torso** (≈ **0.9** m above feet), the XZ extent must fit inside a circle of radius **`PLAYER_RADIUS = 0.5`** (`game/server/simulation.js`, `game/client/collision.js`). **T-pose** hands/feet may extend outside that cylinder at ankles/wrists; document any intentional overhang in [`README.md`](../client/public/models/README.md). |
| **Units** | 1 Blender/export unit = 1 world unit unless a one-time scale is baked at export. |

## Canonical proportion keys

Exact strings (case-sensitive). Shared by:

- Server `proportions{}` (ticket **186** clamping),
- glTF **morph target** names on `player.glb` (ticket **03**),
- Future customization **slider ids** (tickets **187–188**).

| Key | Intended silhouette effect |
|-----|----------------------------|
| `height` | Overall stature (legs + torso + head) |
| `headSize` | Head volume / cranium scale |
| `torsoWidth` | Chest and abdomen breadth |
| `armLength` | Upper and lower arm reach |
| `legLength` | Thigh and shin length |
| `shoulderWidth` | Clavicle / shoulder span |

**No aliases** (e.g. not `HeadSize`, `torso_width`, or `shoulders`).

### Morph influence ranges

All six keys use the same numeric contract for server, client, and Blender authoring:

| Field | Value |
|-------|--------|
| **Minimum** | `0.0` |
| **Neutral** | `0.5` (default when a profile omits a key) |
| **Maximum** | `1.0` |

Ticket **186** should clamp incoming `proportions[key]` to **`[0.0, 1.0]`** and treat missing keys as **`0.5`**. At **`0.5`**, the mesh must match the normalized base silhouette from sub-ticket **02**. Extremes **`0.0`** and **`1.0`** must produce a **visible, distinct** change per key without inverted normals or collapsed volumes (verified in sub-ticket **03**).

Client application (ticket **187+**): map each clamped server value `v ∈ [0.0, 1.0]` to a Three.js morph weight `(v − 0.5) × 2` so `0.5` leaves the base mesh unchanged and `0.0` / `1.0` reach the authored extremes.

### glTF encoding (sub-ticket **03**)

| Item | Value |
|------|--------|
| **Base mesh** | Normalized neutral silhouette (sub-ticket **02**); unchanged vertex positions at influence `0.5`. |
| **Per-key delta** | `POSITION` morph target `δ = P(w=1) − P(w=0.5)` on each skinned primitive (`SuperHero_Male` body + `Face.001` eyes). |
| **Regenerate** | `node game/client/scripts/add-player-proportion-morphs.mjs` (after `normalize-player-glb.mjs`). |

Blender authoring should use shape keys named exactly like the six keys; export with **glTF shape keys → morph targets**. Until a Blender pass lands, the committed `player.glb` uses the scripted deltas above (region-weighted, ~7–14% local scale per key at `w=1`).

## Head anchor (hats)

Ticket **190** attaches hat `.glb` files to a stable point on the body. Sub-ticket **02** documents the chosen anchor in [`README.md`](../client/public/models/README.md)—either:

- a named bone (preferred: rig **`Head`** or pack-equivalent), or
- a fixed offset from the origin in model space (e.g. top of scalp at neutral morphs).

Until `player.glb` lands, procedural avatars use `bodyTopY(shape)` in `renderer.js` (~**0.5** for box/cylinder/cone); the glTF anchor should target the same visual hat seat at **~1.65–1.75** m above feet for the 1.8 m normalized hero.

## Authoring checklist (Blender → glTF)

1. Import **Regular Male** (or current spike: **Superhero Male**) from Universal Base Characters ([`SPIKE_DECISION.md`](./SPIKE_DECISION.md)).
2. Apply scale/rotation so **feet = 0**, **face −Z**, **height ≈ 1.8** (`node game/client/scripts/normalize-player-glb.mjs`).
3. Verify mid-torso width ≤ **1.0** m diameter (radius **0.5**).
4. Add shape keys named exactly as the six keys on the body mesh; re-run `add-player-proportion-morphs.mjs` or export morph targets from Blender.
5. Export **glTF 2.0 binary** (`.glb`) to `game/client/public/models/player.glb`.
6. Update [`CREDITS.md`](../client/public/models/CREDITS.md) and [`README.md`](../client/public/models/README.md).

### Blender / rig names (spike asset)

| Role | Name in committed `player.glb` |
|------|--------------------------------|
| Body mesh object | `SuperHero_Male` → mesh `Sphere.005_Retopology.004` |
| Eyes mesh object | `Eyes` → mesh `Face.001` |
| Armature root | `root` / `Armature` |
| Head bone (hats) | `Head` |

## Out of scope for this contract doc

- Wiring `MODEL_REGISTRY.player` or swapping `createPlayerAvatar` (tickets **161** / **187**).
- Server `cosmetic` validation changes (ticket **186**).
- Enemy / minion models (separate registry keys).
