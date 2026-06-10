# 375-height-aware-projectile-aiming

## Difficulty: hard

## Goal

Make projectile aiming HEIGHT-AWARE. Projectiles aim along XZ (dirX/dirZ) and ignore Y, so they cannot hit elevated/flying targets. When firing at a LOCKED-ON target, compute direction from shooter to the target FULL 3D position (include Y) and make travel + hit-detection account for vertical offset. SYMMETRIC: player, ENEMY, and MINION projectiles (storm_eagle, null_crawler beam, wyrm breath). VERIFY ALL PROJECTILE CARDS: enumerate every projectile card (fireball, ice_ball, arcane_bolt, chain_lightning, photon projectiles, dragons_breath) with height-aiming tests. SCOPE: game/server/simulation.js + game/server/cardEffects.js + test.

## Verification

reconcile: orphaned in_progress on dispatcher startup
