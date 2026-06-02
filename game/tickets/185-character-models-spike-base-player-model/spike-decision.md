# Spike decision — base player model (ticket 185)

**Source:** [Quaternius — Universal Base Characters](https://quaternius.itch.io/universal-base-characters) (**CC0 1.0**). Committed mesh: **`Superhero_Male_FullBody`** from the free **Standard** zip (`License_Standard.txt`). Sub-ticket 01 targeted **Regular Male** (paid **Source** kit); same pack/rig until Source is obtained.

**Poly budget:** **8,000–14,000** triangles target; **~8,483** unique verts measured on normalized [`player.glb`](../../client/public/models/player.glb).

**Anchor / scale (base pose, all morph influences 0):** feet **y = 0**, forward **−Z**, standing height **1.8**, axis-aligned **XZ** footprint ≤ **`PLAYER_RADIUS = 0.5`** (measured **X** half **0.5**, **Z** half ≈ **0.078**). Normalization: Y → 1.8 m, XZ → 0.5 m max half-width, translate feet to **y = 0**.

**Registry:** default **`modelId` `"player"`** → `player.glb`. Six proportion keys (server / glTF / sliders, case-sensitive): `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth` — clamp **0–1**. Renderer still procedural box until ticket **187**.

**Full contract:** [`game/docs/MODEL_SPIKE.md`](../../docs/MODEL_SPIKE.md) · **verbatim code rules:** [`game/client/public/models/README.md`](../../client/public/models/README.md) · **credits:** [`CREDITS.md`](../../client/public/models/CREDITS.md)
