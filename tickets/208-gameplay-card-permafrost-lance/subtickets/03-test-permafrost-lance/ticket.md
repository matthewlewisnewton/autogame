# 03-test-permafrost-lance

Add unit tests verifying the `permafrost_lance` card definition exists with correct stats and that the freeze effect routes through the frost_nova branch.

## Acceptance Criteria

- A test confirms `CARD_DEFS.permafrost_lance` exists and has the expected properties:
  - `magicStoneCost === 30`
  - `damage === 8`
  - `radius === 6`
  - `freezeDurationMs === 2000`
  - `effect === 'frost_nova'`
  - `type === 'spell'`
- A test confirms `permafrost_lance` is in `SHOP_CARD_POOL` (i.e., the card is obtainable).
- Full vitest suite passes green (`pnpm test` or `pnpm test:quick`).

## Technical Specs

- **File:** Add tests to the existing progression test file (search `game/server/__tests__/` or `game/server/test/` for the progression test module). If no progression test file exists, create one at `game/server/__tests__/progression.test.js` following the project's vitest patterns.
- Test structure: `describe('permafrost_lance', ...)` with `it()` blocks for def properties and shop pool membership.

## Verification: code
