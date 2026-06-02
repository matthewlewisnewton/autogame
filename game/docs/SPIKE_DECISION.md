# Character base model — spike decision record

**Ticket:** 185 (sub-ticket 01) · **Status:** chosen path for sub-tickets 02–03 and tickets 186–191.

This document is the canonical in-repo decision record. Do not duplicate it under `tickets/`.

## Candidates compared

| Source | License | Approx. tris (base body) | Rig / morph fit | Notes |
|--------|---------|--------------------------|-----------------|-------|
| **[Quaternius — Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)** | **CC0** | ~13k per full character (pack average; base mesh before hairstyles) | Humanoid rig, mix-and-match hairstyles, animation-friendly topology; `.blend` in Source tier | Already on the project allow-list (`CREDITS.md`); same author as enemy placeholders (Ultimate Monsters). Six proportion variants (Superhero / Regular / Teen × M/F) give a visual baseline for morph authoring. |
| **[Kenney — Animated Characters 3](https://kenney-assets.itch.io/animated-characters-3)** | **CC0** | Low-poly blocky (~2–4k class) | Single rigged mesh + 4 skins; idle/jump/run only | CC0 and tiny, but one shared silhouette—no separate body-proportion bases. Adding six custom shape keys would mean heavy Blender rework on a pack not designed for body morphs. |
| **Authored in Blender (original)** | Project-owned | Budget ~3–8k for spike (target after decimation) | Full control over feet-at-origin, −Z forward, morph keys | Highest alignment with `MODEL_SPIKE.md`, but blocks 02–03 on modeling/rigging time; no reuse of existing Quaternius pipeline used for enemies. |

Sketchfab CC0/CC-BY humanoids were considered and rejected for the spike default: license verification and per-model normalization cost outweigh a pack with a known CC0 license and consistent scale/rig already used elsewhere in the repo.

## Final choice

**Use Quaternius Universal Base Characters (Standard download), “Regular” male or female base mesh** as the starting `.fbx`/`.glb` for `game/client/public/models/player.glb`.

- **Pack URL:** https://quaternius.com/packs/universalbasecharacters.html  
- **Mirror:** https://quaternius.itch.io/universal-base-characters  
- **License:** CC0 (public domain) — no attribution required; record source in `CREDITS.md` anyway.  
- **Approximate triangle count:** ~13k for the imported character as shipped (before optional decimation in Blender); spike target after cleanup: **≤ 8k** tris for the committed base if needed for mobile headroom, documented in the `player.glb` row when 02 lands.  
- **Variant for 02:** pick one **Regular** proportion body (male or female—either is fine; stay consistent in `CREDITS.md`).

## Rationale

1. **License and policy:** CC0 matches `game/client/public/models/CREDITS.md` (redistributable, no commercial-game rip risk).  
2. **Consistency:** Enemies already use Quaternius CC0 assets; artists and tooling expectations align.  
3. **Rig and scale:** Humanoid rig with standard bone names (`Head`, etc.) supports hat attachment (ticket 190) and future animation retargeting without inventing a skeleton.  
4. **Morph workflow:** Blender shape keys on a single normalized base (sub-ticket 03) are easier than retopologizing Kenney’s single shared mesh or building a humanoid from scratch for this spike.  
5. **Cost:** Free Standard pack is sufficient; Source tier optional if we need the `.blend` with shader graphs later.

## Normalization (handoff to sub-ticket 02)

Import one Regular base, then in Blender before export:

- Apply scale so **standing height = 1.8** world units (bounding box Y).  
- **Feet at `y = 0`**, origin centered on XZ at floor contact.  
- **Forward = −Z** (see `MODEL_SPIKE.md` and renderer `rotation.y = playerRotation − π/2`).  
- Fit **collision cylinder** `PLAYER_RADIUS = 0.5` at mid-torso (T-pose arms may extend past 0.5 m horizontally at wrists/ankles—note in README if so).

Do **not** wire `player.glb` into the runtime registry in 02; ticket 187 owns renderer integration.
