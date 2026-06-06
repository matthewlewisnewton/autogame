# Apply safe card tunings

Implement only the **Tier A — safe apply** recommendations from `game/validation/card-balance/report.md` as data-only tweaks in the shared card JSON files. Update affected test assertions; leave all Tier B items as report-only recommendations.

## Acceptance Criteria

- Every Tier A recommendation in `report.md` is applied exactly (field, card id, and target value match the report) OR explicitly marked `deferred` in the report with a one-line reason if a recommendation conflicts with an existing test invariant.
- Changes are limited to **`game/shared/cardStats.json`**, **`game/shared/cardEconomy.json`**, and **`game/shared/cardDefs.json`** — no edits to `simulation.js`, `cardEffects.js`, or client effect code.
- Hardcoded stat assertions in affected tests are updated (e.g. `new_card_pack.test.js`, `fireball_card.test.js`, `ice_ball_card.test.js`, `card_sync.test.js`, card-specific tests) to match new values.
- `report.md` **Applied tunings** appendix lists each change with before → after values.
- No Tier B (operator triage) items are implemented in code.
- `cd game && pnpm test:quick` passes for server and client suites covering changed cards.

## Technical Specs

- **`game/shared/cardStats.json`**: primary target for numeric balance fields (`damage`, `magicStoneCost`, `frozenBonusDamage`, minion combat stats, enchantment damage, etc.).
- **`game/shared/cardEconomy.json`**: adjust `cardSellValues` only when the report flags mispriced sell values alongside a stat change.
- **`game/shared/cardDefs.json`**: only if a safe tuning requires `charges` or `rewardOrder` correction — otherwise leave identity untouched.
- **`game/server/test/*.test.js`** and **`game/client/test/*.test.js`**: update `toMatchObject` / literal expectations for touched cards; do not weaken assertions into vacuous checks.
- **`game/validation/card-balance/report.md`**: append **Applied tunings** section documenting what landed.
- **`game/server/progression.js`**: should require no edits (CARD_DEFS rebuilds from shared JSON); if overlay keys are implicated, stop and defer as Tier B.

## Verification: code
