# Cleanup Arcane Bolt projectile test fixtures

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

The Arcane Bolt projectile test added in `b28ec70` works today but its boundary fixtures are fragile and the surrounding test file has stale framing. Tighten the test so it actually defends against off-by-one and `PROJECTILE_HIT_WIDTH` regressions.

## Difficulty: easy

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/test/new_card_pack.test.js:121` — Arcane Bolt projectile case. In-range enemy is placed at `x: range - 1` (well inside the sample line); out-of-range enemy at `x: range + 2`, only 0.8 units past `PROJECTILE_HIT_WIDTH` (1.2). If hit width is ever increased past 2.0 the miss assertion silently inverts.
- `game/server/test/new_card_pack.test.js:64` — `CARD_DEFS.length` asserted as 34 even though `newCardIds` (around line 50) still lists only ten cards and excludes `arcane_bolt`. The "ten new cards" framing is stale.
- `game/server/simulation.js:674, 749` — `PROJECTILE_HIT_WIDTH` and `collectProjectileHits` used by the test.

## Acceptance Criteria

- Boundary enemy placements use offsets expressed in terms of `PROJECTILE_HIT_WIDTH` (or a clearly large constant) so the miss case stays correct if the hit width changes.
- An additional in-range case exercises the far edge of the projectile path (e.g. an enemy near `x = range`) to defend against `sampleCount` off-by-ones.
- `newCardIds` (or whatever list backs the "X new cards" assertion) and the `CARD_DEFS.length` value are consistent; either `arcane_bolt` joins the list or the framing is renamed.

## Technical Specs

- Likely files: `game/server/test/new_card_pack.test.js`, plus a quick sanity check on `game/server/simulation.js` constants if any helper is introduced.
- Keep using `beforeEach(resetState)` and the existing helper signature — no need to refactor the harness.

## Verification: code
