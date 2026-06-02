# 3D models — author guide

Assets in this directory are served at `/models/<filename>.glb` (Vite `public/` root).
Every committed `.glb` needs a row in [`CREDITS.md`](./CREDITS.md) before it is wired
into [`models.js`](../../models.js) `MODEL_REGISTRY`.

## Base player (`player.glb`)

The hero mesh for the character-model spike (tickets 185–191). Full contract:

| Topic | Rule |
|-------|------|
| **Path** | `game/client/public/models/player.glb` (this folder) |
| **Source** | Quaternius Universal Base Characters — see [`../../../docs/SPIKE_DECISION.md`](../../../docs/SPIKE_DECISION.md) |
| **Feet** | Origin at ground: **Y = 0** at soles |
| **Forward** | Character looks down **−Z** |
| **Height** | **~1.8** world units tall after normalization |
| **Footprint** | XZ fit inside radius **0.5** (`PLAYER_RADIUS` in server/client collision) |
| **Morph names** | `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth` — see [`../../../docs/MODEL_SPIKE.md`](../../../docs/MODEL_SPIKE.md) |
| **Morph range** | `0.0` (min) · `0.5` (neutral) · `1.0` (max) per key |

`player.glb` is not wired in the renderer until ticket 187; sub-tickets 02–03 add and
shape the file without changing gameplay visuals.

### Head anchor (ticket 190 — hats)

- **Primary:** skinned bone `Head` on the Quaternius humanoid rig (present in the
  committed `player.glb`).
- **Fallback offset** from feet origin if a bone is unavailable after re-export:
  approximately `(0, 1.65, 0)` in model space for the normalized 1.8u mesh.
- Hat `.glb` files should parent to this anchor; avoid per-hat position fudge.

### Re-exporting `player.glb`

Source asset (not committed): `Superhero_Male_FullBody.fbx` from the Quaternius
Universal Base Characters **[Standard]** zip. The Dec 2025 Standard export ships
Superhero male/female full-body meshes (Regular/Teen variants are in the paid Source
zip); this spike uses **Superhero Male** as the male base.

From `game/client/` with Flatpak Blender:

```bash
# Place FBX under .authoring/ubc/ (gitignored), then:
flatpak run org.blender.Blender --background --python scripts/blender-normalize-player.py
```

Blender script applies: feet at **Y = 0**, forward **−Z**, height **1.8**, Draco off,
materials omitted for a smaller diff. Verify in Three.js: axis-aligned height ≈ 1.8,
mid-torso XZ radius ≤ 0.5 (T-pose arms are ignored at the ankle slice per
`MODEL_SPIKE.md`).

## Enemy and minion placeholders

Other `.glb` files (grunt, skirmisher, minions, etc.) follow the same license policy
in `CREDITS.md`. Use consistent **−Z forward** and feet-at-**y = 0** when replacing
placeholders so props and VFX align with dungeon coordinates.

## Naming

- File names: lowercase, hyphen for variants (`minion-ancient-wyrm.glb`).
- Registry keys in `models.js` use snake_case for minion types (`ancient_wyrm`) and
  match renderer entity keys — do not rename without updating the registry and tests.
- Proportion / morph keys: exact camelCase strings in `MODEL_SPIKE.md` only.

## Export settings (Blender → glTF)

- Format: glTF 2.0 binary (`.glb`)
- **+Y up**, **−Z forward** after normalization (see `MODEL_SPIKE.md`)
- Apply object transforms on export; no unapplied scale on the root
- Draco: **off** (keeps tests and git diffs simple)

## Documentation map

| Doc | Purpose |
|-----|---------|
| [`../../../docs/MODEL_SPIKE.md`](../../../docs/MODEL_SPIKE.md) | Canonical proportions, morph ranges, scale/orientation |
| [`../../../docs/SPIKE_DECISION.md`](../../../docs/SPIKE_DECISION.md) | Why Quaternius vs alternatives; license and poly budget |
| [`CREDITS.md`](./CREDITS.md) | Per-file license, URL, placeholder/final status |

## Adding a new model

1. Add the `.glb` here.
2. Add a table row to `CREDITS.md` (license must be CC0, CC-BY, or project-owned).
3. Register the path in `models.js` only when a sub-ticket explicitly wires it.
4. For the base player, re-read `MODEL_SPIKE.md` before re-exporting morph targets.
