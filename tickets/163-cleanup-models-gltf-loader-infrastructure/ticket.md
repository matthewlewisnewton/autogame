# Cleanup nits from 161-models-gltf-loader-infrastructure

> **Staleness note.** This follow-up ticket was written against commit
> `8ddc17f` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `161-models-gltf-loader-infrastructure`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Dispose group-placeholder children when swapping in a glTF model

`swapPlaceholderWithRegistryModel` in `game/client/renderer.js` disposes the
placeholder's own `geometry`/`material`, but when the placeholder is a `Group`
(e.g. the `magic_stone` loot, which has a ring child mesh) it only `remove()`s
the children without disposing their geometries/materials. This is dormant today
because the registry is all-null and no swap ever runs, but once a model is wired
for a group-based entity it would leak GPU resources on every spawn.

### Acceptance Criteria
- When `swapPlaceholderWithRegistryModel` removes existing children of a
  placeholder, it disposes each removed child's geometry and material(s)
  (traversing nested meshes), not just the placeholder's top-level geometry/material.
- A unit test covers a group placeholder being swapped and asserts the child
  mesh's geometry/material `dispose` is called.
