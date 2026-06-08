# 318-creature-minion-summon-and-attack-animations

## Difficulty: medium

## Goal

Per-card CREATURE/MINION animations (polish). Give summoned creatures/minions a SUMMON-IN animation and distinct ATTACK visuals using 315 primitives: Vault Wyrm (dungeon_drake), the wyrm fire-breath, storm_eagle/thunderbird (lightning), null_crawler (phase beam), undead_commander (+skeletons), plus the rare medic enemy heal/energy-bead VFX. Each should have a recognizable spawn flourish + attack effect. DEPENDS ON 315. ACCEPTANCE: minions get a summon-in animation + distinct attack VFX; no perf regression; tests where feasible. SCOPE: game/client/cardRenderers.js + game/client (minion render) + game/client/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
