# 296-fire-enemy-inflicts-burning

## Difficulty: medium

## Goal

New FIRE ENEMY (the fire level signature foe). It can LIGHT THE PLAYER ON FIRE: an attack that applies the BURNING status (291) for a short time, with the burning animation on the player. Give it enemy display metadata + lock-on info-panel entry (251/252). Wire into the fire level (295) per-level spawn pool (250) as level-exclusive. DEPENDS ON 291 (burning) + 295 (fire level).

ACCEPTANCE: fire enemy spawns in the fire level; its attack applies burning to the player (calls applyBurning) so the player takes per-tick + extra fire damage with the burning animation; lock-on panel shows name/stats/description; server tests for the burning-on-hit. SCOPE: game/server/simulation.js (enemy + attack), game/server (spawn pool + display metadata), game/client (enemy + burning render), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
