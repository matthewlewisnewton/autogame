# Model loader module + static `/models` serving

Add the additive plumbing for glTF model loading without touching any rendering
code: a new `models.js` module exposing a cached `loadModel(path)` helper and an
all-empty `MODEL_REGISTRY`, vite configured to serve `public/` statically, and a
committed empty `public/models/` directory. No entity visuals change.

## Acceptance Criteria

- `game/client/models.js` exists and exports:
  - `MODEL_REGISTRY` — an object mapping entity keys (`player`, each enemy type,
    each minion type, and loot types) to a model path; EVERY value is `null` (or
    empty) in this ticket.
  - `loadModel(path)` — an async function that imports/uses Three.js
    `GLTFLoader`, fetches+parses a `.glb` at most once per path (cached by path),
    and resolves to a fresh `clone()` of the loaded scene/group on each call so
    callers never share one instance.
  - A helper to look up a registry path by entity key (e.g.
    `modelPathFor(key)`), returning the path or `null`/`undefined` when absent.
- `loadModel` is resilient: a missing/broken/unparseable path logs a warning and
  resolves to `null` (or rejects in a way the caller can catch) — it never throws
  uncaught or leaves a hung promise. A second call for a failed path does not spam
  re-fetches indefinitely / does not crash.
- `GLTFLoader` is imported from the installed `three` examples path
  (`three/examples/jsm/loaders/GLTFLoader.js`).
- `game/client/vite.config.js` explicitly sets `publicDir` (e.g. `'public'`) so
  files under `public/` are served at the web root, while preserving the existing
  `server.port`, `strictPort`, and `/socket.io` + `/api` proxy config unchanged.
- `game/client/public/models/.gitkeep` exists so the served `models/` directory
  is committed and empty.
- No `.glb` files are added. `renderer.js` and all entity visuals are unchanged
  in this sub-ticket.
- Existing server + client unit tests still pass; the client still builds/loads.

## Technical Specs

- NEW `game/client/models.js`:
  - `import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';`
  - Module-level `Map` cache keyed by path holding the in-flight/resolved load
    promise (so concurrent callers share one fetch).
  - `loadModel(path)`: returns the cached promise if present; otherwise creates a
    `new GLTFLoader()` and wraps `loader.load(path, onLoad, undefined, onError)`
    in a promise. On success cache the parsed `gltf.scene`; each `loadModel`
    caller resolves to `.clone(true)` of it. On error: `console.warn(...)` and
    resolve to `null` (cache the failure so it isn't retried forever).
  - `MODEL_REGISTRY`: object with keys for `player`, every enemy type, every
    minion type, and the loot types, all mapped to `null`. Derive the enemy /
    minion / loot key sets from how `renderer.js` already keys
    `createEnemyMesh(type)` / `createMinionMesh(minionType)` / loot meshes (read
    `ENEMY_GEOMETRY`, minion type handling, and `createLootMesh`) so keys match.
  - `modelPathFor(key)`: returns `MODEL_REGISTRY[key] ?? null`.
- `game/client/vite.config.js`: add `publicDir: 'public'` to the exported config
  object; do not alter the existing `server`/`proxy` block.
- NEW empty file `game/client/public/models/.gitkeep`.

Do NOT modify `renderer.js` or add any `.glb` assets in this sub-ticket.

## Verification: code
