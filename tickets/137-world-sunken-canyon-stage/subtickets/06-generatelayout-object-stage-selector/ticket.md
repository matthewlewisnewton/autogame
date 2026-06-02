# Server: `generateLayout({ stage: "sunken-canyon" })` selector

The Sunken Canyon layout already works via `generateLayout(seed, 'sunken-canyon')`, but the
top-level ticket requires the object stage selector form. Teach `generateLayout` to accept
`{ stage: "sunken-canyon" }` as its first argument (with an optional `seed`) and route to the
existing `generateSunkenCanyon` path without breaking the `(seed, profile, options)` signature.

## Acceptance Criteria

- `generateLayout({ stage: "sunken-canyon" })` returns the same sunken-canyon layout shape as
  `generateLayout(seed, 'sunken-canyon')` when called with the same effective seed (use a
  documented default seed when `seed` is omitted, e.g. `questLayoutSeed('sunken-canyon')`).
- Returned layout has `profile: 'sunken-canyon'` and a populated `stageMeta` with
  `plateauRoomIndex`, `canyonRoomIndex`, and `rampRoomIndices`.
- `generateLayout({ stage: "sunken-canyon", seed: 42 })` is equivalent to
  `generateLayout(42, 'sunken-canyon')` (deep-equal layout).
- Existing call sites remain valid: `generateLayout(seed)`, `generateLayout(seed, profile)`,
  `generateLayout(seed, profile, options)`, and `generateLayout(seed, 'sunken-canyon')` behave
  unchanged (no regressions in `dungeon.test.js`).
- A dedicated unit test asserts the object selector for the exact ticket API string
  `"sunken-canyon"` (not only the legacy string-profile path).

## Technical Specs

- `game/server/dungeon.js`:
  - At the top of `generateLayout`, detect when the first argument is a non-array object with a
    `stage` string property. Map `stage: 'sunken-canyon'` to the existing `generateSunkenCanyon`
    branch (same result as `profile === 'sunken-canyon'`).
  - Resolve seed as `opts.seed` when provided; otherwise use a stable default derived from the
    stage id (reuse or mirror `questLayoutSeed` so omitted-seed calls are deterministic).
  - Forward optional `opts.options` (e.g. `{ slopes: true }`) to the inner path only if the
    sunken-canyon generator honors options today; otherwise ignore options for this stage but do
    not throw.
  - Update the JSDoc on `generateLayout` to document both calling conventions.
  - Do **not** change `generateSunkenCanyon` geometry, ramp counts, or `stageMeta` semantics —
    only the public selector wiring.
- `game/server/test/dungeon.test.js`:
  - Add a small `describe('generateLayout({ stage: "sunken-canyon" })')` block with tests for:
    (1) profile and `stageMeta` present, (2) parity with `generateLayout(seed, 'sunken-canyon')`
    for an explicit seed, (3) determinism when seed is omitted.

## Verification: code
