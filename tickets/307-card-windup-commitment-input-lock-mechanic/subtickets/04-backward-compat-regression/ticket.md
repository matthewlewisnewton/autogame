# Backward-compat regression and harness validation

Confirm the wind-up mechanic does not regress existing card combat, movement, or
checkpoint flows. Assign `windUpMs` to one additional high-impact card if balance
warrants it, and run the full test suite gates named in the parent ticket.

## Acceptance Criteria

- Cards without `windUpMs` behave identically to pre-ticket behavior: instant
  `CARD_USED`, immediate damage/effects, no commitment fields set, movement
  unaffected. Spot-check at minimum `iron_sword`, `frost_nova`, and one creature
  card in dedicated regression tests.
- Existing server `useCard` integration tests (`integration.test.js`,
  `overclock.test.js`, `key-items.test.js` echo-strike cases) still pass without
  modification to their expectations.
- Telepipe suspend/resume does not restore stale `cardUseState` /
  `pendingCardUse` from checkpoint (commitment is transient; verify cleared on
  suspend).
- `pnpm test:quick` from `game/` exits 0 (vitest server + client).
- If a second wind-up card is added for balance (e.g. `steel_claymore` with
  `windUpMs`), `getCardDef` and `card_acquisition` sync tests still pass.

## Technical Specs

- `game/shared/cardStats.json` — optionally add `windUpMs` to a second heavy
  weapon if not done in 01; keep the majority of cards without the field.
- `game/server/test/card_windup_regression.test.js` (new) — explicit instant-card
  control cases and suspend-during-windup cleanup assertion.
- No client changes unless a regression fix is required; this ticket is primarily
  test + validation hardening.
- Run `cd game && pnpm test:quick` as the harness gate.

## Verification: code
