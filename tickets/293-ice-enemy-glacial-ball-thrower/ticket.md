# 293-ice-enemy-glacial-ball-thrower

## Difficulty: medium

## Goal

New ICE ENEMY (the ice level signature foe). It lobs GIANT ICE BALLS at players (a slow-moving ranged projectile); on hit it applies the SLOW status (290) to the player (reduced move speed, temporary) and some damage. Give it enemy display metadata + a lock-on info-panel entry (per 251/252: name + stats + short description). Wire it into the ice level (292) per-level spawn pool (per the 250 spawn-pool system) as a level-exclusive/thematically-appropriate enemy. DEPENDS ON 290 (slow) + 292 (ice level).

ACCEPTANCE: ice enemy spawns in the ice level; throws ice-ball projectiles; a hit slows the player (calls applySlow) + deals damage; lock-on panel shows its name/stats/description; server tests for the projectile + slow-on-hit. SCOPE: game/server/simulation.js (enemy + projectile), game/server (spawn pool + display metadata), game/client (enemy + projectile render), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
