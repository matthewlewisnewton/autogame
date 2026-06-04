# Full vitest suite green after balance pass

Confirm all three card rebalance sub-tickets are merged and the complete server + client test suites pass with no remaining stat drift or failures. Fix only test or data inconsistencies surfaced by the full run — no new gameplay behavior.

## Acceptance Criteria

- `game/server/progression.js` reflects all three targets together: `arcane_bolt.damage === 20`, `glacier_collapse.frozenBonusDamage === 33`, `mirror_ward.reflectRange === 11`.
- `cd game && pnpm test` exits 0 (full server + client vitest with coverage per project default).
- No edits under `game/server/simulation.js`, `game/server/cardEffects.js`, or other effect-resolution modules for this pass (data + tests only).

## Technical Specs

- Primary verification command: `cd game && pnpm test`.
- If failures appear, adjust only `game/server/progression.js` and test files already touched by sub-tickets 01–03 (`game/server/test/new_card_pack.test.js`, `game/server/test/enchantment.test.js`). Do not introduce engine changes to make tests pass.
- Optional sanity read: `game/server/test/new_card_pack.test.js` and `game/server/test/enchantment.test.js` for consistent expected values across the three cards.

## Verification: code
