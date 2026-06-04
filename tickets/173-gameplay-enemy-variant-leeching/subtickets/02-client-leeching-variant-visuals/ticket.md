# Client: Leeching variant tint and badge

Give Leeching enemies a distinct look on top of the generic variant badge from ticket 169: a per-variant badge color and a subtle emissive tint on the enemy mesh when `enemy.variant === 'leeching'`. Add a debug scenario that spawns a Leeching grunt beside a normal grunt for side-by-side comparison in the running game.

## Acceptance Criteria

- When `enemy.variant === 'leeching'`, the floating variant badge uses a green/teal color distinct from the default magenta used for other variants (e.g. `test`).
- When `enemy.variant === 'leeching'`, the enemy mesh receives a distinguishing emissive tint that is applied and reverted via the existing `_origEmissive` / `_origEmissiveIntensity` bookkeeping (no stale tint after variant clears or enemy disposal).
- Non-leeching enemies (including `variant: null` and `variant: 'test'`) keep today's appearance for mesh and badge color.
- `?debugScenario=variant-leeching` (registered in the server debug-scenario allowlist) spawns one Leeching-tagged grunt and one plain grunt near the player in an active dungeon, mirroring the `variant-enemy` pattern.
- Existing client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/renderer.js`: introduce a small map of variant id → badge color (and optional mesh tint color). Update `createVariantMarker` / `applyVariantMarker` to accept or resolve color from `enemy.variant`. In the per-enemy update loop (near the existing `applyVariantMarker` call ~4244), branch on `enemy.variant === 'leeching'` to apply/revert mesh emissive tint using the same pattern as `applyWindupFlash` / reveal highlights.
- `game/server/debugScenarios.js`: add a `variant-leeching` branch that sets `enemy.variant = 'leeching'` on one spawned grunt and leaves the other untagged.
- `game/server/index.js`: add `'variant-leeching'` to the debug-scenario allowlists alongside `'variant-enemy'`.
- Optional: `game/client/test/renderer.test.js` (or existing client test module) asserting the leeching color constant is wired — only if the project already tests renderer helpers.

## Verification: code
