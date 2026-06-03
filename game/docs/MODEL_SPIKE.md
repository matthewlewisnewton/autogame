# Player model spike — canonical contract

This document is the **durable contract** for ticket **185** and downstream work
(**186** server `proportions{}`, **187** glTF avatar render, **188** proportion
sliders). Source research and candidate comparison live in
`tickets/185-character-models-spike-base-player-model/DECISION.md` (when present);
this file is what implementers under `game/` should treat as authoritative.

## Chosen base asset

| Field | Value |
|-------|--------|
| **Pack** | [Quaternius — Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) |
| **License** | **CC0** (public domain; redistribution allowed) |
| **Base mesh** | `Regular_Male` (regular body proportion from the pack) |
| **Export path** | `game/client/public/models/player.glb` |

**Rationale (one line):** CC0 rigged humanoid with a neutral rest pose, consistent
with existing Quaternius enemy placeholders, and enough topology for six proportion
morph targets without a custom Blender sculpt for the spike.

## Triangle budget

| Tier | Count |
|------|--------|
| Vendor average (single character, rest pose) | ~**13k** triangles |
| **Target** at export (rest pose, no morph duplicates) | **≤ 15_000** |
| **Hard cap** (rest + six morph targets) | **≤ 18_000** |

Sub-ticket **05** and CI tests should use **`MAX_PLAYER_TRIS = 18000`** (duplicate
this constant in `game/client/test/playerModel.test.js` or import from a shared
test helper — do not drift from the cap here).

## Anchor, scale, and orientation

All exports of `player.glb` MUST follow these world-space conventions so server
collision (`PLAYER_RADIUS`), floor sampling, and renderer facing stay aligned:

| Rule | Value |
|------|--------|
| **Feet** | Sole contact at model **y = 0** (origin on the ground plane) |
| **Forward** | Character faces **−Z** (matches renderer: `rotation.y = playerRotation − π/2`) |
| **Height** | Total axis-aligned height **≈ 1.8** world units (acceptable **1.7–1.9** in tests) |
| **Footprint** | Horizontal extent at the feet fits inside a circle of radius **`PLAYER_RADIUS`** |

`PLAYER_RADIUS` is **0.5** in `game/server/simulation.js` (also mirrored in
`game/client/collision.js`). The model’s XZ bounding box at y ≈ 0 should not
extend beyond ±0.5 on either axis after scale/orientation is applied.

## Body proportions — server, UI, and glTF

Six sliders share one vocabulary. Keys are **case-sensitive**; there is **no**
renaming or alias layer between systems.

| Key | Server field | glTF morph target | UI slider `id` | Clamp (server) | Default |
|-----|--------------|-------------------|----------------|----------------|---------|
| `height` | `proportions.height` | `height` | `height` | 0.75 – 1.25 | 1.0 |
| `headSize` | `proportions.headSize` | `headSize` | `headSize` | 0.75 – 1.25 | 1.0 |
| `torsoWidth` | `proportions.torsoWidth` | `torsoWidth` | `torsoWidth` | 0.75 – 1.25 | 1.0 |
| `armLength` | `proportions.armLength` | `armLength` | `armLength` | 0.75 – 1.25 | 1.0 |
| `legLength` | `proportions.legLength` | `legLength` | `legLength` | 0.75 – 1.25 | 1.0 |
| `shoulderWidth` | `proportions.shoulderWidth` | `shoulderWidth` | `shoulderWidth` | 0.75 – 1.25 | 1.0 |

**Mapping rule:** downstream code sets each morph target influence from
`proportions[key]` using the **same string** as the morph name — e.g.
`mesh.morphTargetInfluences[dictionary.height] = proportions.height`.
Do not translate keys at load time.

Ticket **186** clamps and persists `proportions{}`; ticket **187** applies
influences on the skinned mesh; ticket **188** binds sliders to the same ids.

### Morph authoring (Blender → glTF)

- Add **shape keys** on the skinned body mesh(es) the client will tint (see ticket **187**).
- Export shape keys as glTF **morph targets** with names matching the table above **exactly**.
- **Rest pose:** all morph influences **0** — must still satisfy feet y=0, −Z forward, ~1.8 height, and footprint within `PLAYER_RADIUS`.
- **Full influence:** value **1.0** on a single target should read clearly at the high end of the clamp range; authoring may tune shape-key deltas in Blender, but runtime only sees 0.75–1.25 from the server.
- Sub-ticket **04** lands the morph-enabled `player.glb`; see **Authoring notes** below for mesh ownership and per-target tuning.

### Authoring notes (sub-ticket 04)

| Item | Detail |
|------|--------|
| **Mesh with morphs** | `SuperHero_Male` (`SkinnedMesh`, ~12.6k tris). Eyebrows/Eyes have no shape keys. |
| **Tooling** | Procedural deltas via `node game/scripts/build-player-morphs.mjs` (Three.js `GLTFExporter`; re-run after rest-pose edits). |
| **Runtime influence** | Rest = **0** on all targets. Ticket **187** maps `proportions[key]` (0.75–1.25, default 1.0) onto these names. |
| **Recommended range** | Author at **0–1** per target; **1.0** should read clearly for QA. Server clamp 0.75–1.25 applies in gameplay, not in the asset. |

Per-target delta intent at influence **1.0** (single target, others 0):

| Target | Effect at 1.0 |
|--------|----------------|
| `height` | ~14% taller, feet pinned at y = 0 |
| `headSize` | ~20% radial scale around head center (y ≈ 1.62) |
| `torsoWidth` | ~14% outward on mid torso (hips–upper chest) |
| `armLength` | ~6–10% limb extension on upper arms |
| `legLength` | ~16% leg stretch below hip, soles locked near y = 0 |
| `shoulderWidth` | ~18% lateral span across shoulder band |

### Export notes (sub-ticket 03)

- **Source file:** `Superhero_Male_FullBody.gltf` from the Quaternius **Standard** (CC0) pack. The free Standard download currently ships Superhero male/female bodies only; **Regular_Male** / Teen variants are in the paid Source tier — swap the source glTF when that mesh is available without changing the conventions below.
- **Transform:** uniform scale to **1.8** standing height; translate so sole contact is **y = 0**; vendor rest pose already faces **−Z** (no Y rotation applied).
- **Format:** binary glTF (`.glb`), geometry + skin + six morph targets on `SuperHero_Male` (~1.0 MB) — ticket **187** tints the skinned body mesh at runtime.

## Registry and gameplay wiring

- **`MODEL_REGISTRY.player`** stays `null` until ticket **187** — procedural avatar remains in use until then.
- Do not change `renderer.js` or server cosmetic schema in spike sub-tickets **02–05** except where a ticket explicitly says otherwise.

## Related docs

- Artist/engineer replacement steps: [`game/client/public/models/README.md`](../client/public/models/README.md)
- Attribution ledger: [`game/client/public/models/CREDITS.md`](../client/public/models/CREDITS.md)
- Decision note (candidates, URLs): `tickets/185-character-models-spike-base-player-model/DECISION.md`
