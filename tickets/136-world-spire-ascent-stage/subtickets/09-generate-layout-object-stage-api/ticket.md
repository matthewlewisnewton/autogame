# Generate Layout Object Stage API

Support the parent ticket's documented call shape `generateLayout({ stage: "spire-ascent" })` as a first-argument options object, while preserving existing `generateLayout(seed)`, `generateLayout(seed, profile)`, and `generateLayout(seed, profile, { stage })` signatures.

## Acceptance Criteria

- `generateLayout({ stage: 'spire-ascent' })` returns a spire-ascent layout with `layout.stage === 'spire-ascent'`, 3–5 tiers, and ramp passages — not the default grid layout.
- `generateLayout({ stage: 'spire-ascent', seed: 777 })` (if supported) is deterministic and matches `generateLayout(777, DEFAULT_LAYOUT_PROFILE, { stage: 'spire-ascent' })` for the same structural fields (`rooms`, `passages`, `stage`).
- Existing calls remain unchanged: `generateLayout(42)`, `generateLayout(42, 'crowded')`, and `generateLayout(42, 'crowded', { stage: 'spire-ascent' })` still work and behave as today.
- A unit test in `game/server/test/dungeon.test.js` explicitly covers `generateLayout({ stage: 'spire-ascent' })` and asserts it differs from `generateLayout(42)` (spire has `stage`, fewer tier rooms than grid, monotonic tier Y).
- All spire-ascent acceptance tests under the existing `describe('generateLayout spire-ascent stage')` block still pass.

## Technical Specs

- **Files:** `game/server/dungeon.js` (`generateLayout` entry), `game/server/test/dungeon.test.js`.
- **Detection:** At the top of `generateLayout`, if the first argument is a non-null object with `stage === 'spire-ascent'` (and not a boxed Number), treat it as options: read optional `seed` (default e.g. `42` or `Date.now()` — pick one default and document in test), optional `profile` (default `DEFAULT_LAYOUT_PROFILE`), then delegate to `generateSpireAscentLayout`.
- **Guard:** Do not break `generateLayout(42)` — numbers must still be seeds, not options objects.
- **Exports:** No API surface change beyond `generateLayout` overload behavior.

## Verification: code
