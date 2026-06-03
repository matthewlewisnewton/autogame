# Consolidate duplicate flare_beacon server tests

`game/server/test/flare_beacon.test.js` largely duplicates the `useKeyItem — flare_beacon` block already in `game/server/test/key-items.test.js`, spinning up a redundant socket server suite (~30s per CI run). Remove the duplicate file while preserving full assertion coverage in one place.

## Acceptance Criteria

- `game/server/test/flare_beacon.test.js` is deleted.
- `game/server/test/key-items.test.js` retains a single `describe('useKeyItem — flare_beacon')` block covering: definition parameters, in-radius reveal, out-of-radius skip, dead-enemy skip, cooldown enforcement, `keyItemUsed` response fields, `stateUpdate` snapshot with `revealedUntil`, multi-enemy reveal, and radius-boundary reveal.
- No flare_beacon behavior assertions are dropped compared to the union of the two former files (diff the deleted file against the surviving block before removing).
- `pnpm test:quick` (or `pnpm test` scoped to server tests) passes with no failures.

## Technical Specs

- **Delete**: `game/server/test/flare_beacon.test.js`.
- **Keep / audit**: `game/server/test/key-items.test.js` — `describe('useKeyItem — flare_beacon')` block (~lines 527–801). This block is already a superset; merge any uniquely named helper or assertion from the deleted file only if something would otherwise be lost.
- **Do not change** production code under `game/server/index.js`, `game/server/simulation.js`, or `game/server/progression.js` — test consolidation only.
- Before deleting, map each `it(...)` in `flare_beacon.test.js` to an equivalent test in `key-items.test.js`; add a missing case to `key-items.test.js` only when no equivalent exists.

## Verification: code
