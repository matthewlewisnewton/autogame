# Registry fallback resilience and acceptance tests

Lock in the parent ticket's resilience and exclusion requirements with focused
client tests. All seven enemy/minion paths should already be set from sub-tickets
02–03; this sub-ticket adds regression coverage without changing gameplay logic
unless a fallback bug is found.

## Acceptance Criteria

- `MODEL_REGISTRY.player` is `null`; `createPlayerAvatar` does not gain a model
  path (hero stays procedural for epic 181–188).
- Pointing an enemy or minion key at a non-existent path (e.g.
  `/models/__missing__.glb` in test only) leaves the procedural mesh visible
  after `loadModel` resolves `null`; no uncaught errors; game/client tests pass.
- A test (or tests) in `game/client/test/` asserts:
  - All seven entity keys have non-null registry paths matching the parent ticket
    mapping (`grunt` → `grunt.glb`, minions → `minion-*.glb`, etc.).
  - `modelPathFor` returns those paths.
- `pnpm test` from `game/` completes successfully (server + client suites).
- No new `.glb` files added; no changes to loot registry entries.

## Technical Specs

- NEW or extended `game/client/test/models-registry.test.js` (or similar):
  - Import `MODEL_REGISTRY`, `modelPathFor`, `_clearModelCache` from
    `../models.js`.
  - Assert the seven path strings; assert `player === null`.
  - Optional: mock/stub `loadModel` failure path via invalid path + dynamic import
    of `attachRegistryModel` behavior, or test `loadModel('/models/__missing__.glb')`
    resolves null without throwing.
- `game/client/models.js` — only touch if a test reveals a bug; paths should
  already be complete from 02–03.
- Do not modify `game/client/renderer.js` except for a minimal fallback fix if
  tests expose a regression.

## Verification: code
