# Chain Lightning requires a primary hit

Fix a server bug where `collectChainLightningHits()` still runs the chain loop when no enemy is struck on the primary ray, allowing half-damage hits from the caster position. Chain Lightning must only damage enemies after a full-damage primary strike exists.

## Acceptance Criteria

- When no enemy is found along the primary cast ray within `attackRange`, `collectChainLightningHits()` returns `{ hits: [], magicStonesGained: 0 }` and does **not** enter the chain loop.
- An enemy within `chainRadius` of the caster but **outside** the primary ray is not damaged when the primary ray misses (regression test).
- Existing chain-lightning tests in `game/server/test/chain_lightning.test.js` continue to pass (full + half + half, fewer targets, range limits, distinct targets).
- `pnpm test:quick` (or the server vitest subset) passes with the new test included.

## Technical Specs

- **`game/server/simulation.js`** — in `collectChainLightningHits()` (~1239–1309):
  - After the primary-target search loop, if `primary` is still `null`, return early with empty hits before the `while (chains < maxChainTargets)` loop.
  - Do not change primary selection, chain nearest-neighbor logic, or damage amounts when a primary **is** found.
- **`game/server/test/chain_lightning.test.js`** — add a test such as `does not chain when primary ray misses`:
  - Place caster at `(0, 0)` with aim `(1, 0)`.
  - Add one enemy near the caster but off the ray (e.g. `(0, 2)` or `(1, 2)` — within `chainRadius` of origin, not intersecting the primary ray sample path).
  - Assert `result.hits` is empty and the enemy's `hp` is unchanged.
- Do **not** modify client rendering, card JSON, or other completed sub-ticket files unless a test import requires it.

## Verification: code
