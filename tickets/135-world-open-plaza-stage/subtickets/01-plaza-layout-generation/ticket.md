# Open-Plaza Stage Layout Generation (server)

Give `generateLayout()` a new `open-plaza` stage that produces a single large
bounded arena room instead of the rooms-and-passages grid, and wire it up so it
is selectable like the existing layout profiles. Cover pieces and slopes are
added in later sub-tickets — this one delivers the empty, fully-walled plaza
plus working spawn/enemy/objective placement.

## Acceptance Criteria

- `generateLayout(seed, 'open-plaza')` (a new profile/stage key, consistent with
  the existing `profile` string selection in `game/server/dungeon.js`) returns a
  layout with exactly **one** room (the plaza) and an empty `passages` array.
- The plaza room's floor area (`width * depth`) is **≥ 4× the max default-profile
  room area** (≥ `4 * MAX_ROOM_SIZE_INCLUSIVE^2` = 900 sq units; target ~40×40).
- The plaza is bounded by a **continuous outer wall perimeter with no passage
  gaps** (the four sides each produce full-length wall segments), so players
  cannot exit the level.
- The single room is assigned `role: 'start'` so `firstRoomPosition()` / spawn
  returns a point on the plaza floor (plaza center).
- Existing enemy-spawn and objective-placement helpers (`roomsByRole`,
  `randomRoomPositionByRole`, `randomRoomPosition`) still return valid plaza-floor
  positions on a single-room layout — i.e. the "no combat/treasure room" case
  falls back to the plaza room. Document the fallback in a code comment.
- Deterministic: calling `generateLayout(seed, 'open-plaza')` twice with the same
  seed returns deep-equal layouts.
- A new quest (or `layoutProfile`) entry makes the stage reachable end-to-end via
  the existing `getLayoutProfileForQuest()` path (e.g. a `layoutProfile:
  'open-plaza'` quest in `QUEST_DEFS`).
- Unit tests cover: single-room shape, area bound, closed (gapless) perimeter,
  spawn role assignment, and seed determinism.

## Technical Specs

- `game/server/dungeon.js`: in `generateLayout()`, branch early when the
  profile/stage key is `'open-plaza'` to a new `generateOpenPlaza(seed, opts)`
  helper that builds one centered plaza room (no grid growth, no passages). Reuse
  the existing room object shape (`{ x, z, width, depth, walls, floorCorners,
  role, ... }`) and `assignRoomRoles()`. Build the four perimeter walls with
  **no** passage gaps. Keep `floorCorners` flat (`DEFAULT_FLOOR_Y`) for now.
  Register the key in `LAYOUT_PROFILES` / the profile normalizer as needed.
- `game/server/quests.js`: add a quest def whose `layoutProfile` selects the
  open-plaza stage so `getLayoutProfileForQuest()` returns it.
- `game/server/test/dungeon.test.js`: add the unit tests described above.

## Verification: code
