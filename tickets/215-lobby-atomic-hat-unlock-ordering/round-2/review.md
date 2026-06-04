# Final Review: 215-lobby-atomic-hat-unlock-ordering

## Runtime health

The captured game run is healthy. `metrics.json` reports `"ok": true`, no harness failure, and an empty `pageerrors` array. `console.log` has Vite connection lines and two 409 resource responses, but no `pageerror`, uncaught exception, or `[fatal]` line from game code. Server and client logs show the game starting, two players connecting, lobby-to-run flow working, movement/key-item capture succeeding, and only benign development warnings.

## Acceptance criteria

### Persist currency before recording the unlock

Pass. The live `unlockHat` socket handler now validates ownership/account state, deducts currency in memory, calls `savePlayerData(socket.playerId)`, and only then calls `unlockHatForAccount(player.accountId, hatId)`. This changes the crash window from "hat persisted, currency not persisted" to "currency persisted, hat not persisted", which is the recoverable state requested by the ticket.

The successful path remains coherent: after the account unlock succeeds, the client receives `hatUnlocked` with the updated hat list and current currency. The extra final `savePlayerData` is redundant but not harmful because the currency was already persisted before the account write.

### Abort/refund on persistence failure

Pass. `savePlayerData` now returns `false` when the provider write throws, and the hat unlock handler refunds the in-memory currency and emits `hatError` without recording the hat. If the later account unlock fails after currency was already saved, the handler refunds and re-saves the player record, keeping disk and memory aligned for that non-crash failure case.

### Test that kills the write between steps

Pass. `server/test/hat_unlock_persistence.test.js` adds focused coverage for the write ordering, the crash-between-steps persistence state, currency-save failure, and account-unlock failure refund. The crash-window test blocks the `users.json` rename after the currency save and verifies a reload sees deducted currency without the purchased hat, preventing the original free-hat exploit.

## Design and requirements consistency

The change is server-side persistence ordering for a lobby economy action. It does not alter the documented lobby/dungeon loop, card combat, multiplayer rendering, movement synchronization, or client/server connection requirements. The round-2 screenshots and probes confirm the foundation still loads, connects two players, enters gameplay, moves, and uses a key item.

No development debug scenario was added or changed by this ticket, so the debug-scenario shortcut criteria are not applicable.

## Code quality and validation

The implementation is narrow and follows existing server patterns for player persistence, account unlocks, and socket error events. I did not find dead/broken code or an obvious integration regression in the changed files.

Validation observed in `coverage.log`: `41` test files passed, `918` tests passed. The new `server/test/hat_unlock_persistence.test.js` passed all `4` tests. Coverage on changed server code is visible, with `server/index.js` reported at `89.22%` statements / `64.65%` branches / `89.18%` functions / `89.22%` lines.

## Remaining gaps

None.

VERDICT: PASS
