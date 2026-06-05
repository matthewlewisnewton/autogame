# Canyon band floor materials (plateau vs floor)

Give the sunken-canyon stage a dedicated green/grey palette aligned with the open-plaza
look, and tint room floors by vertical band so the high plateau reads separately from the
sunken canyon floor and ramp connectors.

## Acceptance Criteria

- `game/shared/dungeonTheme.json` defines a `sunken-canyon` profile (and an `open-plaza`
  profile if missing) using muted green/grey tones in the same family as the plaza playtest
  palette — not the sandy `open` grid or dark `crowded` metal palettes.
- When `layout.profile === 'sunken-canyon'`, `buildDungeon` assigns **band-specific floor
  materials**: `band: 'plateau'` rooms use the plateau tint, `band: 'canyon'` rooms use a
  visibly different canyon-floor tint, and `band: 'ramp'` rooms interpolate between high
  and low band colors along the descent.
- Canyon and plateau floor hex colors differ by a measurable margin (tests assert
  `getHex()` differs); ramps differ from both band extremes when connecting plateau to
  canyon.
- Walls continue to use the sunken-canyon profile wall material on all bands; role tints
  (start/treasure) remain subtle overlays on the active band base.
- Non–`sunken-canyon` layouts render unchanged (same materials as before this ticket).

## Technical Specs

- **`game/shared/dungeonTheme.json`**
  - Add `open-plaza` and `sunken-canyon` entries: floor/wall/passage hex colors and
    roughness. Canyon floor should be darker/cooler or more saturated than plateau while
    staying in the green/grey family (e.g. plateau `#4a5f4a`, canyon `#2f3d35`).
- **`game/client/dungeon.js`**
  - Add `getSunkenCanyonBandMaterials(band, yT)` (cached singletons) lerping plateau ↔
    canyon hues from the profile theme entry.
  - In the `buildDungeon` room loop, when `layout.profile === 'sunken-canyon'`, pick
    floor material from `room.band` (fallback to profile default if absent).
  - Export color getters for tests (`getSunkenCanyonBandFloorHex` or via material cache).
- **`game/client/test/dungeon.test.js`**
  - Extend the `sunken-canyon` describe block: fixture with plateau + ramp + canyon rooms
    asserts three distinct floor material colors; server-generated layout (`seed 42`)
    shows canyon ≠ plateau on treasure vs start rooms.

## Verification: code
