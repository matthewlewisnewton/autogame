# 288-hub-validation-capture-walkable-3d-not-menu-overlay

## Difficulty: medium

## Goal

The hub playthrough-validation (281) captured EVERY hub/room screenshot with the 2D "Lobby Connection" menu overlay open, so the walkable 3D ship hub (Quest Board / Launch Bay / Shop are faintly visible behind the menu) was never actually shown. We cannot visually confirm the walkable hub or party-mate presence in 3D.

EVIDENCE: game/validation/hub/01-hub-overview.png and 02-room-operations.png are near-identical 2D menu captures; the menu obscures the 3D space in all of them.

FIX the hub validation driver to DISMISS/close the lobby menu (e.g. Return to Registry) and capture the actual WALKABLE 3D hub: a clean overview of the 3D space, each of the 3 rooms (operations / commerce / salon) as walkable zones with the menu closed, and the 2 party-mates visible in-world. Re-run and land corrected screenshots under game/validation/hub/ so we can assess the hubs walkable presentation (PSO-style) vs menu-dominance.

SCOPE: hub validation driver (game/validate) + game/validation/hub/** outputs. No gameplay changes.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
