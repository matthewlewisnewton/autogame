# Final Review

## Runtime health

The captured run is not passable. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`. There are no browser page errors (`pageerrors.json` is empty), and the server/client logs show the game servers started and the page loaded, but the capture failed on the Telepipe preservation assertion:

> Telepipe run-preservation assertion failed: pre-suspend enemy id(s) missing after resume ... suspended objective was not captured before assertRunPreserved

This is an automatic fail under the ticket gate. The captured probes show the player reached dungeon, hub, and redeployed dungeon, but the fallback capture plan is still asserting old checkpoint/restore semantics: it expects the same enemy IDs and suspended objective to survive Telepipe. The implemented branch intentionally removed checkpoint restore and creates a fresh run while preserving player vitals, so the current round lacks clean runnable proof for the intended acceptance criteria.

## Acceptance criteria

1. **Telepipe-up preserves health and Magic Stones across hub return and redeploy.**  
   Partially met in live memory: the server transition path preserves `player.hp` and `player.magicStones` through `suspendRunToLobby()` and `checkAllReady()`, and the integration test exercises damage plus spent Magic Stones across Telepipe and redeploy. However, this is not durable "forever" persistence. `extractPersistentData()` still omits `hp`, `dead`, and `magicStones`, and `buildPlayerRecord()`/`joinPlayerToLobby()` only restore currency, inventory, deck, position, rotation, and key item. After process restart, lobby deletion/rejoin, or any cold load from the provider, HP resets to `MAX_HP` and Magic Stones reset to `STARTING_MAGIC_STONES`, violating the owner decision that player health and Magic Stones live on the player persistently.

2. **Visiting the med booth restores the player's health.**  
   The medic path exists and is covered: `MEDIC_HEAL` calls `healAtMedic()`, charges currency, sets HP to max, saves the player, and emits `medicHealed`. This criterion is met as a positive feature.

3. **Only the med booth restores health.**  
   Not met. Existing non-medic health restoration remains active:
   - `damagePlayer()` still schedules a 3-second respawn that sets `p.hp = MAX_HP` and `p.dead = false`.
   - `revivePlayerInLobby()` still raises dead or zero-HP players to `LOBBY_REVIVE_HP`.
   - `returnPlayersToLobby()`, `giveUpRun()`, and `joinPlayerToLobby()` call that lobby revive path.
   These are real gameplay paths, not debug shortcuts, so health can be restored without the hub Medic station.

4. **No fresh-run-on-redeploy / run ID no longer implies state wipe.**  
   The code intentionally uses a fresh run ID after Telepipe redeploy while preserving in-memory player vitals. That is consistent with the ticket's "no checkpoint logic" direction only if HP/MS are fully durable and no state wipe occurs for those fields. Because cold persistence still loses HP/MS, this criterion is not robustly met.

5. **Server tests cover Telepipe preservation and med booth healing.**  
   Relevant tests were added, but the round's `coverage.log` is not green: `server/test/debug-scenarios.test.js` has 1 failing test (`debugScenario - arena-trials-* > places player outside dormant boss trigger after adds cleared`). A top-level ticket should not pass with a failing changed-code test suite, especially because `game/server/debugScenarios.js` changed in this branch.

## Design and requirements consistency

The implementation does not regress the basic requirements: the captured page initializes the Three.js scene, connects via Socket.IO, shows the player, and reaches both hub and dungeon states without page errors.

`game/docs/design.md` is now stale relative to the implemented behavior and the ticket decision. It still describes Telepipe as checkpoint suspend/resume with preserved run, layout, enemies, minions, loot, hands, objective progress, and portal position. The code removes that behavior and uses fresh redeploy with durable player vitals. The design doc must be updated to the new owner decision, or future work will continue to validate the wrong behavior.

## Debug scenarios

This ticket added/changed debug scenario behavior for `telepipe-ready`, `lobby-partial-vitals`, and `hub-med-booth-ready`. The URL parameter/debug event remains the entry point; normal gameplay does not call these scenario setup branches. The shortcut end states are reachable through normal play in principle: deploying with Telepipe, returning from a damaged/spent run, and visiting the hub Medic after earning currency.

The scenarios do not bypass persistence intentionally, but the underlying persistence is incomplete for HP/MS, so the debug shortcuts can make the in-memory path look correct while the durable path remains broken. The separate failing `arena-trials-boss-approach` debug test also needs cleanup before the suite can be trusted.

## Remaining gaps

1. The captured proof is red: `metrics.json` is `"ok": false` because the round-1 fallback capture still asserts old checkpoint/enemy preservation semantics. The ticket cannot pass until the capture verifies the new durable-vitals/fresh-redeploy behavior and completes cleanly.

2. HP and Magic Stones are not persisted durably. `extractPersistentData()` does not save them, and cold player construction never restores them, so the "forever" player-state requirement fails outside the in-memory transition tested by the new integration test.

3. Health is still restored outside the med booth. Auto-respawn and lobby revive paths set HP above zero or to full without the Medic station, contradicting the explicit owner decision.

4. The coverage run failed in `server/test/debug-scenarios.test.js`, and the failure is in debug scenario behavior touched by this branch.

5. `game/docs/design.md` still documents the removed Telepipe checkpoint suspend/resume model, so the live implementation and design documentation now disagree.

VERDICT: FAIL
