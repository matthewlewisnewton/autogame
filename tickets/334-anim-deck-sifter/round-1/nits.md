## Remove duplicate CARD_DEFS import in renderer test

`game/client/test/cardRenderers.test.js` imports `CARD_DEFS` from `../cards.js` twice (lines 2 and 9). ESM dedups the binding so the suite passes today, but the redundant import is confusing and a hazard for future edits.

### Acceptance Criteria
- `game/client/test/cardRenderers.test.js` imports `CARD_DEFS` exactly once.
- `npx vitest run client/test/cardRenderers.test.js` still passes.
