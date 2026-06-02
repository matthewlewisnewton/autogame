## Add Wall-Blocked Endpoint Coverage For Phase Step

Phase Step rejects swaps when either endpoint fails `isInsideDungeon`, and normal movement should keep players off wall colliders. A focused server test would lock in the ticket’s “both endpoints valid” intent if debug tools or direct position assignment ever place a player inside a room AABB but overlapping a wall.

### Acceptance Criteria
- Add a `phase_step.test.js` case that places the caster or ally at an inside-dungeon but `isEntityPositionBlocked` position and asserts the swap is rejected with a graceful reason and no cooldown burn (if the product decision is to also check wall colliders, add that guard in `index.js` first).

## Share Phase Step Range Constant

`PHASE_STEP_RANGE` in `game/client/renderer.js` duplicates `KEY_ITEM_DEFS.phase_step.range` on the server. A small shared constant (or re-export from defs) would prevent client highlight range drifting from server authority after future tuning.

### Acceptance Criteria
- Client ally-highlight range reads from the same source of truth as server `def.range` (within normal build constraints for client/server bundles).
