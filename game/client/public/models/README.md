# `game/client/public/models/` — player GLB guide

This folder holds runtime **`.glb`** assets served at `/models/*.glb`. The hero
contract is documented in [`game/docs/MODEL_SPIKE.md`](../../../docs/MODEL_SPIKE.md).

## Replacing `player.glb`

1. **Source** — Start from the chosen spike base ([Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), CC0) or a derivative that keeps the same rig and proportion shape keys. See [`../../../docs/SPIKE_DECISION.md`](../../../docs/SPIKE_DECISION.md) for alternatives that were considered.
2. **Blender cleanup** — Scale and orient only as needed (see checklist below). Do not rename morph targets or proportion keys.
3. **Export** — Overwrite `player.glb` in this directory (binary glTF 2.0, `.glb`).
4. **Credits** — Update the `player.glb` row in [`CREDITS.md`](./CREDITS.md) (source, license, URL, status).
5. **Verify** — Run `pnpm test:quick` from `game/` after sub-ticket **05** lands; the contract test loads `/models/player.glb` and checks morph names, bounds, and triangle count.

`MODEL_REGISTRY.player` in `game/client/models.js` is wired in ticket **187**; until then the file can exist without affecting gameplay.

## Morph targets ↔ `proportions[key]`

The server sends `cosmetic.proportions` with exactly six keys:

`height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`

Each glTF morph target on the exported mesh MUST use the **same name** (case-sensitive). Downstream client code maps:

```text
proportions[key]  →  morphTargetInfluences[morphTargetDictionary[key]]
```

There is **no** renaming layer — if Blender exports `HeadSize` or `torso_width`, fix the export; do not add a mapping table in code.

Server clamp per key: **0.75 – 1.25**, default **1.0** (see `MODEL_SPIKE.md`).

## Blender export checklist

Use these steps for every `player.glb` revision:

1. **Apply transforms** — Object mode → Apply **All Transforms** (scale/rotation/location) on the export root so the file’s rest pose matches game units.
2. **Feet on ground** — Origin / mesh positioned so the soles sit at **y = 0** in the export root’s space.
3. **Forward = −Z** — Character faces **−Z** in Blender before export (game forward matches renderer facing).
4. **Height ≈ 1.8** — Total standing height in Blender units should be ~**1.8** after apply (test band **1.7–1.9** in automated contract tests).
5. **Footprint** — At the feet, XZ extent within radius **0.5** (`PLAYER_RADIUS` in `game/server/simulation.js`).
6. **Shape keys** — Six proportion shape keys named exactly as in `MODEL_SPIKE.md`; export as glTF morph targets on the skinned mesh the client will tint.
7. **glTF export** — glTF 2.0, format **glTF Binary (.glb)**; include skinning; keep triangle count within the budget in `MODEL_SPIKE.md` (≤ 18k with morphs).

Optional: note Blender version, export add-on settings, and which mesh owns the shape keys in the “Morph authoring” section of `MODEL_SPIKE.md` when you change the asset.

## Other models

Enemy and minion placeholders use the same folder; see [`CREDITS.md`](./CREDITS.md) for attribution and replacement policy.
