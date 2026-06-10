1. Client airborne render ignores server-authoritative `entity.y` on non-default floors, so flying enemies/minions render at fixed default-floor altitude and shadows are pinned to constant `GROUND_OVERLAY_Y`.
   Files: game/client/renderer.js
   Fix: derive flying render/shadow Y from `entity.y` or from `sampleFloorY(layout, entity.x, entity.z) + altitude`, while preserving grounded entity placement; add coverage for a flying enemy/minion on a non-default floor height.
