# Document CJS eval-bridge constraints in floorSampling.js

The `floorSampling.js` wrapper strips `export` keywords and `eval`-s the ESM source synchronously. Adding top-level `import` statements or non-trivial ESM syntax to `floorSampling.esm.js` would break the server `require()` without updating the bridge. This limitation is currently undocumented.

## Acceptance Criteria

- `game/shared/floorSampling.js` contains a comment near the top listing the ESM patterns the bridge supports (plain `export function`, `export const`/`let`/`var`) and explicitly stating that top-level `import` is unsupported unless the bridge is updated.
- `game/docs/design.md` Floor Geometry subsection gets a one-line note pointing maintainers at `floorSampling.esm.js` as the canonical source.

## Technical Specs

- **File to change:** `game/shared/floorSampling.js` — add a 3–4 line comment block after the existing header, before the `require('fs')` call.
- **File to change:** `game/docs/design.md` — append one sentence to the Floor Geometry paragraph (e.g. "Floor sampling logic lives in `shared/floorSampling.esm.js`; see `shared/floorSampling.js` for the CJS eval-bridge.").

## Verification: code
