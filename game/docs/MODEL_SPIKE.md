# Model spike: base player contract

Canonical contract for the character-model chain (tickets **185–191**). Sub-ticket **01** defines this document; **02** commits `player.glb`; **03** adds morph targets; **186+** wire server `proportions{}`, client sliders, and glTF avatar rendering (**161** / **187** own runtime registry).

## Canonical proportion keys

These six strings are **exact, case-sensitive identifiers** shared by:

- Future server field `proportions{}` (ticket **186** clamping)
- glTF morph-target names on `player.glb` (ticket **03**)
- Future customization UI slider ids (tickets **188+**)

| Key | Body region (authoring intent) |
|-----|--------------------------------|
| `height` | Overall stature (legs + torso scale) |
| `headSize` | Head volume / neck junction |
| `torsoWidth` | Chest / abdomen width |
| `armLength` | Upper + lower arm reach |
| `legLength` | Upper + lower leg length |
| `shoulderWidth` | Clavicle span / shoulder breadth |

Do not introduce aliases (`HeadSize`, `torso_width`, etc.). Tests in sub-ticket **03** assert these names verbatim on the exported glTF.

## Morph influence range (all keys)

Same range for every key above (server and UI must stay aligned):

| Property | Value |
|----------|--------|
| Minimum influence | `0.0` |
| Neutral (default) | `0.5` |
| Maximum influence | `1.0` |

Ticket **186** should clamp stored/API values to `[0.0, 1.0]` and treat missing keys as `0.5`. At `0.5`, the mesh should match the normalized base silhouette from sub-ticket **02**. Extremes `0.0` and `1.0` are the authored min/max shape keys (sub-ticket **03**); they must remain visually distinct without inverted normals or collapsed geometry.

## Base player asset conventions

| Rule | Specification |
|------|----------------|
| Committed path | `game/client/public/models/player.glb` |
| Ground anchor | Model origin at **feet**: lowest vertex / foot contact at **`y = 0`** on the world ground plane |
| Forward axis | Character faces **−Z** in model space (matches client placement: `rotation.y = playerRotation − π/2` in `game/client/renderer.js`) |
| Standing height | **1.8** world units after import normalization (measure axis-aligned bounding box height) |
| Horizontal footprint | XZ extent must fit inside a cylinder of radius **`PLAYER_RADIUS = 0.5`** (see `game/server/simulation.js` and `game/client/collision.js`) — typically origin-centered on XZ at the foot point |
| Runtime wiring | **Out of scope** for spike sub-tickets 01–03: do not assume `player.glb` is loaded in `renderer.js` until ticket **187** |

### Normalization checklist (sub-ticket 02)

1. Import chosen base mesh (see [`SPIKE_DECISION.md`](./SPIKE_DECISION.md)).
2. Apply scale/rotation so feet sit at `y = 0`, forward is **−Z**, height ≈ **1.8**.
3. Center or constrain XZ so the silhouette fits **`PLAYER_RADIUS`** (0.5) — collision uses a circle in XZ, not a full AABB, but the mesh should not poke outside a 0.5 m radius at the waist/shoulders.
4. Export glTF 2.0 binary (`.glb`); **Draco off** for simpler tooling/tests.
5. Update `game/client/public/models/CREDITS.md` for `player.glb`.

### Head anchor (hats, ticket 190)

Attach hat props to the humanoid **`Head`** bone when present after rig import. If a re-export loses bone names, document the fallback offset from the origin in `game/client/public/models/README.md` (expected top-of-head near `y ≈ 1.55–1.65` when height = 1.8). Sub-ticket **02** must record the actual bone name or offset used.

## Procedural avatar reference (current game)

Until **187** swaps in glTF, players use cosmetic-driven primitives (`createPlayerAvatar` in `game/client/renderer.js`) roughly **1.0** unit tall with **`PLAYER_RADIUS = 0.5`**. The **1.8** u glTF hero is the target size once wired; do not change collision radius for the spike.

## Related docs

- Author quick reference: `game/client/public/models/README.md`
- License rows: `game/client/public/models/CREDITS.md`
- Source decision: [`SPIKE_DECISION.md`](./SPIKE_DECISION.md)
