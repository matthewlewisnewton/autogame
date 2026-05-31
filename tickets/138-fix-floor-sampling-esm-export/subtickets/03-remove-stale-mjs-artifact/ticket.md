# Remove stale `floorSampling.mjs` artifact from round-2 experiment

Round 2 of ticket 138 experimented with converting the floorSampling source to pure ESM (`.mjs`), leaving behind `game/shared/floorSampling.mjs`. The final resolution used approach (3) from the top-level ticket — a CJS source + ESM re-export sibling — making the `.mjs` file dead code. Remove it to avoid confusion.

## Acceptance Criteria

- `game/shared/floorSampling.mjs` no longer exists.
- `game/shared/floorSampling.js` (CJS source) is **unchanged**.
- `game/shared/floorSampling.esm.js` (ESM re-export) is **unchanged**.
- No file in the repository references `floorSampling.mjs` in an import or require path.
- All tests still pass: `pnpm --filter client test && pnpm --filter server test`.

## Technical Specs

- **Delete** `game/shared/floorSampling.mjs`.
- Verify no imports reference `.mjs`: grep for `floorSampling.mjs` across `game/client/` and `game/server/` — should find zero matches.
- Run full test suite to confirm no regression.

## Verification: code
