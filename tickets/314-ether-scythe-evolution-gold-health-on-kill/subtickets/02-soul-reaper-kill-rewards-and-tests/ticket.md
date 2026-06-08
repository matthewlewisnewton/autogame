# Soul Reaper kill gold + health rewards

Wire cone-weapon kill bonuses so the evolved Ether Scythe (`soul_reaper`) grants a small amount of gold (`player.currency`) and HP to the wielder when its attack kills an enemy. Base `harvesting_scythe` behavior stays MS-only.

## Acceptance Criteria

- `collectConeHits` in `game/server/simulation.js` accepts optional `goldOnKill` and `healOnKill` (same kill-only semantics as `healOnKill` in `collectRadialHits`: bonus applies only when `damageEnemy` returns `killed: true`, not on hit alone).
- `collectConeHits` return value includes aggregate `goldGained` and `hpHealed` tallies (parallel to existing `magicStonesGained`).
- `game/server/cardEffects.js` weapon branch passes `goldOnKill: cardDef.goldOnKill` and `healOnKill: cardDef.healOnKill` into `collectConeHits` (and any other swing collectors used by cone weapons in that loop, if applicable).
- After weapon swings, the server applies rewards to the attacker:
  - `player.currency += goldGained` (and `player.currencyEarnedThisRun` if other direct currency grants do so in-run — follow existing patterns in `runHandlers.js` / weapon MS grants)
  - `healPlayer(socket.playerId, hpHealed)` when `hpHealed > 0`
- `SERVER_TO_CLIENT.CARD_USED` payload for weapon kills includes `goldGained` and `hpHealed` when non-zero (mirror `magicStonesGained` / `hpHealed` on spell paths).
- Killing an enemy with `soul_reaper` increases wielder `currency` by `CARD_DEFS.soul_reaper.goldOnKill` and `hp` by up to `healOnKill` (capped at `MAX_HP`).
- Hitting but not killing with `soul_reaper` grants **no** gold or heal bonus (MS-on-hit still works).
- Existing `harvesting_scythe` integration test (`Ether Scythe grants Magic Stones on hit and kill` in `integration.test.js`) still passes unchanged — base card gains only MS, never gold/HP.
- New focused server coverage proves `soul_reaper` kill rewards and base-scythe non-regression (unit test on `collectConeHits` plus socket `useCard` integration test).

## Technical Specs

- **`game/server/simulation.js`**:
  - Extend `collectConeHits` options/return with `goldOnKill`, `healOnKill`, `goldGained`, `hpHealed` (~1285–1311). Mirror the `collectRadialHits` kill-only heal pattern (~1314–1337).
  - Export remains unchanged (function already exported).
- **`game/server/cardEffects.js`**:
  - In the weapon swing loop (~338–371), pass `goldOnKill` and `healOnKill` from `cardDef` into `collectConeHits`.
  - Accumulate `goldGained` / `hpHealed` across swings; after `cleanupAfterDamage()`, apply currency and heal before emitting `CARD_USED` (~451–484).
  - Include `goldGained` and `hpHealed` in the `CARD_USED` emit when > 0.
- **`game/server/test/soul_reaper.test.js`** (new) or additions to `game/server/test/new_card_pack.test.js`:
  - Unit: `collectConeHits` with `goldOnKill`/`healOnKill` — kill grants both, hit-only grants neither.
  - Assert `CARD_DEFS.harvesting_scythe` lacks `goldOnKill` and `healOnKill`.
- **`game/server/test/integration.test.js`**:
  - Add `Soul Reaper grants gold and health on kill` case: player wields `soul_reaper`, kills a low-HP enemy, `currency` and `hp` increase by the configured amounts; MS-on-kill still applies.
  - Do **not** change the existing `harvesting_scythe` test expectations.
- Do **not** add client VFX or HUD changes — gold/HP are server-authoritative stat changes already reflected in state snapshots.
- Depends on sub-ticket `01-evolved-soul-reaper-card-data` for `soul_reaper` defs and `goldOnKill`/`healOnKill` stat values.

## Verification: code
