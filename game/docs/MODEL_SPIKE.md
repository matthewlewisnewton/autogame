# Model spike — base player contract

Canonical contract for the character-model chain (tickets **185–191**). All names below are **case-sensitive** and must match across server JSON, glTF morph targets, and future UI slider ids.

Related: [SPIKE_DECISION.md](./SPIKE_DECISION.md) (source pack choice), [../client/public/models/README.md](../client/public/models/README.md) (author checklist), [../client/public/models/CREDITS.md](../client/public/models/CREDITS.md) (license rows).

## Committed asset path

| Role | Path |
|------|------|
| Base player mesh | `game/client/public/models/player.glb` |

Binary import is sub-ticket **02**; morph targets sub-ticket **03**. This ticket defines conventions only.

## World-space conventions

These match existing gameplay and rendering:

| Rule | Value | Code reference |
|------|--------|----------------|
| Feet on ground plane | Model origin **`y = 0`** at sole contact | Floor sampling places avatar at `sampleFloorY`; group `position.y = floorY` |
| Forward axis | **−Z** (character faces −Z in bind pose) | `playersMeshes[id].rotation.y = rotation − π/2` in `game/client/renderer.js` |
| Standing height | **1.8** world units (full bounding box height after normalization) | Distinct from current procedural ~1u primitives; new hero target |
| Horizontal collision | Fits **`PLAYER_RADIUS = 0.5`** cylinder at **mid-torso** (≈ 0.9 m above feet) | `game/server/simulation.js`, `game/client/collision.js` |
| T-pose overflow | Ankles/wrists may extend past radius 0.5; document in README if true | Collision uses cylinder, not mesh-accurate |

**Import normalization:** Scale/rotate in Blender so the exported glTF satisfies the table without a runtime scale fudge (ticket 187 may add a single uniform scale only if documented here).

## Canonical proportion keys

Exactly six keys. Server `proportions{}`, glTF morph-target **names**, and customization slider ids must use these strings verbatim:

| Key | Semantics (neutral = 0.5) |
|-----|---------------------------|
| `height` | Overall stature (legs + torso + head) |
| `headSize` | Head volume / neck scale |
| `torsoWidth` | Chest / abdomen width |
| `armLength` | Upper + lower arm reach |
| `legLength` | Hip to foot length |
| `shoulderWidth` | Clavicle span (may affect T-pose width vs collision) |

No aliases (e.g. not `HeadSize`, `torso_width`, or `bodyHeight`).

### Morph influence range (ticket 186 clamping)

| Key | Min | Neutral | Max | Notes |
|-----|-----|---------|-----|-------|
| All six keys | `0.0` | `0.5` | `1.0` | Server and client clamp to this closed interval |

- **`0.5`** is the authored default mesh (no morph bias).  
- **`0.0`** and **`1.0`** are the negative and positive extreme shape keys exported in sub-ticket 03.  
- Values outside `[0, 1]` are invalid; ticket **186** should reject or clamp before applying.

Three.js usage (ticket 187+): for each morph target name `key`, set `mesh.morphTargetInfluences[i] = proportions[key]` (after resolving index by name).

### Server shape (future ticket 186)

```js
// Illustrative — not implemented in 185
proportions: {
  height: 0.5,
  headSize: 0.5,
  torsoWidth: 0.5,
  armLength: 0.5,
  legLength: 0.5,
  shoulderWidth: 0.5,
}
```

Defaults are all **`0.5`**. Partial updates merge like other cosmetic fields.

## Head anchor (hats, ticket 190)

Prefer the humanoid rig bone:

- **Bone name:** `Head` (glTF node name after export; confirm in 02 when `player.glb` lands).

Hat `.glb` files attach to this bone in the avatar group (no per-hat Y fudge). If the exported rig uses a different spelling (e.g. `mixamorig:Head`), document the exact node name in `game/client/public/models/README.md` in sub-ticket 02.

Fallback if no bone is exported: offset from origin **`(0, 1.65, 0)`** in model space (≈ top of 1.8 m body)—only as a last resort.

## Blender authoring notes (sub-tickets 02–03)

- Base mesh: one skinned humanoid; shape keys named exactly as the proportion table.  
- Apply transforms before export; +Y up in Blender → **−Z forward** in glTF per table above.  
- Export glTF 2.0 binary (`.glb`); morph targets as shape keys → glTF morph targets.  
- Preserve normalization when re-exporting with morphs (03).

## Out of scope for this document

- Runtime wiring (`game/client/models.js`, `renderer.js`, `createPlayerAvatar`) — tickets **161 / 187**.  
- Server validation of `proportions` — ticket **186**.  
- Customization UI sliders — tickets **188+**.
