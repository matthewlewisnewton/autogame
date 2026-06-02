# glTF loadModel helper with cache and resilient errors

Add a new `game/client/models.js` module that imports Three.js `GLTFLoader` and exposes a cached async `loadModel(path)` helper. Each caller gets a fresh clone of the parsed scene; failed or missing assets must warn and resolve to `null` without throwing.

## Acceptance Criteria

- `game/client/models.js` exists and exports `loadModel(path)`.
- `GLTFLoader` is imported from `three/addons/loaders/GLTFLoader.js`.
- The first request for a given path fetches/parses once; subsequent calls reuse the cached template and return independent clones (not the same object reference).
- A missing URL, network failure, or invalid glTF logs a `console.warn` and resolves to `null` — no uncaught promise rejection and no thrown error into the render loop.
- `cd game && pnpm test:quick` still passes (no renderer wiring yet in this sub-ticket).

## Technical Specs

- **Create** `game/client/models.js`:
  - Module-level `Map` cache: path → parsed `gltf.scene` (or equivalent root `Object3D`).
  - `loadModel(path)` returns `Promise<Object3D | null>`.
  - Use `gltf.scene.clone(true)` (or `SkeletonUtils.clone` if needed) so materials/geometries are not shared across instances.
  - Wrap loader errors in try/catch or `.catch`; log `console.warn('[models] failed to load', path, err)` and return `null`.
- **Optional (recommended):** add a focused unit test under `game/client/test/` that mocks fetch/loader or uses a tiny inline data URL to assert cache-hit behavior and null-on-failure — only if it fits existing vitest patterns without pulling in renderer code.

## Verification: code
