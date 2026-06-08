# 316-distinct-weapon-card-animations

## Difficulty: medium

## Goal

Per-card WEAPON animations (polish). Most melee weapons currently share renderConeSwings (a generic cone flash). Give each weapon a DISTINCT swing/slash visual using the 315 primitives: unique slash arc shape/color/trail per weapon (Rust-Forged Saber, Solar Edge, Alloy Greatblade, Corebreaker Greatsword, Saber of Light, Excalibur Photon, Photon Slicer, Infinite Disk, Arcane Bolt, Phase Echo, Resonance Edge, Ether Scythe), and tie the heavy wind-up weapons (Solar Edge, Corebreaker, Excalibur) to the 315 charge-up telegraph so they feel like big committed hits. DEPENDS ON 315. ACCEPTANCE: each weapon has a visually distinct swing/impact; wind-up weapons show the charge telegraph; no perf regression; tests where feasible. SCOPE: game/client/cardRenderers.js (weapon render fns) + game/client/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
