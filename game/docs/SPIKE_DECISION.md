# Spike decision: base player mesh source

Decision record for ticket **185** (character models spike). Sub-ticket **02** imports and normalizes the chosen mesh into `game/client/public/models/player.glb` per `MODEL_SPIKE.md`.

## Candidates compared

| Source | License | Approx. tris (hero) | Rig / morph fit | Notes |
|--------|---------|---------------------|-----------------|-------|
| **[Quaternius — Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)** ([itch.io](https://quaternius.itch.io/universal-base-characters)) | **CC0** | **~13k** per base model (pack average) | Humanoid rig, animation-friendly topology, Regular / Teen / Superhero proportions | Same author as enemy placeholders (Ultimate Monsters); Standard `.glb` in zip |
| **[Kenney — Mini Characters](https://kenney.nl/assets/mini-characters)** | **CC0** | **~500–2k** (low-poly blocks) | Simple blocky rigs; fewer blend-shape-friendly regions | Fast and tiny, but proportions are stylized miniatures — more retopo work to hit 1.8 u hero + six body morphs |
| **Authored in Blender** | Project-owned | Budget TBD (~8–15k target) | Full control | Best long-term fit for exact morph keys, but blocks the spike on modeling time; no CC0 pack velocity |

## Final choice

- **Pack:** Quaternius **Universal Base Characters** (Standard download).
- **Base mesh:** **Regular Male** (`Regular_Male` in the Standard glTF set) — neutral adult proportion closest to the 1.8 u contract without Superhero bulk or Teen scale.
- **License:** **CC0** (public domain; no attribution required; record source in `CREDITS.md` anyway).
- **Approximate triangle count:** **~13,000** (pack-stated average for base bodies; verify on export in sub-ticket 02).

## Rationale

1. **License and policy** — CC0 matches `CREDITS.md` approved sources and avoids Sketchfab download friction.
2. **Pipeline consistency** — Enemies already use Quaternius placeholders; one toolchain and scale reference for artists.
3. **Rig and morph spike** — Humanoid rig + denser topology than Kenney minis gives workable regions for the six proportion morphs in sub-ticket **03** without commissioning a custom base first.
4. **Time** — Standard pack ships rigged `.glb` files; sub-ticket **02** is normalization (feet `y = 0`, forward **−Z**, height **1.8**, `PLAYER_RADIUS` footprint) rather than modeling from scratch.

Custom Blender remains the fallback if Quaternius Regular Male cannot be normalized into the collision cylinder or morph authoring fails; that would be a new decision note before sub-ticket **03**.

## Import pointers (sub-ticket 02)

1. Download [Universal Base Characters [Standard].zip](https://quaternius.itch.io/universal-base-characters) (free / name your price).
2. Import **Regular Male** glTF; apply `MODEL_SPIKE.md` normalization checklist.
3. Update the `player.glb` row in `game/client/public/models/CREDITS.md` (replace parked Blender row).
