# 02 — Cone weapon kill rewards (currency + HP)

`soul_drain` already grants HP via `healOnKill` through `collectRadialHits()`, but cone weapons (including Ether Scythe) use `collectConeHits()` which only tracks Magic Stones today. Extend the cone hit path so weapon swings can grant **currency** and **HP** on kill, wired through the standard weapon branch in `cardEffects.js`.

## Acceptance Criteria

- `collectConeHits()` in `game/server/simulation.js` accepts optional `healOnKill` and `currencyOnKill` from `options` (default 0).
- For each enemy killed in the cone, the helper accumulates `hpHealed += healOnKill` and `currencyGained += currencyOnKill` (no heal/currency on non-lethal hits unless `healOnHit` / `currencyOnHit` are also passed — do not add hit-tier fields unless a card needs them; evolved scythe is kill-only).
- Return value includes `{ hits, magicStonesGained, hpHealed, currencyGained }` (preserve existing callers; default new fields to 0).
- `game/server/cardEffects.js` weapon branch passes `healOnKill: cardDef.healOnKill` and `currencyOnKill: cardDef.currencyOnKill` into every `collectConeHits()` call (and aggregates totals across multi-swing weapons).
- After cone resolution, the weapon branch:
  - calls `healPlayer(socket.playerId, totalHpHealed)` when `totalHpHealed > 0`;
  - adds `totalCurrencyGained` to `player.currency` and `player.currencyEarnedThisRun` when `totalCurrencyGained > 0`;
  - includes `hpHealed` and `currencyGained` on the `SERVER_TO_CLIENT.CARD_USED` payload (mirror the spell radial pattern used by `soul_drain`).
- Cards without `healOnKill` / `currencyOnKill` stats behave exactly as before (regression-safe).
- New unit coverage in `game/server/test/` (dedicated file or `server.test.js`) proves `collectConeHits()` with `{ healOnKill: 8, currencyOnKill: 6 }` returns the expected totals when one enemy dies and zero when a hit does not kill.

## Technical Specs

- **`game/server/simulation.js`** — `collectConeHits()`:
  - Mirror the accumulation pattern from `collectRadialHits()` (~lines 1317–1337).
  - Export remains unchanged; new return fields are additive.
- **`game/server/cardEffects.js`** — weapon branch (~lines 374–497):
  - Pass kill-reward options into `collectConeHits()`.
  - Track `hpHealed` / `currencyGained` across swings alongside `magicStonesGained`.
  - Apply rewards before `cleanupAfterDamage()` / emit.
  - Currency grant follows loot pickup semantics in `game/server/socketHandlers/runHandlers.js` (`player.currency += …; player.currencyEarnedThisRun += …`).
- **`game/server/test/`** — Add focused unit test for `collectConeHits` kill rewards (minimal enemy fixture, same setup style as `new_card_pack.test.js` / existing simulation tests).
- Do **not** add or change card JSON in this sub-ticket — evolved scythe stats are sub-ticket 01; end-to-end scythe behavior tests are sub-ticket 03.

## Verification: code
