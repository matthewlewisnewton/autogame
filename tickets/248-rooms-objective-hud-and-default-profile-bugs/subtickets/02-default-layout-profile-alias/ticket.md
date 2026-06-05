# `'default'` layout profile resolves to DEFAULT_LAYOUT_PROFILE

The string profile `'default'` is used in client tests (`generateLayout(42, 'default')`) but is missing from `LAYOUT_PROFILES`. `normalizeLayoutProfile('default')` therefore falls through to `LAYOUT_PROFILES.crowded`, so the real `DEFAULT_LAYOUT_PROFILE` tuning (e.g. `cellSpacing: 20`, `targetRoomFraction: 0.6`) is unreachable while `layout.profile` is still labeled `'default'`.

## Acceptance Criteria

- `normalizeLayoutProfile('default')` returns params matching `DEFAULT_LAYOUT_PROFILE` (not the crowded overrides such as `cellSpacing: 18`).
- `generateLayout(42, 'default')` sets `layout.profile` to `'default'`.
- For the same seed, `generateLayout(42, 'default')` produces a different layout than `generateLayout(42, 'crowded')` (e.g. different `cellSpacing` on the returned layout object and/or different room geometry).
- Passing `DEFAULT_LAYOUT_PROFILE` as an object to `generateLayout` continues to work unchanged.
- A vitest in `game/server/test/dungeon.test.js` (under the existing `layout profiles` describe) covers the `'default'` string alias.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`**:
  - Add a `'default'` entry to `LAYOUT_PROFILES` that spreads `DEFAULT_LAYOUT_PROFILE` with no crowded/open overrides (preferred), **or** special-case `profile === 'default'` inside `normalizeLayoutProfile()` before the crowded fallback.
  - Ensure `generateLayout()`'s `profileName` assignment (~lines 437–439) resolves to `'default'` when that string is passed (adding the `LAYOUT_PROFILES` entry satisfies this).
  - Do **not** apply `decorateCrowdedLayout` for the `'default'` profile (only `'crowded'` should trigger it).
  - Export `normalizeLayoutProfile` if the new test needs direct access (already exported at module bottom).
- **`game/server/test/dungeon.test.js`** — in `describe('layout profiles')`:
  - Assert `normalizeLayoutProfile('default').cellSpacing` equals `DEFAULT_LAYOUT_PROFILE.cellSpacing` (20) and not `LAYOUT_PROFILES.crowded.cellSpacing` (18).
  - Assert `generateLayout(42, 'default').profile === 'default'`.
  - Assert `generateLayout(42, 'default').cellSpacing !== generateLayout(42, 'crowded').cellSpacing` (or equivalent geometry diff).

## Verification: code
