# Character base mesh — source decision (ticket 185)

Decision record for the base player humanoid used in the character-model spike
(tickets 185–191). Canonical runtime contract lives in
[`MODEL_SPIKE.md`](./MODEL_SPIKE.md); asset-author summary in
[`../client/public/models/README.md`](../client/public/models/README.md).

## Candidates compared

| Source | License | Rig / morphs | Approx. tris (hero) | Fit for spike |
|--------|---------|--------------|---------------------|---------------|
| **Quaternius — Universal Base Characters** | [CC0](https://quaternius.com/packs/universalbasecharacters.html) | Humanoid rig; 6 body variants (Superhero / Regular / Teen × M/F); 20 hairstyles in pack; morph-friendly low-poly topology | ~13k per base mesh (author stated average) | **Selected** — matches enemy placeholders (Quaternius CC0), same art lane, already listed in `CREDITS.md` approved sources |
| **Custom Blender base** | Project-owned | Full control over proportion shape keys and export; no third-party attribution | Budget TBD (~8–15k target to stay mobile-friendly) | Viable but slower; re-invents rig/normals already solved by CC0 pack; deferred unless pack import fails normalization |
| **Kenney — Mini Characters / Toon Characters** ([kenney.nl](https://kenney.nl/assets)) | CC0 | Static or simple rigs; not a dedicated humanoid customization base | ~500–2k per figure | Rejected for hero — scale/style mismatch with existing Quaternius enemies; limited body-type variation without heavy remesh |
| **Sketchfab CC0/CC-BY humanoids** | Per-model | Variable quality/licensing | Wide | Rejected as default — search friction, inconsistent rig naming, and license audit cost; acceptable only as one-off fallback with row in `CREDITS.md` |

## Final choice

- **Source pack:** Quaternius — **Universal Base Characters** (Standard export)
- **Canonical URL:** https://quaternius.com/packs/universalbasecharacters.html  
  Mirror / download: https://quaternius.itch.io/universal-base-characters
- **License:** CC0 (public domain) — no attribution required; record pack URL in
  [`CREDITS.md`](../client/public/models/CREDITS.md) when `player.glb` is committed
  (sub-ticket 02).
- **Base variant for import (sub-ticket 02):** **Regular Male** glTF from the Standard
  zip unless art direction changes; single humanoid mesh before hairstyle attachments.
- **Approximate triangle count:** ~13k triangles for the chosen base mesh (per pack
  documentation); target **≤ 20k** after normalization and optional hat-anchor geometry
  cleanup so client load stays in line with existing enemy `.glb` placeholders.

## Rationale

1. **License safety** — CC0 matches project policy in `CREDITS.md` (redistributable,
   no commercial-game rips).
2. **Consistency** — Enemy placeholders already use Quaternius CC0 assets; one stylistic
   family reduces visual clash during the spike.
3. **Rigged humanoid** — Pack ships engine-ready humanoid rigs and aligns with the
   Universal Animation Library if we add locomotion clips later (out of scope for 185).
4. **Morph feasibility** — Low-poly, animation-friendly topology is suitable for six
   proportion shape keys (sub-ticket 03) without a full custom sculpt pass.
5. **Cost / time** — Import + Blender normalization is faster than authoring a bespoke
   base while still meeting feet-at-origin, −Z forward, 1.8u height, and `PLAYER_RADIUS`
   constraints documented in `MODEL_SPIKE.md`.

## Anchor and scale conventions (summary)

Full numbers and proportion keys are in `MODEL_SPIKE.md`. In short:

- Committed path: `game/client/public/models/player.glb`
- Feet at model **Y = 0**; character forward **−Z**
- Normalized standing height **1.8** world units
- Horizontal footprint within **`PLAYER_RADIUS = 0.5`** (`game/server/simulation.js`,
  `game/client/collision.js`)
- Renderer facing: `rotation.y = playerRotation − π/2` in `game/client/renderer.js`
  (game +X at `playerRotation = 0` corresponds to model **−Z** forward)

## Out of scope for this document

- Committing or replacing `player.glb` (sub-ticket 02)
- glTF morph target authoring (sub-ticket 03)
- Wiring the model into `renderer.js` / `MODEL_REGISTRY` (tickets 161 / 187)
