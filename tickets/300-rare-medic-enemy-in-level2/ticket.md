# 300-rare-medic-enemy-in-level2

## Difficulty: hard

## Goal

New RARE MEDIC ENEMY that spawns (rarely) in SOME level-2 stages. Behavior/AI: it AVOIDS players (flees / keeps distance) and prioritizes HEALING other enemies (an ally-heal ability restoring enemy HP); when a player gets too close it defends by shooting a small BEAD OF ENERGY (a weak ranged attack) at the player. It does not chase — it kites away and heals allies. Rare spawn weight, level-2 only. Give it display metadata + lock-on info-panel entry (251/252). DEPENDS ON nothing new (level-2 system 253-257 + spawn pools 250 already shipped).

ACCEPTANCE: medic enemy appears rarely in eligible level-2 stages; flees from nearby players; heals nearby wounded enemies on a cooldown; fires a small energy-bead attack when a player is within close range; lock-on panel shows name/stats/description; server tests for the flee + ally-heal + close-range-attack behaviors. SCOPE: game/server/simulation.js (enemy AI) + game/server (spawn weighting + display metadata) + game/client (enemy + heal/energy render) + game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
