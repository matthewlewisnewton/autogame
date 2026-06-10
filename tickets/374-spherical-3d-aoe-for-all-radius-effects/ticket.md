# 374-spherical-3d-aoe-for-all-radius-effects

## Difficulty: hard

## Goal

Make ALL AoE/radius effects 3D SPHERICAL instead of flat 2D. Radius checks currently use Math.hypot(dx,dz) on the XZ plane only (applyFreezeInRadius, healPlayersInRadius, and other damage/heal/effect-in-radius helpers in game/server/simulation.js), ignoring height. Convert to 3D distance (include dy) so AoE is a sphere. SYMMETRIC: both player-card AoE and enemy AoE. VERIFY ALL AoE CARDS: enumerate every AoE/radius card (frost_nova, glacier_collapse, inferno_pillar, purifying_pulse, event_horizon, gravity_well, dragons_breath, heal radius) with tests that each affects targets at different heights and excludes out-of-sphere targets. Prep for flying enemies. SCOPE: game/server/simulation.js + game/server + test.

## Verification

reconcile: orphaned in_progress on dispatcher startup
