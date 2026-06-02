# Spike decision: base player humanoid source

Decision record for ticket **185** (character-model spike). Downstream sub-tickets **02–03** import `player.glb`; tickets **186–191** share the naming and scale conventions documented in [`MODEL_SPIKE.md`](./MODEL_SPIKE.md).

## Candidates considered

| Source | License | Approx. tris (per body) | Rig / morph readiness | Notes |
|--------|---------|------------------------|------------------------|-------|
| **[Quaternius — Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)** | **CC0** | ~**13 000** (pack average; single “Regular” body is in the same ballpark) | Humanoid rig (Mixamo-compatible), `.blend` source in paid tier; FBX/glTF in free Standard zip | Six base meshes (Superhero / Regular / Teen × M/F), 20 hairstyles, matches existing enemy placeholder policy ([`CREDITS.md`](../client/public/models/CREDITS.md)) |
| **Authored in Blender (custom base)** | Project-owned | Budget **≤ 8 000** tris for hero (tighter than import) | Full control over topology, shape keys, and export; no third-party attribution | Highest art cost; best if morph silhouettes must be bespoke; delays spike until modeling pass |
| **Kenney — prototype characters** ([kenney.nl](https://kenney.nl/assets)) | CC0 | ~**2 000–4 000** (low-poly blocks) | Often static or minimal rig; not designed for six body proportion morphs | Fine for blockout; weak fit for ticket **03** morph-target contract and hat anchoring on a consistent head bone |
| **Sketchfab (CC0 / CC-BY filter)** | Per-model | Highly variable | Inconsistent bone naming and scale; manual cleanup per asset | Viable one-off fallback per [`CREDITS.md`](../client/public/models/CREDITS.md) policy; poor canonical baseline for a multi-ticket chain |

## Final choice

**Use Quaternius Universal Base Characters (Standard / free zip)** as the import source for the spike `player.glb`.

- **Pack URL:** https://quaternius.com/packs/universalbasecharacters.html  
- **Mirror / download:** https://quaternius.itch.io/universal-base-characters (file: `Universal Base Characters[Standard].zip`)
- **Concrete mesh:** **Regular Male** (neutral heroic proportion; avoids Teen scale and Superhero bulk). Hair/accessories from the pack are **not** committed in the spike—hats remain separate glTF in ticket **190**.
- **License:** **CC0** (public domain). Record the pack and creature name in [`CREDITS.md`](../client/public/models/CREDITS.md) on import (sub-ticket **02**).
- **Triangle budget:** Source ~**13 k** tris before decimation; acceptable for a single local hero and remote players at this art tier. If profiling demands it, a **≤ 10 k** decimated variant may be considered later without changing the contract keys or world scale.
- **Rationale:**
  1. **License alignment** — CC0 matches project redistributable-asset rules and enemy placeholders already on Quaternius.
  2. **Humanoid rig** — Retargetable skeleton supports future locomotion clips (Universal Animation Library) without blocking the current cosmetic spike.
  3. **Morph path** — Blender shape keys on the chosen base, exported as glTF morph targets in sub-ticket **03**, are straightforward on this topology.
  4. **Time** — Faster than authoring a custom Blender hero for a spike whose goal is **contract + pipeline**, not final art.

Custom Blender authorship remains the fallback if Quaternius silhouettes cannot satisfy the six proportion morphs without artifacts; that would switch `CREDITS.md` to “project-owned” with no URL row change to the file path contract.

## Normalization responsibility

Sub-ticket **02** applies the transforms so the committed asset meets [`MODEL_SPIKE.md`](./MODEL_SPIKE.md): feet at `y = 0`, forward **−Z**, standing height **1.8** world units, XZ footprint within **`PLAYER_RADIUS = 0.5`**. This document does not commit the `.glb` binary.
