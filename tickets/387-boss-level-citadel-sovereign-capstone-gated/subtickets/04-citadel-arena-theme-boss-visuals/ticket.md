# Citadel arena theme and Sovereign client visuals

Give the capstone its visual identity: a `citadel` arena floor theme (cosmetic
decals on the boss arena, like the rift's ice/ember bands) and a distinct
client-side body + attack telegraph for the Citadel Sovereign. Depends on
sub-tickets 01–03.

## Acceptance Criteria

- `game/server/dungeon.js`: `generateLayout(seed, 'boss-arena', { arenaTheme:
  'citadel' })` appends cosmetic citadel floor markings (e.g. concentric
  rampart rings / banner bands around the dais) to the layout, following the
  same data shape the `rift` theme uses. Cosmetic only — no change to
  collision, spawn points, or the dais anchor; output is deterministic for a
  fixed seed.
- The existing `rift` theme output is byte-for-byte unchanged
  (`game/server/test/rift_arena.test.js` passes unmodified).
- `game/server/quests.js`: the `citadel_assault` tier def gains
  `arenaTheme: 'citadel'`, and it flows through the existing pass-through
  (`getLayout` options plumbing at ~lines 1877–1885) into layout generation.
- `game/client/renderer.js`:
  - A body definition for `citadel_sovereign` with a silhouette/palette
    distinct from every other boss (e.g. tall crowned cylinder, deep-violet
    body `0x312e81`, gold emissive `0xfacc15`) alongside the
    `riftbound_colossus` entry.
  - An attack telegraph entry for `citadel_sovereign` with `style: 'radial'`
    and `range: 6` — matching the server def's `attackStyle`/`attackRange`
    exactly.
- New `game/server/test/citadel_arena.test.js` (mirror
  `rift_arena.test.js`): citadel theme decals present + deterministic with the
  theme, absent without it; quest tier declares `arenaTheme: 'citadel'` and
  the option reaches `generateLayout`.
- New `game/client/test/renderer-citadel-sovereign.test.js` (mirror
  `renderer-riftbound-colossus.test.js`): body def exists with the citadel
  palette and differs from `riftbound_colossus`'s geometry/colors; telegraph
  entry exists with radial style and range 6.
- Full test suite (`pnpm test:quick` from `game/`, server + client suites)
  passes.

## Technical Specs

- `game/server/dungeon.js`: extend the arena-theme block (comment at ~line 57,
  implementation ~lines 2427–2496) with a `'citadel'` branch parallel to the
  `'rift'` branch; keep decal records in the same array/field the rift bands
  use so the client needs no new plumbing to receive them.
- `game/server/quests.js`: one-line `arenaTheme: 'citadel'` addition on the
  `citadel_assault` tier def (the pass-through at ~1877–1885 already forwards
  any declared string).
- `game/client/renderer.js`: body defs table ~line 623, telegraph table
  ~line 648 — one entry each, same literal-object style and comment voice as
  the riftbound entries.
- Tests: copy structure from `game/server/test/rift_arena.test.js` and
  `game/client/test/renderer-riftbound-colossus.test.js`.
- If the client draws themed floor decals by reading layout data generically
  (as it does for rift bands), do NOT add bespoke client decal code — only the
  renderer body/telegraph entries are client changes.

## Verification: code
