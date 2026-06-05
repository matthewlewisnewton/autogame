# Perimeter arena motif (banners and tiers)

Dress the open-plaza perimeter walls with an arena motif — tiered seating blocks
and banner poles along each wall — so the single room reads as a colosseum rather
than a bare box.

## Acceptance Criteria

- `generateLayout(seed, 'open-plaza')` returns a `perimeterDecor` array with
  ≥ 8 entries (≥ 2 per wall) of types `arena_banner` and/or `arena_tier`.
- Each decor entry is `{ type, x, z, yaw?, wall: 'north'|'south'|'east'|'west' }`,
  placed just inside the perimeter walls with a fixed inset from the wall plane.
- Decor is visual-only: no new colliders, no changes to wall gaps or arena bounds.
- `buildDungeon` renders each decor via a new `buildPerimeterDecorMesh(type, materials)`
  helper (banner = pole + accent flag plane; tier = stepped box seats) anchored at
  floor Y from `sampleFloorY`.
- Decor meshes are tracked in `meshes`; non–`open-plaza` layouts without
  `perimeterDecor` are unchanged.
- Vitest asserts decor count, allowed types, wall distribution, and client mesh
  emission per entry.

## Technical Specs

- **`game/server/dungeon.js`**
  - Add `placeOpenPlazaPerimeterDecor(half)` (deterministic positions from
    `OPEN_PLAZA.size`, no RNG needed) returning the `perimeterDecor` array.
  - Attach to the layout object in `generateOpenPlaza` after walls are defined.
- **`game/client/dungeon.js`**
  - Add `buildPerimeterDecorMesh(type, materials)` with cases for `arena_banner`
    and `arena_tier`; set `userData.decorType` on the group.
  - In `buildDungeon`, after perimeter walls, iterate `layout.perimeterDecor || []`,
    apply `lm.yaw` when present, add group children to `meshes`.
- **`game/server/test/dungeon.test.js`**
  - Assert `perimeterDecor.length >= 8`, type whitelist, and that every entry's
    `(x, z)` lies within the plaza interior margin.
- **`game/client/test/dungeon.test.js`**
  - Fixture layout with mixed decor types; assert one decor group per entry and
    accent child on banner types.

## Verification: code
