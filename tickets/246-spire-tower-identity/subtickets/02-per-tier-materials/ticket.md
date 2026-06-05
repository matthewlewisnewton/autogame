# Per-tier tint and materials (spire-ascent)

Give each spire-ascent tier a distinct floor (and matching wall) tint derived from
the existing dungeon slate palette so ascent progress is readable without introducing
a new art pack.

## Acceptance Criteria

- When `layout.profile === 'spire-ascent'`, `buildDungeon` assigns **tier-specific
  floor materials** to tier rooms (`band: 'tier'`) based on `tierIndex` (0 = base,
  highest = lightest/summit tone). Ramp rooms (`band: 'ramp'`) use a material
  interpolated between the two tiers they connect.
- Tier tints reuse hues from the generic dungeon materials (`floorMaterial`,
  `wallMaterial`, `passageFloorMaterial`) — progressively lighter or cooler toward
  the summit; no flat single-color spire.
- Walls on spire-ascent tiers use a tier-matched wall tint (not the global default
  for every tier).
- Non–`spire-ascent` layouts render exactly as before (same shared materials).
- Client unit tests in `game/client/test/dungeon.test.js` assert at least two
  different floor material colors across tiers for a multi-tier spire fixture and
  that ramp floors differ from both adjacent tier extremes when slopes connect
  distinct indices.

## Technical Specs

- **`game/client/dungeon.js`**
  - Add `getSpireAscentTierMaterials(tierIndex, tierCount)` (or similar) returning
    cached `MeshStandardMaterial` instances tinted from the base palette.
  - In the room loop inside `buildDungeon`, when `layout.profile === 'spire-ascent'`:
    - Tier rooms: pick floor/wall mats from `room.tierIndex`.
    - Ramp rooms: derive index from adjacent tier Y or store `fromTierIndex` /
      `toTierIndex` on ramp rooms if needed; otherwise infer from `floorCorners` Y.
  - Keep materials module-level singletons (no per-frame allocation).
- **`game/client/test/dungeon.test.js`**
  - Extend the `spire-ascent` describe block with a fixture of ≥3 tiers and assert
    `mesh.material.color.getHex()` differs between bottom and top tier floors.

## Verification: code
