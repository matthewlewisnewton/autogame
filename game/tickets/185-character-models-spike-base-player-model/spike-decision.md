# Spike decision — base player model (ticket 185)

**Canonical path (game tree):** `game/tickets/185-character-models-spike-base-player-model/spike-decision.md`  
**Mirror (ticket tree, sub-ticket 04):** `tickets/185-character-models-spike-base-player-model/spike-decision.md`

## Chosen source

**Quaternius — Universal Base Characters** (CC0)  
- Pack: https://quaternius.itch.io/universal-base-characters  
- Author site: https://quaternius.com/packs/universalbasecharacters.html  
- License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

**Sub-ticket 01 target:** Regular Male proportion.  
**Sub-ticket 02 committed mesh:** `Superhero_Male_FullBody` from the itch.io **Standard** (free) zip — that tier ships only Superhero male/female base bodies (see `License_Standard.txt` in the pack). Regular / Teen variants are in the paid **Source** kit. The committed asset is the same CC0 pack and humanoid rig; proportion tier is documented here so sub-ticket 03 shape keys can be authored on this mesh until a Regular Male file is obtained.

## Evaluated alternatives (sub-ticket 01)

| Source | License | URL | Why not chosen |
|--------|---------|-----|----------------|
| Kenney Animated Characters (Retro) | CC0 | https://kenney.nl/assets/animated-characters-1 | Modular slices; weaker single-body base for six proportion morphs |
| Kenney Blocky Characters | CC0 | https://kenney.nl/assets/blocky-characters | Blocky proportions; poor match for PSO-style hero |
| Sketchfab (CC0 filter) | CC0 / CC-BY | https://sketchfab.com/search?features=downloadable&licenses=cc0&licenses=by&type=models | Inconsistent rig/topology; higher review cost per asset |

## Poly budget

Target **8,000–14,000** triangles for the committed `player.glb`.  
**Measured (normalized asset):** ~8,483 unique uploaded vertices (gltf-transform inspect); suitable for spike.

## Anchor / scale conventions (planned → verified in sub-ticket 02)

| Convention | Target | Verified on committed `player.glb` |
|------------|--------|-------------------------------------|
| Feet / root origin | Model **y = 0** | bbox min **y = 0.0** |
| Forward axis | **−Z** (renderer: `rotation.y = playerRotation - π/2`) | Source T-pose: wide **X** (arms), thin **Z** (depth) → faces **−Z**; no extra yaw applied |
| Standing height | **~1.8** world units | bbox height **1.8** |
| Horizontal footprint | Axis-aligned **XZ** within **PLAYER_RADIUS = 0.5** (`game/client/collision.js`) | bbox half-extents **X = 0.5**, **Z ≈ 0.078** (max horizontal extent **0.5**) |

Normalization applied to `Superhero_Male_FullBody.gltf` (Godot/UE export): non-uniform scale (Y → 1.8 m, XZ → 0.5 m half-width), translate feet to **y = 0**, export glTF binary **Y-up**, single skinned humanoid root wrapper `PlayerNormalized`.

## Proportion morph targets (sub-ticket 03 — in `player.glb`)

Exact glTF morph names (`mesh.extras.targetNames` / Three.js `morphTargetDictionary`):

| Morph | Body region (authored) | Influence range (ticket 186 clamps) | Effect at influence **1.0** |
|-------|------------------------|-------------------------------------|-----------------------------|
| `height` | All verts, scaled from feet **y = 0** | **0 – 1** | +12% standing height (uniform **Y**) |
| `headSize` | Head (**y** ≳ 1.42) + both **Face** meshes | **0 – 1** | ~18% radial expand about neck pivot **(0, 1.55, z)** |
| `torsoWidth` | Torso band **0.95 – 1.38**, low **\|x\|** | **0 – 1** | ~18% lateral **X** (+ slight **Z**) |
| `armLength` | Arms **\|x\| ≳ 0.22**, **y** 1.0 – 1.48 | **0 – 1** | ~14% outward **X** extension |
| `legLength` | Legs **y < 0.95** from hip | **0 – 1** | ~14% lengthen along leg from hip |
| `shoulderWidth` | Shoulders **y** 1.32 – 1.52, **\|x\| ≳ 0.22** | **0 – 1** | ~12% outward **X** at shoulders |

**Authoring:** programmatic shape keys via `game/scripts/add-player-morph-targets.mjs` (gltf-transform **v4.3.0**). Re-run after re-normalizing the base mesh. Face meshes carry only non-zero `headSize` deltas; body mesh carries all six.

**Base pose (influence 0):** normalization unchanged — feet **y = 0**, forward **−Z**, height **1.8**, horizontal extent **≤ 0.5** (see table above).

## Committed asset (sub-ticket 02)

- **File:** `game/client/public/models/player.glb` (~15 MB, rigged skinned glTF 2.0)  
- **Registry / renderer:** unchanged (still procedural box until ticket 187)  
- **Credits:** `game/client/public/models/CREDITS.md`
