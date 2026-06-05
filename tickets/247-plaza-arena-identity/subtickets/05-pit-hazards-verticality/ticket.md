# Shallow pit hazards and extra verticality

Add optional open-plaza verticality with shallow visual pit hazards (recessed
floor patches) and a third raised platform so the arena offers height variation
beyond flat cover boxes.

## Acceptance Criteria

- `generateLayout(seed, 'open-plaza')` returns a `hazards` array with ≥ 1
  `{ type: 'pit', x, z, width, depth, pitDepth? }` entry placed outside the
  spawn-clear zone and clear of cover footprints.
- Hazards are visual-only recesses (same contract as the `open` profile): they
  do not add colliders and do not lower `sampleFloorY`; movement stays unchanged.
- Layout includes ≥ 3 platforms (one more than today) with distinct positions;
  reachability and spawn-clear rules still hold.
- `buildDungeon` renders pit hazards via the existing hazard-pit branch (darkened
  recessed box at `floorY - pitDepth/2`).
- Existing open-plaza tests for cover reachability, determinism, and colliders
  remain green across seeds `[1, 42, 123, 777, 9999]`.
- Vitest asserts hazard count/type, platform count ≥ 3, and client pit mesh count
  matches `layout.hazards.length` for open-plaza.

## Technical Specs

- **`game/server/dungeon.js`**
  - In `generateOpenPlaza`, add a third platform at a deterministic corner
    position and append 1–2 pit hazards using the same shape as
    `placeOpenHazards` entries (`type: 'pit'`, `pitDepth: OPEN_HAZARD_RECESS`).
  - Re-run reachability checks after adding hazards (they must not block paths).
- **`game/client/dungeon.js`**
  - No new render path required if the existing `layout.hazards` pit loop is
    profile-agnostic; confirm open-plaza layouts flow through it.
- **`game/server/test/dungeon.test.js`**
  - Add cases for `hazards.length >= 1`, `platforms.length >= 3`, hazard
    outside spawn-clear, and reachability with hazards present.
- **`game/client/test/dungeon.test.js`**
  - Reuse/adapt `open profile hazards & platforms` patterns for an open-plaza
    fixture with `hazards` and three `platforms`.

## Verification: code
