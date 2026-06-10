# 376-airborne-flying-entity-support

## Difficulty: hard

## Goal

Add AIRBORNE/FLYING entity support. Today entity Y is always floor height (player.y=resolveFloorY(sampleFloorY(layout,x,z))) so nothing can fly. Add an independent altitude Y + flying flag; movement, positioning, ground-snapping, targeting, and client render must handle airborne entities (do not snap fliers to floor; render at altitude with a ground shadow). SYMMETRIC and GENERAL: must serve flying ENEMIES and flying MINIONS now and be reusable by a future PLAYER fly/hover card (do not hard-code to enemies). SCOPE: game/server/simulation.js + game/client (airborne render + shadow) + test.

## Verification

reconcile: orphaned in_progress on dispatcher startup
