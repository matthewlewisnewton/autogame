# 03 — Evolved Ether Scythe kill reward tests

With card data (sub-ticket 01) and cone kill-reward plumbing (sub-ticket 02) in place, add behavioral tests proving the evolved Reaper's Scythe grants currency + HP on kill while the base Ether Scythe remains MS-only.

## Acceptance Criteria

- Integration test (extend `game/server/test/integration.test.js` near the existing `'Ether Scythe grants Magic Stones on hit and kill'` case, or add a dedicated file) shows:
  - Using `reapers_scythe` against one killable enemy increases `player.currency` by `CARD_DEFS.reapers_scythe.currencyOnKill` and `player.hp` by `healOnKill` (capped at `MAX_HP`).
  - The `cardUsed` event payload includes `currencyGained` and `hpHealed` matching those amounts on a kill swing.
  - MS-on-hit/kill still apply for the evolved card (economy identity preserved).
- Regression test shows using `harvesting_scythe` on a kill:
  - grants Magic Stones as today (5 hit + 15 kill for the existing two-enemy layout);
  - does **not** increase `player.currency` or `player.hp`;
  - `cardUsed` payload has no positive `currencyGained` / `hpHealed`.
- `game/server/test/card_evolution.test.js` asserts `CARD_DEFS.reapers_scythe` exposes `currencyOnKill` and `healOnKill` with the conservative values from sub-ticket 01.
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- **`game/server/test/integration.test.js`**
  - Add `'Reaper\'s Scythe grants currency and HP on kill'` — mirror the scythe MS test setup: `enterScenario()`, set `player.currency = 0`, `player.hp` below max (e.g. 80), place a low-HP enemy in cone range, emit `useCard` with `reapers_scythe`, assert currency/hp/ms outcomes and enemy removed.
  - Add or extend a base-scythe case asserting `currencyGained` / `hpHealed` are absent or zero.
- **`game/server/test/card_evolution.test.js`** (if not fully covered in 01)
  - Assert evolved stat fields on `reapers_scythe`.
- **`game/client/test/cards.test.js`** (optional, only if client CARD_DEFS import breaks)
  - Add `reapers_scythe` identity smoke assertion if the client test enumerates evolved weapons.
- No production code changes unless tests reveal a bug in 01/02 — fix only what is required for tests to pass.

## Verification: code
