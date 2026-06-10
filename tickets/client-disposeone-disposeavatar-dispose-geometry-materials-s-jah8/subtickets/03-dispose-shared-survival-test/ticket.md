# Regression test: shared glTF resources survive disposeOne

## Description

Add focused vitest coverage that reproduces the original bug: disposing one modeled entity must not call `.dispose()` on geometry/material still owned by the model cache or referenced by another live instance. This locks in sub-tickets 01–02 and satisfies the parent ticket's explicit test requirement.

## Acceptance Criteria

- New test file exercises `disposeOne` on a modeled enemy host after async `attachRegistryModel` resolves: shared body `geometry.dispose` and `material.dispose` are **not** invoked (use spies on the shared resource objects).
- The same test (or a sibling case) keeps a second live enemy mesh of the same type after the first is disposed; the survivor's glTF subtree still references the same shared geometry/material instances and those resources remain undisposed.
- A `disposeAvatar` case disposes one player avatar while a separately loaded model clone of the same path remains valid — shared geometry is not disposed; the avatar's cloned body material (from `retargetPlayerBodyMesh`) **is** disposed.
- `pnpm test:quick` (or `pnpm test` from `game/`) passes with the new tests included.

## Technical Specs

- **`game/client/test/model-dispose.test.js`** (new)
  - Mock `GLTFLoader` and reuse fake scene helpers from `models-registry.test.js` (or extract a tiny shared test fixture if duplication is large).
  - Flow for `disposeOne`: `createEnemyMesh('grunt')` × 2 → `await vi.waitFor` model attach → spy `dispose` on shared geometry/material → `disposeOne(enemiesMap, id, scene)` on one → assert spies not called and survivor mesh still references shared resources.
  - Flow for `disposeAvatar`: `createPlayerAvatar` → wait for glTF → record shared geometry ref + cloned body material ref → `disposeAvatar(avatar)` → assert shared geometry undisposed, cloned material disposed.
  - Import `disposeOne`, `disposeAvatar`, `createEnemyMesh`, `createPlayerAvatar` from `renderer.js`; clear model cache in `beforeEach`.
- No production code changes unless a test-only export is strictly required (prefer existing public exports).

## Verification: code
