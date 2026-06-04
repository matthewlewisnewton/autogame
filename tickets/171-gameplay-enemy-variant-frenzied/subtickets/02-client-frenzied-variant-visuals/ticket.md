# Client: Frenzied variant tint and badge

Give Frenzied enemies a distinct look on top of the generic variant badge from ticket 169: a per-variant badge color and a subtle emissive mesh tint when `enemy.variant === 'frenzied'`. Add a debug scenario that spawns a Frenzied grunt beside a plain grunt for side-by-side comparison.

## Acceptance Criteria

- When `enemy.variant === 'frenzied'`, the floating variant badge uses a red/orange color distinct from the default magenta badge and from the leeching teal badge.
- When `enemy.variant === 'frenzied'`, the enemy mesh receives a distinguishing emissive tint via the existing `_origEmissive` / `_origEmissiveIntensity` bookkeeping (no stale tint after variant clears or enemy disposal).
- Non-frenzied enemies (including `variant: null`, `variant: 'test'`, and `variant: 'leeching'`) keep today's appearance for mesh and badge color.
- `?debugScenario=variant-frenzied` (registered in the server debug-scenario allowlist) spawns one Frenzied-tagged grunt and one plain grunt near the player in an active dungeon, mirroring the `variant-enemy` / `variant-leeching` pattern. The Frenzied grunt is spawned below 50% HP so its server speed boost is active during manual QA.
- Existing client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/renderer.js`: add `frenzied` entries to `VARIANT_BADGE_COLORS` and `VARIANT_MESH_TINTS` (colors distinct from `default` and `leeching`). Existing `variantBadgeColor`, `applyVariantMarker`, and `applyVariantEmissiveTint` should pick them up without one-off branches.
- `game/server/debugScenarios.js`: add a `variant-frenzied` branch that sets `enemy.variant = 'frenzied'` on one spawned grunt, sets its `hp` below half of `maxHp`, and leaves the other grunt untagged.
- `game/server/index.js`: add `'variant-frenzied'` to the debug-scenario allowlists alongside `'variant-enemy'` and `'variant-leeching'`.
- Optional: extend `game/server/test/debug-scenarios.test.js` if the project already asserts debug scenario wiring for variant scenarios.

## Verification: code
