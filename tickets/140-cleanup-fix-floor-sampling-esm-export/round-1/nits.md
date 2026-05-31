## Update stale floorSampling.esm.js header comments

The file header still says the ESM module “mirrors” the CJS file and must be “kept in sync” manually. After ticket 140, CJS is a thin loader of this file — the comments are misleading and could cause a future contributor to re-duplicate logic.

### Acceptance Criteria

- `game/shared/floorSampling.esm.js` top-of-file comment states it is the canonical implementation and that `floorSampling.js` loads this file at require time.
- No comment suggests maintaining two parallel copies of `sampleFloorY`.

## Document CJS eval-bridge constraints

The `floorSampling.js` wrapper strips `export` keywords and evaluates the ESM text synchronously. Adding top-level `import` or non-trivial ESM syntax to `floorSampling.esm.js` would break server `require()` without code changes to the bridge.

### Acceptance Criteria

- `game/shared/floorSampling.js` includes a brief comment listing supported ESM patterns (plain `export function` / `export const`) and that top-level imports are unsupported unless the bridge is updated.
- Optional: a one-line note in `game/docs/design.md` Floor Geometry subsection pointing maintainers at the canonical `.esm.js` file.
