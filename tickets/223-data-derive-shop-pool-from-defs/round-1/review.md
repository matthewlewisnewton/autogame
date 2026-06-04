## Runtime health

PASS. The captured run proves the game starts and loads cleanly: `metrics.json` has `"ok": true`, no `pageerrors`, and the server/client logs show successful startup and gameplay capture. The only client warning is the benign Three.js deprecation warning. The screenshots show an in-dungeon state, suspended lobby, and resumed dungeon, and the probes confirm the capture completed without browser page errors.

## Acceptance criteria

1. Add per-card acquisition data and derive `SHOP_CARD_POOL` / reward rotation from `CARD_DEFS`: PASS. `game/shared/cardDefs.json` now carries `acquisition` metadata for direct starter/reward/shop paths plus `rewardOrder` for reward cards. `game/server/config.js` derives `VICTORY_REWARD_ROTATION` from reward-tagged card definitions and builds `SHOP_CARD_POOL` from the reward rotation plus shop-only entries, preserving the previous shop behavior while making shared card definitions the source of truth.

2. Add a test asserting every card is reachable or explicitly flagged drop-only: PASS. `game/server/test/card_acquisition.test.js` checks server/shared card key parity, verifies every server card is reachable through starter/reward/shop/drop/evolution paths, rejects drop-only cards that are not actually in `ENEMY_CARD_DROPS`, and verifies tagged direct paths are directly obtainable.

3. Review the 8 previously unreachable cards before flipping: PASS. The eight named cards (`mana_prism`, `harvesting_scythe`, `deck_sifter`, `sacrificial_altar`, `battery_automaton`, `chrono_trigger`, `spike_trap`, `mirror_ward`) are all intentionally tagged as reward cards with deterministic reward order values and are asserted to appear in `VICTORY_REWARD_ROTATION`.

## Design and regression check

PASS. The change is consistent with the design document's loot/economy loop: cards are acquired through rewards, shop, drops, starter inventory, or evolution. Existing reward and shop flows in `game/server/progression.js` continue to grant cards through the same server-side validation and inventory helpers. The foundation requirements are not regressed; the captured run connected to the backend, initialized the scene, rendered the player/dungeon, and proceeded through live gameplay states.

No new or changed debug scenario was introduced by this ticket. The capture used the existing `telepipe-ready` scenario as a QA shortcut, but the changed acquisition code is exercised by normal reward/shop/drop/evolution paths and does not depend on that debug shortcut.

## Verification

`coverage.log` reports 25 test files passed, 981 tests passed. The new acquisition test file ran successfully. Coverage visibility shows all files at 87.39% statements / 87.39% lines, with thresholds disabled.

## Remaining gaps

None.

VERDICT: PASS
